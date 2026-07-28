<script setup lang="ts">
import { reactive, ref } from 'vue';
import { CheckCircle2, ChevronRight, ClipboardCheck, HandCoins, Microscope, Play, Wrench, XCircle } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

defineProps<{ orders: WorkshopOrder[] }>();
const emit = defineEmits<{ update: [id: number, payload: Record<string, unknown>] }>();
const drafts = reactive<Record<number, { diagnosis: string; estimatedTotal: string; approvalMethod: string; approvalNotes: string; paymentAmount: string; paymentMethod: 'cash'|'card'|'transfer'|'other'; paymentReference: string }>>({});
const saving = ref<number | null>(null);
const approvalMethods = [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'call', label: 'Llamada' }, { value: 'in_person', label: 'Presencial' }];
const paymentMethods = [{ value: 'cash', label: 'Efectivo' }, { value: 'card', label: 'Tarjeta' }, { value: 'transfer', label: 'Transferencia' }, { value: 'other', label: 'Otro' }];
const statusLabels: Record<string, string> = { received: 'Recibido', diagnosing: 'En diagnóstico', awaiting_approval: 'Esperando aprobación', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo' };
const testLabels: Record<string, string> = { display: 'Imagen', touch_controls: 'Touch / controles', charging: 'Carga', cameras: 'Cámaras', audio: 'Audio', microphone: 'Micrófono', buttons: 'Botones', connectivity: 'Conectividad' };
const resultLabels: Record<string, string> = { passed: 'Funciona', failed: 'Falla', not_tested: 'No probado' };
const statusTone = (status: string): 'neutral'|'success'|'warning'|'danger'|'info' => status === 'cancelled' ? 'danger' : ['ready','delivered'].includes(status) ? 'success' : ['diagnosing','awaiting_approval'].includes(status) ? 'warning' : ['received','approved','repairing'].includes(status) ? 'info' : 'neutral';

function draft(order: WorkshopOrder) {
  return drafts[order.id] ||= { diagnosis: order.diagnosis || '', estimatedTotal: order.estimated_total?.toString() || '', approvalMethod: 'whatsapp', approvalNotes: '', paymentAmount: '', paymentMethod: 'cash', paymentReference: '' };
}
function submit(order: WorkshopOrder, payload: Record<string, unknown>) {
  saving.value = order.id;
  emit('update', order.id, payload);
  window.setTimeout(() => { if (saving.value === order.id) saving.value = null; }, 600);
}
function saveDiagnosis(order: WorkshopOrder, requestApproval = false) {
  const value = draft(order);
  submit(order, { status: requestApproval ? 'awaiting_approval' : 'diagnosing', diagnosis: value.diagnosis.trim(), estimated_total: value.estimatedTotal === '' ? null : Number(value.estimatedTotal) });
}
function decide(order: WorkshopOrder, decision: 'approved' | 'rejected') {
  const value = draft(order);
  const paymentAmount = Number(value.paymentAmount || 0);
  submit(order, { approval_decision: decision, approval_method: value.approvalMethod, approval_notes: value.approvalNotes.trim() || null, ...(decision === 'approved' && paymentAmount > 0 ? { payment: { amount: paymentAmount, method: value.paymentMethod, reference: value.paymentReference.trim() || null } } : {}) });
}
</script>

<template>
  <div class="grid gap-4">
    <UiCard v-for="order in orders" :key="order.id" class="border-0 p-0 shadow-none sm:border sm:p-6 sm:shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex gap-3"><Microscope class="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p class="font-semibold text-text">{{ order.ticket }} · {{ order.device.brand }} {{ order.device.model }}</p><p class="mt-1 text-sm text-muted">{{ order.customer.name }} · {{ order.reported_fault }}</p></div></div>
        <UiStatusBadge :tone="statusTone(order.status)">{{ statusLabels[order.status] || order.status }}</UiStatusBadge>
      </div>

      <details v-if="Object.keys(order.device.functional_tests).length" class="mt-4 rounded-xl border border-line bg-surface-muted px-3 py-2 sm:mt-5 sm:border-0 sm:border-t sm:bg-transparent sm:px-0 sm:pt-4" open>
        <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Pruebas de recepción</summary>
        <div class="mt-2 flex flex-wrap gap-2"><UiStatusBadge v-for="(result, test) in order.device.functional_tests" :key="test" :tone="result === 'passed' ? 'success' : result === 'failed' ? 'danger' : 'neutral'">{{ testLabels[test] || test }}: {{ resultLabels[result] || result }}</UiStatusBadge></div>
      </details>

      <div v-if="order.status === 'received'" class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-4">
        <div><p class="font-semibold text-text">Iniciar revisión técnica</p><p class="text-sm text-muted">Comienza la revisión y registra lo que encuentres.</p></div>
        <UiButton class="w-full justify-center sm:w-auto" :disabled="saving === order.id" @click="submit(order, { status: 'diagnosing' })"><Play class="h-4 w-4" />Iniciar diagnóstico</UiButton>
      </div>

      <div v-else-if="order.status === 'diagnosing'" class="mt-5 grid gap-4 border-t border-line pt-5">
        <UiTextarea v-model="draft(order).diagnosis" label="Diagnóstico técnico" :rows="3" placeholder="Describe la causa encontrada y el trabajo recomendado" />
        <UiInput v-model="draft(order).estimatedTotal" class="max-w-sm" label="Presupuesto estimado" type="number" min="0" step="0.01" />
        <div class="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0"><UiButton class="justify-center" variant="secondary" :disabled="saving === order.id" @click="saveDiagnosis(order)">Guardar avance</UiButton><UiButton class="justify-center" :disabled="saving === order.id || !draft(order).diagnosis.trim() || draft(order).estimatedTotal === ''" @click="saveDiagnosis(order, true)"><ClipboardCheck class="h-4 w-4" />Solicitar aprobación<ChevronRight class="hidden h-4 w-4 sm:block" /></UiButton></div>
      </div>

      <div v-else-if="order.status === 'awaiting_approval'" class="mt-5 grid gap-4 border-t border-line pt-5">
        <div class="rounded-lg border border-warning bg-warning-soft p-4"><p class="font-semibold text-warning">Presupuesto pendiente de decisión</p><p class="mt-1 text-sm text-text">{{ order.diagnosis }}</p><p class="mt-2 text-lg font-semibold text-text">${{ Number(order.estimated_total || 0).toFixed(2) }}</p></div>
        <div class="grid gap-3 sm:grid-cols-2"><UiSelect v-model="draft(order).approvalMethod" label="¿Cómo respondió el cliente?" :options="approvalMethods" /><UiInput v-model="draft(order).approvalNotes" label="Nota de confirmación" placeholder="Opcional" /></div>
        <div class="rounded-lg border border-line bg-surface-muted p-4"><div class="flex items-center gap-2"><HandCoins class="h-4 w-4 text-primary" /><p class="font-semibold text-text">Abono al autorizar (opcional)</p></div><p class="mt-1 text-xs text-muted">Si el cliente abona para iniciar el trabajo, regístralo junto con la aprobación.</p><div class="mt-3 grid gap-3 sm:grid-cols-3"><UiInput v-model="draft(order).paymentAmount" label="Monto recibido" type="number" min="0" :max="order.balance" step="0.01" /><UiSelect v-if="Number(draft(order).paymentAmount || 0) > 0" v-model="draft(order).paymentMethod" label="Forma de pago" :options="paymentMethods" /><UiInput v-if="Number(draft(order).paymentAmount || 0) > 0" v-model="draft(order).paymentReference" label="Referencia" placeholder="Opcional" /></div></div>
        <div class="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0"><UiButton variant="secondary" class="justify-center text-danger" :disabled="saving === order.id" @click="decide(order, 'rejected')"><XCircle class="h-4 w-4" />Rechazó</UiButton><UiButton class="justify-center" :disabled="saving === order.id || Number(draft(order).paymentAmount || 0) > order.balance" @click="decide(order, 'approved')"><CheckCircle2 class="h-4 w-4" />Aprobó</UiButton></div>
      </div>

      <div v-else-if="order.status === 'approved'" class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success bg-success-soft p-4"><div><p class="font-semibold text-success">Trabajo autorizado por el cliente</p><p class="text-sm text-text">Ya puede iniciar la reparación.</p></div><UiButton class="w-full justify-center sm:w-auto" :disabled="saving === order.id" @click="submit(order, { status: 'repairing' })"><Wrench class="h-4 w-4" />Iniciar reparación</UiButton></div>
      <div v-else-if="order.status === 'repairing'" class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-4"><div><p class="font-semibold text-text">Reparación en proceso</p><p class="text-sm text-muted">Marca la orden como lista cuando finalicen las pruebas.</p></div><UiButton class="w-full justify-center sm:w-auto" :disabled="saving === order.id" @click="submit(order, { status: 'ready' })"><CheckCircle2 class="h-4 w-4" />Marcar como listo</UiButton></div>
    </UiCard>
    <UiCard v-if="orders.length === 0" class="p-10 text-center text-muted">No hay equipos pendientes de diagnóstico.</UiCard>
  </div>
</template>
