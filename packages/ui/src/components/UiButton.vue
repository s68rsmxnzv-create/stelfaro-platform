<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}>(), {
  type: 'button',
  variant: 'primary',
  disabled: false
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-sky-600 text-white hover:bg-sky-700': variant === 'primary',
      'bg-slate-100 text-slate-900 hover:bg-slate-200': variant === 'secondary',
      'text-slate-700 hover:bg-slate-100': variant === 'ghost'
    }"
  >
    <slot />
  </button>
</template>
