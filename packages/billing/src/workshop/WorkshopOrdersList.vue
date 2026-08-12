<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Filter, HandCoins, MessageCircle, Microscope, Printer, RotateCcw } from 'lucide-vue-next';
import { UiActionDropdown, UiActionMenuItem, UiButton, UiCard, UiInput, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ orders: WorkshopOrder[]; stats: Record<string, number>; meta: { current_page: number; last_page: number; per_page: number; total: number }; loading?: boolean }>();
const emit = defineEmits<{ search: [params: { q?: string; status?: string; priority?: string; payment_status?: string; date_from?: string; date_to?: string; page?: number; per_page?: number }]; select: [order: WorkshopOrder]; addPhotos: [order: WorkshopOrder]; diagnose: [order: WorkshopOrder]; pay: [order: WorkshopOrder]; print: [order: WorkshopOrder]; printReception: [order: WorkshopOrder]; whatsapp: [order: WorkshopOrder] }>();
const query = ref('');
const status = ref('');
const priority = ref('');
const paymentStatus = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const filtersOpen = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
const statusOptions = [
  { value: '', label: 'Todas' }, { value: 'received', label: 'Recibidas' }, { value: 'diagnosing', label: 'Diagnóstico' },
  { value: 'awaiting_approval', label: 'Por aprobar' }, { value: 'approved', label: 'Aprobadas' }, { value: 'repairing', label: 'Reparación' },
  { value: 'ready', label: 'Listas' }, { value: 'delivered', label: 'Entregadas' }, { value: 'cancelled', label: 'Canceladas' },
];
const quickStatuses = [{ value: 'received', label: 'Recibidas' }, { value: 'awaiting_approval', label: 'Por aprobar' }, { value: 'ready', label: 'Listas' }];
const activeFilterCount = computed(() => [status.value, priority.value, paymentStatus.value, dateFrom.value, dateTo.value].filter(Boolean).length);
const labels: Record<string, string> = { received: 'Recibido', diagnosing: 'Diagnóstico', awaiting_approval: 'Por aprobar', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };
function params(page = 1) { return { q: query.value || undefined, status: status.value || undefined, priority: priority.value || undefined, payment_status: paymentStatus.value || undefined, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined, page, per_page: props.meta.per_page }; }
function searchLater() { if (timer) clearTimeout(timer); timer = setTimeout(() => emit('search', params()), 300); }
function apply() { emit('search', params()); }
function chooseStatus(value: string) { status.value = value; apply(); }
function clearFilters() { status.value = ''; priority.value = ''; paymentStatus.value = ''; dateFrom.value = ''; dateTo.value = ''; apply(); }
function age(date: string) { const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000); return days <= 0 ? 'Hoy' : days === 1 ? '1 día' : `${days} días`; }
function workActionLabel(status: string) { return status === 'received' ? 'Iniciar diagnóstico' : status === 'diagnosing' ? 'Continuar diagnóstico' : status === 'awaiting_approval' ? 'Registrar respuesta del cliente' : status === 'approved' ? 'Iniciar reparación' : 'Gestionar reparación'; }
function statusTone(status: string): 'neutral'|'success'|'warning'|'danger'|'info' { if (status === 'cancelled') return 'danger'; if (['ready','delivered'].includes(status)) return 'success'; if (['diagnosing','awaiting_approval'].includes(status)) return 'warning'; if (['received','approved','repairing'].includes(status)) return 'info'; return 'neutral'; }
onBeforeUnmount(() => { if (timer) clearTimeout(timer); });
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  query.value = params.get('q') || '';
  status.value = params.get('status') || '';
  priority.value = params.get('priority') || '';
  paymentStatus.value = params.get('payment_status') || '';
  if (query.value || status.value || priority.value || paymentStatus.value) apply();
});
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-3 md:hidden">
      <header class="flex items-end justify-between gap-3 px-1 pb-1">
        <div>
          <h1 class="text-2xl font-black tracking-tight text-text">Órdenes</h1>
          <p class="mt-0.5 text-sm text-muted">Gestiona el taller desde aquí</p>
        </div>
        <span class="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{{ meta.total }}</span>
      </header>

      <section class="px-1">
        <UiSearchInput v-model="query" label="Buscar órdenes" placeholder="Ticket, cliente, equipo o teléfono" :show-button="false" @update:model-value="searchLater" @search="apply" />
      </section>

      <section class="grid grid-cols-3 gap-2">
        <button
          v-for="option in quickStatuses"
          :key="option.value"
          type="button"
          class="min-h-16 rounded-xl border px-2 py-2 text-center transition active:scale-[0.98]"
          :class="status === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted'"
          @click="chooseStatus(status === option.value ? '' : option.value)"
        >
          <strong class="block text-xl text-text">{{ stats[option.value] || 0 }}</strong>
          <span class="mt-0.5 block text-xs font-semibold">{{ option.label }}</span>
        </button>
      </section>

      <section class="overflow-hidden rounded-xl border border-line bg-surface">
        <button type="button" class="flex min-h-12 w-full items-center gap-3 px-4 text-left" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
          <Filter class="h-5 w-5 text-primary" />
          <span class="flex-1 text-sm font-bold text-text">Filtros</span>
          <span v-if="activeFilterCount" class="grid min-h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-black text-primary-contrast">{{ activeFilterCount }}</span>
          <ChevronDown class="h-5 w-5 text-muted transition" :class="filtersOpen ? 'rotate-180' : ''" />
        </button>
        <div v-if="filtersOpen" class="grid gap-3 border-t border-line bg-surface-muted/40 p-3">
          <UiSelect v-model="status" label="Estado" :options="statusOptions" @update:model-value="apply" />
          <div class="grid grid-cols-2 gap-3">
            <UiSelect v-model="priority" label="Prioridad" :options="[{value:'',label:'Todas'},{value:'urgent',label:'Urgente'},{value:'high',label:'Alta'},{value:'normal',label:'Normal'},{value:'low',label:'Baja'}]" @update:model-value="apply" />
            <UiSelect v-model="paymentStatus" label="Cobro" :options="[{value:'',label:'Todos'},{value:'receivable',label:'Por cobrar'}]" @update:model-value="apply" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UiInput v-model="dateFrom" type="date" label="Desde" @change="apply" />
            <UiInput v-model="dateTo" type="date" label="Hasta" @change="apply" />
          </div>
          <button v-if="activeFilterCount" type="button" class="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted active:bg-surface" @click="clearFilters"><RotateCcw class="h-4 w-4" />Limpiar filtros</button>
        </div>
      </section>

      <p class="px-1 text-xs font-medium text-muted">{{ meta.total }} orden{{ meta.total === 1 ? '' : 'es' }} encontrada{{ meta.total === 1 ? '' : 's' }}</p>

      <section v-if="orders.length" class="grid gap-3">
        <article v-for="order in orders" :key="order.id" class="rounded-2xl border border-line bg-surface shadow-sm">
          <button type="button" class="block w-full px-4 pb-3 pt-4 text-left active:bg-surface-muted" @click="$emit('select', order)">
            <span class="flex items-start justify-between gap-3">
              <span class="min-w-0">
                <span class="flex flex-wrap items-center gap-2">
                  <strong class="text-base text-primary">{{ order.ticket }}</strong>
                  <UiStatusBadge :tone="statusTone(order.status)">{{ labels[order.status] || order.status }}</UiStatusBadge>
                </span>
                <strong class="mt-2 block truncate text-base text-text">{{ order.customer.name }}</strong>
                <span class="mt-0.5 block truncate text-sm text-muted">{{ order.device.brand }} {{ order.device.model }} · {{ order.reception.equipment_label }}</span>
              </span>
              <span class="shrink-0 text-right">
                <strong class="block text-base" :class="order.balance > 0 ? 'text-warning' : 'text-text'">${{ order.balance.toFixed(2) }}</strong>
                <span class="mt-1 block text-xs text-muted">{{ age(order.received_at) }}</span>
              </span>
            </span>
            <span class="mt-3 block rounded-xl bg-surface-muted px-3 py-2 text-sm leading-5 text-text">{{ order.reported_fault }}</span>
            <span v-if="order.financial.closed_at" class="mt-2 block text-xs" :class="order.balance > 0 ? 'text-warning' : 'text-success'">{{ order.balance > 0 ? 'Cerrada · saldo pendiente' : order.billing.status === 'invoiced' ? 'Facturada' : 'Cerrada · sin facturar' }}</span>
          </button>

          <div class="flex items-center gap-2 border-t border-line px-3 py-2.5" @click.stop>
            <UiButton class="min-h-11 flex-1 justify-center" size="sm" variant="secondary" @click="$emit('select', order)">Ver orden</UiButton>
            <UiActionDropdown :label="`Acciones de ${order.ticket} ${order.reception.equipment_label}`">
              <UiActionMenuItem v-if="['received','diagnosing','awaiting_approval','approved','repairing'].includes(order.status)" @select="$emit('diagnose', order)"><template #icon><Microscope class="h-4 w-4" /></template>{{ workActionLabel(order.status) }}</UiActionMenuItem>
              <UiActionMenuItem v-if="!order.financial.closed_at && order.estimated_total !== null && order.balance > 0 && order.status !== 'cancelled'" @select="$emit('pay', order)"><template #icon><HandCoins class="h-4 w-4" /></template>Registrar anticipo</UiActionMenuItem>
              <UiActionMenuItem v-if="order.financial.closed_at && order.balance > 0 && order.status !== 'cancelled'" @select="$emit('pay', order)"><template #icon><HandCoins class="h-4 w-4" /></template>Registrar pago</UiActionMenuItem>
              <UiActionMenuItem :disabled="!order.customer.phone" @select="$emit('whatsapp', order)"><template #icon><MessageCircle class="h-4 w-4" /></template>Reenviar por WhatsApp</UiActionMenuItem>
              <UiActionMenuItem @select="$emit('printReception', order)"><template #icon><ClipboardCheck class="h-4 w-4" /></template>Reimprimir recepción</UiActionMenuItem>
              <UiActionMenuItem v-if="order.financial.closed_at" @select="$emit('print', order)"><template #icon><Printer class="h-4 w-4" /></template>{{ order.billing.status === 'invoiced' && order.billing.core_document_id ? 'Reimprimir DTE' : 'Imprimir orden cerrada' }}</UiActionMenuItem>
              <UiActionMenuItem @select="$emit('addPhotos', order)"><template #icon><Camera class="h-4 w-4" /></template>{{ order.photo_count ? 'Agregar fotos' : 'Agregar primera foto' }}</UiActionMenuItem>
            </UiActionDropdown>
          </div>
        </article>
      </section>
      <p v-else class="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-muted">No encontramos órdenes con estos filtros.</p>

      <div v-if="meta.last_page > 1" class="grid grid-cols-2 gap-2 pt-1">
        <UiButton class="w-full justify-center" variant="secondary" :disabled="loading || meta.current_page <= 1" @click="$emit('search', params(meta.current_page - 1))"><ChevronLeft class="mr-1 h-4 w-4" />Anterior</UiButton>
        <UiButton class="w-full justify-center" variant="secondary" :disabled="loading || meta.current_page >= meta.last_page" @click="$emit('search', params(meta.current_page + 1))">Siguiente<ChevronRight class="ml-1 h-4 w-4" /></UiButton>
      </div>
    </div>

    <UiCard class="hidden overflow-hidden md:block">
      <div class="border-b border-line p-5">
        <UiSearchInput v-model="query" label="Buscar órdenes" placeholder="Ticket, cliente, teléfono, equipo, IMEI, serie o falla" show-button button-label="Buscar" @update:model-value="searchLater" @search="apply" />
        <div class="mt-4 flex flex-wrap items-center gap-2"><span class="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Atajos</span><button v-for="option in quickStatuses" :key="option.value" type="button" class="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition" :class="status === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-primary/50'" @click="chooseStatus(status === option.value ? '' : option.value)"><span>{{ option.label }}</span><strong class="rounded-full bg-surface-muted px-1.5 py-0.5 text-xs text-text">{{ stats[option.value] || 0 }}</strong></button></div>
      </div>

      <div class="grid gap-3 border-b border-line bg-surface-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <UiSelect v-model="status" label="Estado" :options="statusOptions" @update:model-value="apply" />
        <UiSelect v-model="priority" label="Prioridad" :options="[{value:'',label:'Todas las prioridades'},{value:'urgent',label:'Urgente'},{value:'high',label:'Alta'},{value:'normal',label:'Normal'},{value:'low',label:'Baja'}]" @update:model-value="apply" />
        <UiSelect v-model="paymentStatus" label="Cobro" :options="[{value:'',label:'Todos'},{value:'receivable',label:'Por cobrar'}]" @update:model-value="apply" />
        <UiInput v-model="dateFrom" type="date" label="Desde" @change="apply" />
        <UiInput v-model="dateTo" type="date" label="Hasta" @change="apply" />
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[920px] text-left text-sm"><thead class="bg-surface-muted text-muted"><tr><th class="px-4 py-3">Orden</th><th class="px-4 py-3">Cliente y equipo</th><th class="px-4 py-3">Falla reportada</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Saldo</th><th class="px-4 py-3">Antigüedad</th><th class="px-4 py-3 text-right">Acciones</th></tr></thead><tbody class="divide-y divide-line"><tr v-for="order in orders" :key="order.id" class="sf-interactive-row cursor-pointer text-text" tabindex="0" @click="$emit('select', order)" @keydown.enter="$emit('select', order)"><td class="px-4 py-4"><strong class="text-primary">{{ order.ticket }}</strong><p class="mt-1 text-xs font-semibold text-muted">{{ order.reception.equipment_label }}<template v-if="order.reception.equipment_count > 1"> de {{ order.reception.equipment_count }}</template></p><p class="text-xs capitalize text-muted">{{ order.priority }}</p></td><td class="px-4 py-4"><strong>{{ order.customer.name }}</strong><p class="mt-1 text-muted">{{ order.device.brand }} {{ order.device.model }}</p><p class="text-xs text-muted">{{ order.device.imei || order.device.serial_number || 'Sin identificador' }}</p></td><td class="max-w-xs px-4 py-4"><p class="line-clamp-2">{{ order.reported_fault }}</p></td><td class="px-4 py-4"><UiStatusBadge :tone="statusTone(order.status)">{{ labels[order.status] || order.status }}</UiStatusBadge><p v-if="order.financial.closed_at" class="mt-1 text-xs" :class="order.balance > 0 ? 'text-warning' : 'text-success'">{{ order.balance > 0 ? 'Cerrada · saldo pendiente' : order.billing.status === 'invoiced' ? 'Facturada' : 'Cerrada · sin facturar' }}</p><p v-else-if="order.status === 'cancelled' && order.paid_total > 0" class="mt-1 text-xs font-medium text-warning">Anticipo por resolver</p></td><td class="px-4 py-4"><template v-if="order.status === 'cancelled' && order.financial.status !== 'settled'"><p class="font-semibold text-warning">${{ order.paid_total.toFixed(2) }}</p><p class="text-xs text-muted">por resolver</p></template><span v-else class="font-semibold">${{ order.balance.toFixed(2) }}</span></td><td class="px-4 py-4 text-muted">{{ age(order.received_at) }}</td><td class="px-4 py-4" @click.stop @keydown.stop><UiActionDropdown :label="`Acciones de ${order.ticket} ${order.reception.equipment_label}`"><UiActionMenuItem v-if="['received','diagnosing','awaiting_approval','approved','repairing'].includes(order.status)" @select="$emit('diagnose', order)"><template #icon><Microscope class="h-4 w-4" /></template>{{ workActionLabel(order.status) }}</UiActionMenuItem><UiActionMenuItem v-if="!order.financial.closed_at && order.estimated_total !== null && order.balance > 0 && order.status !== 'cancelled'" @select="$emit('pay', order)"><template #icon><HandCoins class="h-4 w-4" /></template>Registrar anticipo</UiActionMenuItem><UiActionMenuItem v-if="order.financial.closed_at && order.balance > 0 && order.status !== 'cancelled'" @select="$emit('pay', order)"><template #icon><HandCoins class="h-4 w-4" /></template>Registrar pago</UiActionMenuItem><UiActionMenuItem :disabled="!order.customer.phone" @select="$emit('whatsapp', order)"><template #icon><MessageCircle class="h-4 w-4" /></template>Reenviar por WhatsApp</UiActionMenuItem><UiActionMenuItem @select="$emit('printReception', order)"><template #icon><ClipboardCheck class="h-4 w-4" /></template>Reimprimir comprobante de recepción</UiActionMenuItem><UiActionMenuItem v-if="order.financial.closed_at" @select="$emit('print', order)"><template #icon><Printer class="h-4 w-4" /></template>{{ order.billing.status === 'invoiced' && order.billing.core_document_id ? 'Reimprimir DTE' : 'Imprimir orden cerrada' }}</UiActionMenuItem><UiActionMenuItem @select="$emit('addPhotos', order)"><template #icon><Camera class="h-4 w-4" /></template>{{ order.photo_count ? 'Agregar fotos' : 'Agregar primera foto' }}</UiActionMenuItem></UiActionDropdown></td></tr><tr v-if="!orders.length"><td colspan="7" class="px-4 py-12 text-center text-muted">No encontramos órdenes con estos filtros.</td></tr></tbody></table>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-line px-4 py-3"><p class="text-sm text-muted">{{ meta.total }} resultados · Página {{ meta.current_page }} de {{ meta.last_page }}</p><div class="flex gap-2"><UiButton variant="secondary" :disabled="loading || meta.current_page <= 1" @click="$emit('search', params(meta.current_page - 1))"><ChevronLeft class="mr-1 h-4 w-4" />Anterior</UiButton><UiButton variant="secondary" :disabled="loading || meta.current_page >= meta.last_page" @click="$emit('search', params(meta.current_page + 1))">Siguiente<ChevronRight class="ml-1 h-4 w-4" /></UiButton></div></div>
    </UiCard>
  </div>
</template>
