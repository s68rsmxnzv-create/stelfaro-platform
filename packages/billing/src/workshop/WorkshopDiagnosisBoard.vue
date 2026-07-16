<script setup lang="ts">
import { reactive } from 'vue';
import { Microscope } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSelect, UiTextarea } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';
defineProps<{ orders: WorkshopOrder[] }>();
const emit = defineEmits<{ update: [id: number, payload: { status: string; diagnosis: string; estimated_total: number | null }] }>();
const drafts = reactive<Record<number, { diagnosis: string; estimated_total: string; status: string }>>({});
const statuses = [{value:'diagnosing',label:'Diagnosticando'},{value:'awaiting_approval',label:'Esperando aprobación'},{value:'approved',label:'Aprobado'},{value:'repairing',label:'En reparación'},{value:'ready',label:'Listo'}];
function draft(order: WorkshopOrder) { return drafts[order.id] ||= { diagnosis: order.diagnosis || '', estimated_total: order.estimated_total?.toString() || '', status: order.status === 'received' ? 'diagnosing' : order.status }; }
function save(order: WorkshopOrder) { const value = draft(order); emit('update', order.id, { status: value.status, diagnosis: value.diagnosis, estimated_total: value.estimated_total ? Number(value.estimated_total) : null }); }
</script>
<template><div class="grid gap-4 lg:grid-cols-2"><UiCard v-for="order in orders" :key="order.id" class="p-5"><div class="flex items-start justify-between gap-3"><div class="flex gap-3"><Microscope class="mt-1 h-5 w-5 text-primary" /><div><p class="font-semibold text-text">{{ order.ticket }} · {{ order.device.brand }} {{ order.device.model }}</p><p class="text-sm text-muted">{{ order.customer.name }} — {{ order.reported_fault }}</p></div></div></div><div class="mt-4 grid gap-3"><UiTextarea v-model="draft(order).diagnosis" label="Diagnóstico técnico" /><div class="grid gap-3 sm:grid-cols-2"><UiInput v-model="draft(order).estimated_total" label="Presupuesto" type="number" min="0" step="0.01" /><UiSelect v-model="draft(order).status" label="Estado" :options="statuses" /></div><div class="flex justify-end"><UiButton @click="save(order)">Guardar diagnóstico</UiButton></div></div></UiCard><UiCard v-if="orders.length === 0" class="p-10 text-center text-muted lg:col-span-2">No hay equipos pendientes de diagnóstico.</UiCard></div></template>
