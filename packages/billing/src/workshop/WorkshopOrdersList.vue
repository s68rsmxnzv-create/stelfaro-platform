<script setup lang="ts">
import { ClipboardList, Search } from 'lucide-vue-next';
import { ref } from 'vue';
import { UiCard, UiInput, UiStatusBadge } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';
const props = defineProps<{ orders: WorkshopOrder[] }>();
const query = ref('');
const labels: Record<string, string> = { received: 'Recibido', diagnosing: 'Diagnóstico', awaiting_approval: 'Por aprobar', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };
function visible() { const q = query.value.toLowerCase(); return props.orders.filter(o => !q || `${o.ticket} ${o.customer.name} ${o.device.brand} ${o.device.model} ${o.device.imei || ''}`.toLowerCase().includes(q)); }
</script>
<template>
  <UiCard class="overflow-hidden">
    <div class="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between"><div class="flex items-center gap-3"><ClipboardList class="h-5 w-5 text-primary" /><div><h2 class="font-semibold text-text">Órdenes de servicio</h2><p class="text-sm text-muted">{{ orders.length }} órdenes registradas</p></div></div><div class="w-full sm:w-80"><UiInput v-model="query" label="Buscar" placeholder="Ticket, cliente, equipo o IMEI"><template #prefix><Search class="h-4 w-4" /></template></UiInput></div></div>
    <div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead class="bg-surface-muted text-muted"><tr><th class="px-4 py-3">Ticket</th><th class="px-4 py-3">Cliente y equipo</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Anticipo</th><th class="px-4 py-3">Ingreso</th></tr></thead><tbody class="divide-y divide-line"><tr v-for="order in visible()" :key="order.id" class="text-text"><td class="px-4 py-3 font-semibold text-primary">{{ order.ticket }}</td><td class="px-4 py-3"><strong>{{ order.customer.name }}</strong><p class="text-muted">{{ order.device.brand }} {{ order.device.model }} · {{ order.device.imei || order.device.serial_number || 'Sin identificador' }}</p></td><td class="px-4 py-3"><UiStatusBadge :tone="order.status === 'ready' ? 'success' : order.status === 'cancelled' ? 'danger' : 'neutral'">{{ labels[order.status] || order.status }}</UiStatusBadge></td><td class="px-4 py-3">${{ order.paid_total.toFixed(2) }}</td><td class="px-4 py-3 text-muted">{{ new Date(order.received_at).toLocaleDateString() }}</td></tr><tr v-if="visible().length === 0"><td colspan="5" class="px-4 py-10 text-center text-muted">No hay órdenes para mostrar.</td></tr></tbody></table></div>
  </UiCard>
</template>
