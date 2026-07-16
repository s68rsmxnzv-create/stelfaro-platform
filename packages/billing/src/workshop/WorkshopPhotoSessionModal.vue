<script setup lang="ts">
import { ref, watch } from 'vue';
import QRCode from 'qrcode';
import { ExternalLink } from 'lucide-vue-next';
import { UiButton, UiLoadingMark, UiModalShell } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';

const props = defineProps<{ order: WorkshopOrder | null; session: { url: string; expires_at: string } | null; loading?: boolean; error?: string }>();
defineEmits<{ close: [] }>();
const qr = ref('');
watch(() => props.session?.url, async url => { qr.value = url ? await QRCode.toDataURL(url, { width: 260, margin: 1, errorCorrectionLevel: 'M' }) : ''; }, { immediate: true });
</script>

<template>
  <UiModalShell :open="Boolean(order)" :title="order?.photo_count ? 'Agregar fotos' : 'Agregar primera foto'" :description="order ? `${order.ticket} · ${order.device.brand} ${order.device.model}` : null" max-width="max-w-lg" @close="$emit('close')">
    <UiLoadingMark v-if="loading" label="Generando QR temporal" />
    <p v-else-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
    <div v-else-if="session" class="text-center"><div class="mx-auto w-fit rounded-lg border border-line bg-white p-3"><img :src="qr" class="h-60 w-60" alt="QR temporal para agregar fotografías"></div><p class="mt-4 text-sm text-muted">Escanea el QR desde el teléfono para tomar o elegir fotografías. El enlace es temporal.</p><a :href="session.url" target="_blank" rel="noopener"><UiButton class="mt-4"><ExternalLink class="mr-2 h-4 w-4" />Abrir carga de fotos</UiButton></a></div>
  </UiModalShell>
</template>
