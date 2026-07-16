<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { CircleDollarSign, ExternalLink, KeyRound, MessageCircle, Package, Smartphone, UserRound, Wrench, X } from 'lucide-vue-next';
import { UiButton, UiModalShell, UiStatusBadge } from '@stelfaro/ui';
import type { WorkshopOrder, WorkshopOrderPhoto } from '@stelfaro/api-client';
import WorkshopPhotoGallery from './WorkshopPhotoGallery.vue';
import { workshopWhatsAppUrl } from './workshopWhatsApp';

const props = defineProps<{ order: WorkshopOrder | null; photos: WorkshopOrderPhoto[]; photoLoading?: boolean; createPhotoSession: () => Promise<{ url: string; expires_at: string }> }>();
defineEmits<{ close: []; refreshPhotos: [] }>();
const photoSession = ref<{ url: string; expires_at: string } | null>(null);
const photoQr = ref('');
const sessionLoading = ref(false);
const sessionError = ref('');
const whatsappUrl = computed(() => props.order ? workshopWhatsAppUrl(props.order) : '');
watch(() => props.order?.id, () => { photoSession.value = null; photoQr.value = ''; });
async function addPhotos() {
  sessionLoading.value = true; sessionError.value = '';
  try { photoSession.value = await props.createPhotoSession(); photoQr.value = await QRCode.toDataURL(photoSession.value.url, { width: 240, margin: 1, errorCorrectionLevel: 'M' }); }
  catch (reason) { sessionError.value = reason instanceof Error ? reason.message : 'No fue posible generar el QR.'; }
  finally { sessionLoading.value = false; }
}
const statusLabels: Record<string, string> = { received: 'Recibido', diagnosing: 'En diagnóstico', awaiting_approval: 'Esperando aprobación', approved: 'Aprobado', repairing: 'En reparación', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' };
const powerLabels: Record<string, string> = { on: 'Enciende', off: 'No enciende', not_tested: 'No comprobado' };
const conditionLabels: Record<string, string> = { scratches: 'Rayones', dents: 'Golpes', cracked: 'Quebraduras', missing_parts: 'Piezas faltantes', moisture: 'Humedad visible', opened: 'Abierto previamente', tampered_screws: 'Tornillos manipulados', no_accessories: 'Sin accesorios' };
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
</script>

<template>
  <UiModalShell :open="Boolean(order)" :title="order?.ticket || 'Orden'" :description="order ? `${order.customer.name} · ${order.device.brand} ${order.device.model}` : null" max-width="max-w-6xl" @close="$emit('close')">
    <div v-if="order" class="max-h-[75vh] overflow-y-auto pr-1">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-4">
        <div><p class="text-sm text-muted">Estado actual</p><UiStatusBadge class="mt-1" :tone="order.status === 'ready' ? 'success' : order.status === 'cancelled' ? 'danger' : 'neutral'">{{ statusLabels[order.status] || order.status }}</UiStatusBadge></div>
        <div class="flex flex-wrap items-center justify-end gap-3"><a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener"><UiButton variant="success"><MessageCircle class="mr-2 h-4 w-4" />Reenviar por WhatsApp</UiButton></a><div class="text-right"><p class="text-sm text-muted">Ingreso</p><p class="font-semibold text-text">{{ new Date(order.received_at).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' }) }}</p></div></div>
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><UserRound class="h-5 w-5" /><h3 class="font-semibold">Cliente</h3></div><p class="mt-3 font-semibold text-text">{{ order.customer.name }}</p><p class="mt-1 text-sm text-muted">{{ order.customer.phone || 'Sin teléfono registrado' }}</p></section>
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><Smartphone class="h-5 w-5" /><h3 class="font-semibold">Equipo</h3></div><p class="mt-3 font-semibold text-text">{{ order.device.brand }} {{ order.device.model }}</p><p class="mt-1 text-sm text-muted">{{ order.device.imei ? `IMEI ${order.device.imei}` : order.device.serial_number ? `Serie ${order.device.serial_number}` : 'Sin identificador visible' }}</p><p v-if="order.device.color" class="mt-1 text-sm text-muted">Color: {{ order.device.color }}</p></section>
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><CircleDollarSign class="h-5 w-5" /><h3 class="font-semibold">Balance</h3></div><div class="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p class="text-muted">Estimado</p><p class="font-semibold text-text">{{ order.estimated_total === null ? 'Pendiente' : money(order.estimated_total) }}</p></div><div><p class="text-muted">Pagado</p><p class="font-semibold text-success">{{ money(order.paid_total) }}</p></div><div><p class="text-muted">Saldo</p><p class="font-semibold text-text">{{ money(order.balance) }}</p></div></div></section>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><Wrench class="h-5 w-5" /><h3 class="font-semibold">Recepción y diagnóstico</h3></div><p class="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Falla reportada</p><p class="mt-1 whitespace-pre-wrap text-sm text-text">{{ order.reported_fault }}</p><template v-if="order.diagnosis"><p class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Diagnóstico técnico</p><p class="mt-1 whitespace-pre-wrap text-sm text-text">{{ order.diagnosis }}</p></template><p class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Encendido</p><p class="mt-1 text-sm text-text">{{ powerLabels[order.device.power_status] || order.device.power_status }}</p></section>
        <section class="rounded-lg border border-line bg-surface p-4"><div class="flex items-center gap-2 text-primary"><Package class="h-5 w-5" /><h3 class="font-semibold">Condición y accesorios</h3></div><div v-if="order.physical_conditions.length" class="mt-3 flex flex-wrap gap-2"><UiStatusBadge v-for="condition in order.physical_conditions" :key="condition" tone="neutral">{{ conditionLabels[condition] || condition }}</UiStatusBadge></div><p v-if="order.physical_condition" class="mt-3 whitespace-pre-wrap text-sm text-muted">{{ order.physical_condition }}</p><p v-if="order.accessories.length" class="mt-4 text-sm text-text"><strong>Accesorios:</strong> {{ order.accessories.join(', ') }}</p><p v-if="!order.physical_conditions.length && !order.physical_condition && !order.accessories.length" class="mt-3 text-sm text-muted">Sin detalles adicionales registrados.</p><div v-if="order.device.is_locked" class="mt-4 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning"><KeyRound class="h-4 w-4" />{{ order.device.has_access_secret ? 'Acceso registrado para revisión.' : 'Equipo bloqueado sin acceso proporcionado.' }}</div></section>
      </div>

      <p v-if="sessionError" class="mt-5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ sessionError }}</p><div v-if="photoSession" class="relative mt-5 grid gap-4 rounded-lg border border-primary/30 bg-primary-soft/30 p-4 sm:grid-cols-[180px_1fr] sm:items-center"><button type="button" class="absolute right-3 top-3 text-muted hover:text-text" aria-label="Cerrar QR" @click="photoSession = null"><X class="h-5 w-5" /></button><div class="rounded-lg bg-white p-2"><img :src="photoQr" class="mx-auto h-40 w-40" alt="QR temporal para agregar fotos"></div><div><h3 class="font-semibold text-text">Agregar fotografías a {{ order.ticket }}</h3><p class="mt-2 text-sm text-muted">Escanea el QR desde el teléfono. El enlace es temporal y permite tomar o elegir más fotografías.</p><a :href="photoSession.url" target="_blank" rel="noopener"><UiButton class="mt-3" variant="secondary"><ExternalLink class="mr-2 h-4 w-4" />Abrir carga de fotos</UiButton></a></div></div>
      <WorkshopPhotoGallery :photos="photos" :loading="photoLoading || sessionLoading" allow-add @add-photos="addPhotos" @refresh="$emit('refreshPhotos')" />
    </div>
  </UiModalShell>
</template>
