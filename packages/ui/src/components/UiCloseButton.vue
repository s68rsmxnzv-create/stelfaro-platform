<script setup lang="ts">
import UiCloseCircleIcon from './UiCloseCircleIcon.vue';

withDefaults(defineProps<{
  label?: string;
  disabled?: boolean;
}>(), {
  label: 'Cerrar',
  disabled: false
});
</script>

<template>
  <button
    type="button"
    class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-soft dark:hover:bg-surface-muted dark:hover:text-text"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
  >
    <UiCloseCircleIcon class="h-6 w-6" />
  </button>
</template>
