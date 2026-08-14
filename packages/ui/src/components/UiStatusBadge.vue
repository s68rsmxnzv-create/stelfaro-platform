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
      'bg-surface-muted text-muted': tone === 'neutral',
      'bg-success-soft text-success': tone === 'success',
      'bg-warning-soft text-warning': tone === 'warning',
      'bg-danger-soft text-danger': tone === 'danger',
      'bg-primary-soft text-primary': tone === 'info'
    }"
  >
    <slot />
  </span>
</template>
