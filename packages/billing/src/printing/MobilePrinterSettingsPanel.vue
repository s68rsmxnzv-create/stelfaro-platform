<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { CheckCircle2, Download, ExternalLink, Link2, Printer, Smartphone, Usb } from 'lucide-vue-next';

type AgentRelease = {
  available: boolean;
  version: string | null;
  size?: number;
};

const androidRelease = reactive<AgentRelease>({
  available: false,
  version: null,
});

const isAndroid = computed(() => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent));
const downloadUrl = '/downloads/stelfaro-print-agent-android-latest.apk';

onMounted(async () => {
  try {
    const response = await fetch('/downloads/agent-releases.json', { cache: 'no-store' });
    if (!response.ok) return;
    const manifest = await response.json() as { android?: AgentRelease };
    if (manifest.android) Object.assign(androidRelease, manifest.android);
  } catch {
    // El panel conserva el estado "en preparación" si no responde el manifiesto.
  }
});

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  return ` · ${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="space-y-5">
    <header class="overflow-hidden rounded-xl bg-gradient-to-br from-primary to-blue-700 p-5 text-white shadow-lg shadow-primary/15 sm:p-6">
      <div class="flex items-start gap-4">
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
          <Smartphone class="h-7 w-7" />
        </span>
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Impresión móvil</p>
          <h2 class="mt-1 text-xl font-bold">Configura la impresora desde el agente Android</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-white/80">
            En celulares y tablets la conexión se administra desde la aplicación móvil. La configuración de Windows no se comparte con este dispositivo.
          </p>
        </div>
      </div>
    </header>

    <section v-if="isAndroid" class="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
            <Download class="h-5 w-5" />
          </span>
          <div>
            <h3 class="font-bold text-text">Agente Stelfaro para Android</h3>
            <p v-if="androidRelease.available" class="mt-1 text-sm text-muted">
              Versión {{ androidRelease.version || 'más reciente' }}{{ formatSize(androidRelease.size) }}
            </p>
            <p v-else class="mt-1 text-sm text-muted">La nueva versión está en preparación y validación.</p>
          </div>
        </div>
        <a
          v-if="androidRelease.available"
          :href="downloadUrl"
          download="stelfaro-print-agent-android-latest.apk"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white"
        >
          <Download class="h-4 w-4" />
          Descargar agente
        </a>
        <span v-else class="inline-flex rounded-full bg-warning-soft px-3 py-1.5 text-xs font-bold text-warning">
          Disponible próximamente
        </span>
      </div>
    </section>

    <section v-else class="rounded-xl border border-warning/30 bg-warning-soft p-5">
      <h3 class="font-bold text-text">Dispositivo móvil no compatible por ahora</h3>
      <p class="mt-2 text-sm leading-6 text-muted">
        La primera aplicación móvil estará disponible para Android. En iPhone y iPad todavía no instalaremos un agente de impresión.
      </p>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h3 class="flex items-center gap-2 font-bold text-text">
        <Printer class="h-5 w-5 text-primary" />
        Flujo de configuración móvil
      </h3>
      <ol class="mt-5 grid gap-4 lg:grid-cols-3">
        <li class="rounded-lg border border-line bg-surface-muted p-4">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-black text-white">1</span>
          <p class="mt-3 font-bold text-text">Instala el agente</p>
          <p class="mt-1 text-sm leading-6 text-muted">Descarga la aplicación oficial en este dispositivo Android.</p>
        </li>
        <li class="rounded-lg border border-line bg-surface-muted p-4">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-black text-white">2</span>
          <p class="mt-3 flex items-center gap-2 font-bold text-text"><Link2 class="h-4 w-4" />Empareja tu cuenta</p>
          <p class="mt-1 text-sm leading-6 text-muted">Abre el agente e ingresa el código temporal generado por Stelfaro.</p>
        </li>
        <li class="rounded-lg border border-line bg-surface-muted p-4">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-black text-white">3</span>
          <p class="mt-3 flex items-center gap-2 font-bold text-text"><Usb class="h-4 w-4" />Conecta e imprime</p>
          <p class="mt-1 text-sm leading-6 text-muted">Selecciona USB OTG, Bluetooth o red desde la aplicación y realiza una prueba.</p>
        </li>
      </ol>
    </section>

    <div class="flex items-start gap-3 rounded-xl border border-line bg-surface-muted p-4">
      <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-success" />
      <div>
        <p class="text-sm font-bold text-text">Configuraciones independientes</p>
        <p class="mt-1 text-sm leading-6 text-muted">
          Los ajustes móviles quedan en el agente Android. Al volver desde una computadora aparecerá automáticamente el panel del agente Windows.
        </p>
      </div>
      <ExternalLink class="hidden h-4 w-4 shrink-0 text-muted sm:block" />
    </div>
  </div>
</template>
