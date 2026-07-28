<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { HandCoins } from 'lucide-vue-next';
import { UiButton, UiInput, UiModalShell, UiSelect, UiTextarea } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ order: WorkshopOrder | null }>();
const emit = defineEmits<{ close: []; pay: [id: number, payload: { amount: number; method: 'cash'|'card'|'transfer'|'other'; reference?: string|null; notes?: string|null }] }>();
const form = reactive({ amount: '', method: 'cash' as 'cash'|'card'|'transfer'|'other', reference: '', notes: '' });
const saving = ref(false);
const isAdvance = computed(() => Boolean(props.order && !props.order.financial.closed_at));
const methods = [{ value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' }, { value: 'transfer', label: 'Transferencia' }, { value: 'other', label: 'Otro' }];

watch(() => props.order, order => {
  if (!order) return;
  form.amount = order.balance.toFixed(2);
  form.method = 'cash';
  form.reference = '';
  form.notes = '';
}, { immediate: true });

function submit() {
  if (!props.order || saving.value) return;
  saving.value = true;
  emit('pay', props.order.id, { amount: Number(form.amount), method: form.method, reference: form.reference || null, notes: form.notes || null });
  window.setTimeout(() => { saving.value = false; }, 700);
}
</script>

<template>
  <UiModalShell mobile-fullscreen :open="Boolean(order)" :title="isAdvance ? 'Registrar anticipo' : 'Registrar pago'" :description="order ? `${order.ticket} · ${order.customer.name}` : null" max-width="max-w-lg" @close="$emit('close')">
    <div v-if="order" class="space-y-4">
      <div class="rounded-lg border border-warning bg-warning-soft p-4"><p class="text-sm text-muted">{{ isAdvance ? 'Saldo estimado' : 'Saldo pendiente' }}</p><p class="mt-1 text-2xl font-bold text-warning">${{ order.balance.toFixed(2) }}</p><p v-if="isAdvance" class="mt-1 text-xs text-muted">El anticipo aparecerá en Caja. La venta se mostrará cuando cierres la orden.</p></div>
      <UiInput v-model="form.amount" :label="isAdvance ? 'Anticipo recibido' : 'Monto recibido'" type="number" min="0.01" :max="order.balance" step="0.01" />
      <div class="grid gap-3 sm:grid-cols-2"><UiSelect v-model="form.method" label="Forma de pago" :options="methods" /><UiInput v-model="form.reference" label="Referencia" placeholder="Opcional" /></div>
      <UiTextarea v-model="form.notes" label="Observación" :rows="2" placeholder="Opcional" />
      <div class="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4"><UiButton class="flex-1 justify-center sm:flex-none" variant="secondary" @click="$emit('close')">Volver</UiButton><UiButton class="flex-[2] justify-center sm:flex-none" variant="success" :disabled="saving || Number(form.amount) <= 0 || Number(form.amount) > order.balance" @click="submit"><HandCoins class="h-4 w-4" />{{ isAdvance ? 'Registrar anticipo' : 'Registrar pago' }}</UiButton></div>
    </div>
  </UiModalShell>
</template>
