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
    class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-soft transition hover:bg-surface-muted hover:text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
  >
    <UiCloseCircleIcon class="h-6 w-6" />
  </button>
</template>
