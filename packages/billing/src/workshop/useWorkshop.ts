import { computed, onMounted, ref } from 'vue';
import { CoreDteClient, PlatformClient, type BillingCustomer, type WorkshopOrder, type WorkshopOrderPayload } from '@stelfaro/api-client';

export function useWorkshop(coreBaseUrl: string, platformBaseUrl: string, authToken: string | null, tenantId: number) {
  const core = new CoreDteClient(coreBaseUrl, { authToken });
  const platform = new PlatformClient(platformBaseUrl, { credentials: 'same-origin' });
  const orders = ref<WorkshopOrder[]>([]);
  const customers = ref<BillingCustomer[]>([]);
  const empresaId = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function initialize() {
    loading.value = true;
    try {
      const [context, orderResult] = await Promise.all([core.billingContext(), platform.workshopOrders(tenantId)]);
      empresaId.value = context.empresas[0]?.id ?? 0;
      orders.value = orderResult.data;
    } catch (reason) { error.value = reason instanceof Error ? reason.message : 'No fue posible cargar Taller.'; }
    finally { loading.value = false; }
  }
  async function searchCustomers(q: string) {
    if (!empresaId.value || q.trim().length < 2) { customers.value = []; return; }
    customers.value = (await core.customers({ empresa_id: empresaId.value, q })).data;
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
  return { orders, customers, loading, error, openOrders: computed(() => orders.value.filter((o) => !['delivered', 'cancelled'].includes(o.status))), searchCustomers, createOrder, updateOrder };
}
