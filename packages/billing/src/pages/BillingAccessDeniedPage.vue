<script setup lang="ts">
withDefaults(defineProps<{ homeHref?: string }>(), { homeHref: '/facturacion/fe' });
</script>

<template>
  <section class="mx-auto grid min-h-[55vh] max-w-xl place-items-center px-4 py-12 text-center">
    <div class="rounded-3xl border border-line bg-surface p-8 shadow-sm">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">Acceso restringido</p>
      <h1 class="mt-3 text-2xl font-bold text-text">No tienes acceso a esta sección</h1>
      <p class="mt-3 text-sm leading-6 text-muted">Tu cuenta de cajero está preparada para emitir facturas y comprobantes de crédito fiscal desde tu caja asignada.</p>
      <a :href="homeHref" class="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-contrast">Ir a facturar</a>
    </div>
  </section>
</template>
