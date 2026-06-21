<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}>(), {
  tone: 'neutral'
});
</script>

<template>
  <span
    class="inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
    :class="{
      'bg-slate-100 text-slate-600 dark:bg-surface-muted dark:text-muted': tone === 'neutral',
      'bg-emerald-50 text-emerald-700 dark:bg-success-soft dark:text-success': tone === 'success',
      'bg-amber-50 text-amber-700 dark:bg-warning-soft dark:text-warning': tone === 'warning',
      'bg-rose-50 text-rose-700 dark:bg-danger-soft dark:text-danger': tone === 'danger',
      'bg-sky-50 text-sky-700 dark:bg-primary-soft dark:text-primary': tone === 'info'
    }"
  >
    <slot />
  </span>
</template>
