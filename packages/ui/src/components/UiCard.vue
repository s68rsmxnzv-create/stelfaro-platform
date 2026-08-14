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
      : 'rounded-lg border border-line bg-surface p-5 text-text shadow-surface'"
  >
    <slot />
  </section>
</template>
