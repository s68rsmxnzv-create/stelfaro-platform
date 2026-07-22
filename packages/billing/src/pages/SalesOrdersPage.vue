<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, PlatformClient } from '@stelfaro/api-client';
import { UiActionDropdown, UiActionMenuItem, UiButton, UiInput, UiLoadingMark, UiSearchInput, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import { Banknote, FileText, PackageCheck, Plus, ReceiptText, Trash2, UserPlus } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import BillingCustomerModal from '../components/BillingCustomerModal.vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingModalShell from '../components/BillingModalShell.vue';

const props = withDefaults(defineProps<{
  platformBaseUrl?: string;
  coreBaseUrl?: string;
  authToken?: string | null;
  tenantId: number;
  company?: Record<string, any> | null;
}>(), { platformBaseUrl: '/api/v1', coreBaseUrl: '/api/v1', authToken: null, company: null });

const platform = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const core = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken || undefined }));
const orders = ref([]);
const stats = ref({ open: 0, receivable: 0 });
const meta = ref({ current_page: 1, last_page: 1, total: 0 });
const loading = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const customerModalOpen = ref(false);
const deliveryOrder = ref(null);
const paymentOrder = ref(null);
const billingOrder = ref(null);
const customerQuery = ref('');
const customerResults = ref([]);
const customerLoading = ref(false);
const selectedCustomer = ref(null);
const itemQuery = ref('');
const itemResults = ref([]);
const itemLoading = ref(false);
const toasts = ref([]);
const initialParams = new URLSearchParams(window.location.search);
const filters = reactive({ q: initialParams.get('q') || '', status: initialParams.get('status') || '', payment_status: initialParams.get('payment_status') || '', page: 1 });
const orderForm = reactive({ branch_id: '', notes: '', lines: [] });
const deliveryForm = reactive({ amount_received: 0, method: 'cash', reference: '', document_choice: 'order', dte_type: '01' });
const paymentForm = reactive({ amount: 0, method: 'cash', reference: '', notes: '' });
let searchTimer;
let customerTimer;
let itemTimer;

const statusOptions = [
  { value: '', label: 'Todos los estados' }, { value: 'open', label: 'Pendientes de entrega' },
  { value: 'delivered', label: 'Entregadas' }, { value: 'cancelled', label: 'Canceladas' }
];
const paymentOptions = [
  { value: '', label: 'Todos los pagos' }, { value: 'receivable', label: 'Con saldo pendiente' }, { value: 'paid', label: 'Pagadas' }
];
const methodOptions = [
  { value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' }, { value: 'other', label: 'Otro' }
];
const documentOptions = [{ value: 'order', label: 'Cerrar con orden comercial' }, { value: 'dte', label: 'Emitir DTE' }];
const dteOptions = [{ value: '01', label: 'Factura electrónica' }, { value: '03', label: 'Crédito fiscal' }];
const branchOptions = computed(() => (props.company?.sucursales || []).map((branch) => ({ value: String(branch.id), label: `${branch.codigo} · ${branch.nombre}` })));
const orderTotal = computed(() => orderForm.lines.reduce((sum, line) => sum + lineTotal(line), 0));
const canCreate = computed(() => selectedCustomer.value && orderForm.lines.length > 0 && orderForm.lines.every((line) => Number(line.quantity) > 0 && Number(line.unit_price) >= 0));

watch(() => filters.q, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { filters.page = 1; loadOrders(); }, 250);
});
watch(() => [filters.status, filters.payment_status], () => { filters.page = 1; loadOrders(); });
watch(customerQuery, () => {
  clearTimeout(customerTimer);
  if (selectedCustomer.value || customerQuery.value.trim().length < 2) { customerResults.value = []; return; }
  customerTimer = setTimeout(searchCustomers, 250);
});
watch(itemQuery, () => {
  clearTimeout(itemTimer);
  if (itemQuery.value.trim().length < 2) { itemResults.value = []; return; }
  itemTimer = setTimeout(searchItems, 250);
});
onMounted(loadOrders);
onBeforeUnmount(() => { clearTimeout(searchTimer); clearTimeout(customerTimer); clearTimeout(itemTimer); });

async function loadOrders() {
  if (!props.tenantId) return;
  loading.value = true;
  try {
    const response = await platform.value.salesOrders(props.tenantId, { q: filters.q || undefined, status: filters.status || undefined, payment_status: filters.payment_status || undefined, page: filters.page, per_page: 20 });
    orders.value = response.data; stats.value = response.stats; meta.value = response.meta;
  } catch (error) { notify('No se pudieron cargar las órdenes', errorMessage(error), 'error'); }
  finally { loading.value = false; }
}

function openCreate() {
  selectedCustomer.value = null; customerQuery.value = ''; itemQuery.value = ''; itemResults.value = [];
  orderForm.branch_id = branchOptions.value[0]?.value || ''; orderForm.notes = ''; orderForm.lines = [];
  createOpen.value = true;
}

async function searchCustomers() {
  if (!props.company?.id) return;
  customerLoading.value = true;
  try { customerResults.value = (await core.value.customers({ empresa_id: props.company.id, q: customerQuery.value.trim(), per_page: 8 })).data; }
  catch (error) { notify('No se pudo buscar clientes', errorMessage(error), 'error'); }
  finally { customerLoading.value = false; }
}

function chooseCustomer(customer) { selectedCustomer.value = customer; customerQuery.value = customer.name; customerResults.value = []; }
function clearCustomer() { selectedCustomer.value = null; customerQuery.value = ''; }

async function createCustomer(payload) {
  saving.value = true;
  try {
    const response = await core.value.saveCustomer({ empresa_id: props.company.id, ...payload });
    chooseCustomer(response.customer); customerModalOpen.value = false; notify('Cliente creado', 'Ya está seleccionado en la orden.', 'success');
  } catch (error) { notify('No se pudo crear el cliente', errorMessage(error), 'error'); }
  finally { saving.value = false; }
}

async function searchItems() {
  itemLoading.value = true;
  try { itemResults.value = (await platform.value.catalogItems(props.tenantId, { q: itemQuery.value.trim(), status: 'active', per_page: 10 })).data; }
  catch (error) { notify('No se pudo buscar el catálogo', errorMessage(error), 'error'); }
  finally { itemLoading.value = false; }
}

function addItem(item) {
  const existing = orderForm.lines.find((line) => line.catalog_item_id === item.id);
  if (existing) existing.quantity = Number(existing.quantity) + 1;
  else orderForm.lines.push({ catalog_item_id: item.id, description: item.name, quantity: 1, unit_price: Number(item.base_price || 0), discount_amount: 0, controls_inventory: item.controls_inventory });
  itemQuery.value = ''; itemResults.value = [];
}

function addFreeLine() { orderForm.lines.push({ catalog_item_id: null, description: '', quantity: 1, unit_price: 0, discount_amount: 0, controls_inventory: false }); }
function lineTotal(line) { return Math.max(0, Number(line.quantity || 0) * Number(line.unit_price || 0) - Number(line.discount_amount || 0)); }

async function createOrder() {
  if (!canCreate.value) return;
  saving.value = true;
  try {
    const branch = (props.company?.sucursales || []).find((entry) => String(entry.id) === String(orderForm.branch_id));
    await platform.value.createSalesOrder(props.tenantId, {
      idempotency_key: uuid(), core_sucursal_id: branch?.id || null, core_sucursal_code: branch?.codigo || null, core_sucursal_name: branch?.nombre || null,
      customer: { core_customer_id: selectedCustomer.value.id, name: selectedCustomer.value.name, phone: selectedCustomer.value.phone, email: selectedCustomer.value.email },
      notes: orderForm.notes || null,
      lines: orderForm.lines.map(({ catalog_item_id, description, quantity, unit_price, discount_amount }) => ({ catalog_item_id, description, quantity: Number(quantity), unit_price: Number(unit_price), discount_amount: Number(discount_amount || 0) }))
    });
    createOpen.value = false; notify('Orden creada', 'Quedó lista para entregar cuando corresponda.', 'success'); await loadOrders();
  } catch (error) { notify('No se pudo crear la orden', errorMessage(error), 'error'); }
  finally { saving.value = false; }
}

function openDelivery(order) {
  deliveryOrder.value = order; deliveryForm.amount_received = order.total; deliveryForm.method = 'cash'; deliveryForm.reference = '';
  deliveryForm.document_choice = 'order'; deliveryForm.dte_type = '01';
}

async function deliver() {
  saving.value = true;
  try {
    const response = await platform.value.deliverSalesOrder(props.tenantId, deliveryOrder.value.id, { amount_received: Number(deliveryForm.amount_received || 0), method: Number(deliveryForm.amount_received) > 0 ? deliveryForm.method : undefined, reference: deliveryForm.reference || null, document_choice: deliveryForm.document_choice, dte_type: deliveryForm.document_choice === 'dte' ? deliveryForm.dte_type : undefined });
    deliveryOrder.value = null; notify('Entrega registrada', response.data.balance > 0 ? `Quedó un saldo de ${money(response.data.balance)}.` : 'La orden quedó pagada.', 'success');
    await loadOrders();
    if (deliveryForm.document_choice === 'dte') goToBilling(response.data, deliveryForm.dte_type);
  } catch (error) { notify('No se pudo entregar', errorMessage(error), 'error'); }
  finally { saving.value = false; }
}

function openPayment(order) { paymentOrder.value = order; paymentForm.amount = order.balance; paymentForm.method = 'cash'; paymentForm.reference = ''; paymentForm.notes = ''; }
async function pay() {
  saving.value = true;
  try {
    const response = await platform.value.recordSalesOrderPayment(props.tenantId, paymentOrder.value.id, { idempotency_key: uuid(), amount: Number(paymentForm.amount), method: paymentForm.method, reference: paymentForm.reference || null, notes: paymentForm.notes || null });
    paymentOrder.value = null; notify('Pago registrado', response.data.balance > 0 ? `Saldo pendiente: ${money(response.data.balance)}.` : 'La cuenta quedó saldada.', 'success'); await loadOrders();
  } catch (error) { notify('No se pudo registrar el pago', errorMessage(error), 'error'); }
  finally { saving.value = false; }
}

async function cancelOrder(order) {
  if (!window.confirm(`¿Cancelar ${order.number}?`)) return;
  try { await platform.value.cancelSalesOrder(props.tenantId, order.id); notify('Orden cancelada', null, 'success'); await loadOrders(); }
  catch (error) { notify('No se pudo cancelar', errorMessage(error), 'error'); }
}

function goToBilling(order, type = null) {
  const dteType = type || order.billing.dte_type || '01';
  window.location.href = `/facturacion/${dteType === '03' ? 'ccf' : 'fe'}?sales_order=${order.id}`;
}
function statusLabel(order) { return order.status === 'open' ? 'Pendiente' : order.status === 'delivered' ? 'Entregada' : 'Cancelada'; }
function statusTone(order) { return order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'warning'; }
function money(value) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(Number(value || 0)); }
function uuid() { return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function notify(title, message = null, variant = 'info') { const id = uuid(); toasts.value.push({ id, title, message, variant }); setTimeout(() => { toasts.value = toasts.value.filter((toast) => toast.id !== id); }, 4300); }
function errorMessage(error) { return error?.message || 'Revisá los datos e intentá nuevamente.'; }
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />
    <div class="rounded-md border border-slate-200 bg-white p-6 shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:text-text dark:shadow-none">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-950 dark:text-text">Órdenes de venta</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-muted">Entregá productos, registrá pagos y facturá cuando el cliente lo solicite.</p>
        </div>
        <UiButton @click="openCreate"><Plus class="mr-2 h-4 w-4" />Nueva orden</UiButton>
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2">
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Por entregar</p><p class="mt-1 text-2xl font-bold">{{ stats.open }}</p></div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Con saldo</p><p class="mt-1 text-2xl font-bold">{{ stats.receivable }}</p></div>
      </div>
    </div>

    <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
      <div class="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
        <UiSearchInput v-model="filters.q" label="Buscar órdenes" placeholder="Orden, cliente, teléfono o artículo" @search="loadOrders" />
        <UiSelect v-model="filters.status" label="Estado" :options="statusOptions" />
        <UiSelect v-model="filters.payment_status" label="Pago" :options="paymentOptions" />
        <div class="flex items-end"><UiButton variant="secondary" @click="loadOrders">Actualizar</UiButton></div>
      </div>
    </div>

    <div class="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-line dark:bg-surface">
      <UiLoadingMark v-if="loading" class="p-10" label="Cargando órdenes" />
      <p v-else-if="orders.length === 0" class="p-10 text-center text-sm text-slate-500 dark:text-muted">No hay órdenes con estos filtros.</p>
      <div v-else class="divide-y divide-slate-100 dark:divide-line">
        <article v-for="order in orders" :key="order.id" class="grid gap-4 p-5 transition hover:bg-sky-50/60 dark:hover:bg-surface-muted lg:grid-cols-[130px_1fr_150px_160px_56px] lg:items-center">
          <div><p class="font-bold text-slate-950 dark:text-text">{{ order.number }}</p><p class="text-xs text-slate-500 dark:text-muted">{{ new Date(order.created_at).toLocaleDateString('es-SV') }}</p></div>
          <div class="min-w-0"><p class="truncate font-semibold text-slate-900 dark:text-text">{{ order.customer.name }}</p><p class="truncate text-sm text-slate-500 dark:text-muted">{{ order.lines.map(line => line.description).join(' · ') }}</p></div>
          <div><UiStatusBadge :tone="statusTone(order)">{{ statusLabel(order) }}</UiStatusBadge><UiStatusBadge v-if="order.balance > 0" class="ml-2" tone="warning">Debe {{ money(order.balance) }}</UiStatusBadge></div>
          <div class="lg:text-right"><p class="font-bold text-slate-950 dark:text-text">{{ money(order.total) }}</p><p class="text-xs text-slate-500 dark:text-muted">Pagado {{ money(order.paid_total) }}</p></div>
          <UiActionDropdown>
            <UiActionMenuItem v-if="order.status === 'open'" @select="openDelivery(order)"><template #icon><PackageCheck class="h-4 w-4" /></template>Entregar y cobrar</UiActionMenuItem>
            <UiActionMenuItem v-if="order.status === 'delivered' && order.balance > 0" @select="openPayment(order)"><template #icon><Banknote class="h-4 w-4" /></template>Registrar pago</UiActionMenuItem>
            <UiActionMenuItem v-if="order.status === 'delivered' && order.billing.status !== 'invoiced'" @select="billingOrder = order"><template #icon><FileText class="h-4 w-4" /></template>Emitir DTE</UiActionMenuItem>
            <UiActionMenuItem v-if="order.status === 'open'" tone="danger" separated @select="cancelOrder(order)"><template #icon><Trash2 class="h-4 w-4" /></template>Cancelar orden</UiActionMenuItem>
          </UiActionDropdown>
        </article>
      </div>
      <div v-if="meta.last_page > 1" class="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-line">
        <UiButton variant="secondary" size="sm" :disabled="meta.current_page <= 1" @click="filters.page--; loadOrders()">Anterior</UiButton>
        <span class="text-sm text-slate-500 dark:text-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
        <UiButton variant="secondary" size="sm" :disabled="meta.current_page >= meta.last_page" @click="filters.page++; loadOrders()">Siguiente</UiButton>
      </div>
    </div>

    <BillingModalShell :open="createOpen" title="Nueva orden de venta" description="Una sola orden puede incluir varios productos o repuestos." max-width="max-w-5xl" panel-class="max-h-[94vh] overflow-hidden" body-class="space-y-5 overflow-y-auto px-5 py-5" @close="createOpen = false">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="relative">
          <div class="flex items-end gap-2"><UiSearchInput v-model="customerQuery" class="flex-1" label="Cliente" placeholder="Nombre, documento o teléfono" /><UiButton v-if="selectedCustomer" variant="danger" icon-only aria-label="Quitar cliente" @click="clearCustomer"><Trash2 class="h-5 w-5" /></UiButton><UiButton variant="secondary" icon-only aria-label="Nuevo cliente" @click="customerModalOpen = true"><UserPlus class="h-5 w-5" /></UiButton></div>
          <div v-if="!selectedCustomer && (customerResults.length || customerLoading)" class="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white p-1 shadow-xl dark:border-line dark:bg-surface-raised">
            <p v-if="customerLoading" class="px-3 py-2 text-sm text-slate-500">Buscando…</p>
            <button v-for="customer in customerResults" :key="customer.id" type="button" class="block w-full rounded-md px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-surface-muted" @click="chooseCustomer(customer)"><span class="block font-semibold">{{ customer.name }}</span><span class="text-xs text-slate-500 dark:text-muted">{{ customer.document_number || customer.phone || 'Sin documento' }}</span></button>
          </div>
        </div>
        <UiSelect v-model="orderForm.branch_id" label="Sucursal" :options="branchOptions" />
      </div>
      <div class="relative"><UiSearchInput v-model="itemQuery" label="Agregar del catálogo" placeholder="Producto, repuesto o código" />
        <div v-if="itemResults.length || itemLoading" class="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white p-1 shadow-xl dark:border-line dark:bg-surface-raised"><p v-if="itemLoading" class="px-3 py-2 text-sm text-slate-500">Buscando…</p><button v-for="item in itemResults" :key="item.id" type="button" class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-surface-muted" @click="addItem(item)"><span><span class="block font-semibold">{{ item.name }}</span><span class="text-xs text-slate-500 dark:text-muted">{{ item.controls_inventory ? `Inventario: ${item.stock_quantity}` : 'Catálogo' }}</span></span><strong>{{ money(item.base_price) }}</strong></button></div>
      </div>
      <div class="space-y-3">
        <div v-for="(line, index) in orderForm.lines" :key="index" class="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-line md:grid-cols-[1fr_110px_140px_140px_42px] md:items-end">
          <UiInput v-model="line.description" label="Descripción" :readonly="Boolean(line.catalog_item_id)" />
          <UiInput v-model.number="line.quantity" type="number" min="0.001" step="0.001" label="Cantidad" />
          <UiInput v-model.number="line.unit_price" type="number" min="0" step="0.01" label="Precio" />
          <UiInput v-model.number="line.discount_amount" type="number" min="0" step="0.01" label="Descuento" />
          <UiButton variant="danger" icon-only aria-label="Quitar línea" @click="orderForm.lines.splice(index, 1)"><Trash2 class="h-4 w-4" /></UiButton>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3"><UiButton variant="secondary" size="sm" @click="addFreeLine"><Plus class="mr-2 h-4 w-4" />Descripción libre</UiButton><p class="text-xl font-bold text-slate-950 dark:text-text">Total {{ money(orderTotal) }}</p></div>
      </div>
      <UiTextarea v-model="orderForm.notes" label="Nota (opcional)" :rows="2" />
      <template #footer><UiButton variant="secondary" @click="createOpen = false">Cancelar</UiButton><UiButton :disabled="!canCreate || saving" @click="createOrder">Crear orden</UiButton></template>
    </BillingModalShell>

    <BillingModalShell :open="Boolean(deliveryOrder)" title="Entregar orden" :description="deliveryOrder ? `${deliveryOrder.number} · ${money(deliveryOrder.total)}` : ''" @close="deliveryOrder = null">
      <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model.number="deliveryForm.amount_received" type="number" min="0" :max="deliveryOrder?.total" step="0.01" label="Pago recibido ahora" /><UiSelect v-if="Number(deliveryForm.amount_received) > 0" v-model="deliveryForm.method" label="Forma de pago" :options="methodOptions" /></div>
      <UiInput v-if="Number(deliveryForm.amount_received) > 0 && deliveryForm.method !== 'cash'" v-model="deliveryForm.reference" class="mt-4" label="Referencia (opcional)" />
      <div class="mt-4 grid gap-4 sm:grid-cols-2"><UiSelect v-model="deliveryForm.document_choice" label="Comprobante" :options="documentOptions" /><UiSelect v-if="deliveryForm.document_choice === 'dte'" v-model="deliveryForm.dte_type" label="Tipo de DTE" :options="dteOptions" /></div>
      <p v-if="deliveryOrder && Number(deliveryForm.amount_received) < deliveryOrder.total" class="mt-4 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:bg-warning-soft dark:text-warning">Saldo por cobrar: {{ money(deliveryOrder.total - Number(deliveryForm.amount_received || 0)) }}</p>
      <template #footer><UiButton variant="secondary" @click="deliveryOrder = null">Volver</UiButton><UiButton :disabled="saving" @click="deliver">Confirmar entrega</UiButton></template>
    </BillingModalShell>

    <BillingModalShell :open="Boolean(paymentOrder)" title="Registrar pago" :description="paymentOrder ? `${paymentOrder.number} · Saldo ${money(paymentOrder.balance)}` : ''" @close="paymentOrder = null">
      <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model.number="paymentForm.amount" type="number" min="0.01" :max="paymentOrder?.balance" step="0.01" label="Monto recibido" /><UiSelect v-model="paymentForm.method" label="Forma de pago" :options="methodOptions" /></div><UiInput v-model="paymentForm.reference" class="mt-4" label="Referencia (opcional)" /><UiTextarea v-model="paymentForm.notes" class="mt-4" label="Nota (opcional)" :rows="2" />
      <template #footer><UiButton variant="secondary" @click="paymentOrder = null">Cancelar</UiButton><UiButton :disabled="saving || paymentForm.amount <= 0 || paymentForm.amount > paymentOrder?.balance" @click="pay">Guardar pago</UiButton></template>
    </BillingModalShell>

    <BillingModalShell :open="Boolean(billingOrder)" title="Emitir DTE" description="Elegí el comprobante que necesita el cliente." @close="billingOrder = null"><div class="grid gap-3 sm:grid-cols-2"><button type="button" class="rounded-xl border border-slate-200 p-5 text-left transition hover:border-sky-400 hover:bg-sky-50 dark:border-line dark:hover:bg-primary-soft" @click="goToBilling(billingOrder, '01')"><ReceiptText class="h-6 w-6 text-sky-600" /><strong class="mt-3 block">Factura electrónica</strong><span class="text-sm text-slate-500 dark:text-muted">Consumidor final</span></button><button type="button" class="rounded-xl border border-slate-200 p-5 text-left transition hover:border-sky-400 hover:bg-sky-50 dark:border-line dark:hover:bg-primary-soft" @click="goToBilling(billingOrder, '03')"><FileText class="h-6 w-6 text-sky-600" /><strong class="mt-3 block">Crédito fiscal</strong><span class="text-sm text-slate-500 dark:text-muted">Cliente contribuyente</span></button></div></BillingModalShell>

    <BillingCustomerModal :open="customerModalOpen" mode="quick" :loading="saving" @close="customerModalOpen = false" @save="createCustomer" />
  </section>
</template>
