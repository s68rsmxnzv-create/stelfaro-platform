<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'muted' | 'raised';
}>(), {
  variant: 'muted'
});
</script>

<template>
  <div
    class="rounded-md border border-transparent p-4"
    :class="{
      'bg-slate-50 dark:border-line dark:bg-surface-muted dark:text-text': variant === 'muted',
      'border-slate-200 bg-white dark:border-line dark:bg-surface dark:text-text': variant === 'default',
      'border-slate-200 bg-white shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface-raised dark:text-text dark:shadow-none': variant === 'raised'
    }"
  >
    <slot />
  </div>
</template>
