<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Cable, ChevronDown, Download, Printer, RefreshCw, TestTube2 } from 'lucide-vue-next';
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
const latestAgentVersion = ref<string | null>(null);
const connectedAgentVersion = ref<string | null>(null);
let ready = false;

onMounted(() => { Object.assign(settings, loadPrinterSettings()); ready = true; void loadLatestAgentVersion(); });
watch(settings, () => { if (ready) savePrinterSettings(settings); }, { deep: true });

const isAgentOutdated = computed(() => (
  status.value === 'ok'
  && !!connectedAgentVersion.value
  && !!latestAgentVersion.value
  && compareVersions(connectedAgentVersion.value, latestAgentVersion.value) < 0
));

async function loadLatestAgentVersion(): Promise<void> {
  try {
    const response = await fetch('/downloads/agent-releases.json', { cache: 'no-store' });
    if (!response.ok) return;
    const manifest = await response.json() as { windows?: { version?: string | null } };
    latestAgentVersion.value = manifest.windows?.version ?? null;
  } catch {
    // El agente ya conectado sigue funcionando aunque el manifiesto no responda.
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const partsB = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(partsA.length, partsB.length); index += 1) {
    const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function checkAgent(loadAvailablePrinters = false) {
  checking.value = true; status.value = 'idle'; message.value = 'Conectando con el agente local…'; connectedAgentVersion.value = null;
  try {
    const health = await requestPrintAgent<AgentHealth>(settings, '/health');
    status.value = 'ok'; message.value = `${health.name || 'Agente Stelfaro'} ${health.version || ''} · ${health.platform || 'dispositivo local'}${health.dryRun ? ' · modo de prueba' : ''}`;
    connectedAgentVersion.value = health.version ?? null;
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

    <div v-if="isAgentOutdated" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4">
      <div class="min-w-0">
        <p class="text-sm font-bold text-warning">Agente desactualizado</p>
        <p class="mt-1 text-sm text-muted">Tienes la versión {{ connectedAgentVersion }} instalada; la más reciente es {{ latestAgentVersion }}. Descarga e instala la actualización para seguir recibiendo mejoras y soporte.</p>
      </div>
      <a
        href="/downloads/stelfaro-print-agent-windows-latest.zip"
        :download="`stelfaro-print-agent-${latestAgentVersion}-windows.zip`"
        class="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-warning px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
      >
        <Download class="h-4 w-4" />
        Descargar actualización
      </a>
    </div>

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
