<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, HandCoins, KeyRound, MessageCircle, Plus, Printer, QrCode, Smartphone } from 'lucide-vue-next';
import { UiButton, UiCard } from '@stelfaro/ui';
import type { WorkshopOrder, WorkshopOrderPhoto } from '@stelfaro/api-client';
import WorkshopPhotoGallery from './WorkshopPhotoGallery.vue';
import { workshopWhatsAppUrl } from './workshopWhatsApp';

const props = defineProps<{ order: WorkshopOrder; orders: WorkshopOrder[]; photos: WorkshopOrderPhoto[]; photoLoading?: boolean; photoUrl?: string; expiresAt?: string; printing?: boolean; labelPrinting?: boolean }>();
defineEmits<{ addAnother: []; finish: []; refreshPhotos: []; print: []; printLabel: []; advance: [order: WorkshopOrder] }>();
const qr = ref('');
const mobileQrOpen = ref(false);
const whatsappUrl = computed(() => workshopWhatsAppUrl(props.orders));
watch(() => props.photoUrl, async (value) => { qr.value = value ? await QRCode.toDataURL(value, { width: 280, margin: 1, errorCorrectionLevel: 'M' }) : ''; }, { immediate: true });
</script>

<template>
  <UiCard class="w-full overflow-hidden p-4 sm:p-6 lg:p-7">
    <div class="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-soft">
          <CheckCircle2 class="h-6 w-6 text-success" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wide text-success">Equipo registrado</p>
          <h2 class="mt-0.5 truncate text-xl font-bold text-text sm:text-2xl">{{ order.ticket }} · {{ order.reception.equipment_label }}</h2>
          <p class="mt-1 text-sm font-semibold text-text">{{ order.customer.name }}</p>
          <p class="mt-0.5 text-xs text-muted"><template v-for="(item, index) in orders" :key="item.id"><span v-if="index"> · </span>{{ item.reception.equipment_label }}: {{ item.device.brand }} {{ item.device.model }}</template></p>
        </div>
      </div>
      <UiButton class="w-full shrink-0 justify-center sm:w-auto" @click="$emit('finish')"><CheckCircle2 class="mr-2 h-5 w-5" />Finalizar recepción</UiButton>
    </div>

    <section class="mt-5 rounded-xl border border-primary/20 bg-primary-soft/30 p-4 sm:p-5">
      <div class="mb-4"><p class="font-bold text-text">Fotos del equipo</p><p class="mt-1 text-sm text-muted">Escanea el QR con el teléfono para tomar las fotos.</p></div>
      <div class="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-5">
      <div class="order-2 lg:order-1">
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left lg:hidden"
          :aria-expanded="mobileQrOpen"
          @click="mobileQrOpen = !mobileQrOpen"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Smartphone class="h-5 w-5" /></span>
          <span class="min-w-0 flex-1"><strong class="block text-sm text-text">Usar otro dispositivo</strong><span class="block text-xs text-muted">Mostrar QR o enviar enlace</span></span>
          <ChevronUp v-if="mobileQrOpen" class="h-5 w-5 shrink-0 text-muted" />
          <ChevronDown v-else class="h-5 w-5 shrink-0 text-muted" />
        </button>

        <div v-if="mobileQrOpen" class="mt-3 rounded-xl border border-line bg-surface p-4 text-center lg:hidden">
          <img v-if="qr" :src="qr" class="mx-auto h-auto w-full max-w-64" alt="QR temporal para subir fotos">
          <p v-if="expiresAt" class="mt-2 text-xs text-slate-500">QR válido hasta {{ new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }}</p>
          <p v-else class="py-8 text-sm text-slate-500">No fue posible generar el QR. El equipo sí quedó registrado.</p>
        </div>

        <div class="hidden rounded-lg border border-line bg-surface p-4 text-center lg:block">
          <img v-if="qr" :src="qr" class="mx-auto h-56 w-56" alt="QR temporal para subir fotos">
          <p v-if="expiresAt" class="mt-2 text-xs text-slate-500">QR válido hasta {{ new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }}</p>
          <p v-else class="py-20 text-sm text-slate-500">No fue posible generar el QR. El equipo sí quedó registrado.</p>
        </div>
      </div>

      <div class="order-1 grid content-start gap-3 lg:order-2">
        <div class="grid grid-cols-2 gap-3">
          <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener" class="block">
            <UiButton class="min-h-28 w-full flex-col justify-center gap-2 text-center" variant="secondary"><MessageCircle class="h-6 w-6 text-success" /><span>Enviar por WhatsApp</span></UiButton>
          </a>
          <div v-else class="flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-line bg-surface-muted p-3 text-center text-sm text-muted"><MessageCircle class="h-6 w-6" /><span>WhatsApp no disponible</span></div>

          <UiButton class="min-h-28 w-full flex-col justify-center gap-2 text-center" variant="secondary" :disabled="printing" @click="$emit('print')"><Printer class="h-6 w-6 text-primary" /><span>{{ printing ? 'Preparando…' : 'Imprimir recepción' }}</span></UiButton>

          <UiButton class="min-h-28 w-full flex-col justify-center gap-2 text-center" variant="secondary" :disabled="labelPrinting" @click="$emit('printLabel')"><QrCode class="h-6 w-6 text-primary" /><span>{{ labelPrinting ? 'Preparando…' : 'Imprimir etiqueta' }}</span></UiButton>

          <UiButton v-if="order.estimated_total !== null && order.balance > 0" class="min-h-28 w-full flex-col justify-center gap-2 text-center" variant="secondary" @click="$emit('advance', order)"><HandCoins class="h-6 w-6 text-primary" /><span>Registrar anticipo</span></UiButton>

          <UiButton class="min-h-28 w-full flex-col justify-center gap-2 text-center" variant="secondary" @click="$emit('addAnother')"><Plus class="h-6 w-6 text-primary" /><span>Agregar otro equipo</span></UiButton>
        </div>

        <div v-if="order.device_access" class="flex items-center gap-3 rounded-md border border-line bg-surface p-3.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-soft"><KeyRound class="h-4 w-4 text-warning" /></span>
          <div><p class="text-xs font-semibold text-muted">PIN para carga móvil</p><p class="mt-0.5 font-mono text-lg font-black tracking-[0.2em] text-text">{{ order.device_access.pin }}</p></div>
        </div>
        <a v-if="photoUrl" :href="photoUrl" target="_blank" rel="noopener" class="inline-flex w-fit items-center gap-2 px-1 py-1 text-sm font-semibold text-muted transition hover:text-primary"><Camera class="h-4 w-4" />Subir fotos guardadas en esta computadora</a>
      </div>
    </div>
    </section>

    <WorkshopPhotoGallery :photos="photos" :loading="photoLoading" @refresh="$emit('refreshPhotos')" />
  </UiCard>
</template>
