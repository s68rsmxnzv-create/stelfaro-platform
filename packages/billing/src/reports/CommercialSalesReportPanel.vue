<script setup lang="ts">
import { PlatformClient, type BillingEmpresa, type PlatformSalesReport, type WorkshopOrder } from '@stelfaro/api-client';
import { UiButton, UiCard, UiInput, UiModalShell, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, FileSpreadsheet, HandCoins, Printer, Scale } from 'lucide-vue-next';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import WorkshopPaymentModal from '../workshop/WorkshopPaymentModal.vue';

type SaleRow = PlatformSalesReport['data'][number];
type Period = 'today'|'week'|'month'|'year'|'custom';

const props = withDefaults(defineProps<{
  platformBaseUrl?: string;
  authToken?: string|null;
  tenantId: number;
  workshopEnabled?: boolean;
  branchId?: number|null;
  branchName?: string|null;
  company?: BillingEmpresa|null;
}>(), { platformBaseUrl: '/api/v1', authToken: null, workshopEnabled: false, branchId: null, branchName: null, company: null });
const emit = defineEmits<{ cashChanged: [] }>();

const client = computed(() => new PlatformClient(props.platformBaseUrl, { authToken: props.authToken }));
const report = ref<PlatformSalesReport|null>(null);
const loading = ref(false);
const exporting = ref(false);
const paymentOrder = ref<WorkshopOrder|null>(null);
const dtePaymentSale = ref<SaleRow|null>(null);
const dtePaymentForm = reactive({ amount: 0, method: 'cash' as 'cash'|'card'|'transfer'|'other', reference: '', notes: '', idempotency_key: '' });
const toasts = ref<any[]>([]);
const period = ref<Period>('month');
const filters = reactive({ date_from: '', date_to: '', source_type: '', document_type: '', payment_status: '', page: 1, per_page: 20 });

const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value || 0);
const integer = (value: number) => new Intl.NumberFormat('es-SV').format(value || 0);
const sourceOptions = [{ value: '', label: 'Todos los orígenes' }, { value: 'dte', label: 'Facturación' }, { value: 'workshop_order', label: 'Taller' }];
const documentOptions = [{ value: '', label: 'Todos los comprobantes' }, { value: '01', label: 'Factura electrónica' }, { value: '03', label: 'Crédito fiscal' }, { value: '05', label: 'Nota de crédito' }, { value: '06', label: 'Nota de débito' }, { value: '14', label: 'Sujeto excluido' }];
const paymentOptions = [{ value: '', label: 'Todos los estados' }, { value: 'paid', label: 'Cobrado' }, { value: 'receivable', label: 'Pendiente de cobro' }];
const collectionMethodOptions = [{ value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'card', label: 'Tarjeta' }, { value: 'other', label: 'Otro' }];
const paymentLabels: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
const paymentCards: Array<{ key: 'cash'|'card'|'transfer'|'other'; label: string }> = [{ key: 'cash', label: 'Efectivo' }, { key: 'transfer', label: 'Transferencia' }, { key: 'card', label: 'Tarjeta' }, { key: 'other', label: 'Otros' }];
const companyName = computed(() => props.company?.nombre_comercial || props.company?.razon_social || 'Reporte de ventas');

function svDateParts(): { year: number; month: number; day: number } {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/El_Salvador', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day };
}
function iso(date: Date): string { return date.toISOString().slice(0, 10); }
function setPeriod(value: Period, reload = true): void {
  period.value = value;
  if (value !== 'custom') {
    const today = svDateParts();
    const end = new Date(Date.UTC(today.year, today.month - 1, today.day));
    let start = new Date(end);
    if (value === 'week') {
      const weekday = end.getUTCDay() || 7;
      start.setUTCDate(end.getUTCDate() - weekday + 1);
    } else if (value === 'month') start = new Date(Date.UTC(today.year, today.month - 1, 1));
    else if (value === 'year') start = new Date(Date.UTC(today.year, 0, 1));
    filters.date_from = iso(start);
    filters.date_to = iso(end);
  }
  filters.page = 1;
  if (reload) void loadReport();
}
function notify(title: string, message = '', variant = 'success'): void {
  const id = `${Date.now()}-${Math.random()}`;
  toasts.value.push({ id, title, message, variant });
  window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4300);
}
function errorMessage(error: any): string { return error?.response?.message || error?.message || 'Revisa los datos e intenta nuevamente.'; }
function requestParams(page = filters.page, perPage = filters.per_page) {
  return {
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    source_type: filters.source_type || undefined,
    document_type: filters.document_type || undefined,
    payment_status: filters.payment_status || undefined,
    core_sucursal_id: props.branchId || undefined,
    page,
    per_page: perPage,
  };
}
async function loadReport(): Promise<void> {
  loading.value = true;
  try {
    report.value = await client.value.commercialSalesReport(props.tenantId, requestParams());
  } catch (error) {
    notify('No pudimos cargar las ventas', errorMessage(error), 'error');
  } finally {
    loading.value = false;
  }
}
async function goToPage(page: number): Promise<void> {
  filters.page = Math.min(Math.max(page, 1), report.value?.meta.last_page || 1);
  await loadReport();
}
async function allRows(): Promise<{ rows: SaleRow[]; report: PlatformSalesReport }> {
  const first = await client.value.commercialSalesReport(props.tenantId, requestParams(1, 100));
  const rows = [...first.data];
  for (let page = 2; page <= first.meta.last_page; page++) {
    const response = await client.value.commercialSalesReport(props.tenantId, requestParams(page, 100));
    rows.push(...response.data);
  }
  return { rows, report: first };
}
function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function rowMethods(row: SaleRow): string {
  const methods = Object.entries(row.payment_methods || {}).filter(([, amount]) => Number(amount) !== 0).map(([method, amount]) => `${paymentLabels[method] || 'Otro'} ${money(Number(amount))}`);
  if (row.payment_status === 'receivable') methods.push(`Crédito · pendiente ${money(row.outstanding_amount)}`);
  return methods.length ? methods.join(' · ') : 'Sin clasificar';
}
function paymentAmount(method: 'cash'|'card'|'transfer'|'other'): number { return report.value?.summary.payments[method] || 0; }
async function exportCsv(): Promise<void> {
  exporting.value = true;
  try {
    const { rows } = await allRows();
    const headers = ['Fecha', 'Comprobante', 'Origen', 'Tipo DTE', 'Cliente', 'Estado de cobro', 'Formas de pago', 'Neto', 'IVA', 'Total', 'Saldo pendiente'];
    const lines = rows.map(row => [row.date, row.source_number || `Venta #${row.id}`, row.source_type === 'workshop_order' ? 'Taller' : 'Facturación', row.document_type || '', row.customer_name || 'Consumidor final', row.payment_status === 'receivable' ? 'Por cobrar' : 'Cobrado', rowMethods(row), row.net.toFixed(2), row.tax.toFixed(2), row.total.toFixed(2), row.outstanding_amount.toFixed(2)]);
    const csv = `\uFEFF${[headers, ...lines].map(line => line.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ventas-${filters.date_from || 'inicio'}-${filters.date_to || 'hoy'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Reporte descargado', `${integer(rows.length)} ventas incluidas en el archivo.`);
  } catch (error) {
    notify('No se pudo exportar', errorMessage(error), 'error');
  } finally {
    exporting.value = false;
  }
}
function html(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character); }
async function printReport(): Promise<void> {
  exporting.value = true;
  try {
    const { rows, report: complete } = await allRows();
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('Permite las ventanas emergentes para imprimir el reporte.');
    popup.opener = null;
    const payments = complete.summary.payments;
    const tableRows = rows.map(row => `<tr><td>${html(row.date)}</td><td><strong>${html(row.source_number || `Venta #${row.id}`)}</strong><br><small>${row.source_type === 'workshop_order' ? 'Taller' : `DTE ${html(row.document_type || '')}`}</small></td><td>${html(row.customer_name || 'Consumidor final')}</td><td>${html(rowMethods(row))}</td><td class="number">${html(money(row.net))}</td><td class="number">${html(money(row.tax))}</td><td class="number"><strong>${html(money(row.total))}</strong></td></tr>`).join('');
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de ventas</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:28px;font-size:12px}h1{margin:0;font-size:24px}h2{font-size:15px;margin:22px 0 8px}.muted{color:#64748b}.toolbar{display:flex;justify-content:flex-end;margin-bottom:18px}.toolbar button{border:0;border-radius:8px;background:#0284c7;color:white;padding:10px 16px;font-weight:700}.summary,.payments{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:18px}.box{border:1px solid #cbd5e1;border-radius:8px;padding:10px}.box span{display:block;color:#64748b;font-size:10px;text-transform:uppercase}.box strong{display:block;margin-top:4px;font-size:15px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border-bottom:1px solid #e2e8f0;padding:8px 6px;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:10px;text-transform:uppercase}.number{text-align:right;white-space:nowrap}footer{margin-top:20px;color:#64748b;font-size:10px}@media print{body{margin:10mm}.toolbar{display:none}.summary,.payments{break-inside:avoid}thead{display:table-header-group}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / guardar PDF</button></div><h1>Reporte de ventas</h1><p><strong>${html(companyName.value)}</strong>${props.branchName ? ` · ${html(props.branchName)}` : ''}</p><p class="muted">Período: ${html(filters.date_from || 'Inicio')} al ${html(filters.date_to || 'Hoy')} · ${integer(complete.summary.transactions)} operaciones</p><div class="summary"><div class="box"><span>Total vendido</span><strong>${html(money(complete.summary.total))}</strong></div><div class="box"><span>Neto</span><strong>${html(money(complete.summary.net))}</strong></div><div class="box"><span>IVA</span><strong>${html(money(complete.summary.tax))}</strong></div><div class="box"><span>Costo</span><strong>${html(money(complete.summary.cost))}</strong></div><div class="box"><span>Margen</span><strong>${html(money(complete.summary.margin))}</strong></div></div><h2>Cobros asociados</h2><div class="payments"><div class="box"><span>Efectivo</span><strong>${html(money(payments.cash))}</strong></div><div class="box"><span>Transferencia</span><strong>${html(money(payments.transfer))}</strong></div><div class="box"><span>Tarjeta</span><strong>${html(money(payments.card))}</strong></div><div class="box"><span>Otros</span><strong>${html(money(payments.other))}</strong></div><div class="box"><span>Por cobrar</span><strong>${html(money(complete.summary.receivable))}</strong></div></div><table><thead><tr><th>Fecha</th><th>Venta</th><th>Cliente</th><th>Forma de pago</th><th class="number">Neto</th><th class="number">IVA</th><th class="number">Total</th></tr></thead><tbody>${tableRows || '<tr><td colspan="7">No hay ventas en este período.</td></tr>'}</tbody></table><footer>Generado ${html(new Intl.DateTimeFormat('es-SV', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/El_Salvador' }).format(new Date()))}</footer></body></html>`);
    popup.document.close();
  } catch (error) {
    notify('No se pudo preparar el reporte', errorMessage(error), 'error');
  } finally {
    exporting.value = false;
  }
}
async function openReceivablePayment(sale: SaleRow): Promise<void> {
  loading.value = true;
  try { paymentOrder.value = (await client.value.workshopOrder(props.tenantId, Number(sale.source_id))).data; }
  catch (error) { notify('No se pudo abrir el cobro', errorMessage(error), 'error'); }
  finally { loading.value = false; }
}
async function openCollection(sale: SaleRow): Promise<void> {
  if (sale.source_type === 'workshop_order') {
    await openReceivablePayment(sale);
    return;
  }
  dtePaymentSale.value = sale;
  Object.assign(dtePaymentForm, { amount: sale.outstanding_amount, method: 'cash', reference: '', notes: '', idempotency_key: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}` });
}
async function recordDtePayment(): Promise<void> {
  if (!dtePaymentSale.value || dtePaymentForm.amount <= 0) return;
  loading.value = true;
  try {
    const result = await client.value.recordCommercialSalePayment(props.tenantId, dtePaymentSale.value.id, { ...dtePaymentForm, reference: dtePaymentForm.reference.trim() || null, notes: dtePaymentForm.notes.trim() || null });
    dtePaymentSale.value = null;
    notify('Pago registrado', result.data.outstanding_amount > 0 ? `Quedan ${money(result.data.outstanding_amount)} por cobrar.` : 'La venta quedó completamente cobrada.');
    await loadReport();
    emit('cashChanged');
  } catch (error) { notify('No se pudo registrar el pago', errorMessage(error), 'error'); }
  finally { loading.value = false; }
}
async function recordReceivablePayment(orderId: number, payload: { amount: number; method: 'cash'|'card'|'transfer'|'other'; reference?: string|null; notes?: string|null }): Promise<void> {
  loading.value = true;
  try {
    const result = await client.value.recordWorkshopOrderPayment(props.tenantId, orderId, payload);
    paymentOrder.value = null;
    notify('Pago registrado', result.data.balance > 0 ? `Quedan ${money(result.data.balance)} por cobrar.` : 'La cuenta quedó saldada.');
    await loadReport();
    emit('cashChanged');
  } catch (error) { notify('No se pudo registrar el pago', errorMessage(error), 'error'); }
  finally { loading.value = false; }
}

defineExpose({ reload: loadReport });
watch(() => props.branchId, () => { filters.page = 1; void loadReport(); });
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment_status') === 'receivable') {
    filters.payment_status = 'receivable';
    period.value = 'custom';
    filters.date_from = '';
    filters.date_to = '';
  } else setPeriod('month', false);
  void loadReport();
});
</script>

<template>
  <div class="space-y-4">
    <BillingFloatingToastStack :toasts="toasts" />
    <UiCard>
      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-primary">Reporte comercial</p>
          <h3 class="mt-1 text-xl font-bold text-text">Ventas por período</h3>
          <p class="mt-1 text-sm text-muted">Consulta, imprime o descarga todas las ventas del período seleccionado.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton variant="secondary" :disabled="exporting" @click="exportCsv"><FileSpreadsheet class="h-4 w-4" />CSV</UiButton>
          <UiButton :disabled="exporting" @click="printReport"><Printer class="h-4 w-4" />Imprimir / PDF</UiButton>
        </div>
      </div>
      <div class="mt-5 flex flex-wrap gap-2">
        <UiButton v-for="option in [{ value: 'today', label: 'Hoy' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }, { value: 'year', label: 'Año' }]" :key="option.value" size="sm" :variant="period === option.value ? 'primary' : 'secondary'" @click="setPeriod(option.value as Period)">{{ option.label }}</UiButton>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <UiInput v-model="filters.date_from" type="date" label="Desde" @update:model-value="period = 'custom'" />
        <UiInput v-model="filters.date_to" type="date" label="Hasta" @update:model-value="period = 'custom'" />
        <UiSelect v-model="filters.source_type" label="Origen" :options="sourceOptions" />
        <UiSelect v-model="filters.document_type" label="Comprobante" :options="documentOptions" />
        <UiSelect v-model="filters.payment_status" label="Cobro" :options="paymentOptions" />
      </div>
      <div class="mt-4 flex justify-end"><UiButton :disabled="loading" @click="filters.page = 1; loadReport()"><CalendarDays class="h-4 w-4" />Actualizar reporte</UiButton></div>
    </UiCard>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <UiCard><CircleDollarSign class="h-5 w-5 text-primary" /><p class="mt-2 text-xs text-muted">Total vendido</p><p class="text-xl font-bold text-text">{{ money(report?.summary.total || 0) }}</p></UiCard>
      <UiCard><p class="text-xs text-muted">Neto</p><p class="mt-2 text-xl font-bold text-text">{{ money(report?.summary.net || 0) }}</p></UiCard>
      <UiCard><p class="text-xs text-muted">IVA</p><p class="mt-2 text-xl font-bold text-text">{{ money(report?.summary.tax || 0) }}</p></UiCard>
      <UiCard><p class="text-xs text-muted">Costo</p><p class="mt-2 text-xl font-bold text-text">{{ money(report?.summary.cost || 0) }}</p></UiCard>
      <UiCard><Scale class="h-5 w-5 text-success" /><p class="mt-2 text-xs text-muted">Margen</p><p class="text-xl font-bold text-success">{{ money(report?.summary.margin || 0) }}</p></UiCard>
    </section>

    <UiCard>
      <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="font-semibold text-text">Cobros asociados a estas ventas</h3><p class="text-sm text-muted">Solo el efectivo modifica el saldo físico de caja.</p></div><UiStatusBadge v-if="(report?.summary.payments.unclassified || 0) > 0" tone="warning">{{ money(report?.summary.payments.unclassified || 0) }} sin clasificar</UiStatusBadge></div>
      <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div v-for="item in paymentCards" :key="item.key" class="rounded-lg border border-line bg-surface-muted p-3"><p class="text-xs text-muted">{{ item.label }}</p><p class="mt-1 font-bold text-text">{{ money(paymentAmount(item.key)) }}</p></div>
        <div class="rounded-lg border border-warning/30 bg-warning-soft p-3"><p class="text-xs text-muted">Por cobrar</p><p class="mt-1 font-bold text-warning">{{ money(report?.summary.receivable || 0) }}</p></div>
      </div>
    </UiCard>

    <UiCard class="overflow-hidden p-0">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-surface-muted text-left text-xs uppercase text-muted"><tr><th class="px-5 py-3">Fecha</th><th class="px-5 py-3">Venta</th><th class="px-5 py-3">Cliente</th><th class="px-5 py-3">Forma de pago</th><th class="px-5 py-3">Estado</th><th class="px-5 py-3 text-right">Total / saldo</th><th class="px-5 py-3 text-right">Acciones</th></tr></thead>
          <tbody class="divide-y divide-line">
            <tr v-for="sale in report?.data || []" :key="sale.id" class="transition hover:bg-surface-muted">
              <td class="whitespace-nowrap px-5 py-4 text-muted">{{ sale.date }}</td>
              <td class="px-5 py-4"><p class="font-semibold text-text">{{ sale.source_number || `Venta #${sale.id}` }}</p><p class="text-xs text-muted">{{ sale.source_type === 'workshop_order' ? 'Taller' : `DTE ${sale.document_type || ''}` }}</p></td>
              <td class="px-5 py-4 text-text">{{ sale.customer_name || 'Consumidor final' }}</td>
              <td class="px-5 py-4 text-muted">{{ rowMethods(sale) }}</td>
              <td class="px-5 py-4"><UiStatusBadge :tone="sale.payment_status === 'receivable' ? 'warning' : 'success'">{{ sale.payment_status === 'receivable' ? 'Por cobrar' : 'Cobrado' }}</UiStatusBadge></td>
              <td class="px-5 py-4 text-right"><p class="font-bold text-text">{{ money(sale.total) }}</p><p v-if="sale.payment_status === 'receivable'" class="text-xs font-semibold text-warning">Pendiente {{ money(sale.outstanding_amount) }}</p></td>
              <td class="px-5 py-4 text-right"><UiButton v-if="sale.payment_status === 'receivable'" size="sm" variant="success" :disabled="loading" @click="openCollection(sale)"><HandCoins class="h-4 w-4" />Cobrar</UiButton><span v-else class="text-xs text-muted">—</span></td>
            </tr>
            <tr v-if="!report?.data.length"><td colspan="7" class="px-5 py-12 text-center text-muted">No hay ventas en este período.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p class="text-sm text-muted">{{ integer(report?.meta.total || 0) }} ventas · Página {{ report?.meta.current_page || 1 }} de {{ report?.meta.last_page || 1 }}</p><div class="flex gap-2"><UiButton size="sm" variant="secondary" :disabled="loading || (report?.meta.current_page || 1) <= 1" @click="goToPage((report?.meta.current_page || 1) - 1)"><ChevronLeft class="h-4 w-4" />Anterior</UiButton><UiButton size="sm" variant="secondary" :disabled="loading || (report?.meta.current_page || 1) >= (report?.meta.last_page || 1)" @click="goToPage((report?.meta.current_page || 1) + 1)">Siguiente<ChevronRight class="h-4 w-4" /></UiButton></div></div>
    </UiCard>

    <WorkshopPaymentModal :order="paymentOrder" @pay="recordReceivablePayment" @close="paymentOrder = null" />
    <UiModalShell :open="Boolean(dtePaymentSale)" title="Registrar pago" :description="dtePaymentSale ? `${dtePaymentSale.source_number} · Saldo ${money(dtePaymentSale.outstanding_amount)}` : ''" @close="dtePaymentSale = null">
      <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model.number="dtePaymentForm.amount" type="number" min="0.01" :max="dtePaymentSale?.outstanding_amount || 0" step="0.01" label="Monto recibido" suffix="USD" /><UiSelect v-model="dtePaymentForm.method" label="Forma de pago" :options="collectionMethodOptions" /><UiInput v-model="dtePaymentForm.reference" class="sm:col-span-2" label="Referencia opcional" placeholder="Ej. número de transferencia" /><UiTextarea v-model="dtePaymentForm.notes" class="sm:col-span-2" label="Nota opcional" /></div>
      <template #footer><UiButton variant="ghost" @click="dtePaymentSale = null">Cancelar</UiButton><UiButton :disabled="loading || dtePaymentForm.amount <= 0 || dtePaymentForm.amount > (dtePaymentSale?.outstanding_amount || 0)" @click="recordDtePayment"><HandCoins class="h-4 w-4" />Registrar pago</UiButton></template>
    </UiModalShell>
  </div>
</template>
