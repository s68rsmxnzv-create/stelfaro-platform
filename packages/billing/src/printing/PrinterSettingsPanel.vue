<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { Cable, ChevronDown, Printer, RefreshCw, TestTube2 } from 'lucide-vue-next';
import { UiButton, UiInput, UiSelect, UiStatusBadge, UiToggle } from '@stelfaro/ui';
import { defaultPrinterSettings, loadPrinterSettings, requestPrintAgent, savePrinterSettings, type PrinterSettings } from './printerSettings';
import { printerTestOperations } from './printerTestJob';
import { sendPrintOperations } from './printJob';

type AgentHealth = { ok: boolean; name?: string; version?: string; platform?: string; dryRun?: boolean };
type AgentPrinter = { name: string; source?: string };
const settings = reactive<PrinterSettings>(defaultPrinterSettings());
const printers = ref<AgentPrinter[]>([]);
const checking = ref(false);
const status = ref<'idle'|'ok'|'error'>('idle');
const message = ref('Aún no hemos comprobado el agente en esta terminal.');
const advancedOpen = ref(false);
let ready = false;

onMounted(() => { Object.assign(settings, loadPrinterSettings()); ready = true; });
watch(settings, () => { if (ready) savePrinterSettings(settings); }, { deep: true });

async function checkAgent(loadAvailablePrinters = false) {
  checking.value = true; status.value = 'idle'; message.value = 'Conectando con el agente local…';
  try {
    const health = await requestPrintAgent<AgentHealth>(settings, '/health');
    status.value = 'ok'; message.value = `${health.name || 'Agente Stelfaro'} ${health.version || ''} · ${health.platform || 'dispositivo local'}${health.dryRun ? ' · modo de prueba' : ''}`;
    if (loadAvailablePrinters) await loadPrinters();
  } catch (error) { status.value = 'error'; message.value = error instanceof Error ? error.message : 'No fue posible conectar con el agente.'; }
  finally { checking.value = false; }
}
async function loadPrinters() {
  const response = await requestPrintAgent<{ printers: AgentPrinter[] }>(settings, '/printers');
  printers.value = response.printers || [];
  if (!printers.value.some((printer) => printer.name === settings.printer)) settings.printer = printers.value[0]?.name || '';
  message.value = printers.value.length ? `${printers.value.length} impresora(s) detectada(s).` : 'El agente respondió, pero no encontró impresoras.';
}
async function testPrint() {
  if (!settings.printer) { status.value = 'error'; message.value = 'Selecciona una impresora antes de realizar la prueba.'; return; }
  checking.value = true;
  try {
    await sendPrintOperations(settings, printerTestOperations(settings));
    status.value = 'ok'; message.value = 'La prueba fue enviada correctamente.';
  } catch (error) { status.value = 'error'; message.value = error instanceof Error ? error.message : 'No fue posible imprimir la prueba.'; }
  finally { checking.value = false; }
}
function openHealth() {
  window.open(`${settings.agentUrl.replace(/\/+$/, '')}/health`, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-2 text-primary"><Printer class="h-5 w-5" /><h3 class="font-semibold text-text">Impresora de esta terminal</h3></div>
    <p class="-mt-3 max-w-2xl text-sm text-muted">Estas preferencias se guardan únicamente en este navegador. No afectan otras computadoras ni usuarios.</p>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex items-center gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3"><UiToggle v-model="settings.enabled" aria-label="Impresión silenciosa activa" /><span class="text-sm font-semibold text-text">Impresión silenciosa activa</span></label>
      <label v-if="settings.enabled" class="flex items-center gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3"><UiToggle v-model="settings.autoPrintAfterIssue" aria-label="Impresión automática después de emitir" class="shrink-0" /><span class="text-sm text-text"><strong class="block">Impresión automática después de emitir</strong><small class="mt-1 block text-muted">Imprime al recibir Hacienda. Si el cliente tiene correo, preguntaremos antes.</small></span></label>
      <label class="flex items-center gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3"><UiToggle v-model="settings.openDrawer" aria-label="Abrir gaveta al cobrar" class="shrink-0" /><span class="text-sm text-text"><strong class="block">Abrir gaveta al cobrar</strong><small class="mt-1 block text-muted">Envía el pulso mediante la impresora seleccionada.</small></span></label>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_140px_170px]"><UiSelect v-model="settings.printer" label="Impresora predeterminada" :options="printers.length ? printers.map(printer => ({ value: printer.name, label: printer.name })) : settings.printer ? [{ value: settings.printer, label: settings.printer }] : []" placeholder="Buscar impresoras" /><div class="flex items-end"><UiButton class="w-full" variant="secondary" :disabled="checking" @click="checkAgent(true)"><RefreshCw class="h-4 w-4" :class="checking ? 'animate-spin' : ''" />Buscar</UiButton></div><UiSelect v-model="settings.paperWidth" label="Ancho de papel" :options="[{value:'58',label:'58 mm'},{value:'80',label:'80 mm'}]" /><UiInput v-model.number="settings.cutLines" label="Líneas antes del corte" type="number" min="1" max="12" /></div>

    <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-4"><div class="flex min-w-0 items-center gap-3"><Cable class="h-5 w-5 shrink-0" :class="status === 'ok' ? 'text-success' : status === 'error' ? 'text-danger' : 'text-muted'" /><div class="min-w-0"><UiStatusBadge :tone="status === 'ok' ? 'success' : status === 'error' ? 'danger' : 'neutral'">{{ status === 'ok' ? 'Conectado' : status === 'error' ? 'Sin conexión' : 'Sin comprobar' }}</UiStatusBadge><p class="mt-1 max-w-2xl text-sm text-muted">{{ message }}</p><button v-if="status === 'error'" type="button" class="mt-2 text-xs font-semibold text-primary hover:underline" @click="openHealth">Abrir página de salud del agente</button></div></div><div class="flex flex-wrap gap-2"><UiButton variant="secondary" :disabled="checking" @click="checkAgent(false)">Comprobar</UiButton><UiButton :disabled="checking || !settings.printer" @click="testPrint"><TestTube2 class="h-4 w-4" />Imprimir prueba</UiButton></div></div>

    <div>
      <button type="button" class="flex w-full items-center justify-between rounded-md border border-line px-4 py-3 text-left text-sm font-semibold text-text hover:bg-surface-muted" @click="advancedOpen = !advancedOpen">
        <span>Configuración avanzada</span>
        <ChevronDown class="h-4 w-4 transition-transform" :class="advancedOpen ? 'rotate-180' : ''" />
      </button>
      <div v-if="advancedOpen" class="mt-3">
        <UiInput v-model="settings.agentUrl" label="Dirección del agente" placeholder="http://localhost:8711" />
      </div>
    </div>
  </div>
</template>
