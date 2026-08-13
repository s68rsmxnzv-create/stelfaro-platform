<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, CircleDollarSign, FileText, HandCoins, Images, KeyRound, Package, PackageCheck, Smartphone, UserRound, Wrench } from 'lucide-vue-next';
import { UiButton, UiModalShell, UiStatusBadge } from '@stelfaro/ui';
import type { WorkshopOrder, WorkshopOrderPhoto } from '@stelfaro/api-client';
import WorkshopDiagnosisBoard from './WorkshopDiagnosisBoard.vue';
import WorkshopPhotoGallery from './WorkshopPhotoGallery.vue';

const props = defineProps<{ order: WorkshopOrder | null; photos: WorkshopOrderPhoto[]; tenantId: number; platformBaseUrl: string; photoLoading?: boolean; defaultSection?: 'summary'|'work'|'condition'|'photos' }>();
const emit = defineEmits<{ close: []; refreshPhotos: []; addPhotos: []; update: [id: number, payload: Record<string, unknown>]; cancel: [order: WorkshopOrder]; settle: [order: WorkshopOrder]; invoice: [order: WorkshopOrder] }>();
function triggerProgressAction(key: 'settle'|'invoice', order: WorkshopOrder) {
  if (key === 'settle') emit('settle', order);
  else emit('invoice', order);
}
const activeSection = ref<'summary'|'work'|'condition'|'photos'>('summary');
const workFormExpanded = ref(false);
const focusDismissed = ref(false);
watch(() => props.order?.id, () => {
  workFormExpanded.value = false;
  focusDismissed.value = false;
  const expanded = Boolean(props.order) && props.order?.status !== 'received';
  activeSection.value = expanded ? 'work' : (props.defaultSection || 'work');
});
const isWorkExpanded = computed(() => !props.order || props.order.status !== 'received' || workFormExpanded.value);
watch(isWorkExpanded, (expanded, wasExpanded) => {
  if (expanded && !wasExpanded) { focusDismissed.value = false; activeSection.value = 'work'; }
});
function exitFocus() { focusDismissed.value = true; }
const progressActions = computed(() => {
  const order = props.order;
  if (!order) return [];
  const actions: Array<{ key: 'settle'|'invoice'; label: string; icon: typeof PackageCheck }> = [];
  if (order.status === 'ready' && order.financial.status !== 'settled') actions.push({ key: 'settle', label: 'Entregar y cerrar', icon: PackageCheck });
  if (order.status === 'cancelled' && order.financial.status !== 'settled') actions.push({ key: 'settle', label: order.paid_total > 0 ? 'Resolver cancelación' : 'Cerrar cancelación', icon: HandCoins });
  if (order.financial.closed_at && order.billing.status !== 'invoiced' && order.status !== 'cancelled') actions.push({ key: 'invoice', label: 'Facturar orden', icon: FileText });
  return actions;
});
const canCancel = computed(() => {
  const order = props.order;
  if (!order) return false;
  return !order.financial.closed_at && ['received','diagnosing','awaiting_approval','approved','repairing'].includes(order.status);
});
const hasWorkBoard = computed(() => {
  const order = props.order;
  if (!order) return false;
  return ['received','diagnosing','awaiting_approval','approved','repairing','ready'].includes(order.status);
});
const isFocusMode = computed(() => hasWorkBoard.value && isWorkExpanded.value && !focusDismissed.value);
const sections = [
  { value: 'summary', label: 'Resumen', icon: UserRound },
  { value: 'work', label: 'Trabajo', icon: Wrench },
  { value: 'condition', label: 'Estado', icon: Package },
  { value: 'photos', label: 'Fotos', icon: Images }
] as const;
const statusLabels: Record<string, string> = { received: 'Recibido', diagnosing: 'En diagnóstico', awaiting_approval: 'Esperando aprobación', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };
const powerLabels: Record<string, string> = { on: 'Enciende', off: 'No enciende', not_tested: 'No comprobado' };
const conditionLabels: Record<string, string> = { scratches: 'Rayones', dents: 'Golpes', cracked: 'Quebraduras', missing_parts: 'Piezas faltantes', moisture: 'Humedad visible', opened: 'Abierto previamente', tampered_screws: 'Tornillos manipulados', no_accessories: 'Sin accesorios' };
const testLabels: Record<string, string> = { display: 'Imagen', touch_controls: 'Touch / controles', charging: 'Carga', cameras: 'Cámaras', audio: 'Audio', microphone: 'Micrófono', buttons: 'Botones', connectivity: 'Conectividad' };
const resultLabels: Record<string, string> = { passed: 'Funciona', failed: 'Falla', not_tested: 'No probado' };
const approvalMethodLabels: Record<string, string> = { whatsapp: 'WhatsApp', call: 'Llamada', in_person: 'Presencial' };
const statusTone = (status: string): 'neutral'|'success'|'warning'|'danger'|'info' => status === 'cancelled' ? 'danger' : ['ready','delivered'].includes(status) ? 'success' : ['diagnosing','awaiting_approval'].includes(status) ? 'warning' : ['received','approved','repairing'].includes(status) ? 'info' : 'neutral';
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
</script>

<template>
  <UiModalShell mobile-fullscreen :open="Boolean(order)" :title="order?.ticket || 'Orden'" :description="order ? `${order.customer.name} · ${order.device.brand} ${order.device.model}` : null" max-width="max-w-6xl" @close="$emit('close')">
    <template v-if="order" #title>
      <div class="flex items-center gap-2">
        <button v-if="isFocusMode" type="button" class="-ml-1 shrink-0 rounded-full p-1 text-muted transition hover:bg-surface-muted hover:text-text" aria-label="Volver" @click="exitFocus">
          <ChevronLeft class="h-5 w-5" />
        </button>
        <span>{{ order.ticket }}</span>
      </div>
    </template>
    <template v-if="order" #description>
      <div class="flex flex-wrap items-center gap-2">
        <span>{{ order.customer.name }} · {{ order.device.brand }} {{ order.device.model }}</span>
        <UiStatusBadge :tone="statusTone(order.status)">{{ statusLabels[order.status] || order.status }}</UiStatusBadge>
      </div>
    </template>
    <template v-if="order" #header-actions>
      <UiButton v-if="canCancel" variant="danger" size="sm" @click="emit('cancel', order)">Cancelar orden</UiButton>
      <UiButton v-for="action in progressActions" :key="action.key" size="sm" variant="primary" @click="triggerProgressAction(action.key, order)">
        <component :is="action.icon" class="h-4 w-4" />{{ action.label }}
      </UiButton>
    </template>
    <div v-if="order" class="-mx-1 px-1 md:max-h-[75vh] md:overflow-y-auto">
      <p class="px-1 text-xs text-muted md:px-0">Ingreso: {{ new Date(order.received_at).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' }) }}</p>

      <div v-if="isFocusMode" class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <div><span class="text-xs font-semibold uppercase tracking-wide text-muted">{{ order.financial.final_total === null ? 'Total estimado' : 'Total final' }}</span> <strong class="ml-1 text-text">{{ (order.financial.final_total ?? order.estimated_total) === null ? 'Pendiente' : money(order.financial.final_total ?? order.estimated_total ?? 0) }}</strong></div>
        <div><span class="text-xs font-semibold uppercase tracking-wide text-muted">Pagado</span> <strong class="ml-1 text-success">{{ money(order.paid_total) }}</strong></div>
        <div><span class="text-xs font-semibold uppercase tracking-wide text-muted">Saldo</span> <strong class="ml-1 text-text">{{ money(order.balance) }}</strong></div>
      </div>

      <nav v-if="!isFocusMode" class="sticky top-0 z-10 -mx-1 mt-3 grid grid-cols-4 gap-1 border-y border-line bg-surface/95 px-1 py-2 backdrop-blur md:static md:mx-0 md:max-w-md md:rounded-xl md:border md:bg-surface md:px-1" aria-label="Secciones de la orden">
        <button
          v-for="section in sections"
          :key="section.value"
          type="button"
          class="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition md:min-h-11 md:flex-row md:gap-1.5 md:text-xs"
          :class="activeSection === section.value ? 'bg-primary text-primary-contrast shadow-sm' : 'text-muted active:bg-surface-muted md:hover:bg-surface-muted'"
          @click="activeSection = section.value"
        >
          <component :is="section.icon" class="h-4 w-4" />
          {{ section.label }}
        </button>
      </nav>

      <div class="mt-3 grid gap-3 md:mt-5 md:grid-cols-2 md:gap-4 xl:grid-cols-3" :class="activeSection !== 'summary' ? 'hidden' : ''">
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><UserRound class="h-5 w-5" /><h3 class="font-semibold">Cliente</h3></div><p class="mt-3 font-semibold text-text">{{ order.customer.name }}</p><p class="mt-1 text-sm text-muted">{{ order.customer.phone || 'Sin teléfono registrado' }}</p></section>
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><Smartphone class="h-5 w-5" /><h3 class="font-semibold">Equipo</h3></div><p class="mt-3 font-semibold text-text">{{ order.device.brand }} {{ order.device.model }}</p><p class="mt-1 text-sm text-muted">{{ order.device.imei ? `IMEI ${order.device.imei}` : order.device.serial_number ? `Serie ${order.device.serial_number}` : 'Sin identificador visible' }}</p><p v-if="order.device.color" class="mt-1 text-sm text-muted">Color: {{ order.device.color }}</p></section>
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><CircleDollarSign class="h-5 w-5" /><h3 class="font-semibold">Balance</h3></div><div class="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p class="text-muted">{{ order.financial.final_total === null ? 'Estimado' : 'Total final' }}</p><p class="font-semibold text-text">{{ (order.financial.final_total ?? order.estimated_total) === null ? 'Pendiente' : money(order.financial.final_total ?? order.estimated_total ?? 0) }}</p></div><div><p class="text-muted">Pagado neto</p><p class="font-semibold text-success">{{ money(order.paid_total) }}</p><p v-if="order.refunded_total" class="text-xs text-muted">Devuelto {{ money(order.refunded_total) }}</p></div><div><p class="text-muted">Saldo</p><p class="font-semibold text-text">{{ money(order.balance) }}</p></div></div><p v-if="order.financial.status !== 'settled'" class="mt-3 border-t border-line pt-2 text-xs font-semibold text-warning">Liquidación pendiente</p></section>
      </div>

      <div class="mt-3 grid gap-3 md:mt-4 md:gap-4 lg:grid-cols-2" :class="activeSection !== 'work' ? 'hidden' : ''">
        <section v-if="!isFocusMode" class="rounded-xl border border-line bg-surface p-4 md:p-5" :class="(!hasWorkBoard || isWorkExpanded) ? 'lg:col-span-2' : ''">
          <div class="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <Wrench class="h-5 w-5 text-primary" />
            <h3 class="font-semibold text-text">Recepción y diagnóstico</h3>
          </div>
          <div class="rounded-xl border border-line bg-surface p-4 md:p-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Falla reportada</p>
            <p class="mt-1 whitespace-pre-wrap text-sm text-text">{{ order.reported_fault }}</p>
            <template v-if="order.diagnosis"><p class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Diagnóstico técnico</p><p class="mt-1 whitespace-pre-wrap text-sm text-text">{{ order.diagnosis }}</p></template>
            <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Encendido</p>
            <p class="mt-1 text-sm text-text">{{ powerLabels[order.device.power_status] || order.device.power_status }}</p>
            <div v-if="Object.keys(order.device.functional_tests).length" class="mt-4 flex flex-wrap gap-2"><UiStatusBadge v-for="(result, test) in order.device.functional_tests" :key="test" :tone="result === 'passed' ? 'success' : result === 'failed' ? 'danger' : 'neutral'">{{ testLabels[test] || test }}: {{ resultLabels[result] || result }}</UiStatusBadge></div>
            <div v-if="order.approval.decision" class="mt-4 rounded-md border border-line bg-surface p-3 text-sm"><p class="font-semibold text-text">Presupuesto {{ order.approval.decision === 'approved' ? 'aprobado' : 'rechazado' }}</p><p class="mt-1 text-muted">Confirmado por {{ approvalMethodLabels[order.approval.method || ''] || order.approval.method }}<span v-if="order.approval.notes"> · {{ order.approval.notes }}</span></p></div>
          </div>
        </section>
        <section v-if="hasWorkBoard" class="rounded-xl border border-line bg-surface p-4 md:p-5" :class="isWorkExpanded ? 'lg:col-span-2' : ''">
          <div class="mb-4 flex items-center gap-2 border-b border-line pb-3">
            <Wrench class="h-5 w-5 text-primary" />
            <h3 class="font-semibold text-text">Operaciones de taller</h3>
          </div>
          <WorkshopDiagnosisBoard embedded :orders="[order]" :tenant-id="tenantId" :platform-base-url="platformBaseUrl" @update="(id, payload) => $emit('update', id, payload)" @expanded-change="workFormExpanded = $event" />
        </section>
      </div>

      <div class="mt-3 grid gap-3 md:mt-4 md:gap-4" :class="activeSection !== 'condition' ? 'hidden' : ''">
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><Package class="h-5 w-5" /><h3 class="font-semibold">Condición y accesorios</h3></div><div v-if="order.physical_conditions.length" class="mt-3 flex flex-wrap gap-2"><UiStatusBadge v-for="condition in order.physical_conditions" :key="condition" tone="neutral">{{ conditionLabels[condition] || condition }}</UiStatusBadge></div><p v-if="order.physical_condition" class="mt-3 whitespace-pre-wrap text-sm text-muted">{{ order.physical_condition }}</p><p v-if="order.accessories.length" class="mt-4 text-sm text-text"><strong>Accesorios:</strong> {{ order.accessories.join(', ') }}</p><p v-if="!order.physical_conditions.length && !order.physical_condition && !order.accessories.length" class="mt-3 text-sm text-muted">Sin detalles adicionales registrados.</p><div v-if="order.device.is_locked" class="mt-4 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning"><KeyRound class="h-4 w-4" />{{ order.device.has_access_secret ? 'Acceso registrado para revisión.' : 'Equipo bloqueado sin acceso proporcionado.' }}</div></section>
      </div>

      <WorkshopPhotoGallery :class="activeSection !== 'photos' ? 'hidden' : ''" :photos="photos" :loading="photoLoading" allow-add @add-photos="$emit('addPhotos')" @refresh="$emit('refreshPhotos')" />
    </div>
  </UiModalShell>
</template>
