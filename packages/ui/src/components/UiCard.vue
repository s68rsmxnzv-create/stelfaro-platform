<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'bare';
}>(), {
  variant: 'default'
});
</script>

<template>
  <section
    :class="variant === 'bare'
      ? 'bg-transparent'
      : 'rounded-lg border border-blue-100/80 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:text-text dark:shadow-surface'"
  >
    <slot />
  </section>
</template>
