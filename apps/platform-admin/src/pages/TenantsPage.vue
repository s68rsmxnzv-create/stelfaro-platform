<script setup lang="ts">
const nextSteps = [
  'Crear tenant con nombre, slug, estado y app principal.',
  'Crear usuario dueño/admin inicial del tenant.',
  'Activar apps contratadas desde tenant_app_accesses.',
  'Vincular fiscalidad cuando el cliente delegue onboarding.'
];

const tenantRows = [
  {
    name: 'Servicio Tecnico El Faro',
    slug: 'servicio-tecnico-el-faro',
    apps: 'Taller, Facturacion',
    status: 'Activo',
    plan: 'Implementacion',
    admin: 'Jose Armando'
  }
];
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Plataforma</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-950">Tenants</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Clientes globales de Stelfaro. Desde aqui se da de alta el tenant, se asignan apps, plan y usuario administrador inicial.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-semibold text-slate-950">Clientes registrados</h2>
            <p class="mt-1 text-sm text-slate-500">Vista propietaria de tenants y acceso contratado.</p>
          </div>
          <button type="button" class="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            Nuevo tenant
          </button>
        </div>
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Cliente</th>
              <th class="px-4 py-3">Apps</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Plan</th>
              <th class="px-4 py-3">Admin inicial</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="tenant in tenantRows" :key="tenant.slug" class="hover:bg-slate-50">
              <td class="px-4 py-4">
                <p class="font-semibold text-slate-950">{{ tenant.name }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ tenant.slug }}</p>
              </td>
              <td class="px-4 py-4 text-slate-600">{{ tenant.apps }}</td>
              <td class="px-4 py-4">
                <span class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{{ tenant.status }}</span>
              </td>
              <td class="px-4 py-4 text-slate-600">{{ tenant.plan }}</td>
              <td class="px-4 py-4 text-slate-600">{{ tenant.admin }}</td>
            </tr>
            <tr>
              <td class="bg-slate-50 px-4 py-4 text-xs text-slate-500" colspan="5">
                Datos semilla de orientacion. El siguiente paso conecta esta tabla al BFF administrativo.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="rounded-lg border border-slate-200 bg-white p-5">
        <h2 class="text-base font-semibold text-slate-950">Siguiente implementacion</h2>
        <ol class="mt-4 space-y-3 text-sm text-slate-600">
          <li v-for="(step, index) in nextSteps" :key="step" class="flex gap-3">
            <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">{{ index + 1 }}</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </aside>
    </div>
  </section>
</template>
