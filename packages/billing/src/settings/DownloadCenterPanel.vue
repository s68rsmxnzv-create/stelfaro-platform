<script setup lang="ts">
import { Download, Monitor, ShieldCheck, Smartphone } from "lucide-vue-next";
import { computed, onMounted, reactive } from "vue";

type AgentRelease = {
  available: boolean;
  version: string | null;
  file: string;
  size?: number;
  sha256?: string;
  published_at?: string;
};

const releases = reactive<Record<"windows" | "android", AgentRelease>>({
  windows: {
    available: true,
    version: null,
    file: "stelfaro-print-agent-windows-latest.zip",
  },
  android: {
    available: false,
    version: null,
    file: "stelfaro-print-agent-android-latest.apk",
  },
});

const windowsAgentHref = computed(() => {
  const release = releases.windows;
  const cacheKey = encodeURIComponent(
    `${release.version || "latest"}-${release.published_at || Date.now()}`,
  );
  return `/downloads/${release.file}?v=${cacheKey}`;
});
const windowsAgentFileName = computed(
  () =>
    `stelfaro-print-agent-${releases.windows.version || "latest"}-windows.zip`,
);

const androidAgent = {
  href: "/downloads/stelfaro-print-agent-android-latest.apk",
  fileName: "stelfaro-print-agent-android-latest.apk",
};

onMounted(async () => {
  try {
    const response = await fetch("/downloads/agent-releases.json", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const manifest = (await response.json()) as Partial<
      Record<"windows" | "android", AgentRelease>
    >;
    if (manifest.windows) Object.assign(releases.windows, manifest.windows);
    if (manifest.android) Object.assign(releases.android, manifest.android);
  } catch {
    // La descarga estable de Windows sigue disponible aunque el manifiesto no responda.
  }
});

function formatSize(bytes?: number): string {
  if (!bytes) return "Paquete ZIP";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-lg border border-primary/20 bg-primary-soft p-5">
      <div class="flex items-start gap-3">
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-white"
        >
          <ShieldCheck class="h-5 w-5" />
        </span>
        <div>
          <h2 class="text-base font-bold text-text">
            Aplicaciones oficiales de Stelfaro
          </h2>
          <p class="mt-1 text-sm leading-6 text-muted">
            Descarga únicamente desde este centro para instalar versiones
            verificadas y compatibles con tu cuenta.
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <article
        class="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-sm shadow-slate-950/5"
      >
        <div class="flex items-start justify-between gap-4">
          <span
            class="grid h-11 w-11 place-items-center rounded-lg bg-surface-muted text-primary"
          >
            <Monitor class="h-6 w-6" />
          </span>
          <span
            class="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success"
            >Disponible</span
          >
        </div>
        <h3 class="mt-5 text-lg font-bold text-text">
          Agente de impresión para Windows
        </h3>
        <p class="mt-2 flex-1 text-sm leading-6 text-muted">
          Conecta Stelfaro con la impresora térmica instalada en tu computadora
          para imprimir tickets sin ventanas adicionales.
        </p>
        <dl
          class="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-surface-muted p-4 text-sm"
        >
          <div>
            <dt
              class="text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Versión
            </dt>
            <dd class="mt-1 font-bold text-text">
              {{ releases.windows.version || "Más reciente" }}
            </dd>
          </div>
          <div>
            <dt
              class="text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Sistema
            </dt>
            <dd class="mt-1 font-bold text-text">Windows 64 bits</dd>
          </div>
        </dl>
        <a
          :href="windowsAgentHref"
          :download="windowsAgentFileName"
          class="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Download class="h-4 w-4" />
          Descargar agente para Windows
        </a>
        <p class="mt-2 text-center text-xs text-muted">
          {{ formatSize(releases.windows.size) }}
        </p>
      </article>

      <article
        class="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-sm shadow-slate-950/5"
      >
        <div class="flex items-start justify-between gap-4">
          <span
            class="grid h-11 w-11 place-items-center rounded-lg bg-surface-muted text-muted"
          >
            <Smartphone class="h-6 w-6" />
          </span>
          <span
            class="rounded-full px-3 py-1 text-xs font-bold"
            :class="
              releases.android.available
                ? 'bg-success-soft text-success'
                : 'bg-warning-soft text-warning'
            "
          >
            {{ releases.android.available ? "Disponible" : "En preparación" }}
          </span>
        </div>
        <h3 class="mt-5 text-lg font-bold text-text">Agente para Android</h3>
        <p class="mt-2 flex-1 text-sm leading-6 text-muted">
          {{
            releases.android.available
              ? "Instala la versión más reciente en teléfonos y terminales Android compatibles."
              : "La nueva versión para teléfonos y terminales Android está en desarrollo. Su descarga aparecerá aquí cuando complete las pruebas de compatibilidad."
          }}
        </p>
        <div
          class="mt-5 rounded-lg border border-dashed border-line bg-surface-muted p-4 text-sm leading-6 text-muted"
        >
          Próxima versión: conexión mejorada, instalación más sencilla y soporte
          reforzado para impresoras móviles.
        </div>
        <a
          v-if="releases.android.available"
          :href="androidAgent.href"
          :download="androidAgent.fileName"
          class="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Download class="h-4 w-4" />
          Descargar agente para Android
        </a>
        <button
          v-else
          type="button"
          class="mt-5 inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-surface-muted px-5 py-2.5 text-sm font-bold text-muted"
          disabled
        >
          <Download class="h-4 w-4" />
          Descarga disponible próximamente
        </button>
      </article>
    </div>
  </div>
</template>
