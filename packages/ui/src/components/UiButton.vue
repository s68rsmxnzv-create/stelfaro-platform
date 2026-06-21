<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  size?: 'sm' | 'md';
  disabled?: boolean;
}>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-lg text-sm font-semibold tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'px-3 py-1.5': size === 'sm',
      'px-6 py-2': size === 'md',
      'bg-sky-600 text-white hover:bg-sky-500 focus:outline-none focus:ring focus:ring-sky-300 focus:ring-opacity-80': variant === 'primary',
      'bg-emerald-600 text-white hover:bg-emerald-500 focus:outline-none focus:ring focus:ring-emerald-300 focus:ring-opacity-80': variant === 'success',
      'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring focus:ring-slate-300 focus:ring-opacity-80 dark:bg-surface-muted dark:text-text dark:hover:bg-surface-strong dark:focus:ring-line': variant === 'secondary',
      'text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring focus:ring-slate-300 focus:ring-opacity-70 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text dark:focus:ring-line': variant === 'ghost'
    }"
  >
    <slot />
  </button>
</template>
