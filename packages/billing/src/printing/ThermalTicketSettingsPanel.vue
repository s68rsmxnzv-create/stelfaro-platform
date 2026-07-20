<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ReceiptText } from 'lucide-vue-next';
import { UiInput } from '@stelfaro/ui';
import { defaultPrinterSettings, loadPrinterSettings, savePrinterSettings, type PrinterSettings } from './printerSettings';
import ThermalTicketPreview from './ThermalTicketPreview.vue';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';

type PreviewCompany = { name: string; tradeName: string; logoUrl: string | null; nit: string; nrc: string | null; activity: string };
const props = defineProps<{ company?: PreviewCompany | null }>();
const settings = reactive<PrinterSettings>(defaultPrinterSettings());
let ready = false;
let saveTimer: number | null = null;
let lastSaved = '';
let toastId = 0;
const toasts = ref<BillingFloatingToast[]>([]);
const toastTimers: number[] = [];

onMounted(() => { Object.assign(settings, loadPrinterSettings()); lastSaved = JSON.stringify(settings); ready = true; });
onBeforeUnmount(() => { if (saveTimer) window.clearTimeout(saveTimer); toastTimers.forEach(timer => window.clearTimeout(timer)); });
watch(settings, () => {
  if (!ready) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistSettings, 650);
}, { deep: true });

function persistSettings(): void {
  let adjusted = false;
  const qrWidth = Number(settings.qrWidth);
  const normalizedQrWidth = Number.isFinite(qrWidth) ? Math.max(120, Math.min(420, qrWidth)) : 280;
  if (normalizedQrWidth !== qrWidth) {
    settings.qrWidth = normalizedQrWidth;
    adjusted = true;
  }

  const serialized = JSON.stringify(settings);
  if (serialized === lastSaved) return;
  savePrinterSettings(settings);
  lastSaved = serialized;
  notify(adjusted
    ? { title: 'Tamaño del QR ajustado', message: 'El valor permitido está entre 120 y 420.', variant: 'warning' }
    : { title: 'Formato actualizado', message: 'El cambio ya se refleja en la vista previa y en las próximas impresiones.', variant: 'success' });
}

function notify(toast: Omit<BillingFloatingToast, 'id'>): void {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, ...toast }];
  toastTimers.push(window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4200));
}
</script>

<template>
  <div class="space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />
    <div class="flex items-start gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><ReceiptText class="h-5 w-5" /></span>
      <div>
        <h3 class="font-semibold text-text">Presentación del ticket</h3>
        <p class="mt-1 max-w-2xl text-sm text-muted">Elige qué elementos opcionales se imprimen. La evidencia fiscal conservada no se modifica.</p>
      </div>
    </div>

    <div class="grid gap-3 rounded-lg border border-line bg-surface-muted p-4 sm:grid-cols-2">
      <label class="flex cursor-pointer items-center gap-3 text-sm text-text"><input v-model="settings.showLogo" type="checkbox" class="h-4 w-4 accent-primary"><span><strong class="block">Imprimir logo</strong><small class="text-muted">Usa el logo rasterizado y conservado al emitir el DTE.</small></span></label>
      <label class="flex cursor-pointer items-center gap-3 text-sm text-text"><input v-model="settings.showIssuerDetails" type="checkbox" class="h-4 w-4 accent-primary"><span><strong class="block">Imprimir información de la empresa</strong><small class="text-muted">Nombre comercial, actividad, NIT, NRC y contacto disponible.</small></span></label>
      <label class="flex cursor-pointer items-center gap-3 text-sm text-text"><input v-model="settings.qrEnabled" type="checkbox" class="h-4 w-4 accent-primary"><span><strong class="block">Imprimir QR</strong><small class="text-muted">Incluye el acceso a la consulta pública cuando aplique.</small></span></label>
      <div><UiInput v-model.number="settings.qrWidth" label="Tamaño del QR" type="number" min="120" max="420" step="1" suffix="px" /><p class="mt-1 text-xs text-muted">Valor permitido: 120 a 420.</p></div>
    </div>

    <ThermalTicketPreview :settings="settings" :company="props.company" />
  </div>
</template>
