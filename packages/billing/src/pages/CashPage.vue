<script setup lang="ts">
import { PlatformClient, type BillingEmpresa, type PlatformCashHistory, type PlatformCashOverview, type PlatformInventoryPurchase, type PlatformInventorySupplier, type WorkshopOrder } from '@stelfaro/api-client';
import { UiButton, UiCard, UiInput, UiModalShell, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays, CalendarRange, LockKeyhole, Plus, RefreshCw } from 'lucide-vue-next';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import CommercialSalesReportPanel from '../reports/CommercialSalesReportPanel.vue';

const props = withDefaults(defineProps<{ platformBaseUrl?: string; authToken?: string|null; tenantId: number; workshopEnabled?: boolean; company?: BillingEmpresa|null; fiscalRole?: string|null }>(), { platformBaseUrl: '/api/v1', authToken: null, workshopEnabled: false, company: null, fiscalRole: null });
const client = computed(() => new PlatformClient(props.platformBaseUrl, { authToken: props.authToken }));
const tab = ref<'cash'|'sales'|'history'>('cash'); const loading = ref(false); const overview = ref<PlatformCashOverview|null>(null); const toasts = ref<any[]>([]);
const history = ref<PlatformCashHistory|null>(null); const historyPage = ref(1); const historyFilters = reactive({ date_from: '', date_to: '' });
const reportPanel = ref<InstanceType<typeof CommercialSalesReportPanel>|null>(null);
const selectedRegisterId = ref('');
const modal = ref<'open'|'movement'|'close'|'confirm-close'|'reconcile'|null>(null); const suppliers = ref<PlatformInventorySupplier[]>([]); const orders = ref<WorkshopOrder[]>([]); const purchases = ref<PlatformInventoryPurchase[]>([]); const reconcilingExpenseId = ref<number|null>(null); const selectedPurchaseId = ref('');
const closeTargetId = ref<number|null>(null);
const openForm = reactive({ opening_balance: 0, name: 'Caja principal', notes: '' });
const movementForm = reactive({ direction: 'out', kind: 'supplier_purchase', method: 'cash', amount: 0, description: '', reference: '', supplier_id: '', workshop_order_id: '', expense_category: 'replacement', destination: 'direct_order' });
const closeForm = reactive({ declared_balance: 0, notes: '' });
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value || 0);
const dateTime = (value: string) => new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const balance = computed(() => overview.value?.active_session?.expected ?? 0);
const closingExpected = computed(() => closeTargetId.value ? (overview.value?.pending_counts.find(item => item.id === closeTargetId.value)?.expected ?? overview.value?.active_session?.expected ?? 0) : balance.value);
const closingDifference = computed(() => Number(closeForm.declared_balance || 0) - closingExpected.value);
const methodOptions = [{ value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' }, { value: 'transfer', label: 'Transferencia' }, { value: 'other', label: 'Otro' }];
const supplierOptions = computed(() => [{ value: '', label: 'Sin proveedor registrado' }, ...suppliers.value.map(item => ({ value: String(item.id), label: item.name }))]);
const orderOptions = computed(() => [{ value: '', label: 'No asociar a una orden' }, ...orders.value.map(item => ({ value: String(item.id), label: `${item.ticket} · ${item.customer.name} · ${item.device.brand} ${item.device.model}` }))]);
const categoryOptions = [{ value: 'replacement', label: 'Repuesto' }, { value: 'tool', label: 'Herramienta' }, { value: 'service', label: 'Servicio' }, { value: 'transport', label: 'Transporte' }, { value: 'general', label: 'Gasto general' }];
const destinationOptions = [{ value: 'direct_order', label: 'Uso directo en orden' }, { value: 'inventory', label: 'Ingresará a inventario' }, { value: 'expense', label: 'Gasto operativo' }];
const purchaseOptions = computed(() => [{ value: '', label: 'Selecciona la compra importada' }, ...purchases.value.map(item => ({ value: String(item.id), label: `${item.document_number || `Compra #${item.purchase_number}`} · ${money(Number(item.total))} · ${item.supplier?.name || 'Proveedor'}` }))]);
const registerOptions = computed(() => (overview.value?.registers || []).map(register => ({ value: String(register.id), label: `${register.branch_code ? `${register.branch_code} · ` : ''}${register.branch_name || register.name}` })));
const selectedRegister = computed(() => overview.value?.registers.find(register => String(register.id) === selectedRegisterId.value) ?? null);

function notify(title: string, message = '', variant = 'success') { const id = `${Date.now()}-${Math.random()}`; toasts.value.push({ id, title, message, variant }); window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4300); }
function errorMessage(error: any) { return error?.response?.message || error?.message || 'Revisa los datos e intenta nuevamente.'; }
async function loadCash() { loading.value = true; try { let result = await client.value.cashOverview(props.tenantId, selectedRegisterId.value ? { cash_register_id: Number(selectedRegisterId.value) } : {}); if (!selectedRegisterId.value && result.registers[0]) { selectedRegisterId.value=String(result.registers[0].id); result=await client.value.cashOverview(props.tenantId, { cash_register_id:Number(selectedRegisterId.value) }); } overview.value = result; } catch (error) { notify('No pudimos cargar Caja', errorMessage(error), 'error'); } finally { loading.value = false; } }
async function loadRelations() { try { suppliers.value = (await client.value.inventorySuppliers(props.tenantId, { status: 'active', per_page: 100 })).data; purchases.value = (await client.value.inventoryPurchases(props.tenantId, { per_page: 100 })).data; if (props.workshopEnabled) orders.value = (await client.value.workshopOrders(props.tenantId, { per_page: 100 })).data; } catch { /* Los selectores pueden seguir vacíos. */ } }
async function openSession() { loading.value = true; try { await client.value.openCashSession(props.tenantId, { ...openForm, cash_register_id: selectedRegisterId.value ? Number(selectedRegisterId.value) : undefined }); modal.value = null; notify('Caja abierta', 'Ya puedes registrar cobros y salidas en efectivo.'); await loadCash(); } catch (error) { notify('No se pudo abrir', errorMessage(error), 'error'); } finally { loading.value = false; } }
async function closeSession() { const sessionId=closeTargetId.value || overview.value?.active_session?.id; if (!sessionId) return; loading.value = true; try { const response = await client.value.closeCashSession(props.tenantId, sessionId, closeForm); modal.value = null; closeTargetId.value=null; notify('Caja cerrada', response.data.difference === 0 ? 'El efectivo quedó cuadrado.' : `Diferencia registrada: ${money(response.data.difference || 0)}.`, response.data.difference === 0 ? 'success' : 'warning'); await loadCash(); } catch (error) { notify('No se pudo cerrar', errorMessage(error), 'error'); } finally { loading.value = false; } }
function openCount(session:any) { closeTargetId.value=session.id; closeForm.declared_balance=session.expected; modal.value='close'; }
async function saveMovement() { loading.value = true; try { await client.value.createCashMovement(props.tenantId, { ...movementForm, cash_register_id: selectedRegisterId.value ? Number(selectedRegisterId.value) : null, supplier_id: movementForm.supplier_id || null, workshop_order_id: movementForm.workshop_order_id || null, idempotency_key: crypto.randomUUID?.() || `${Date.now()}` }); modal.value = null; notify(movementForm.direction === 'out' ? 'Salida registrada' : 'Ingreso registrado', movementForm.workshop_order_id ? 'El movimiento quedó relacionado con la orden.' : 'Caja fue actualizada.'); Object.assign(movementForm, { direction: 'out', kind: 'supplier_purchase', method: 'cash', amount: 0, description: '', reference: '', supplier_id: '', workshop_order_id: '', expense_category: 'replacement', destination: 'direct_order' }); await loadCash(); } catch (error) { notify('No se pudo registrar', errorMessage(error), 'error'); } finally { loading.value = false; } }
function newMovement(direction: 'in'|'out') { movementForm.direction = direction; movementForm.kind = direction === 'in' ? 'manual_income' : 'supplier_purchase'; modal.value = 'movement'; }
function openReconcile(expenseId: number) { reconcilingExpenseId.value = expenseId; selectedPurchaseId.value = ''; modal.value = 'reconcile'; }
async function reconcileExpense() { if (!reconcilingExpenseId.value || !selectedPurchaseId.value) return; loading.value = true; try { const result = await client.value.reconcileCashExpense(props.tenantId, reconcilingExpenseId.value, Number(selectedPurchaseId.value)); modal.value = null; notify(result.data.status === 'reconciled' ? 'Compra asociada' : 'Monto por revisar', result.data.difference === 0 ? 'El comprobante quedó asociado al gasto.' : `Hay una diferencia de ${money(Math.abs(result.data.difference))}.`, result.data.difference === 0 ? 'success' : 'warning'); await Promise.all([loadCash(), loadRelations()]); } catch (error) { notify('No se pudo asociar la compra', errorMessage(error), 'error'); } finally { loading.value = false; } }
async function loadHistory() {
  loading.value = true;
  try {
    history.value = await client.value.cashHistory(props.tenantId, {
      cash_register_id: selectedRegisterId.value ? Number(selectedRegisterId.value) : undefined,
      date_from: historyFilters.date_from || undefined,
      date_to: historyFilters.date_to || undefined,
      page: historyPage.value,
    });
  } catch (error) {
    notify('No pudimos cargar el historial', errorMessage(error), 'error');
  } finally {
    loading.value = false;
  }
}
function goHistoryPage(page: number) { historyPage.value = page; void loadHistory(); }
const dirty = reactive({ cash: false, history: false });
watch(selectedRegisterId, () => {
  dirty.cash = true;
  dirty.history = true;
  if (tab.value === 'cash') { dirty.cash = false; void loadCash(); }
  if (tab.value === 'history') { dirty.history = false; historyPage.value = 1; void loadHistory(); }
});
watch(tab, (value) => {
  if (value === 'cash' && (dirty.cash || !overview.value)) { dirty.cash = false; void loadCash(); }
  if (value === 'history' && (dirty.history || !history.value)) { dirty.history = false; void loadHistory(); }
});
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'sales') tab.value = 'sales';
  if (params.get('tab') === 'history') tab.value = 'history';
  const registerParam = params.get('cash_register_id');
  if (registerParam) selectedRegisterId.value = registerParam;
  void Promise.all([loadCash(), loadRelations()]);
  if (tab.value === 'history') void loadHistory();
});
</script>

<template>
  <div class="space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />
    <section class="flex flex-col gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary-soft to-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 class="text-2xl font-bold text-text">Caja y ventas</h2></div>
      <div class="flex flex-wrap items-end gap-2"><UiSelect v-if="registerOptions.length && fiscalRole !== 'cashier'" v-model="selectedRegisterId" class="min-w-56" label="Sucursal / caja" hide-label :options="registerOptions" /><UiButton variant="secondary" @click="tab = 'cash'"><Banknote class="h-4 w-4" />Caja</UiButton><UiButton variant="secondary" @click="tab = 'sales'"><CalendarRange class="h-4 w-4" />Ventas</UiButton><UiButton variant="secondary" @click="tab = 'history'"><CalendarDays class="h-4 w-4" />Historial</UiButton><UiButton variant="ghost" :disabled="loading" aria-label="Actualizar" @click="tab === 'cash' ? loadCash() : tab === 'sales' ? reportPanel?.reload() : loadHistory()"><RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" /></UiButton></div>
    </section>

    <template v-if="tab === 'cash'">
      <UiCard v-for="pending in overview?.pending_counts || []" :key="`pending-${pending.id}`" class="border-warning/30 bg-warning-soft"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><UiStatusBadge tone="warning">Conteo pendiente</UiStatusBadge><p class="mt-2 font-semibold text-text">{{ pending.register.name }} · {{ pending.business_date }}</p><p class="text-sm text-muted">Confirma si hay {{ money(pending.expected) }} en efectivo.</p></div><UiButton variant="secondary" @click="openCount(pending)">Confirmar efectivo</UiButton></div></UiCard>
      <UiCard v-if="overview?.active_session" class="border-primary/30">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div class="flex items-center gap-2"><UiStatusBadge :tone="overview.active_session.status === 'open' ? 'success' : 'warning'">{{ overview.active_session.status === 'open' ? 'Caja abierta' : 'Conteo pendiente' }}</UiStatusBadge><span class="text-sm text-muted">{{ overview.active_session.register.name }}</span></div><p class="mt-3 text-3xl font-bold text-text">{{ money(balance) }}</p><p class="text-sm text-muted">Efectivo esperado · {{ overview.active_session.status === 'open' ? `abierta ${dateTime(overview.active_session.opened_at)}` : 'confirma el efectivo físico' }}</p></div><div class="flex flex-wrap gap-2"><template v-if="overview.active_session.status === 'open'"><UiButton @click="newMovement('in')"><ArrowDownLeft class="h-4 w-4" />Ingreso</UiButton><UiButton variant="secondary" @click="newMovement('out')"><ArrowUpRight class="h-4 w-4" />Salida</UiButton></template><UiButton variant="ghost" @click="openCount(overview.active_session)"><LockKeyhole class="h-4 w-4" />{{ overview.active_session.status === 'open' ? 'Cerrar caja' : 'Confirmar conteo' }}</UiButton></div></div>
      </UiCard>
      <UiCard v-else><div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="font-semibold text-text">La caja está cerrada</h3><p class="mt-1 text-sm text-muted">Registra el efectivo inicial para comenzar a cobrar y pagar desde esta terminal.</p></div><UiButton @click="modal = 'open'"><Plus class="h-4 w-4" />Abrir caja</UiButton></div></UiCard>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UiCard><p class="text-sm text-muted">Ingresos</p><p class="mt-2 text-2xl font-bold text-success">{{ money(overview?.summary.inflows || 0) }}</p></UiCard>
        <UiCard><p class="text-sm text-muted">Salidas</p><p class="mt-2 text-2xl font-bold text-danger">{{ money(overview?.summary.outflows || 0) }}</p></UiCard>
        <UiCard><p class="text-sm text-muted">Gastos sin comprobante</p><p class="mt-2 text-2xl font-bold text-warning">{{ overview?.summary.pending_documents || 0 }}</p><p class="text-xs text-muted">Pendientes de asociar a una compra</p></UiCard>
        <UiCard><p class="text-sm text-muted">Movimiento neto</p><p class="mt-2 text-2xl font-bold text-text">{{ money((overview?.summary.inflows || 0) - (overview?.summary.outflows || 0)) }}</p></UiCard>
      </section>

      <UiCard class="overflow-hidden p-0"><div class="border-b border-line px-5 py-4"><h3 class="font-semibold text-text">Movimientos recientes</h3></div><div v-if="overview?.data.length" class="divide-y divide-line"><div v-for="item in overview.data" :key="item.id" class="flex items-center gap-3 px-5 py-4 transition hover:bg-surface-muted"><span class="rounded-lg p-2" :class="item.direction === 'in' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'"><ArrowDownLeft v-if="item.direction === 'in'" class="h-4 w-4" /><ArrowUpRight v-else class="h-4 w-4" /></span><div class="min-w-0 flex-1"><p class="truncate font-semibold text-text">{{ item.description }}</p><p class="mt-0.5 text-xs text-muted">{{ dateTime(item.occurred_at) }} · {{ methodOptions.find(option => option.value === item.method)?.label || item.method }}<span v-if="item.order"> · {{ item.order.ticket }}</span></p></div><div class="flex items-center gap-3 text-right"><UiButton v-if="item.expense?.status === 'pending_document'" variant="ghost" size="sm" @click="openReconcile(item.expense.id)">Asociar compra</UiButton><div><p class="font-bold" :class="item.direction === 'in' ? 'text-success' : 'text-danger'">{{ item.direction === 'in' ? '+' : '-' }}{{ money(item.amount) }}</p><UiStatusBadge v-if="item.expense?.status === 'pending_document'" tone="warning">Sin comprobante</UiStatusBadge><UiStatusBadge v-else-if="item.expense?.status === 'reconciled'" tone="success">Compra asociada</UiStatusBadge></div></div></div></div><p v-else class="px-5 py-12 text-center text-sm text-muted">Todavía no hay movimientos registrados.</p></UiCard>
    </template>

    <template v-else-if="tab === 'history'">
      <section class="flex flex-wrap items-end gap-3">
        <UiInput v-model="historyFilters.date_from" type="date" label="Desde" @update:model-value="goHistoryPage(1)" />
        <UiInput v-model="historyFilters.date_to" type="date" label="Hasta" @update:model-value="goHistoryPage(1)" />
      </section>
      <UiCard class="overflow-hidden p-0">
        <div v-if="history?.data.length" class="divide-y divide-line">
          <div v-for="entry in history.data" :key="entry.id" class="flex flex-wrap items-center gap-3 px-5 py-4">
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-text">{{ entry.business_date }} · {{ entry.register.branch_name }}</p>
              <p class="mt-0.5 text-xs text-muted">Abrió {{ entry.opened_by || '—' }} · Cerró {{ entry.closed_by || 'Sin confirmar' }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-muted">Esperado {{ money(entry.expected_balance || 0) }}</p>
              <p v-if="entry.declared_balance !== null" class="text-sm text-muted">Declarado {{ money(entry.declared_balance) }}</p>
              <p v-if="entry.status === 'closed_unverified'" class="text-sm font-semibold text-warning">Sin confirmar</p>
              <p v-else class="text-sm font-bold" :class="Math.abs(entry.difference || 0) < 0.01 ? 'text-success' : 'text-warning'">Diferencia {{ money(entry.difference || 0) }}</p>
            </div>
          </div>
        </div>
        <p v-else class="px-5 py-12 text-center text-sm text-muted">No hay cierres registrados en este período.</p>
      </UiCard>
      <div v-if="history && history.meta.last_page > 1" class="flex items-center justify-center gap-2">
        <UiButton variant="ghost" size="sm" :disabled="history.meta.current_page <= 1" @click="goHistoryPage(history.meta.current_page - 1)">Anterior</UiButton>
        <span class="text-sm text-muted">Página {{ history.meta.current_page }} de {{ history.meta.last_page }}</span>
        <UiButton variant="ghost" size="sm" :disabled="history.meta.current_page >= history.meta.last_page" @click="goHistoryPage(history.meta.current_page + 1)">Siguiente</UiButton>
      </div>
    </template>

    <CommercialSalesReportPanel v-else ref="reportPanel" :platform-base-url="platformBaseUrl" :auth-token="authToken" :tenant-id="tenantId" :workshop-enabled="workshopEnabled" :branch-id="selectedRegister?.branch_id || null" :branch-name="selectedRegister?.branch_name || selectedRegister?.name || null" :company="company" @cash-changed="loadCash" />

    <UiModalShell :open="modal === 'open'" title="Abrir caja" description="Indica cuánto efectivo hay antes del primer movimiento." @close="modal = null"><div class="space-y-4"><UiInput v-model.number="openForm.opening_balance" type="number" min="0" step="0.01" label="Efectivo inicial" suffix="USD" /><UiInput v-model="openForm.name" label="Nombre de la caja" /><UiTextarea v-model="openForm.notes" label="Nota opcional" /></div><template #footer><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton><UiButton :disabled="loading" @click="openSession">Abrir caja</UiButton></template></UiModalShell>
    <UiModalShell :open="modal === 'close'" title="Cerrar caja" :description="`Cuenta el efectivo antes de continuar. Deberías encontrar ${money(closingExpected)}.`" @close="modal = null; closeTargetId = null"><div class="space-y-4"><UiInput v-model.number="closeForm.declared_balance" type="number" min="0" step="0.01" label="Efectivo contado" suffix="USD" /><UiTextarea v-model="closeForm.notes" label="Observación opcional" /></div><template #footer><UiButton variant="ghost" @click="modal = null; closeTargetId = null">Cancelar</UiButton><UiButton :disabled="loading" @click="modal = 'confirm-close'">Revisar cierre</UiButton></template></UiModalShell>
    <UiModalShell :open="modal === 'confirm-close'" title="¿Cerrar la caja?" description="Después del cierre ya no podrás registrar movimientos en efectivo hasta la próxima apertura." max-width="max-w-md" @close="modal = 'close'"><div class="space-y-3 rounded-lg border border-line bg-surface p-4"><div class="flex items-center justify-between"><span class="text-sm text-muted">Efectivo esperado</span><strong class="text-text">{{ money(closingExpected) }}</strong></div><div class="flex items-center justify-between"><span class="text-sm text-muted">Efectivo contado</span><strong class="text-text">{{ money(Number(closeForm.declared_balance)) }}</strong></div><div class="flex items-center justify-between border-t border-line pt-3"><span class="text-sm text-muted">Diferencia</span><strong :class="Math.abs(closingDifference) < 0.01 ? 'text-success' : 'text-warning'">{{ money(closingDifference) }}</strong></div></div><template #footer><UiButton variant="secondary" @click="modal = 'close'">Volver</UiButton><UiButton variant="danger" :disabled="loading" @click="closeSession">Sí, cerrar caja</UiButton></template></UiModalShell>
    <UiModalShell :open="modal === 'movement'" :title="movementForm.direction === 'in' ? 'Registrar ingreso' : 'Registrar salida'" :description="movementForm.direction === 'out' ? 'Si recibes un comprobante del proveedor, podrás asociarlo después.' : 'Indica el dinero que recibiste.'" @close="modal = null"><div class="grid gap-4 sm:grid-cols-2"><UiInput v-model.number="movementForm.amount" type="number" min="0.01" step="0.01" label="Monto" suffix="USD" /><UiSelect v-model="movementForm.method" label="Forma" :options="methodOptions" /><UiInput v-model="movementForm.description" class="sm:col-span-2" label="Concepto" placeholder="Ej. Pantalla para Samsung A54" /><template v-if="movementForm.direction === 'out'"><UiSelect v-model="movementForm.expense_category" label="Categoría" :options="categoryOptions" /><UiSelect v-model="movementForm.destination" label="Destino" :options="destinationOptions" /><UiSelect v-model="movementForm.supplier_id" label="Proveedor" :options="supplierOptions" /><UiSelect v-if="workshopEnabled" v-model="movementForm.workshop_order_id" label="Orden de taller" :options="orderOptions" /></template><UiInput v-model="movementForm.reference" class="sm:col-span-2" label="Referencia opcional" /></div><template #footer><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton><UiButton :disabled="loading || movementForm.amount <= 0 || !movementForm.description" @click="saveMovement">Guardar movimiento</UiButton></template></UiModalShell>
    <UiModalShell :open="modal === 'reconcile'" title="Asociar compra" description="Selecciona la compra que corresponde a este gasto." @close="modal = null"><UiSelect v-model="selectedPurchaseId" label="Compra" :options="purchaseOptions" /><p v-if="purchases.length === 0" class="mt-3 text-sm text-muted">Primero registra o importa la compra desde Inventario.</p><template #footer><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton><UiButton :disabled="loading || !selectedPurchaseId" @click="reconcileExpense">Asociar compra</UiButton></template></UiModalShell>
  </div>
</template>
