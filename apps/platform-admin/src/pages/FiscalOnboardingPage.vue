<script setup lang="ts">
import { BillingOnboardingPage } from '@stelfaro/billing';
import { useCoreSessionStore } from '../stores/coreSession';

const core = useCoreSessionStore();
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Fiscal</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-950">Onboarding fiscal</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Reutiliza el flujo fiscal del monorepo para registrar empresa, ubicacion, certificado y credenciales MH.
      </p>
    </div>

    <div v-if="!core.isConnected" class="rounded-lg border border-slate-200 bg-white p-5">
      <h2 class="text-lg font-semibold text-slate-950">Conexion con dte-core</h2>
      <p class="mt-1 text-sm text-slate-600">
        La sesion fiscal se abre desde platform-api. No necesitas pegar tokens manualmente.
      </p>
      <p v-if="core.lastError" class="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ core.lastError }}
      </p>
    </div>

    <BillingOnboardingPage
      v-else
      :core-base-url="core.baseUrl"
      request-credentials="include"
    />
  </section>
</template>
