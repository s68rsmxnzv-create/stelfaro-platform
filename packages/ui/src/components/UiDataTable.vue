<script setup lang="ts">
withDefaults(defineProps<{
  minWidth?: string;
  overflow?: 'hidden' | 'visible' | 'auto';
}>(), {
  minWidth: 'min-w-full',
  overflow: 'hidden'
});
</script>

<template>
  <div
    class="rounded-md border border-slate-200 dark:border-line"
    :class="{
      'overflow-hidden': overflow === 'hidden',
      'overflow-visible': overflow === 'visible',
      'overflow-x-auto': overflow === 'auto'
    }"
  >
    <table class="w-full text-left text-sm text-slate-900 dark:text-text" :class="minWidth">
      <slot />
    </table>
  </div>
</template>
