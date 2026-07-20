<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { FileCheck2, ReceiptText, Smartphone } from 'lucide-vue-next';
import { PlatformClient, type WorkshopTicketSettings } from '@stelfaro/api-client';
import { UiInput, UiSelect, UiTextarea } from '@stelfaro/ui';
import { defaultPrinterSettings, loadPrinterSettings, savePrinterSettings, type PrinterSettings } from './printerSettings';
import ThermalTicketPreview from './ThermalTicketPreview.vue';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';

type PreviewCompany = { name: string; tradeName: string; logoUrl: string | null; nit: string; nrc: string | null; activity: string };
const props = withDefaults(defineProps<{ company?: PreviewCompany | null; workshopEnabled?: boolean; tenantId?: number; platformBaseUrl?: string }>(), { workshopEnabled: false, tenantId: 0, platformBaseUrl: '/api/v1' });
const settings = reactive<PrinterSettings>(defaultPrinterSettings());
const workshopSettings = reactive<WorkshopTicketSettings>({ receipt_copies: 2, print_equipment_label: true, terms: '' });
const previewVariant = ref<'dte' | 'workshop'>('dte');
let ready = false;
let saveTimer: number | null = null;
let lastSaved = '';
let workshopSaveTimer: number | null = null;
let workshopReady = false;
let toastId = 0;
const toasts = ref<BillingFloatingToast[]>([]);
const toastTimers: number[] = [];

onMounted(async () => {
  Object.assign(settings, loadPrinterSettings()); lastSaved = JSON.stringify(settings); ready = true;
  if (props.workshopEnabled && props.tenantId) {
    try { Object.assign(workshopSettings, (await new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }).workshopTicketSettings(props.tenantId)).data); workshopReady = true; }
    catch { notify({ title: 'No cargamos el formato de Taller', message: 'Puedes continuar con los ajustes locales de impresión.', variant: 'warning' }); }
  }
});
onBeforeUnmount(() => { if (saveTimer) window.clearTimeout(saveTimer); if (workshopSaveTimer) window.clearTimeout(workshopSaveTimer); toastTimers.forEach(timer => window.clearTimeout(timer)); });
watch(settings, () => {
  if (!ready) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistSettings, 650);
}, { deep: true });
watch(workshopSettings, () => {
  if (!workshopReady || !props.tenantId) return;
  if (workshopSaveTimer) window.clearTimeout(workshopSaveTimer);
  workshopSaveTimer = window.setTimeout(persistWorkshopSettings, 700);
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

async function persistWorkshopSettings(): Promise<void> {
  try {
    await new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }).updateWorkshopTicketSettings(props.tenantId, { ...workshopSettings, receipt_copies: Number(workshopSettings.receipt_copies) === 1 ? 1 : 2 });
    notify({ title: 'Recepción actualizada', message: 'Copias, etiqueta y condiciones quedaron guardadas para el Taller.', variant: 'success' });
  } catch (reason) {
    notify({ title: 'No se guardó el formato', message: reason instanceof Error ? reason.message : 'Intenta nuevamente.', variant: 'error' });
  }
}
</script>

<template>
  <div class="space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />
    <div class="flex items-start gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><ReceiptText class="h-5 w-5" /></span>
      <div>
        <h3 class="font-semibold text-text">Presentación del ticket</h3>
        <p class="mt-1 max-w-2xl text-sm text-muted">Elige qué elementos se imprimen en esta terminal. La evidencia fiscal conservada no se modifica.</p>
      </div>
    </div>

    <div class="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.28fr)]">
      <div class="grid gap-3 rounded-lg border border-line bg-surface-muted p-4 sm:p-5 xl:sticky xl:top-4">
        <div v-if="workshopEnabled" class="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-1.5">
          <button type="button" class="flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition" :class="previewVariant === 'dte' ? 'bg-primary text-primary-contrast shadow-sm' : 'text-muted hover:bg-surface-muted hover:text-text'" @click="previewVariant = 'dte'"><FileCheck2 class="h-4 w-4" />DTE</button>
          <button type="button" class="flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition" :class="previewVariant === 'workshop' ? 'bg-primary text-primary-contrast shadow-sm' : 'text-muted hover:bg-surface-muted hover:text-text'" @click="previewVariant = 'workshop'"><Smartphone class="h-4 w-4" />Recepción</button>
        </div>
        <template v-if="workshopEnabled && previewVariant === 'workshop'">
          <UiSelect v-model="workshopSettings.receipt_copies" label="Copias de recepción" :options="[{ value: 1, label: '1 copia · Cliente' }, { value: 2, label: '2 copias · Cliente y taller' }]" />
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-text"><input v-model="workshopSettings.print_equipment_label" type="checkbox" class="mt-1 h-4 w-4 accent-primary"><span><strong class="block">Imprimir etiqueta del equipo</strong><small class="text-muted">Agrega una hoja corta con el QR seguro para pegar en el equipo.</small></span></label>
          <UiTextarea v-model="workshopSettings.terms" label="Términos y condiciones" :rows="7" :maxlength="4000" placeholder="Una condición por párrafo. Se imprimirán en las copias de recepción." />
        </template>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-text"><input v-model="settings.showLogo" type="checkbox" class="mt-1 h-4 w-4 accent-primary"><span><strong class="block">Imprimir logo</strong><small class="text-muted">Usa el logo preparado para la impresora térmica.</small></span></label>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-text"><input v-model="settings.showIssuerDetails" type="checkbox" class="mt-1 h-4 w-4 accent-primary"><span><strong class="block">Imprimir información de la empresa</strong><small class="text-muted">Nombre comercial, actividad, NIT, NRC y contacto disponible.</small></span></label>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-text"><input v-model="settings.qrEnabled" type="checkbox" class="mt-1 h-4 w-4 accent-primary"><span><strong class="block">Imprimir QR</strong><small class="text-muted">Incluye la consulta fiscal o el acceso a fotografías cuando aplique.</small></span></label>
        <div class="rounded-lg border border-line bg-surface p-3"><UiInput v-model.number="settings.qrWidth" label="Tamaño del QR" type="number" min="120" max="420" step="1" suffix="px" /><p class="mt-1 text-xs text-muted">Valor permitido: 120 a 420.</p></div>
      </div>

      <ThermalTicketPreview :settings="settings" :company="props.company" :variant="previewVariant" :workshop-settings="workshopSettings" />
    </div>
  </div>
</template>
