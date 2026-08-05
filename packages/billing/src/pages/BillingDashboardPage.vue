<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowRight, CalendarDays, ChevronDown, CircleDollarSign, ClipboardCheck, Clock3, FileCheck2, FileText, PackageCheck, RefreshCw, Smartphone, TriangleAlert, Wrench, X } from 'lucide-vue-next';
import { CoreDteClient, PlatformClient, type DteDashboardSummary, type PlatformCommercialDashboard, type WorkshopDashboard, type WorkshopOrder } from '@stelfaro/api-client';
import { UiButton, UiCard, UiStatusBadge } from '@stelfaro/ui';

const props = withDefaults(defineProps<{ coreBaseUrl?: string; platformBaseUrl?: string; authToken?: string | null; tenantId?: number; appBaseUrl?: string; workshopEnabled?: boolean }>(), { coreBaseUrl: '/api/v1', platformBaseUrl: '/api/v1', authToken: null, tenantId: 0, appBaseUrl: '', workshopEnabled: false });
const core = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const platform = computed(() => new PlatformClient(props.platformBaseUrl, { authToken: props.authToken }));
const workshop = ref<WorkshopDashboard | null>(null); const commercial = ref<PlatformCommercialDashboard['commercial'] | null>(null); const fiscal = ref<DteDashboardSummary | null>(null); const loading = ref(false); const error = ref('');
const base = computed(() => props.appBaseUrl.replace(/\/$/, ''));
const invoiceHref = computed(() => `${base.value}${props.workshopEnabled ? '/facturacion' : ''}/fe`);
const billingBase = computed(() => `${base.value}${props.workshopEnabled ? '/facturacion' : ''}`);
const invoiceMenuOpen = ref(false);
const showMoreInvoiceOptions = ref(false);
const primaryInvoiceOptions = computed(() => [
  { code: '01', label: 'Factura', description: 'Venta a consumidor final', href: `${billingBase.value}/fe` },
  { code: '03', label: 'Crédito fiscal', description: 'Venta a contribuyente', href: `${billingBase.value}/ccf` },
]);
const secondaryInvoiceOptions = computed(() => [
  { code: '14', label: 'Sujeto excluido', description: 'Compra a persona no contribuyente', href: `${billingBase.value}/se` },
  { code: '05', label: 'Nota de crédito', description: 'Disminuir o corregir una venta', href: `${billingBase.value}/nc` },
  { code: '06', label: 'Nota de débito', description: 'Aumentar el valor de una venta', href: `${billingBase.value}/nd` },
]);
function openInvoiceMenu() {
  showMoreInvoiceOptions.value = false;
  invoiceMenuOpen.value = true;
}
function closeInvoiceMenu() {
  invoiceMenuOpen.value = false;
  showMoreInvoiceOptions.value = false;
}
watch(invoiceMenuOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});
onBeforeUnmount(() => {
  document.body.style.overflow = '';
});
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value || 0);
const hasEstimatedTaxCredit = computed(() => (commercial.value?.estimated_tax_credit_balance_month ?? 0) > 0);
const estimatedTaxAmount = computed(() => hasEstimatedTaxCredit.value
  ? commercial.value?.estimated_tax_credit_balance_month ?? 0
  : commercial.value?.estimated_tax_payable_month ?? 0);
const labels: Record<string, string> = { received: 'Recibido', diagnosing: 'Diagnóstico', awaiting_approval: 'Por aprobar', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo' };
function tone(status: string): 'neutral'|'success'|'warning'|'danger'|'info' { if (status === 'ready') return 'success'; if (status === 'awaiting_approval') return 'warning'; if (['received', 'diagnosing', 'approved', 'repairing'].includes(status)) return 'info'; return 'neutral'; }
function orderAge(date: string) { const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000); return days <= 0 ? 'Hoy' : days === 1 ? 'Hace 1 día' : `Hace ${days} días`; }
function orderUrl(order: WorkshopOrder) { return `${base.value}/ordenes?q=${encodeURIComponent(order.ticket)}`; }
async function load() {
  loading.value = true; error.value = '';
  const [fiscalResult, commercialResult, workshopResult] = await Promise.allSettled([
    core.value.dashboardSummary(),
    props.tenantId ? platform.value.commercialDashboard(props.tenantId) : Promise.resolve(null),
    props.workshopEnabled && props.tenantId ? platform.value.workshopDashboard(props.tenantId) : Promise.resolve(null),
  ]);
  if (fiscalResult.status === 'fulfilled') fiscal.value = fiscalResult.value;
  if (commercialResult.status === 'fulfilled' && commercialResult.value) commercial.value = commercialResult.value.commercial;
  if (workshopResult.status === 'fulfilled' && workshopResult.value) {
    workshop.value = workshopResult.value;
    commercial.value ??= workshop.value.commercial;
  }
  const requiredResults = [fiscalResult, ...(props.tenantId ? [commercialResult] : []), ...(props.workshopEnabled && props.tenantId ? [workshopResult] : [])];
  if (requiredResults.every(result => result.status === 'rejected')) error.value = 'No pudimos actualizar el dashboard. Intenta nuevamente.';
  loading.value = false;
}
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-5 md:hidden">
      <section class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-muted">Resumen de hoy</p>
          <h1 class="mt-0.5 text-2xl font-bold tracking-tight text-text">
            {{ workshopEnabled ? 'Tu taller' : 'Tu facturación' }}
          </h1>
        </div>
        <button
          type="button"
          class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm"
          :disabled="loading"
          aria-label="Actualizar dashboard"
          @click="load"
        >
          <RefreshCw class="h-5 w-5" :class="loading ? 'animate-spin' : ''" />
        </button>
      </section>

      <p v-if="error" class="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

      <section class="grid gap-3" :class="workshopEnabled ? 'grid-cols-2' : 'grid-cols-1'">
        <a
          v-if="workshopEnabled"
          :href="`${base}/recepcion`"
          class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-4 text-center text-sm font-bold text-primary-contrast shadow-lg shadow-primary/20 active:scale-[0.98]"
        >
          <Smartphone class="h-7 w-7" />
          Recibir equipo
        </a>
        <button
          type="button"
          class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-4 text-center text-sm font-bold text-primary-contrast shadow-lg shadow-primary/20 active:scale-[0.98]"
          aria-haspopup="dialog"
          @click="openInvoiceMenu"
        >
          <FileCheck2 class="h-7 w-7" />
          Emitir factura
        </button>
      </section>

      <Teleport to="body">
        <div
          v-if="invoiceMenuOpen"
          class="fixed inset-0 z-[1000] flex items-end bg-black/55 backdrop-blur-[2px] md:hidden"
          role="presentation"
          @click.self="closeInvoiceMenu"
        >
          <section
            class="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[1.75rem] border border-line bg-surface px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-menu-title"
          >
            <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong"></div>
            <div class="flex items-start justify-between gap-4 px-1">
              <div>
                <h2 id="invoice-menu-title" class="text-xl font-black text-text">¿Qué deseas emitir?</h2>
                <p class="mt-1 text-sm text-muted">Elige el tipo de documento para comenzar.</p>
              </div>
              <button type="button" class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-muted text-muted active:bg-surface-strong" aria-label="Cerrar" @click="closeInvoiceMenu">
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3">
              <a
                v-for="option in primaryInvoiceOptions"
                :key="option.code"
                :href="option.href"
                class="flex min-h-32 flex-col rounded-2xl border border-line bg-surface-raised p-4 text-left shadow-sm active:scale-[0.98] active:bg-primary-soft"
              >
                <span class="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <FileText class="h-6 w-6" />
                </span>
                <strong class="mt-4 block text-sm text-text">{{ option.label }}</strong>
                <span class="mt-1 block text-xs leading-5 text-muted">{{ option.description }}</span>
              </a>
            </div>

            <button
              type="button"
              class="mt-3 flex min-h-12 w-full items-center justify-between rounded-xl border border-line bg-surface-muted px-4 text-left text-sm font-bold text-text active:bg-surface-strong"
              :aria-expanded="showMoreInvoiceOptions"
              @click="showMoreInvoiceOptions = !showMoreInvoiceOptions"
            >
              {{ showMoreInvoiceOptions ? 'Ocultar otras opciones' : 'Ver más opciones' }}
              <ChevronDown class="h-5 w-5 text-muted transition-transform" :class="showMoreInvoiceOptions ? 'rotate-180' : ''" />
            </button>

            <div v-if="showMoreInvoiceOptions" class="mt-2 overflow-hidden rounded-xl border border-line">
              <a
                v-for="option in secondaryInvoiceOptions"
                :key="option.code"
                :href="option.href"
                class="flex min-h-16 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 active:bg-surface-muted"
              >
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-primary">
                  <FileText class="h-5 w-5" />
                </span>
                <span class="min-w-0">
                  <strong class="block text-sm text-text">{{ option.label }}</strong>
                  <span class="mt-0.5 block text-xs text-muted">{{ option.description }}</span>
                </span>
                <ArrowRight class="ml-auto h-4 w-4 shrink-0 text-soft" />
              </a>
            </div>
          </section>
        </div>
      </Teleport>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-bold uppercase tracking-wide text-muted">Hoy</h2>
          <span class="text-xs text-muted">Actividad actual</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <a
            v-if="workshopEnabled"
            :href="`${base}/ordenes`"
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm active:bg-surface-muted"
          >
            <Wrench class="h-5 w-5 text-primary" />
            <strong class="mt-3 block text-2xl text-text">{{ workshop?.orders.active ?? '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">Órdenes activas</span>
          </a>
          <a
            v-if="workshopEnabled"
            :href="`${base}/ordenes?status=ready`"
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm active:bg-surface-muted"
          >
            <PackageCheck class="h-5 w-5 text-success" />
            <strong class="mt-3 block text-2xl text-text">{{ workshop?.orders.ready ?? '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">Listas para entregar</span>
          </a>
          <a
            :href="`${base}/caja`"
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm active:bg-surface-muted"
          >
            <CircleDollarSign class="h-5 w-5 text-success" />
            <strong class="mt-3 block truncate text-xl text-text">{{ commercial ? money(commercial.sales_today) : '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">Ventas de hoy</span>
          </a>
          <a
            v-if="workshopEnabled"
            :href="`${base}/ordenes-trabajo?tab=receivables`"
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm active:bg-surface-muted"
          >
            <Clock3 class="h-5 w-5 text-warning" />
            <strong class="mt-3 block truncate text-xl" :class="workshop?.commercial.receivables ? 'text-warning' : 'text-text'">{{ workshop ? money(workshop.commercial.receivables) : '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">Por cobrar</span>
          </a>
          <div
            v-else
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm"
          >
            <CalendarDays class="h-5 w-5 text-primary" />
            <strong class="mt-3 block truncate text-xl text-text">{{ commercial ? money(commercial.sales_month) : '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">Ventas del mes</span>
          </div>
          <a
            v-if="!workshopEnabled"
            :href="`${base}/comprobantes/dte`"
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm active:bg-surface-muted"
          >
            <FileCheck2 class="h-5 w-5 text-success" />
            <strong class="mt-3 block text-2xl text-text">{{ fiscal?.totals.accepted ?? '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">DTE aceptados</span>
          </a>
          <a
            v-if="!workshopEnabled"
            :href="`${base}/comprobantes/dte`"
            class="min-h-28 rounded-2xl border border-line bg-surface p-4 shadow-sm active:bg-surface-muted"
          >
            <TriangleAlert class="h-5 w-5" :class="fiscal?.totals.rejected ? 'text-danger' : 'text-muted'" />
            <strong class="mt-3 block text-2xl" :class="fiscal?.totals.rejected ? 'text-danger' : 'text-text'">{{ fiscal?.totals.rejected ?? '—' }}</strong>
            <span class="mt-0.5 block text-sm text-muted">DTE rechazados</span>
          </a>
        </div>
      </section>

      <section v-if="workshopEnabled" class="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div class="border-b border-line px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wide text-muted">Requieren atención</h2>
        </div>
        <div v-if="workshop && (workshop.orders.urgent || workshop.orders.awaiting_approval || workshop.orders.ready)" class="divide-y divide-line">
          <a v-if="workshop.orders.urgent" :href="`${base}/ordenes?priority=urgent`" class="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-danger-soft">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger"><TriangleAlert class="h-5 w-5" /></span>
            <div class="min-w-0 flex-1"><strong class="block text-sm text-text">{{ workshop.orders.urgent }} urgente{{ workshop.orders.urgent === 1 ? '' : 's' }}</strong><span class="text-xs text-muted">Necesitan atención prioritaria</span></div>
            <ArrowRight class="h-5 w-5 shrink-0 text-muted" />
          </a>
          <a v-if="workshop.orders.awaiting_approval" :href="`${base}/ordenes?status=awaiting_approval`" class="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-warning-soft">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning-soft text-warning"><ClipboardCheck class="h-5 w-5" /></span>
            <div class="min-w-0 flex-1"><strong class="block text-sm text-text">{{ workshop.orders.awaiting_approval }} por aprobar</strong><span class="text-xs text-muted">Esperando respuesta del cliente</span></div>
            <ArrowRight class="h-5 w-5 shrink-0 text-muted" />
          </a>
          <a v-if="workshop.orders.ready" :href="`${base}/ordenes?status=ready`" class="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-success-soft">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-soft text-success"><PackageCheck class="h-5 w-5" /></span>
            <div class="min-w-0 flex-1"><strong class="block text-sm text-text">{{ workshop.orders.ready }} lista{{ workshop.orders.ready === 1 ? '' : 's' }}</strong><span class="text-xs text-muted">Preparadas para entregar</span></div>
            <ArrowRight class="h-5 w-5 shrink-0 text-muted" />
          </a>
        </div>
        <p v-else class="px-4 py-5 text-sm text-muted">Todo al día. No hay órdenes que requieran atención inmediata.</p>
      </section>

      <section v-if="workshopEnabled" class="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 class="text-sm font-bold uppercase tracking-wide text-muted">Trabajo reciente</h2>
          <a :href="`${base}/ordenes`" class="text-sm font-semibold text-primary">Ver todo</a>
        </div>
        <div v-if="workshop?.recent_orders.length" class="divide-y divide-line">
          <a v-for="order in workshop.recent_orders.slice(0, 4)" :key="order.id" :href="orderUrl(order)" class="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 active:bg-surface-muted">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2"><strong class="text-sm text-primary">{{ order.ticket }}</strong><UiStatusBadge :tone="tone(order.status)">{{ labels[order.status] || order.status }}</UiStatusBadge></div>
              <p class="mt-1 truncate text-sm font-medium text-text">{{ order.device.brand }} {{ order.device.model }} · {{ order.customer.name }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ orderAge(order.received_at) }}</p>
            </div>
            <ArrowRight class="h-5 w-5 shrink-0 text-muted" />
          </a>
        </div>
        <p v-else class="px-4 py-6 text-center text-sm text-muted">Aún no hay órdenes activas.</p>
      </section>

      <section v-else class="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <div><h2 class="text-sm font-bold uppercase tracking-wide text-muted">Estado fiscal</h2><p class="mt-1 text-xs text-muted">Documentos procesados por Hacienda</p></div>
          <UiStatusBadge :tone="!fiscal ? 'neutral' : fiscal.totals.rejected ? 'warning' : 'success'">{{ !fiscal ? 'Sin datos' : fiscal.totals.rejected ? 'Revisar' : 'Operativo' }}</UiStatusBadge>
        </div>
        <div class="divide-y divide-line px-4 text-sm">
          <div class="flex items-center justify-between py-3.5"><span class="text-muted">IVA generado este mes</span><strong class="text-text">{{ commercial ? money(commercial.sales_tax_month) : '—' }}</strong></div>
          <div class="flex items-center justify-between py-3.5"><span class="text-muted">IVA deducible</span><strong class="text-success">− {{ commercial ? money(commercial.purchase_tax_credit_month) : '—' }}</strong></div>
          <div class="flex items-center justify-between py-3.5"><span class="font-semibold text-text">{{ hasEstimatedTaxCredit ? 'Crédito fiscal a favor' : 'IVA estimado por pagar' }}</span><strong :class="hasEstimatedTaxCredit ? 'text-success' : 'text-text'">{{ commercial ? money(estimatedTaxAmount) : '—' }}</strong></div>
        </div>
      </section>

    </div>

    <div class="hidden space-y-5 md:block">
    <section class="flex flex-col gap-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary-soft to-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p class="text-sm font-semibold uppercase tracking-wide text-primary">{{ workshopEnabled ? 'Resumen del taller' : 'Resumen de facturación' }}</p><h2 class="mt-1 text-2xl font-bold text-text">Lo importante para hoy</h2><p class="mt-1 text-sm text-muted">{{ workshopEnabled ? 'Órdenes, cobros y facturación en un solo vistazo.' : 'Ventas y documentos fiscales en un solo vistazo.' }}</p></div>
      <div class="flex flex-wrap gap-2"><a v-if="workshopEnabled" :href="`${base}/recepcion`" class="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast transition hover:bg-primary-hover"><Smartphone class="h-4 w-4" />Recibir equipo</a><a :href="invoiceHref" class="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-text transition hover:bg-surface-muted"><FileCheck2 class="h-4 w-4" />Nueva factura</a><UiButton variant="ghost" size="sm" :disabled="loading" aria-label="Actualizar dashboard" @click="load"><RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" /></UiButton></div>
    </section>

    <p v-if="error" class="rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UiCard><div class="flex items-start justify-between gap-3"><div><p class="text-sm text-muted">Ventas de hoy</p><p class="mt-2 text-2xl font-bold text-text">{{ commercial ? money(commercial.sales_today) : '—' }}</p><p class="mt-1 text-xs text-muted">Neto {{ commercial ? money(commercial.sales_net_today) : '—' }} · IVA {{ commercial ? money(commercial.sales_tax_today) : '—' }}</p></div><span class="rounded-lg bg-success-soft p-2 text-success"><CircleDollarSign class="h-5 w-5" /></span></div></UiCard>
      <template v-if="workshopEnabled">
        <UiCard><div class="flex items-start justify-between"><div><p class="text-sm text-muted">Órdenes activas</p><p class="mt-2 text-2xl font-bold text-text">{{ workshop?.orders.active ?? '—' }}</p><p class="mt-1 text-xs text-muted">{{ workshop?.orders.received_today ?? 0 }} recibidas hoy</p></div><span class="rounded-lg bg-primary-soft p-2 text-primary"><Wrench class="h-5 w-5" /></span></div></UiCard>
        <a :href="`${base}/ordenes?status=ready`" class="block rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"><UiCard class="h-full transition hover:-translate-y-0.5 hover:border-success/50 hover:shadow"><div class="flex items-start justify-between"><div><p class="text-sm text-muted">Listas para entregar</p><p class="mt-2 text-2xl font-bold text-text">{{ workshop?.orders.ready ?? '—' }}</p><p class="mt-1 text-xs text-muted">Ver órdenes listas</p></div><span class="rounded-lg bg-success-soft p-2 text-success"><PackageCheck class="h-5 w-5" /></span></div></UiCard></a>
        <a :href="`${base}/ordenes-trabajo?tab=receivables`" class="block rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"><UiCard class="h-full transition hover:-translate-y-0.5 hover:border-warning/50 hover:shadow"><div class="flex items-start justify-between"><div><p class="text-sm text-muted">Por cobrar</p><p class="mt-2 text-2xl font-bold" :class="workshop?.commercial.receivables ? 'text-warning' : 'text-text'">{{ workshop ? money(workshop.commercial.receivables) : '—' }}</p><p class="mt-1 text-xs text-muted">Ver cuentas pendientes</p></div><span class="rounded-lg bg-warning-soft p-2 text-warning"><Clock3 class="h-5 w-5" /></span></div></UiCard></a>
      </template>
      <template v-else>
        <UiCard><div class="flex items-start justify-between"><div><p class="text-sm text-muted">Ventas del mes</p><p class="mt-2 text-2xl font-bold text-text">{{ commercial ? money(commercial.sales_month) : '—' }}</p><p class="mt-1 text-xs text-muted">Neto {{ commercial ? money(commercial.sales_net_month) : '—' }} · IVA {{ commercial ? money(commercial.sales_tax_month) : '—' }}</p></div><span class="rounded-lg bg-primary-soft p-2 text-primary"><CalendarDays class="h-5 w-5" /></span></div></UiCard>
        <UiCard><div class="flex items-start justify-between"><div><p class="text-sm text-muted">DTE aceptados</p><p class="mt-2 text-2xl font-bold text-text">{{ fiscal?.totals.accepted ?? '—' }}</p><p class="mt-1 text-xs text-muted">Documentos procesados por MH</p></div><span class="rounded-lg bg-success-soft p-2 text-success"><FileCheck2 class="h-5 w-5" /></span></div></UiCard>
        <UiCard><div class="flex items-start justify-between"><div><p class="text-sm text-muted">DTE rechazados</p><p class="mt-2 text-2xl font-bold" :class="fiscal?.totals.rejected ? 'text-danger' : 'text-text'">{{ fiscal?.totals.rejected ?? '—' }}</p><p class="mt-1 text-xs text-muted">Requieren revisión</p></div><span class="rounded-lg bg-danger-soft p-2 text-danger"><TriangleAlert class="h-5 w-5" /></span></div></UiCard>
      </template>
    </section>

    <section v-if="workshop && (workshop.orders.urgent || workshop.orders.awaiting_approval || workshop.orders.ready)" class="grid gap-3 md:grid-cols-3">
      <a v-if="workshop.orders.urgent" :href="`${base}/ordenes?priority=urgent`" class="flex items-center gap-3 rounded-lg border border-danger bg-danger-soft p-4 text-danger transition hover:brightness-95"><TriangleAlert class="h-6 w-6 shrink-0" /><div><strong>{{ workshop.orders.urgent }} urgente{{ workshop.orders.urgent === 1 ? '' : 's' }}</strong><p class="text-xs opacity-80">Necesitan atención prioritaria</p></div><ArrowRight class="ml-auto h-4 w-4" /></a>
      <a v-if="workshop.orders.awaiting_approval" :href="`${base}/ordenes?status=awaiting_approval`" class="flex items-center gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-warning transition hover:brightness-95"><ClipboardCheck class="h-6 w-6 shrink-0" /><div><strong>{{ workshop.orders.awaiting_approval }} por aprobar</strong><p class="text-xs opacity-80">Esperando respuesta del cliente</p></div><ArrowRight class="ml-auto h-4 w-4" /></a>
      <a v-if="workshop.orders.ready" :href="`${base}/ordenes?status=ready`" class="flex items-center gap-3 rounded-lg border border-success bg-success-soft p-4 text-success transition hover:brightness-95"><PackageCheck class="h-6 w-6 shrink-0" /><div><strong>{{ workshop.orders.ready }} lista{{ workshop.orders.ready === 1 ? '' : 's' }}</strong><p class="text-xs opacity-80">Preparadas para entregar</p></div><ArrowRight class="ml-auto h-4 w-4" /></a>
    </section>

    <section v-if="workshopEnabled" class="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
      <UiCard class="overflow-hidden p-0"><div class="flex items-center justify-between border-b border-line px-5 py-4"><div><h3 class="font-semibold text-text">Trabajo en curso</h3><p class="mt-1 text-xs text-muted">Últimas órdenes que siguen activas</p></div><a :href="`${base}/ordenes`" class="text-sm font-semibold text-primary hover:underline">Ver todas</a></div><div v-if="workshop?.recent_orders.length" class="divide-y divide-line"><a v-for="order in workshop.recent_orders" :key="order.id" :href="orderUrl(order)" class="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-muted"><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><strong class="text-primary">{{ order.ticket }}</strong><UiStatusBadge :tone="tone(order.status)">{{ labels[order.status] || order.status }}</UiStatusBadge><UiStatusBadge v-if="order.priority === 'urgent'" tone="danger">Urgente</UiStatusBadge></div><p class="mt-1 truncate text-sm font-medium text-text">{{ order.customer.name }} · {{ order.device.brand }} {{ order.device.model }}</p><p class="mt-0.5 truncate text-xs text-muted">{{ order.reported_fault }}</p></div><span class="shrink-0 text-xs text-muted">{{ orderAge(order.received_at) }}</span><ArrowRight class="h-4 w-4 shrink-0 text-muted" /></a></div><p v-else class="px-5 py-10 text-center text-sm text-muted">No hay órdenes activas. Buen momento para recibir el siguiente equipo.</p></UiCard>

      <div class="space-y-5">
        <UiCard><div class="flex items-center gap-2"><CalendarDays class="h-5 w-5 text-primary" /><h3 class="font-semibold text-text">{{ hasEstimatedTaxCredit ? 'Crédito fiscal a favor' : 'IVA estimado por pagar' }}</h3></div><p class="mt-4 text-3xl font-bold" :class="hasEstimatedTaxCredit ? 'text-success' : 'text-text'">{{ commercial ? money(estimatedTaxAmount) : '—' }}</p><p class="mt-1 text-xs text-muted">Estimación del mes en curso</p><div class="mt-5 divide-y divide-line text-sm"><div class="flex items-center justify-between py-2.5"><span class="text-muted">IVA generado en ventas</span><strong class="text-text">{{ commercial ? money(commercial.sales_tax_month) : '—' }}</strong></div><div class="flex items-center justify-between py-2.5"><span class="text-muted">IVA deducible en compras</span><strong class="text-success">− {{ commercial ? money(commercial.purchase_tax_credit_month) : '—' }}</strong></div></div></UiCard>
        <UiCard><div class="flex items-center justify-between"><div><p class="text-sm font-semibold text-text">Estado fiscal</p><p class="mt-1 text-xs text-muted">Documentos procesados por MH</p></div><UiStatusBadge :tone="!fiscal ? 'neutral' : fiscal.totals.rejected ? 'warning' : 'success'">{{ !fiscal ? 'Sin datos' : fiscal.totals.rejected ? 'Revisar' : 'Operativo' }}</UiStatusBadge></div><div class="mt-4 grid grid-cols-2 gap-3 text-sm"><div class="rounded-lg bg-success-soft p-3"><p class="text-xs text-success">Aceptados</p><strong class="mt-1 block text-lg text-text">{{ fiscal?.totals.accepted ?? '—' }}</strong></div><div class="rounded-lg bg-danger-soft p-3"><p class="text-xs text-danger">Rechazados</p><strong class="mt-1 block text-lg text-text">{{ fiscal?.totals.rejected ?? '—' }}</strong></div></div></UiCard>
      </div>
    </section>

    <section v-else class="grid gap-5 lg:grid-cols-2">
      <UiCard><div class="flex items-center gap-2"><CircleDollarSign class="h-5 w-5 text-primary" /><h3 class="font-semibold text-text">Resumen comercial</h3></div><div class="mt-4 divide-y divide-line text-sm"><div class="flex items-center justify-between py-3"><span class="text-muted">Venta bruta de hoy</span><strong class="text-text">{{ commercial ? money(commercial.sales_today) : '—' }}</strong></div><div class="flex items-center justify-between py-3"><span class="text-muted">Venta neta de hoy</span><strong class="text-text">{{ commercial ? money(commercial.sales_net_today) : '—' }}</strong></div><div class="flex items-center justify-between py-3"><span class="text-muted">IVA generado este mes</span><strong class="text-text">{{ commercial ? money(commercial.sales_tax_month) : '—' }}</strong></div><div class="flex items-center justify-between py-3"><span class="text-muted">IVA deducible en compras</span><strong class="text-success">{{ commercial ? `− ${money(commercial.purchase_tax_credit_month)}` : '—' }}</strong></div><div class="flex items-center justify-between py-3"><span class="font-semibold text-text">{{ hasEstimatedTaxCredit ? 'Crédito fiscal a favor' : 'IVA estimado por pagar' }}</span><strong :class="hasEstimatedTaxCredit ? 'text-success' : 'text-text'">{{ commercial ? money(estimatedTaxAmount) : '—' }}</strong></div></div></UiCard>
      <UiCard><div class="flex items-center justify-between"><div><p class="font-semibold text-text">Estado fiscal</p><p class="mt-1 text-xs text-muted">Documentos procesados por Hacienda</p></div><UiStatusBadge :tone="!fiscal ? 'neutral' : fiscal.totals.rejected ? 'warning' : 'success'">{{ !fiscal ? 'Sin datos' : fiscal.totals.rejected ? 'Revisar' : 'Operativo' }}</UiStatusBadge></div><div class="mt-5 grid grid-cols-2 gap-3 text-sm"><div class="rounded-lg bg-success-soft p-4"><p class="text-xs text-success">Aceptados</p><strong class="mt-1 block text-2xl text-text">{{ fiscal?.totals.accepted ?? '—' }}</strong></div><div class="rounded-lg bg-danger-soft p-4"><p class="text-xs text-danger">Rechazados</p><strong class="mt-1 block text-2xl text-text">{{ fiscal?.totals.rejected ?? '—' }}</strong></div></div></UiCard>
    </section>
    </div>
  </div>
</template>
