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
  <div class="flex flex-wrap items-center gap-3 text-sm">
    <label class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70 dark:border-line dark:bg-surface-muted dark:text-muted dark:hover:bg-surface-strong">
      <input
        class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-line"
        type="checkbox"
        :checked="priceIncludesIva"
        @change="emit('update:priceIncludesIva', ($event.target as HTMLInputElement).checked)"
      >
      <span class="font-semibold">Precio incluye IVA</span>
    </label>

    <label class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70 dark:border-line dark:bg-surface-muted dark:text-muted dark:hover:bg-surface-strong">
      <input
        class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-line"
        type="checkbox"
        :checked="retainIva"
        @change="emit('update:retainIva', ($event.target as HTMLInputElement).checked)"
      >
      <span class="font-semibold">Retener IVA 1%</span>
    </label>
  </div>
</template>
