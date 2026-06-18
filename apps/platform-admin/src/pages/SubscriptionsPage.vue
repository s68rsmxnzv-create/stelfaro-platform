<script setup lang="ts">
const planDrafts = [
  { tenant: 'Servicio Tecnico El Faro', plan: 'Implementacion', status: 'Activo', renewal: 'Manual', apps: 'Taller + Facturacion' },
  { tenant: 'Facturacion libre demo', plan: 'Starter', status: 'Trial', renewal: 'Pendiente', apps: 'Facturacion' }
];
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Plataforma</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-950">Suscripciones</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Capa comercial de Stelfaro. Esto no pertenece a dte-core: vive en platform-api y decide acceso, limites y estado del servicio.
      </p>
    </div>

    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-semibold text-slate-950">Suscripciones por tenant</h2>
          <p class="mt-1 text-sm text-slate-500">Control comercial que habilita acceso a apps y limites.</p>
        </div>
        <button type="button" class="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          Nueva suscripcion
        </button>
      </div>

      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Tenant</th>
            <th class="px-4 py-3">Plan</th>
            <th class="px-4 py-3">Apps</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Renovacion</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="subscription in planDrafts" :key="subscription.tenant" class="hover:bg-slate-50">
            <td class="px-4 py-4 font-semibold text-slate-950">{{ subscription.tenant }}</td>
            <td class="px-4 py-4 text-slate-600">{{ subscription.plan }}</td>
            <td class="px-4 py-4 text-slate-600">{{ subscription.apps }}</td>
            <td class="px-4 py-4">
              <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="subscription.status === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'">
                {{ subscription.status }}
              </span>
            </td>
            <td class="px-4 py-4 text-slate-600">{{ subscription.renewal }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Pendiente: migraciones de planes/suscripciones, contadores de uso y bloqueo por estado trialing/active/past_due/suspended.
    </div>
  </section>
</template>
