<script setup lang="ts">
withDefaults(defineProps<{
  minWidth?: string;
}>(), {
  minWidth: 'min-w-full'
});
</script>

<template>
  <div class="overflow-hidden rounded-md border border-slate-200 dark:border-line">
    <table class="w-full text-left text-sm text-slate-900 dark:text-text" :class="minWidth">
      <slot />
    </table>
  </div>
</template>
