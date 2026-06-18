<script setup lang="ts">
const areas = [
  { label: 'Empresas fiscales delegadas', status: '1 configurada' },
  { label: 'Sucursales y puntos de venta', status: 'Base operativa' },
  { label: 'Certificados y credenciales MH', status: 'Administrado en onboarding' },
  { label: 'Ambiente pruebas/produccion', status: 'Pruebas activo' }
];
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Fiscal</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-950">Estado fiscal</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Vista global para soporte e implementacion fiscal. El onboarding funcional se mantiene separado y reutiliza el flujo existente.
      </p>
    </div>

    <div class="grid gap-5 lg:grid-cols-4">
      <article v-for="area in areas" :key="area.label" class="rounded-lg border border-slate-200 bg-white p-5">
        <p class="text-sm font-semibold text-slate-950">{{ area.label }}</p>
        <p class="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">{{ area.status }}</p>
        <p class="mt-3 text-sm leading-6 text-slate-600">Resumen propietario conectado al BFF fiscal en la siguiente iteracion.</p>
      </article>
    </div>

    <div class="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-950">Onboarding funcional</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        La pantalla de onboarding fiscal existente se mantiene tal cual porque ya funciona. Esta vista sera el tablero global para encontrar clientes y entrar a su configuracion.
      </p>
    </div>
  </section>
</template>
