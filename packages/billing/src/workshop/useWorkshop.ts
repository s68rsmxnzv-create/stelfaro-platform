import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { CoreDteClient, PlatformClient, type BillingCustomer, type WorkshopOrder, type WorkshopOrderPayload, type WorkshopOrderPhoto } from '@stelfaro/api-client';
import type { BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';

export function useWorkshop(coreBaseUrl: string, platformBaseUrl: string, authToken: string | null, tenantId: number, initialPerPage = 100) {
  const core = new CoreDteClient(coreBaseUrl, { authToken });
  const platform = new PlatformClient(platformBaseUrl, { credentials: 'same-origin' });
  const orders = ref<WorkshopOrder[]>([]);
  const customers = ref<BillingCustomer[]>([]);
  const empresaId = ref(0);
  const loading = ref(false);
  const customerLoading = ref(false);
  const photoLoading = ref(false);
  const photos = ref<WorkshopOrderPhoto[]>([]);
  const orderStats = ref<Record<string, number>>({});
  const orderMeta = ref({ current_page: 1, last_page: 1, per_page: 15, total: 0 });
  const error = ref<string | null>(null);
  let customerSearchTimer: ReturnType<typeof window.setTimeout> | null = null;
  let customerSearchVersion = 0;

  async function initialize() {
    loading.value = true;
    try {
      const [context, orderResult] = await Promise.all([core.billingContext(), platform.workshopOrders(tenantId, { per_page: initialPerPage })]);
      empresaId.value = context.empresas[0]?.id ?? 0;
      orders.value = orderResult.data;
      orderStats.value = orderResult.stats;
      orderMeta.value = orderResult.meta;
    } catch (reason) { error.value = reason instanceof Error ? reason.message : 'No fue posible cargar Taller.'; }
    finally { loading.value = false; }
  }
  function searchCustomers(q: string) {
    if (customerSearchTimer) window.clearTimeout(customerSearchTimer);
    const query = q.trim();
    if (!empresaId.value || query.length < 2) { customers.value = []; customerLoading.value = false; return; }
    const version = ++customerSearchVersion;
    customerLoading.value = true;
    customerSearchTimer = window.setTimeout(async () => {
      try {
        const result = await core.customers({ empresa_id: empresaId.value, q: query });
        if (version === customerSearchVersion) customers.value = result.data;
      } catch (reason) {
        if (version === customerSearchVersion) error.value = reason instanceof Error ? reason.message : 'No fue posible buscar clientes.';
      } finally {
        if (version === customerSearchVersion) customerLoading.value = false;
      }
    }, 250);
  }
  async function createOrder(payload: WorkshopOrderPayload) {
    error.value = null;
    try {
      const result = await platform.createWorkshopOrder(tenantId, payload);
      orders.value.unshift(result.data);
      return result.data;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'No fue posible registrar la recepción.';
      throw reason;
    }
  }
  async function createPhotoSession(orderId: number) {
    return (await platform.createWorkshopPhotoSession(tenantId, orderId)).data;
  }
  async function loadOrders(params: { q?: string; status?: string; priority?: string; date_from?: string; date_to?: string; page?: number; per_page?: number } = {}) {
    loading.value = true; error.value = null;
    try {
      const result = await platform.workshopOrders(tenantId, { per_page: 15, ...params });
      orders.value = result.data; orderStats.value = result.stats; orderMeta.value = result.meta;
    } catch (reason) { error.value = reason instanceof Error ? reason.message : 'No fue posible cargar las órdenes.'; }
    finally { loading.value = false; }
  }
  async function loadPhotos(orderId: number) {
    photoLoading.value = true;
    try { photos.value = (await platform.workshopOrderPhotos(tenantId, orderId)).data; }
    catch (reason) { error.value = reason instanceof Error ? reason.message : 'No fue posible cargar las fotografías.'; }
    finally { photoLoading.value = false; }
  }
  async function createCustomer(payload: BillingCustomerModalPayload) {
    if (!empresaId.value) throw new Error('No hay una empresa activa para registrar el cliente.');
    error.value = null;
    try {
      const result = await core.saveCustomer({ empresa_id: empresaId.value, ...payload, allowed_dte_codes: ['01'] });
      customers.value = [result.customer, ...customers.value.filter(customer => customer.id !== result.customer.id)];
      return result.customer;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'No fue posible registrar el cliente.';
      throw reason;
    }
  }
  async function updateOrder(id: number, payload: { status?: string; diagnosis?: string | null; estimated_total?: number | null; approval_decision?: 'approved' | 'rejected'; approval_method?: 'whatsapp' | 'call' | 'in_person'; approval_notes?: string | null }) {
    error.value = null;
    try {
      const result = await platform.updateWorkshopOrder(tenantId, id, payload);
      const index = orders.value.findIndex((order) => order.id === id);
      if (index >= 0) orders.value[index] = result.data;
      return result.data;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'No fue posible actualizar la orden.';
      throw reason;
    }
  }
  onMounted(initialize);
  onBeforeUnmount(() => { if (customerSearchTimer) window.clearTimeout(customerSearchTimer); });
  return { orders, customers, photos, orderStats, orderMeta, loading, customerLoading, photoLoading, error, openOrders: computed(() => orders.value.filter((o) => !['delivered', 'cancelled'].includes(o.status))), searchCustomers, createCustomer, createOrder, createPhotoSession, loadOrders, loadPhotos, updateOrder };
}
