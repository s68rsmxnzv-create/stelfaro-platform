<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}>(), {
  hint: '',
  tone: 'neutral',
  size: 'md'
});
</script>

<template>
  <section class="rounded-md border border-line bg-surface-muted px-4 py-3 text-text">
    <p class="text-xs font-semibold uppercase tracking-wide text-soft">{{ label }}</p>
    <p
      class="mt-2 font-bold"
      :class="[
        size === 'md' ? 'text-2xl' : 'text-base',
        {
          'text-text': tone === 'neutral',
          'text-primary': tone === 'primary',
          'text-success': tone === 'success',
          'text-warning': tone === 'warning',
          'text-danger': tone === 'danger'
        }
      ]"
    >
      {{ value }}
    </p>
    <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </section>
</template>
