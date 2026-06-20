<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
}>(), {
  type: 'button',
  disabled: false,
  loading: false,
  label: 'Actualizar',
  loadingLabel: 'Actualizando'
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold tracking-wide text-white transition-colors duration-200 hover:bg-sky-500 focus:outline-none focus:ring focus:ring-sky-300 focus:ring-opacity-80 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-soft dark:text-white dark:hover:bg-primary"
  >
    <svg
      class="mr-2 h-5 w-5"
      :class="loading ? 'animate-spin' : ''"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path fill-rule="evenodd" d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276Z" clip-rule="evenodd" />
    </svg>
    <span>{{ loading ? loadingLabel : label }}</span>
  </button>
</template>
