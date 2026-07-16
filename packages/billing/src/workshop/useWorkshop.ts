import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { CoreDteClient, PlatformClient, type BillingCustomer, type WorkshopOrder, type WorkshopOrderPayload } from '@stelfaro/api-client';
import type { BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';

export function useWorkshop(coreBaseUrl: string, platformBaseUrl: string, authToken: string | null, tenantId: number) {
  const core = new CoreDteClient(coreBaseUrl, { authToken });
  const platform = new PlatformClient(platformBaseUrl, { credentials: 'same-origin' });
  const orders = ref<WorkshopOrder[]>([]);
  const customers = ref<BillingCustomer[]>([]);
  const empresaId = ref(0);
  const loading = ref(false);
  const customerLoading = ref(false);
  const error = ref<string | null>(null);
  let customerSearchTimer: ReturnType<typeof window.setTimeout> | null = null;
  let customerSearchVersion = 0;

  async function initialize() {
    loading.value = true;
    try {
      const [context, orderResult] = await Promise.all([core.billingContext(), platform.workshopOrders(tenantId)]);
      empresaId.value = context.empresas[0]?.id ?? 0;
      orders.value = orderResult.data;
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
  async function updateOrder(id: number, payload: { status?: string; diagnosis?: string | null; estimated_total?: number | null }) {
    error.value = null;
    try {
      const result = await platform.updateWorkshopOrder(tenantId, id, payload);
      const index = orders.value.findIndex((order) => order.id === id);
      if (index >= 0) orders.value[index] = result.data;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'No fue posible actualizar la orden.';
    }
  }
  onMounted(initialize);
  onBeforeUnmount(() => { if (customerSearchTimer) window.clearTimeout(customerSearchTimer); });
  return { orders, customers, loading, customerLoading, error, openOrders: computed(() => orders.value.filter((o) => !['delivered', 'cancelled'].includes(o.status))), searchCustomers, createCustomer, createOrder, updateOrder };
}
