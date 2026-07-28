<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, HandCoins, KeyRound, MessageCircle, Plus, Printer, Smartphone } from 'lucide-vue-next';
import { UiButton, UiCard } from '@stelfaro/ui';
import type { WorkshopOrder, WorkshopOrderPhoto } from '@stelfaro/api-client';
import WorkshopPhotoGallery from './WorkshopPhotoGallery.vue';
import { workshopWhatsAppUrl } from './workshopWhatsApp';

const props = defineProps<{ order: WorkshopOrder; orders: WorkshopOrder[]; photos: WorkshopOrderPhoto[]; photoLoading?: boolean; photoUrl?: string; expiresAt?: string; printing?: boolean }>();
defineEmits<{ addAnother: []; finish: []; refreshPhotos: []; print: []; advance: [order: WorkshopOrder] }>();
const qr = ref('');
const mobileQrOpen = ref(false);
const whatsappUrl = computed(() => workshopWhatsAppUrl(props.orders));
watch(() => props.photoUrl, async (value) => { qr.value = value ? await QRCode.toDataURL(value, { width: 280, margin: 1, errorCorrectionLevel: 'M' }) : ''; }, { immediate: true });
</script>

<template>
  <UiCard class="w-full overflow-hidden p-6 sm:p-8">
    <div class="text-center">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft">
        <CheckCircle2 class="h-7 w-7 text-success" />
      </div>
      <h2 class="mt-4 text-2xl font-bold text-text">{{ order.ticket }} · {{ order.reception.equipment_label }}</h2>
      <p class="mt-2 text-sm text-muted">Equipo registrado. Completa ahora su evidencia fotográfica.</p>
    </div>

    <div class="mt-6 grid gap-5 lg:mt-7 lg:grid-cols-[320px_1fr] lg:gap-6">
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

        <div v-if="mobileQrOpen" class="mt-3 rounded-xl border border-line bg-white p-4 text-center lg:hidden">
          <img v-if="qr" :src="qr" class="mx-auto h-auto w-full max-w-64" alt="QR temporal para subir fotos">
          <p v-if="expiresAt" class="mt-2 text-xs text-slate-500">QR válido hasta {{ new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }}</p>
          <p v-else class="py-8 text-sm text-slate-500">No fue posible generar el QR. El equipo sí quedó registrado.</p>
          <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener" class="mt-3 block">
            <UiButton class="w-full justify-center" variant="success"><MessageCircle class="mr-2 h-5 w-5" />Enviar enlace por WhatsApp</UiButton>
          </a>
          <p v-else class="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">El cliente no tiene teléfono para compartir el enlace.</p>
        </div>

        <div class="hidden rounded-lg border border-line bg-white p-4 text-center lg:block">
          <img v-if="qr" :src="qr" class="mx-auto h-64 w-64" alt="QR temporal para subir fotos">
          <p v-if="expiresAt" class="mt-2 text-xs text-slate-500">QR válido hasta {{ new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }}</p>
          <p v-else class="py-20 text-sm text-slate-500">No fue posible generar el QR. El equipo sí quedó registrado.</p>
        </div>
      </div>

      <div class="order-1 grid content-start gap-3 lg:order-2">
        <a v-if="photoUrl" :href="photoUrl" target="_blank" rel="noopener">
          <UiButton class="min-h-14 w-full justify-center text-base lg:min-h-0 lg:justify-start lg:text-sm"><Camera class="mr-2 h-5 w-5" />Tomar o subir fotos ahora</UiButton>
        </a>
        <p v-else class="rounded-md bg-warning-soft px-3 py-3 text-sm text-warning">No fue posible abrir la carga de fotos. El equipo sí quedó registrado.</p>

        <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener" class="hidden lg:block">
          <UiButton class="w-full justify-start" variant="success"><MessageCircle class="mr-2 h-5 w-5" />Enviar por WhatsApp</UiButton>
        </a>
        <UiButton class="w-full justify-start" variant="secondary" :disabled="printing" @click="$emit('print')"><Printer class="mr-2 h-5 w-5" />{{ printing ? 'Preparando impresión…' : `Imprimir recepción (${orders.length} ${orders.length === 1 ? 'equipo' : 'equipos'})` }}</UiButton>
        <UiButton v-if="order.estimated_total !== null && order.balance > 0" class="w-full justify-start" variant="secondary" @click="$emit('advance', order)"><HandCoins class="mr-2 h-5 w-5" />Registrar anticipo</UiButton>
        <p v-if="!whatsappUrl" class="hidden rounded-md bg-warning-soft px-3 py-2 text-sm text-warning lg:block">El cliente no tiene teléfono para abrir WhatsApp.</p>

        <div v-if="order.device_access" class="flex items-center gap-3 rounded-md border border-warning bg-warning-soft p-4">
          <KeyRound class="h-5 w-5 shrink-0 text-warning" />
          <div><p class="text-xs font-semibold uppercase tracking-wide text-warning">PIN móvil de {{ order.reception.equipment_label.toLowerCase() }}</p><p class="mt-1 font-mono text-xl font-black tracking-[0.2em] text-text">{{ order.device_access.pin }}</p></div>
        </div>

        <div class="mt-2 rounded-md border border-line bg-surface-muted p-4 text-sm">
          <p class="font-semibold text-text">{{ order.customer.name }}</p>
          <div class="mt-2 space-y-1"><p v-for="item in orders" :key="item.id" class="text-muted"><strong class="text-text">{{ item.reception.equipment_label }}:</strong> {{ item.device.brand }} {{ item.device.model }}</p></div>
        </div>

        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <UiButton class="w-full justify-start" @click="$emit('addAnother')"><Plus class="mr-2 h-5 w-5" />Agregar otro equipo</UiButton>
          <UiButton class="w-full justify-start" variant="ghost" @click="$emit('finish')"><CheckCircle2 class="mr-2 h-5 w-5" />Finalizar recepción</UiButton>
        </div>
      </div>
    </div>

    <WorkshopPhotoGallery :photos="photos" :loading="photoLoading" @refresh="$emit('refreshPhotos')" />
  </UiCard>
</template>
