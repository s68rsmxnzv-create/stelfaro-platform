<script setup lang="ts">
const plans = [
  { name: 'Starter', price: 'Base', includes: '1 app, 2 usuarios, 1 sucursal', dte: '100 DTE/mes' },
  { name: 'Pro', price: 'Intermedio', includes: 'Taller + facturacion, 10 usuarios, 3 sucursales', dte: '1000 DTE/mes' },
  { name: 'Business', price: 'Personalizado', includes: 'Apps multiples, limites ampliados y soporte prioritario', dte: 'Personalizado' }
];
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Comercial</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-950">Planes</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Catalogo propietario de planes. Las apps operativas solo consultan si el tenant tiene acceso y limites disponibles.
      </p>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <article v-for="plan in plans" :key="plan.name" class="rounded-lg border border-slate-200 bg-white p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-700">{{ plan.price }}</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-950">{{ plan.name }}</h2>
        <p class="mt-3 text-sm leading-6 text-slate-600">{{ plan.includes }}</p>
        <p class="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{{ plan.dte }}</p>
      </article>
    </div>

    <div class="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 class="text-base font-semibold text-slate-950">Reglas del catalogo</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Los planes definen acceso, limites y suspension comercial. Las apps consultan platform-api; dte-core no conoce planes ni suscripciones.
      </p>
    </div>
  </section>
</template>
