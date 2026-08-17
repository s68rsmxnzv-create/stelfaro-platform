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
    <div class="rounded-lg border border-line bg-surface p-6 shadow-sm shadow-surface">
      <p class="text-sm font-semibold uppercase tracking-wide text-primary">Taller electronico</p>
      <h2 class="mt-2 text-2xl font-semibold text-text">{{ props.title }}</h2>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-muted">{{ props.description }}</p>

      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <article
          v-for="item in props.items"
          :key="item"
          class="rounded-md border border-line bg-surface-muted p-4 text-sm font-medium text-muted"
        >
          {{ item }}
        </article>
      </div>

      <div class="mt-6 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
        Pantalla reservada. El flujo operativo se implementara aqui sin mover la facturacion ni duplicar logica fiscal.
      </div>
    </div>
  </section>
</template>
