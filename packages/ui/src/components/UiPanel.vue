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
      'bg-surface-muted text-text': variant === 'muted',
      'border-line bg-surface text-text': variant === 'default',
      'border-line bg-surface-raised text-text shadow-surface': variant === 'raised'
    }"
  >
    <slot />
  </div>
</template>
