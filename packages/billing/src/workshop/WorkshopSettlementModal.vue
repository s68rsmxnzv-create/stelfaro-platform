<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { CircleDollarSign, RotateCcw, Truck } from 'lucide-vue-next';
import { UiButton, UiInput, UiModalShell, UiSelect, UiTextarea } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ order: WorkshopOrder | null }>();
const emit = defineEmits<{ close: []; settle: [id: number, payload: { action: 'deliver_close' | 'cancel_close'; final_total?: number; diagnostic_charge?: number; amount_received?: number; method?: 'cash' | 'card' | 'transfer' | 'other'; reference?: string | null; notes?: string | null; document_choice?: 'work_order'|'dte'; dte_type?: '01'|'03' }] }>();
const form = reactive({ finalTotal: '', diagnosticCharge: '0', amountReceived: '', method: 'cash' as 'cash'|'card'|'transfer'|'other', reference: '', notes: '', documentChoice: 'work_order' as 'work_order'|'dte', dteType: '01' as '01'|'03' });
const saving = ref(false);
const isCancellation = computed(() => props.order?.status === 'cancelled');
const finalTotal = computed(() => Math.max(0, Number(form.finalTotal || 0)));
const diagnosticCharge = computed(() => Math.max(0, Number(form.diagnosticCharge || 0)));
const amountToCollect = computed(() => Math.max(0, finalTotal.value - (props.order?.paid_total || 0)));
const amountReceived = computed(() => Math.max(0, Number(form.amountReceived || 0)));
const remainingAfterDelivery = computed(() => Math.max(0, amountToCollect.value - amountReceived.value));
const amountToRefund = computed(() => Math.max(0, (props.order?.paid_total || 0) - diagnosticCharge.value));
const diagnosticAmountToCollect = computed(() => Math.max(0, diagnosticCharge.value - (props.order?.paid_total || 0)));
const methods = [{ value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' }, { value: 'transfer', label: 'Transferencia' }, { value: 'other', label: 'Otro' }];
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

watch(() => props.order, (order) => {
  if (!order) return;
  form.finalTotal = String(order.estimated_total ?? order.paid_total ?? 0);
  form.diagnosticCharge = '0'; form.amountReceived = Math.max(0, Number(form.finalTotal) - order.paid_total).toFixed(2); form.method = 'cash'; form.reference = ''; form.notes = ''; form.documentChoice = 'work_order'; form.dteType = '01';
}, { immediate: true });
function submit() {
  if (!props.order || saving.value) return;
  saving.value = true;
  emit('settle', props.order.id, isCancellation.value
    ? { action: 'cancel_close', diagnostic_charge: diagnosticCharge.value, method: amountToRefund.value > 0 || diagnosticAmountToCollect.value > 0 ? form.method : undefined, reference: form.reference || null, notes: form.notes || null }
    : { action: 'deliver_close', final_total: finalTotal.value, amount_received: amountReceived.value, method: amountReceived.value > 0 ? form.method : undefined, reference: form.reference || null, notes: form.notes || null, document_choice: form.documentChoice, dte_type: form.documentChoice === 'dte' ? form.dteType : undefined });
  window.setTimeout(() => { saving.value = false; }, 700);
}
</script>

<template>
  <UiModalShell :open="Boolean(order)" :title="isCancellation ? 'Resolver anticipo y cerrar' : 'Entregar y cerrar orden'" :description="order ? `${order.ticket} · ${order.customer.name}` : null" max-width="max-w-xl" :close-on-backdrop="!saving" @close="$emit('close')">
    <div v-if="order" class="space-y-5">
      <div v-if="isCancellation" class="rounded-lg border border-warning bg-warning-soft p-4">
        <div class="flex gap-3"><RotateCcw class="mt-0.5 h-5 w-5 shrink-0 text-warning" /><div><p class="font-semibold text-text">Anticipo recibido: {{ money(order.paid_total) }}</p><p class="mt-1 text-sm text-muted">Indica si una parte se aplicará a diagnóstico o trabajo realizado. El resto quedará registrado como devolución.</p></div></div>
      </div>
      <div v-else class="rounded-lg border border-success bg-success-soft p-4">
        <div class="flex gap-3"><Truck class="mt-0.5 h-5 w-5 shrink-0 text-success" /><div><p class="font-semibold text-text">Entrega y cierre en un solo paso</p><p class="mt-1 text-sm text-muted">Puedes cobrar ahora o entregar con saldo pendiente. El cierre registra la venta comercial, pero no genera factura.</p></div></div>
      </div>

      <UiInput v-if="isCancellation" v-model="form.diagnosticCharge" label="Costo de diagnóstico o trabajo realizado" type="number" min="0" step="0.01" />
      <UiInput v-else v-model="form.finalTotal" label="Total final del trabajo" type="number" min="0" step="0.01" />

      <div v-if="!isCancellation" class="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"><div class="sm:col-span-2"><p class="font-semibold text-text">Cobro al entregar</p><p class="text-xs text-muted">Puedes recibir todo, una parte o dejar el saldo completo pendiente.</p></div><UiInput v-model="form.amountReceived" label="Monto recibido ahora" type="number" min="0" :max="amountToCollect" step="0.01" /><div v-if="amountReceived > 0"><UiSelect v-model="form.method" label="Forma de pago" :options="methods" /></div><UiInput v-if="amountReceived > 0" v-model="form.reference" class="sm:col-span-2" label="Referencia" placeholder="Opcional" /></div>

      <div class="grid gap-3 rounded-lg border border-line bg-surface-muted p-4 text-sm" :class="isCancellation ? 'sm:grid-cols-3' : 'grid-cols-2'">
        <div><p class="text-muted">{{ isCancellation ? 'Anticipo recibido' : 'Ya recibido' }}</p><p class="mt-1 font-semibold text-text">{{ money(order.paid_total) }}</p></div>
        <div v-if="isCancellation"><p class="text-muted">Costo de diagnóstico</p><p class="mt-1 font-semibold text-text">{{ money(diagnosticCharge) }}</p></div>
        <div><p class="text-muted">{{ isCancellation ? amountToRefund > 0 ? 'A devolver' : diagnosticAmountToCollect > 0 ? 'A cobrar' : 'Movimiento' : 'Quedará por cobrar' }}</p><p class="mt-1 text-lg font-bold" :class="isCancellation || remainingAfterDelivery > 0 ? 'text-warning' : 'text-success'">{{ money(isCancellation ? amountToRefund || diagnosticAmountToCollect : remainingAfterDelivery) }}</p></div>
      </div>

      <div v-if="isCancellation && (amountToRefund > 0 || diagnosticAmountToCollect > 0)" class="grid gap-3 sm:grid-cols-2"><UiSelect v-model="form.method" :label="amountToRefund > 0 ? 'Forma de devolución' : 'Forma de cobro'" :options="methods" /><UiInput v-model="form.reference" label="Referencia" placeholder="Opcional" /></div>
      <UiTextarea v-model="form.notes" :label="isCancellation ? 'Motivo de cancelación' : 'Observación'" :rows="2" :placeholder="isCancellation ? 'Ej. No se encontró repuesto o no fue posible reparar' : 'Opcional'" />

      <div v-if="!isCancellation"><p class="mb-2 text-sm font-medium text-text">¿Qué deseas hacer después del cierre?</p><div class="grid gap-2 sm:grid-cols-2"><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.documentChoice === 'work_order' ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-primary/50'" @click="form.documentChoice = 'work_order'"><strong class="text-sm text-text">Solo cerrar orden</strong><p class="mt-1 text-xs text-muted">Orden de trabajo cobrada, sin documento fiscal por ahora.</p></button><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.documentChoice === 'dte' ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-primary/50'" @click="form.documentChoice = 'dte'"><strong class="text-sm text-text">Preparar DTE</strong><p class="mt-1 text-xs text-muted">Abrir facturación con cliente, concepto y total precargados.</p></button></div></div>
      <div v-if="!isCancellation && form.documentChoice === 'dte'"><p class="mb-2 text-sm font-medium text-text">Tipo de comprobante</p><div class="grid grid-cols-2 gap-2"><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.dteType === '01' ? 'border-primary bg-primary-soft' : 'border-line bg-surface'" @click="form.dteType = '01'"><strong class="text-sm text-text">Factura electrónica</strong><p class="mt-1 text-xs text-muted">Consumidor final</p></button><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.dteType === '03' ? 'border-primary bg-primary-soft' : 'border-line bg-surface'" @click="form.dteType = '03'"><strong class="text-sm text-text">Crédito fiscal</strong><p class="mt-1 text-xs text-muted">Requiere datos fiscales completos</p></button></div></div>

      <div class="flex justify-end gap-2 border-t border-line pt-4"><UiButton variant="secondary" :disabled="saving" @click="$emit('close')">Volver</UiButton><UiButton :variant="isCancellation ? 'secondary' : 'success'" :disabled="saving || (isCancellation && !form.notes.trim()) || (!isCancellation && amountReceived > amountToCollect)" @click="submit"><CircleDollarSign class="h-4 w-4" />{{ isCancellation ? amountToRefund > 0 ? 'Devolver y cerrar' : diagnosticAmountToCollect > 0 ? 'Cobrar y cerrar' : 'Cerrar cancelación' : amountReceived <= 0 ? 'Entregar con saldo pendiente' : remainingAfterDelivery > 0 ? 'Registrar abono y entregar' : 'Cobrar, entregar y cerrar' }}</UiButton></div>
    </div>
  </UiModalShell>
</template>
