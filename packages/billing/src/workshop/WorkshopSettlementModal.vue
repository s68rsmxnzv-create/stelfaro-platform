<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, CircleDollarSign, FileText, RotateCcw } from 'lucide-vue-next';
import { UiButton, UiInput, UiModalShell, UiSelect, UiTextarea } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ order: WorkshopOrder | null }>();
const emit = defineEmits<{ close: []; settle: [id: number, payload: { action: 'deliver_close' | 'cancel_close'; final_total?: number; diagnostic_charge?: number; amount_received?: number; method?: 'cash' | 'card' | 'transfer' | 'other'; reference?: string | null; notes?: string | null; document_choice?: 'work_order'|'dte'; dte_type?: '01'|'03' }] }>();
const form = reactive({ finalTotal: '', diagnosticCharge: '0', amountReceived: '', method: 'cash' as 'cash'|'card'|'transfer'|'other', reference: '', notes: '', documentChoice: 'work_order' as 'work_order'|'dte', dteType: '01' as '01'|'03' });
const saving = ref(false);
const mobileStep = ref<1|2>(1);
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
  mobileStep.value = 1;
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
  <UiModalShell mobile-fullscreen :open="Boolean(order)" :title="isCancellation ? 'Resolver anticipo y cerrar' : 'Entregar y cerrar orden'" :description="order ? `${order.ticket} · ${order.customer.name}` : null" max-width="max-w-xl" :close-on-backdrop="!saving" @close="$emit('close')">
    <div v-if="order">
      <div v-if="!isCancellation" class="md:hidden">
        <div class="mb-5 grid grid-cols-2 gap-2">
          <button type="button" class="rounded-xl px-3 py-2 text-left" :class="mobileStep === 1 ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-muted'" @click="mobileStep = 1"><span class="block text-[10px] font-bold uppercase tracking-wide">Paso 1</span><strong class="text-sm">Cobro</strong></button>
          <button type="button" class="rounded-xl px-3 py-2 text-left" :class="mobileStep === 2 ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-muted'" :disabled="amountReceived > amountToCollect" @click="mobileStep = 2"><span class="block text-[10px] font-bold uppercase tracking-wide">Paso 2</span><strong class="text-sm">Cierre</strong></button>
        </div>

        <section v-if="mobileStep === 1" class="space-y-4">
          <div class="grid grid-cols-3 gap-2 rounded-2xl bg-surface-muted p-3 text-sm">
            <div><span class="block text-[10px] font-bold uppercase text-muted">Total</span><strong class="mt-1 block text-text">{{ money(finalTotal) }}</strong></div>
            <div><span class="block text-[10px] font-bold uppercase text-muted">Anticipo</span><strong class="mt-1 block text-success">{{ money(order.paid_total) }}</strong></div>
            <div class="text-right"><span class="block text-[10px] font-bold uppercase text-muted">Pendiente</span><strong class="mt-1 block text-warning">{{ money(amountToCollect) }}</strong></div>
          </div>

          <UiInput v-model="form.finalTotal" label="Total final del trabajo" type="number" min="0" step="0.01" inputmode="decimal" />

          <div>
            <p class="mb-2 text-sm font-semibold text-text">¿Cuánto recibe ahora?</p>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="min-h-12 rounded-xl border px-3 text-sm font-bold" :class="amountReceived === amountToCollect ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-text'" @click="form.amountReceived = amountToCollect.toFixed(2)">Cobrar saldo</button>
              <button type="button" class="min-h-12 rounded-xl border px-3 text-sm font-bold" :class="amountReceived === 0 ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-text'" @click="form.amountReceived = '0.00'">Dejar pendiente</button>
            </div>
          </div>

          <UiInput v-model="form.amountReceived" label="Monto recibido ahora" type="number" min="0" :max="amountToCollect" step="0.01" inputmode="decimal" />
          <div v-if="amountReceived > 0" class="grid grid-cols-2 gap-3">
            <UiSelect v-model="form.method" label="Forma de pago" :options="methods" />
            <UiInput v-model="form.reference" label="Referencia" placeholder="Opcional" />
          </div>

          <p v-if="remainingAfterDelivery > 0" class="rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">Quedarán {{ money(remainingAfterDelivery) }} por cobrar.</p>
          <p v-else class="rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">La orden quedará completamente pagada.</p>

          <div class="sticky bottom-0 -mx-4 grid grid-cols-[auto_1fr] gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <UiButton variant="secondary" @click="$emit('close')">Volver</UiButton>
            <UiButton class="justify-center" :disabled="amountReceived > amountToCollect" @click="mobileStep = 2">Continuar<ChevronRight class="h-4 w-4" /></UiButton>
          </div>
        </section>

        <section v-else class="space-y-4">
          <div class="flex items-center justify-between rounded-2xl bg-surface-muted p-3">
            <div><span class="block text-[10px] font-bold uppercase text-muted">Se recibe</span><strong class="mt-1 block text-lg text-success">{{ money(amountReceived) }}</strong></div>
            <div class="text-right"><span class="block text-[10px] font-bold uppercase text-muted">Saldo posterior</span><strong class="mt-1 block text-lg" :class="remainingAfterDelivery > 0 ? 'text-warning' : 'text-text'">{{ money(remainingAfterDelivery) }}</strong></div>
          </div>

          <div>
            <p class="mb-2 text-sm font-semibold text-text">Al cerrar la orden</p>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="min-h-24 rounded-xl border p-3 text-left" :class="form.documentChoice === 'work_order' ? 'border-primary bg-primary-soft' : 'border-line bg-surface'" @click="form.documentChoice = 'work_order'"><CircleDollarSign class="h-5 w-5 text-primary" /><strong class="mt-2 block text-sm text-text">Solo cerrar</strong><span class="mt-1 block text-xs text-muted">Sin comprobante fiscal</span></button>
              <button type="button" class="min-h-24 rounded-xl border p-3 text-left" :class="form.documentChoice === 'dte' ? 'border-primary bg-primary-soft' : 'border-line bg-surface'" @click="form.documentChoice = 'dte'"><FileText class="h-5 w-5 text-primary" /><strong class="mt-2 block text-sm text-text">Emitir DTE</strong><span class="mt-1 block text-xs text-muted">Continuar a facturación</span></button>
            </div>
          </div>

          <div v-if="form.documentChoice === 'dte'">
            <p class="mb-2 text-sm font-semibold text-text">Tipo de comprobante</p>
            <div class="grid grid-cols-2 gap-2"><button type="button" class="min-h-12 rounded-xl border px-3 text-sm font-bold" :class="form.dteType === '01' ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-text'" @click="form.dteType = '01'">Factura</button><button type="button" class="min-h-12 rounded-xl border px-3 text-sm font-bold" :class="form.dteType === '03' ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-text'" @click="form.dteType = '03'">Crédito fiscal</button></div>
          </div>

          <details class="rounded-xl border border-line bg-surface">
            <summary class="cursor-pointer px-3 py-3 text-sm font-semibold text-text">Agregar observación <span class="font-normal text-muted">(opcional)</span></summary>
            <div class="border-t border-line p-3"><UiTextarea v-model="form.notes" label="Observación" :rows="2" placeholder="Opcional" /></div>
          </details>

          <div class="sticky bottom-0 -mx-4 grid grid-cols-[auto_1fr] gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <UiButton variant="secondary" :disabled="saving" @click="mobileStep = 1"><ChevronLeft class="h-4 w-4" />Cobro</UiButton>
            <UiButton class="justify-center" variant="success" :disabled="saving" @click="submit"><CircleDollarSign class="h-4 w-4" />{{ amountReceived <= 0 ? 'Entregar con saldo' : remainingAfterDelivery > 0 ? 'Abonar y entregar' : 'Cobrar y cerrar' }}</UiButton>
          </div>
        </section>
      </div>

      <div class="space-y-5" :class="!isCancellation ? 'hidden md:block' : ''">
      <div v-if="isCancellation" class="rounded-lg border border-warning bg-warning-soft p-4">
        <div class="flex gap-3"><RotateCcw class="mt-0.5 h-5 w-5 shrink-0 text-warning" /><div><p class="font-semibold text-text">Anticipo recibido: {{ money(order.paid_total) }}</p><p class="mt-1 text-sm text-muted">Indica si una parte se aplicará a diagnóstico o trabajo realizado. El resto quedará registrado como devolución.</p></div></div>
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

      <div v-if="!isCancellation"><p class="mb-2 text-sm font-medium text-text">¿Qué deseas hacer después del cierre?</p><div class="grid gap-2 sm:grid-cols-2"><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.documentChoice === 'work_order' ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-primary/50'" @click="form.documentChoice = 'work_order'"><strong class="text-sm text-text">Solo cerrar orden</strong><p class="mt-1 text-xs text-muted">Finaliza el cobro sin emitir un comprobante fiscal.</p></button><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.documentChoice === 'dte' ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-primary/50'" @click="form.documentChoice = 'dte'"><strong class="text-sm text-text">Emitir comprobante</strong><p class="mt-1 text-xs text-muted">Continúa a Facturación con los datos de esta orden.</p></button></div></div>
      <div v-if="!isCancellation && form.documentChoice === 'dte'"><p class="mb-2 text-sm font-medium text-text">Tipo de comprobante</p><div class="grid grid-cols-2 gap-2"><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.dteType === '01' ? 'border-primary bg-primary-soft' : 'border-line bg-surface'" @click="form.dteType = '01'"><strong class="text-sm text-text">Factura electrónica</strong><p class="mt-1 text-xs text-muted">Consumidor final</p></button><button type="button" class="rounded-lg border p-3 text-left transition" :class="form.dteType === '03' ? 'border-primary bg-primary-soft' : 'border-line bg-surface'" @click="form.dteType = '03'"><strong class="text-sm text-text">Crédito fiscal</strong><p class="mt-1 text-xs text-muted">Requiere datos fiscales completos</p></button></div></div>

      <div class="sticky bottom-0 -mx-4 grid grid-cols-[auto_1fr] gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4"><UiButton variant="secondary" :disabled="saving" @click="$emit('close')">Volver</UiButton><UiButton class="justify-center" :variant="isCancellation ? 'secondary' : 'success'" :disabled="saving || (isCancellation && !form.notes.trim()) || (!isCancellation && amountReceived > amountToCollect)" @click="submit"><CircleDollarSign class="h-4 w-4" />{{ isCancellation ? amountToRefund > 0 ? 'Devolver y cerrar' : diagnosticAmountToCollect > 0 ? 'Cobrar y cerrar' : 'Cerrar cancelación' : amountReceived <= 0 ? 'Entregar con saldo pendiente' : remainingAfterDelivery > 0 ? 'Registrar abono y entregar' : 'Cobrar, entregar y cerrar' }}</UiButton></div>
      </div>
    </div>
  </UiModalShell>
</template>
