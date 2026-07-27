<script setup lang="ts">
import { Download, Monitor, ShieldCheck, Smartphone } from 'lucide-vue-next';

const windowsAgent = {
  version: '0.2.8-dev',
  href: '/downloads/stelfaro-print-agent-0.2.8-dev-windows.zip',
  fileName: 'stelfaro-print-agent-0.2.8-dev-windows.zip'
};
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-lg border border-primary/20 bg-primary-soft p-5">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-white">
          <ShieldCheck class="h-5 w-5" />
        </span>
        <div>
          <h2 class="text-base font-bold text-text">Aplicaciones oficiales de Stelfaro</h2>
          <p class="mt-1 text-sm leading-6 text-muted">
            Descarga únicamente desde este centro para instalar versiones verificadas y compatibles con tu cuenta.
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <article class="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-sm shadow-slate-950/5">
        <div class="flex items-start justify-between gap-4">
          <span class="grid h-11 w-11 place-items-center rounded-lg bg-surface-muted text-primary">
            <Monitor class="h-6 w-6" />
          </span>
          <span class="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">Disponible</span>
        </div>
        <h3 class="mt-5 text-lg font-bold text-text">Agente de impresión para Windows</h3>
        <p class="mt-2 flex-1 text-sm leading-6 text-muted">
          Conecta Stelfaro con la impresora térmica instalada en tu computadora para imprimir tickets sin ventanas adicionales.
        </p>
        <dl class="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-surface-muted p-4 text-sm">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted">Versión</dt>
            <dd class="mt-1 font-bold text-text">{{ windowsAgent.version }}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted">Sistema</dt>
            <dd class="mt-1 font-bold text-text">Windows 64 bits</dd>
          </div>
        </dl>
        <a
          :href="windowsAgent.href"
          :download="windowsAgent.fileName"
          class="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Download class="h-4 w-4" />
          Descargar agente para Windows
        </a>
      </article>

      <article class="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-sm shadow-slate-950/5">
        <div class="flex items-start justify-between gap-4">
          <span class="grid h-11 w-11 place-items-center rounded-lg bg-surface-muted text-muted">
            <Smartphone class="h-6 w-6" />
          </span>
          <span class="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">En preparación</span>
        </div>
        <h3 class="mt-5 text-lg font-bold text-text">Agente para Android</h3>
        <p class="mt-2 flex-1 text-sm leading-6 text-muted">
          La nueva versión para teléfonos y terminales Android está en desarrollo. Su descarga aparecerá aquí cuando complete las pruebas de compatibilidad.
        </p>
        <div class="mt-5 rounded-lg border border-dashed border-line bg-surface-muted p-4 text-sm leading-6 text-muted">
          Próxima versión: conexión mejorada, instalación más sencilla y soporte reforzado para impresoras móviles.
        </div>
        <button
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
