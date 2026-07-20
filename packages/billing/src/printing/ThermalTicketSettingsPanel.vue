<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue';
import { ReceiptText } from 'lucide-vue-next';
import { UiInput } from '@stelfaro/ui';
import { defaultPrinterSettings, loadPrinterSettings, savePrinterSettings, type PrinterSettings } from './printerSettings';
import ThermalTicketPreview from './ThermalTicketPreview.vue';

type PreviewCompany = { name: string; tradeName: string; logoUrl: string | null; nit: string; nrc: string | null; activity: string };
const props = defineProps<{ company?: PreviewCompany | null }>();
const settings = reactive<PrinterSettings>(defaultPrinterSettings());
let ready = false;

onMounted(() => { Object.assign(settings, loadPrinterSettings()); ready = true; });
watch(settings, () => { if (ready) savePrinterSettings(settings); }, { deep: true });
</script>

<template>
  <div class="space-y-5">
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
      <UiInput v-model.number="settings.qrWidth" label="Tamaño del QR" type="number" min="120" max="420" />
    </div>

    <ThermalTicketPreview :settings="settings" :company="props.company" />
  </div>
</template>
