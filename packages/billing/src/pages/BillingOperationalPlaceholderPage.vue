<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string;
  description?: string;
  items?: string[];
}>(), {
  title: 'Modulo operativo',
  description: 'Esta area queda reservada para el flujo operativo de la app vertical.',
  items: () => []
});
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-blue-950/5">
      <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Taller electronico</p>
      <h2 class="mt-2 text-2xl font-semibold text-slate-950">{{ props.title }}</h2>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{{ props.description }}</p>

      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <article
          v-for="item in props.items"
          :key="item"
          class="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700"
        >
          {{ item }}
        </article>
      </div>

      <div class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Pantalla reservada. El flujo operativo se implementara aqui sin mover la facturacion ni duplicar logica fiscal.
      </div>
    </div>
  </section>
</template>
