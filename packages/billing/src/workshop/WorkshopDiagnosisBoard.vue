<script setup lang="ts">
import { reactive, ref } from 'vue';
import { CheckCircle2, ChevronRight, ClipboardCheck, HandCoins, Microscope, Wrench, XCircle, Zap } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';
import WorkshopMaterialsPanel from './WorkshopMaterialsPanel.vue';

withDefaults(defineProps<{ orders: WorkshopOrder[]; tenantId: number; platformBaseUrl: string; embedded?: boolean }>(), { embedded: false });
const emit = defineEmits<{ update: [id: number, payload: Record<string, unknown>]; expandedChange: [expanded: boolean] }>();
const drafts = reactive<Record<number, { diagnosis: string; estimatedTotal: string; approvalMethod: string; approvalNotes: string; paymentAmount: string; paymentMethod: 'cash'|'card'|'transfer'|'other'; paymentReference: string }>>({});
const saving = ref<number | null>(null);
const directServiceOpen = ref<Record<number, boolean>>({});
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
function openDirectService(order: WorkshopOrder) {
  const value = draft(order);
  if (!value.diagnosis.trim()) value.diagnosis = order.reported_fault;
  directServiceOpen.value[order.id] = true;
  emit('expandedChange', true);
}
function closeDirectService(order: WorkshopOrder) {
  directServiceOpen.value[order.id] = false;
  emit('expandedChange', false);
}
function startDirectService(order: WorkshopOrder) {
  const value = draft(order);
  submit(order, {
    status: 'repairing',
    direct_service: true,
    diagnosis: value.diagnosis.trim(),
    estimated_total: value.estimatedTotal === '' ? null : Number(value.estimatedTotal),
  });
}
function decide(order: WorkshopOrder, decision: 'approved' | 'rejected') {
  const value = draft(order);
  const paymentAmount = Number(value.paymentAmount || 0);
  submit(order, { approval_decision: decision, approval_method: value.approvalMethod, approval_notes: value.approvalNotes.trim() || null, ...(decision === 'approved' && paymentAmount > 0 ? { payment: { amount: paymentAmount, method: value.paymentMethod, reference: value.paymentReference.trim() || null } } : {}) });
}
</script>

<template>
  <div class="grid gap-4">
    <UiCard v-for="order in orders" :key="order.id" class="border-0 p-0 shadow-none" :class="embedded ? '' : 'md:border md:p-6 md:shadow-sm'">
      <div v-if="!embedded" class="hidden flex-wrap items-start justify-between gap-3 md:flex">
        <div class="flex gap-3"><Microscope class="mt-1 h-5 w-5 shrink-0 text-primary" /><div><p class="font-semibold text-text">{{ order.ticket }} · {{ order.device.brand }} {{ order.device.model }}</p><p class="mt-1 text-sm text-muted">{{ order.customer.name }} · {{ order.reported_fault }}</p></div></div>
        <UiStatusBadge :tone="statusTone(order.status)">{{ statusLabels[order.status] || order.status }}</UiStatusBadge>
      </div>

      <div v-if="!embedded" class="flex items-center justify-between gap-3 md:hidden">
        <p class="text-sm font-bold text-text">{{ statusLabels[order.status] || order.status }}</p>
        <UiStatusBadge :tone="statusTone(order.status)">Paso actual</UiStatusBadge>
      </div>

      <details v-if="!embedded" class="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 md:hidden">
        <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Datos de recepción</summary>
        <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Falla reportada</p>
        <p class="mt-1 text-sm text-text">{{ order.reported_fault }}</p>
        <template v-if="Object.keys(order.device.functional_tests).length">
          <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Pruebas realizadas</p>
          <div class="mt-2 flex flex-wrap gap-2"><UiStatusBadge v-for="(result, test) in order.device.functional_tests" :key="test" :tone="result === 'passed' ? 'success' : result === 'failed' ? 'danger' : 'neutral'">{{ testLabels[test] || test }}: {{ resultLabels[result] || result }}</UiStatusBadge></div>
        </template>
      </details>

      <details v-if="!embedded && Object.keys(order.device.functional_tests).length" class="mt-5 hidden border-t border-line pt-4 md:block" open>
        <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Pruebas de recepción</summary>
        <div class="mt-2 flex flex-wrap gap-2"><UiStatusBadge v-for="(result, test) in order.device.functional_tests" :key="test" :tone="result === 'passed' ? 'success' : result === 'failed' ? 'danger' : 'neutral'">{{ testLabels[test] || test }}: {{ resultLabels[result] || result }}</UiStatusBadge></div>
      </details>

      <div :class="embedded ? 'grid items-start gap-4 lg:grid-cols-2' : ''">
        <div v-if="order.status === 'received'" class="grid gap-3 rounded-xl border border-line bg-surface p-4 md:p-5" :class="embedded ? 'lg:col-span-2' : 'mt-5'">
          <div><p class="font-semibold text-text">¿Cómo se atenderá esta orden?</p><p class="text-sm text-muted">Elige reparación directa si el trabajo y el precio ya fueron acordados.</p></div>
          <div v-if="!directServiceOpen[order.id]" class="grid gap-2 sm:grid-cols-2">
            <button type="button" class="rounded-xl border border-primary/40 bg-primary-soft p-4 text-left transition hover:border-primary" @click="openDirectService(order)"><span class="flex items-center gap-2 font-bold text-primary"><Zap class="h-4 w-4" />Reparación directa</span><span class="mt-1 block text-sm text-text">Cambio de pantalla, batería, conector u otro trabajo ya definido.</span></button>
            <button type="button" class="rounded-xl border border-line bg-surface p-4 text-left transition hover:border-primary" :disabled="saving === order.id" @click="submit(order, { status: 'diagnosing' })"><span class="flex items-center gap-2 font-bold text-text"><Microscope class="h-4 w-4 text-primary" />Requiere diagnóstico</span><span class="mt-1 block text-sm text-muted">La causa o la reparación todavía no están claras.</span></button>
          </div>
          <div v-else class="grid gap-3">
            <div><p class="font-bold text-text">Trabajo acordado</p><p class="text-xs text-muted">Quedará registrado como autorizado presencialmente.</p></div>
            <UiTextarea v-model="draft(order).diagnosis" label="Reparación a realizar" :rows="2" placeholder="Ej. Cambio de pantalla completa" />
            <UiInput v-model="draft(order).estimatedTotal" label="Precio acordado" type="number" min="0" step="0.01" />
            <div class="grid grid-cols-2 gap-2 sm:flex sm:justify-end"><UiButton variant="secondary" :disabled="saving === order.id" @click="closeDirectService(order)">Volver</UiButton><UiButton :disabled="saving === order.id || !draft(order).diagnosis.trim() || draft(order).estimatedTotal === ''" @click="startDirectService(order)"><Wrench class="h-4 w-4" />Iniciar reparación</UiButton></div>
          </div>
        </div>

        <div v-else-if="order.status === 'diagnosing'" class="grid gap-4" :class="embedded ? 'rounded-xl border border-line bg-surface p-4 md:p-5' : 'mt-5 md:border-t md:border-line md:pt-5'">
          <UiTextarea v-model="draft(order).diagnosis" label="Diagnóstico técnico" :rows="3" placeholder="Describe la causa encontrada y el trabajo recomendado" />
          <UiInput v-model="draft(order).estimatedTotal" class="max-w-sm" label="Presupuesto estimado" type="number" min="0" step="0.01" />
          <div class="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mx-0 md:flex md:justify-end md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0"><UiButton class="justify-center" variant="secondary" :disabled="saving === order.id" @click="saveDiagnosis(order)">Guardar avance</UiButton><UiButton class="justify-center" :disabled="saving === order.id || !draft(order).diagnosis.trim() || draft(order).estimatedTotal === ''" @click="saveDiagnosis(order, true)"><ClipboardCheck class="h-4 w-4" />Solicitar aprobación<ChevronRight class="hidden h-4 w-4 md:block" /></UiButton></div>
        </div>

        <div v-else-if="order.status === 'awaiting_approval'" class="grid gap-4" :class="embedded ? 'rounded-xl border border-line bg-surface p-4 md:p-5' : 'mt-5 md:border-t md:border-line md:pt-5'">
          <div class="rounded-xl border border-warning bg-warning-soft p-4"><p class="text-xs font-bold uppercase tracking-wide text-warning">Presupuesto presentado</p><div class="mt-2 flex items-end justify-between gap-3"><p class="line-clamp-2 text-sm text-text">{{ order.diagnosis }}</p><p class="shrink-0 text-2xl font-black text-text">${{ Number(order.estimated_total || 0).toFixed(2) }}</p></div></div>
          <div class="grid gap-3 sm:grid-cols-2"><UiSelect v-model="draft(order).approvalMethod" label="¿Cómo respondió el cliente?" :options="approvalMethods" /><UiInput v-model="draft(order).approvalNotes" label="Nota de confirmación" placeholder="Opcional" /></div>
          <details class="rounded-xl border border-line bg-surface-muted p-4"><summary class="flex cursor-pointer list-none items-center gap-2"><HandCoins class="h-4 w-4 text-primary" /><span class="flex-1 text-sm font-semibold text-text">Registrar abono</span><span class="text-xs text-muted">Opcional</span></summary><p class="mt-2 text-xs text-muted">Registra un pago únicamente si el cliente abonó al autorizar.</p><div class="mt-3 grid gap-3 sm:grid-cols-3"><UiInput v-model="draft(order).paymentAmount" label="Monto recibido" type="number" min="0" :max="order.balance" step="0.01" /><UiSelect v-if="Number(draft(order).paymentAmount || 0) > 0" v-model="draft(order).paymentMethod" label="Forma de pago" :options="paymentMethods" /><UiInput v-if="Number(draft(order).paymentAmount || 0) > 0" v-model="draft(order).paymentReference" label="Referencia" placeholder="Opcional" /></div></details>
          <div class="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-surface/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:mx-0 md:flex md:justify-end md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0"><UiButton variant="secondary" class="justify-center text-danger" :disabled="saving === order.id" @click="decide(order, 'rejected')"><XCircle class="h-4 w-4" />Rechazó</UiButton><UiButton class="justify-center" :disabled="saving === order.id || Number(draft(order).paymentAmount || 0) > order.balance" @click="decide(order, 'approved')"><CheckCircle2 class="h-4 w-4" />Aprobó</UiButton></div>
        </div>

        <div v-else-if="order.status === 'approved'" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success bg-success-soft p-4" :class="embedded ? '' : 'mt-5'"><div><p class="font-semibold text-success">Trabajo autorizado</p><p class="text-sm text-text">Ya puedes iniciar la reparación.</p></div><UiButton class="w-full justify-center md:w-auto" :disabled="saving === order.id" @click="submit(order, { status: 'repairing' })"><Wrench class="h-4 w-4" />Iniciar reparación</UiButton></div>
        <div v-else-if="order.status === 'repairing'" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-4" :class="embedded ? '' : 'mt-5'"><div><p class="font-semibold text-text">Reparación en proceso</p><p class="text-sm text-muted">Finaliza las pruebas antes de marcarla como lista.</p></div><UiButton class="w-full justify-center md:w-auto" :disabled="saving === order.id" @click="submit(order, { status: 'ready' })"><CheckCircle2 class="h-4 w-4" />Marcar como listo</UiButton></div>

        <WorkshopMaterialsPanel
          v-if="['diagnosing','awaiting_approval','approved','repairing','ready'].includes(order.status)"
          :tenant-id="tenantId"
          :platform-base-url="platformBaseUrl"
          :order="order"
          :boxed="embedded"
        />
      </div>
    </UiCard>
    <UiCard v-if="orders.length === 0" class="p-10 text-center text-muted">No hay equipos pendientes de diagnóstico.</UiCard>
  </div>
</template>
