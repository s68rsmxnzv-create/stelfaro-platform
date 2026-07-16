<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ orders: WorkshopOrder[]; stats: Record<string, number>; meta: { current_page: number; last_page: number; per_page: number; total: number }; loading?: boolean }>();
const emit = defineEmits<{ search: [params: { q?: string; status?: string; priority?: string; date_from?: string; date_to?: string; page?: number; per_page?: number }]; select: [order: WorkshopOrder] }>();
const query = ref('');
const status = ref('');
const priority = ref('');
const dateFrom = ref('');
const dateTo = ref('');
let timer: ReturnType<typeof setTimeout> | null = null;
const statusOptions = [
  { value: '', label: 'Todas' }, { value: 'received', label: 'Recibidas' }, { value: 'diagnosing', label: 'Diagnóstico' },
  { value: 'awaiting_approval', label: 'Por aprobar' }, { value: 'approved', label: 'Aprobadas' }, { value: 'repairing', label: 'Reparación' },
  { value: 'ready', label: 'Listas' }, { value: 'delivered', label: 'Entregadas' }, { value: 'cancelled', label: 'Canceladas' },
];
const labels: Record<string, string> = { received: 'Recibido', diagnosing: 'Diagnóstico', awaiting_approval: 'Por aprobar', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };
const totalStats = computed(() => Object.values(props.stats).reduce((total, value) => total + value, 0));
function params(page = 1) { return { q: query.value || undefined, status: status.value || undefined, priority: priority.value || undefined, date_from: dateFrom.value || undefined, date_to: dateTo.value || undefined, page, per_page: props.meta.per_page }; }
function searchLater() { if (timer) clearTimeout(timer); timer = setTimeout(() => emit('search', params()), 300); }
function apply() { emit('search', params()); }
function chooseStatus(value: string) { status.value = value; apply(); }
function age(date: string) { const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000); return days <= 0 ? 'Hoy' : days === 1 ? '1 día' : `${days} días`; }
onBeforeUnmount(() => { if (timer) clearTimeout(timer); });
</script>

<template>
  <div class="space-y-4">
    <UiCard class="overflow-hidden">
      <div class="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between"><div class="flex items-center gap-3"><span class="grid h-11 w-11 place-items-center rounded-md bg-primary-soft text-primary"><ClipboardList class="h-5 w-5" /></span><div><h2 class="font-semibold text-text">Órdenes de servicio</h2><p class="text-sm text-muted">{{ meta.total }} órdenes encontradas</p></div></div><div class="w-full lg:w-96"><UiSearchInput v-model="query" label="Buscar órdenes" placeholder="Ticket, cliente, teléfono, equipo, IMEI o falla" @update:model-value="searchLater" @search="apply" /></div></div>

      <div class="grid grid-cols-3 gap-2 border-b border-line bg-surface-muted p-4 sm:grid-cols-5 lg:grid-cols-9">
        <button v-for="option in statusOptions" :key="option.value || 'all'" type="button" class="rounded-md border px-2 py-2 text-left transition" :class="status === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-primary/50'" @click="chooseStatus(option.value)"><span class="block text-xs font-medium">{{ option.label }}</span><strong class="mt-1 block text-base">{{ option.value ? (stats[option.value] || 0) : totalStats }}</strong></button>
      </div>

      <div class="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
        <UiSelect v-model="priority" label="Prioridad" :options="[{value:'',label:'Todas las prioridades'},{value:'urgent',label:'Urgente'},{value:'high',label:'Alta'},{value:'normal',label:'Normal'},{value:'low',label:'Baja'}]" @update:model-value="apply" />
        <UiInput v-model="dateFrom" type="date" label="Desde" @change="apply" />
        <UiInput v-model="dateTo" type="date" label="Hasta" @change="apply" />
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[850px] text-left text-sm"><thead class="bg-surface-muted text-muted"><tr><th class="px-4 py-3">Orden</th><th class="px-4 py-3">Cliente y equipo</th><th class="px-4 py-3">Falla reportada</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Saldo</th><th class="px-4 py-3">Antigüedad</th></tr></thead><tbody class="divide-y divide-line"><tr v-for="order in orders" :key="order.id" class="cursor-pointer text-text transition hover:bg-primary-soft/30" tabindex="0" @click="$emit('select', order)" @keydown.enter="$emit('select', order)"><td class="px-4 py-4"><strong class="text-primary">{{ order.ticket }}</strong><p class="mt-1 text-xs capitalize text-muted">{{ order.priority }}</p></td><td class="px-4 py-4"><strong>{{ order.customer.name }}</strong><p class="mt-1 text-muted">{{ order.device.brand }} {{ order.device.model }}</p><p class="text-xs text-muted">{{ order.device.imei || order.device.serial_number || 'Sin identificador' }}</p></td><td class="max-w-xs px-4 py-4"><p class="line-clamp-2">{{ order.reported_fault }}</p></td><td class="px-4 py-4"><UiStatusBadge :tone="order.status === 'ready' ? 'success' : order.status === 'cancelled' ? 'danger' : 'neutral'">{{ labels[order.status] || order.status }}</UiStatusBadge></td><td class="px-4 py-4 font-semibold">${{ order.balance.toFixed(2) }}</td><td class="px-4 py-4 text-muted">{{ age(order.received_at) }}</td></tr><tr v-if="!orders.length"><td colspan="6" class="px-4 py-12 text-center text-muted">No encontramos órdenes con estos filtros.</td></tr></tbody></table>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-line px-4 py-3"><p class="text-sm text-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</p><div class="flex gap-2"><UiButton variant="secondary" :disabled="loading || meta.current_page <= 1" @click="$emit('search', params(meta.current_page - 1))"><ChevronLeft class="mr-1 h-4 w-4" />Anterior</UiButton><UiButton variant="secondary" :disabled="loading || meta.current_page >= meta.last_page" @click="$emit('search', params(meta.current_page + 1))">Siguiente<ChevronRight class="ml-1 h-4 w-4" /></UiButton></div></div>
    </UiCard>
  </div>
</template>
