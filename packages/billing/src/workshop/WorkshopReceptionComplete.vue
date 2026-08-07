<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, HandCoins, KeyRound, MessageCircle, MoreHorizontal, Plus, Printer, Smartphone } from 'lucide-vue-next';
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
  <UiCard class="w-full overflow-hidden p-4 sm:p-6 lg:p-7">
    <div class="flex items-center gap-3 border-b border-line pb-5">
      <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-soft">
        <CheckCircle2 class="h-6 w-6 text-success" />
      </div>
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-wide text-success">Equipo registrado</p>
        <h2 class="mt-0.5 truncate text-xl font-bold text-text sm:text-2xl">{{ order.ticket }} · {{ order.reception.equipment_label }}</h2>
      </div>
    </div>

    <section class="mt-5 rounded-xl border border-primary/20 bg-primary-soft/30 p-4 sm:p-5">
      <div class="mb-4"><p class="font-bold text-text">Completa la evidencia fotográfica</p><p class="mt-1 text-sm text-muted">Toma las fotos aquí o abre el enlace desde otro teléfono.</p></div>
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
          <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener" class="mt-3 block">
            <UiButton class="w-full justify-center" variant="success"><MessageCircle class="mr-2 h-5 w-5" />Enviar enlace por WhatsApp</UiButton>
          </a>
          <p v-else class="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">El cliente no tiene teléfono para compartir el enlace.</p>
        </div>

        <div class="hidden rounded-lg border border-line bg-surface p-4 text-center lg:block">
          <img v-if="qr" :src="qr" class="mx-auto h-56 w-56" alt="QR temporal para subir fotos">
          <p v-if="expiresAt" class="mt-2 text-xs text-slate-500">QR válido hasta {{ new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }}</p>
          <p v-else class="py-20 text-sm text-slate-500">No fue posible generar el QR. El equipo sí quedó registrado.</p>
        </div>
      </div>

      <div class="order-1 grid content-start gap-3 lg:order-2">
        <a v-if="photoUrl" :href="photoUrl" target="_blank" rel="noopener">
          <UiButton class="min-h-14 w-full justify-center text-base"><Camera class="mr-2 h-5 w-5" />Tomar o subir fotos</UiButton>
        </a>
        <p v-else class="rounded-md bg-warning-soft px-3 py-3 text-sm text-warning">No fue posible abrir la carga de fotos. El equipo sí quedó registrado.</p>

        <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener" class="hidden lg:block">
          <UiButton class="w-full justify-center" variant="secondary"><MessageCircle class="mr-2 h-5 w-5 text-success" />Compartir enlace por WhatsApp</UiButton>
        </a>
        <p v-if="!whatsappUrl" class="hidden rounded-md bg-warning-soft px-3 py-2 text-sm text-warning lg:block">El cliente no tiene teléfono para abrir WhatsApp.</p>

        <div v-if="order.device_access" class="flex items-center gap-3 rounded-md border border-line bg-surface p-3.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-soft"><KeyRound class="h-4 w-4 text-warning" /></span>
          <div><p class="text-xs font-semibold text-muted">PIN para carga móvil</p><p class="mt-0.5 font-mono text-lg font-black tracking-[0.2em] text-text">{{ order.device_access.pin }}</p></div>
        </div>
      </div>
    </div>
    </section>

    <section class="mt-4 grid gap-4 rounded-xl border border-line bg-surface-muted p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div class="min-w-0 text-sm"><p class="font-bold text-text">{{ order.customer.name }}</p><div class="mt-1 flex flex-wrap gap-x-4 gap-y-1"><p v-for="item in orders" :key="item.id" class="text-muted"><strong class="text-text">{{ item.reception.equipment_label }}:</strong> {{ item.device.brand }} {{ item.device.model }}</p></div></div>
      <details class="relative">
        <summary class="flex cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-muted"><MoreHorizontal class="h-4 w-4" />Más acciones</summary>
        <div class="mt-2 grid gap-2 sm:absolute sm:right-0 sm:z-20 sm:w-64 sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:p-2 sm:shadow-xl">
          <UiButton class="w-full justify-start" variant="ghost" :disabled="printing" @click="$emit('print')"><Printer class="mr-2 h-4 w-4" />{{ printing ? 'Preparando…' : 'Imprimir recepción' }}</UiButton>
          <UiButton v-if="order.estimated_total !== null && order.balance > 0" class="w-full justify-start" variant="ghost" @click="$emit('advance', order)"><HandCoins class="mr-2 h-4 w-4" />Registrar anticipo</UiButton>
        </div>
      </details>
    </section>

    <div class="mt-4 grid gap-2 sm:grid-cols-2">
      <UiButton class="w-full justify-center" variant="secondary" @click="$emit('addAnother')"><Plus class="mr-2 h-5 w-5" />Agregar otro equipo</UiButton>
      <UiButton class="w-full justify-center" @click="$emit('finish')"><CheckCircle2 class="mr-2 h-5 w-5" />Finalizar recepción</UiButton>
    </div>

    <WorkshopPhotoGallery :photos="photos" :loading="photoLoading" @refresh="$emit('refreshPhotos')" />
  </UiCard>
</template>
