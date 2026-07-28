<script setup lang="ts">
import { ref, watch } from 'vue';
import QRCode from 'qrcode';
import { ChevronDown, ExternalLink, QrCode } from 'lucide-vue-next';
import { UiButton, UiLoadingMark, UiModalShell } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ order: WorkshopOrder | null; session: { url: string; expires_at: string } | null; loading?: boolean; error?: string }>();
defineEmits<{ close: [] }>();
const qr = ref('');
const mobileQrOpen = ref(false);
watch(() => props.session?.url, async url => { qr.value = url ? await QRCode.toDataURL(url, { width: 260, margin: 1, errorCorrectionLevel: 'M' }) : ''; }, { immediate: true });
</script>

<template>
  <UiModalShell mobile-fullscreen :open="Boolean(order)" :title="order?.photo_count ? 'Agregar fotos' : 'Agregar primera foto'" :description="order ? `${order.ticket} · ${order.device.brand} ${order.device.model}` : null" max-width="max-w-lg" @close="$emit('close')">
    <UiLoadingMark v-if="loading" label="Generando QR temporal" />
    <p v-else-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <div v-else-if="session" class="text-center">
      <a :href="session.url" target="_blank" rel="noopener" class="block md:hidden"><UiButton class="min-h-14 w-full justify-center text-base"><ExternalLink class="mr-2 h-5 w-5" />Tomar o subir fotos ahora</UiButton></a>
      <button type="button" class="mt-4 flex min-h-12 w-full items-center gap-3 rounded-xl border border-line px-4 text-left text-sm font-semibold text-text md:hidden" :aria-expanded="mobileQrOpen" @click="mobileQrOpen = !mobileQrOpen"><QrCode class="h-5 w-5 text-primary" /><span class="flex-1">Usar otro dispositivo</span><ChevronDown class="h-5 w-5 text-muted transition" :class="mobileQrOpen ? 'rotate-180' : ''" /></button>
      <div :class="mobileQrOpen ? 'mt-4 block md:mt-0' : 'hidden md:block'"><div class="mx-auto w-fit rounded-lg border border-line bg-white p-3"><img :src="qr" class="h-60 w-60" alt="QR temporal para agregar fotografías"></div><p class="mt-4 text-sm text-muted">Escanea el QR desde otro teléfono para tomar o elegir fotografías. El enlace es temporal.</p></div>
      <a :href="session.url" target="_blank" rel="noopener" class="hidden md:inline-block"><UiButton class="mt-4"><ExternalLink class="mr-2 h-4 w-4" />Abrir carga de fotos</UiButton></a>
    </div>
  </UiModalShell>
</template>
