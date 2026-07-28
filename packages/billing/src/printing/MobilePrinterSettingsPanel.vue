<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { CheckCircle2, Download, Link2, Printer, RefreshCw, Smartphone, TestTube2, Trash2, Usb } from 'lucide-vue-next';
import { UiButton, UiInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { isAndroidDevice, saveAndroidPrintContext } from './androidPrint';
import { defaultPrinterSettings, loadPrinterSettings, savePrinterSettings, type PrinterSettings } from './printerSettings';
import { printerTestOperations } from './printerTestJob';
import { sendPrintOperations } from './printJob';

type AgentRelease = { available: boolean; version: string | null; size?: number };
type AndroidAgent = {
  id: number;
  name: string;
  device_name?: string | null;
  status: string;
  last_seen_at?: string | null;
};

const props = withDefaults(defineProps<{
  tenantId: number;
  platformBaseUrl?: string;
}>(), {
  platformBaseUrl: '/api/v1',
});

const androidRelease = reactive<AgentRelease>({ available: false, version: null });
const settings = reactive<PrinterSettings>(defaultPrinterSettings());
const agents = ref<AndroidAgent[]>([]);
const selectedAgentId = ref('');
const agentName = ref('');
const pairingCode = ref('');
const pairingExpiresAt = ref('');
const busy = ref(false);
const message = ref('Configura un agente Android para comenzar.');
const status = ref<'idle' | 'ok' | 'error'>('idle');
let ready = false;

const isAndroid = computed(isAndroidDevice);
const downloadUrl = '/downloads/stelfaro-print-agent-android-latest.apk';
const apiBase = computed(() => props.platformBaseUrl.replace(/\/+$/, ''));
const agentOptions = computed(() => agents.value
  .filter(agent => agent.status === 'active')
  .map(agent => ({
    value: String(agent.id),
    label: `${agent.name}${agent.last_seen_at ? ' · conectado' : ''}`,
  })));

onMounted(async () => {
  Object.assign(settings, loadPrinterSettings());
  const configuredAgent = /^android:(\d+)$/.exec(settings.printer);
  selectedAgentId.value = configuredAgent?.[1] || '';
  ready = true;
  await Promise.all([loadRelease(), isAndroid.value ? loadAgents() : Promise.resolve()]);
});

watch(settings, () => {
  if (ready) savePrinterSettings(settings);
}, { deep: true });

watch(selectedAgentId, (value) => {
  if (!ready || !value) return;
  settings.printer = `android:${value}`;
  savePrinterSettings(settings);
  saveAndroidPrintContext({
    tenantId: props.tenantId,
    agentId: Number(value),
    platformBaseUrl: apiBase.value,
  });
});

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${apiBase.value}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Solicitud fallida (HTTP ${response.status}).`);
  return data;
}

async function loadRelease(): Promise<void> {
  try {
    const response = await fetch('/downloads/agent-releases.json', { cache: 'no-store' });
    if (response.ok) {
      const manifest = await response.json() as { android?: AgentRelease };
      if (manifest.android) Object.assign(androidRelease, manifest.android);
    }
  } catch {
    // La configuración continúa aunque el manifiesto de descarga no responda.
  }
}

async function loadAgents(): Promise<void> {
  if (!props.tenantId) return;
  busy.value = true;
  try {
    agents.value = (await api(`/platform/tenants/${props.tenantId}/android-print/agents`)).data || [];
    if (!agents.value.some(agent => String(agent.id) === selectedAgentId.value)) {
      selectedAgentId.value = agents.value.find(agent => agent.status === 'active')?.id?.toString() || '';
    }
    status.value = agents.value.some(agent => agent.status === 'active') ? 'ok' : 'idle';
    message.value = agents.value.some(agent => agent.status === 'active')
      ? 'Agente Android disponible para recibir impresiones.'
      : 'Genera un código y empareja el APK con esta empresa.';
  } catch (error) {
    status.value = 'error';
    message.value = error instanceof Error ? error.message : 'No fue posible consultar los agentes.';
  } finally {
    busy.value = false;
  }
}

async function createPairingCode(): Promise<void> {
  busy.value = true;
  pairingCode.value = '';
  try {
    const response = await api(`/platform/tenants/${props.tenantId}/android-print/pairing-codes`, {
      method: 'POST',
      body: JSON.stringify({ agent_name: agentName.value || null }),
    });
    pairingCode.value = response.data.code;
    pairingExpiresAt.value = response.data.expires_at;
    status.value = 'ok';
    message.value = `En el APK usa ${response.data.server_url} y el código mostrado.`;
  } catch (error) {
    status.value = 'error';
    message.value = error instanceof Error ? error.message : 'No se pudo generar el código.';
  } finally {
    busy.value = false;
  }
}

async function revoke(agent: AndroidAgent): Promise<void> {
  if (!window.confirm(`¿Revocar ${agent.name}?`)) return;
  busy.value = true;
  try {
    await api(`/platform/tenants/${props.tenantId}/android-print/agents/${agent.id}`, { method: 'DELETE' });
    await loadAgents();
  } catch (error) {
    status.value = 'error';
    message.value = error instanceof Error ? error.message : 'No se pudo revocar el agente.';
  } finally {
    busy.value = false;
  }
}

async function testPrint(): Promise<void> {
  if (!selectedAgentId.value) {
    status.value = 'error';
    message.value = 'Selecciona un agente emparejado.';
    return;
  }
  busy.value = true;
  try {
    settings.enabled = true;
    settings.printer = `android:${selectedAgentId.value}`;
    saveAndroidPrintContext({
      tenantId: props.tenantId,
      agentId: Number(selectedAgentId.value),
      platformBaseUrl: apiBase.value,
    });
    await sendPrintOperations(settings, printerTestOperations(settings));
    status.value = 'ok';
    message.value = 'Prueba agregada a la cola. El agente la imprimirá al consultar el servidor.';
  } catch (error) {
    status.value = 'error';
    message.value = error instanceof Error ? error.message : 'No fue posible enviar la prueba.';
  } finally {
    busy.value = false;
  }
}

function formatSize(bytes?: number): string {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
}

function lastSeen(value?: string | null): string {
  if (!value) return 'Todavía no se conecta';
  return `Última conexión: ${new Intl.DateTimeFormat('es-SV', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))}`;
}
</script>

<template>
  <div class="space-y-5">
    <header class="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-5 text-white shadow-lg shadow-primary/15 sm:p-6">
      <div class="flex items-start gap-4">
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15"><Smartphone class="h-7 w-7" /></span>
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Impresión Android</p>
          <h2 class="mt-1 text-xl font-bold">Conecta esta empresa con el agente móvil</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-white/80">Las mismas plantillas térmicas de Stelfaro se envían por HTTPS al agente Android.</p>
        </div>
      </div>
    </header>

    <section v-if="!isAndroid" class="rounded-xl border border-warning/30 bg-warning-soft p-5">
      <h3 class="font-bold text-text">Android requerido</h3>
      <p class="mt-2 text-sm text-muted">La impresión móvil está disponible únicamente en Android. iPhone y iPad quedan fuera de esta primera versión.</p>
    </section>

    <template v-else>
      <section class="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="font-bold text-text">Agente Stelfaro para Android</h3>
            <p class="mt-1 text-sm text-muted">Versión {{ androidRelease.version || 'más reciente' }} · {{ formatSize(androidRelease.size) }}</p>
          </div>
          <a v-if="androidRelease.available" :href="downloadUrl" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white">
            <Download class="h-4 w-4" />Descargar APK
          </a>
        </div>
      </section>

      <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h3 class="flex items-center gap-2 font-bold text-text"><Link2 class="h-5 w-5 text-primary" />Emparejar un agente</h3>
        <div class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <UiInput v-model="agentName" label="Nombre del dispositivo" placeholder="Caja Android" />
          <div class="flex items-end"><UiButton class="w-full" :disabled="busy" @click="createPairingCode">Generar código</UiButton></div>
        </div>
        <div v-if="pairingCode" class="mt-4 rounded-xl border-2 border-primary/30 bg-primary-soft p-5 text-center">
          <p class="text-xs font-bold uppercase tracking-widest text-muted">Código temporal</p>
          <p class="mt-2 font-mono text-4xl font-black tracking-[0.18em] text-primary">{{ pairingCode }}</p>
          <p class="mt-2 text-xs text-muted">Vence {{ new Date(pairingExpiresAt).toLocaleTimeString('es-SV') }}. En el APK usa la URL <strong>https://taller.stelfaro.com</strong>.</p>
        </div>
      </section>

      <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <div class="flex items-center justify-between gap-3">
          <h3 class="flex items-center gap-2 font-bold text-text"><Usb class="h-5 w-5 text-primary" />Agentes emparejados</h3>
          <UiButton size="sm" variant="secondary" :disabled="busy" @click="loadAgents"><RefreshCw class="h-4 w-4" />Actualizar</UiButton>
        </div>
        <div v-if="agents.length" class="mt-4 space-y-2">
          <div v-for="agent in agents" :key="agent.id" class="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-3">
            <div class="min-w-0"><p class="truncate text-sm font-bold text-text">{{ agent.name }}</p><p class="mt-1 text-xs text-muted">{{ lastSeen(agent.last_seen_at) }}</p></div>
            <div class="flex items-center gap-2"><UiStatusBadge :tone="agent.status === 'active' ? 'success' : 'neutral'">{{ agent.status === 'active' ? 'Activo' : 'Revocado' }}</UiStatusBadge><button v-if="agent.status === 'active'" class="p-2 text-danger" @click="revoke(agent)"><Trash2 class="h-4 w-4" /></button></div>
          </div>
        </div>
        <p v-else class="mt-4 rounded-lg bg-surface-muted p-4 text-sm text-muted">No hay agentes emparejados todavía.</p>
      </section>

      <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h3 class="flex items-center gap-2 font-bold text-text"><Printer class="h-5 w-5 text-primary" />Preferencias en este Android</h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <UiSelect v-model="selectedAgentId" label="Agente predeterminado" :options="agentOptions" placeholder="Seleccionar agente" />
          <UiSelect v-model="settings.paperWidth" label="Ancho de papel" :options="[{value:'58',label:'58 mm'},{value:'80',label:'80 mm'}]" />
          <label class="flex items-center gap-3 rounded-lg border border-line bg-surface-muted p-4"><input v-model="settings.enabled" type="checkbox" class="h-4 w-4 accent-primary"><span class="text-sm font-bold text-text">Impresión activa</span></label>
          <label class="flex items-center gap-3 rounded-lg border border-line bg-surface-muted p-4"><input v-model="settings.autoPrintAfterIssue" type="checkbox" class="h-4 w-4 accent-primary"><span class="text-sm font-bold text-text">Imprimir automáticamente al emitir</span></label>
        </div>
        <UiButton class="mt-4 w-full sm:w-auto" :disabled="busy || !selectedAgentId" @click="testPrint"><TestTube2 class="h-4 w-4" />Enviar impresión de prueba</UiButton>
      </section>

      <div class="flex items-start gap-3 rounded-xl border border-line bg-surface-muted p-4">
        <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0" :class="status === 'error' ? 'text-danger' : 'text-success'" />
        <p class="text-sm leading-6 text-muted">{{ message }}</p>
      </div>
    </template>
  </div>
</template>
