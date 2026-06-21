<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}>(), {
  tone: 'neutral',
  disabled: false
});

defineEmits<{
  select: [];
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex w-full items-center px-4 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text': tone === 'neutral',
      'text-rose-700 hover:bg-rose-50 dark:text-danger dark:hover:bg-danger-soft': tone === 'danger'
    }"
    @click="$emit('select')"
  >
    <slot />
  </button>
</template>
