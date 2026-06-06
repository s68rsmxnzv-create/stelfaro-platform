<script setup lang="ts">
defineProps<{
  priceIncludesIva: boolean;
  retainIva: boolean;
}>();

const emit = defineEmits<{
  'update:priceIncludesIva': [value: boolean];
  'update:retainIva': [value: boolean];
}>();
</script>

<template>
  <section class="rounded-md border border-slate-200 bg-slate-50 p-3">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Opciones CCF</p>
    <div class="mt-3 grid gap-2 sm:grid-cols-2">
      <label class="flex cursor-pointer items-start gap-3 rounded-md bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 transition hover:ring-sky-200">
        <input
          class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          type="checkbox"
          :checked="priceIncludesIva"
          @change="emit('update:priceIncludesIva', ($event.target as HTMLInputElement).checked)"
        >
        <span>
          <span class="block font-semibold text-slate-950">Precio incluye IVA</span>
          <span class="mt-0.5 block text-xs text-slate-500">El precio digitado ya contiene el 13%.</span>
        </span>
      </label>

      <label class="flex cursor-pointer items-start gap-3 rounded-md bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 transition hover:ring-sky-200">
        <input
          class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          type="checkbox"
          :checked="retainIva"
          @change="emit('update:retainIva', ($event.target as HTMLInputElement).checked)"
        >
        <span>
          <span class="block font-semibold text-slate-950">Retener IVA 1%</span>
          <span class="mt-0.5 block text-xs text-slate-500">Calcula retencion sobre la base gravada.</span>
        </span>
      </label>
    </div>
  </section>
</template>
