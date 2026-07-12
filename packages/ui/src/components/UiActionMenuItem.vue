<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  separated?: boolean;
}>(), {
  tone: 'neutral',
  disabled: false,
  separated: false
});

defineEmits<{
  select: [];
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text': tone === 'neutral',
      'text-rose-700 hover:bg-rose-50 dark:text-danger dark:hover:bg-danger-soft': tone === 'danger',
      'mt-1 border-t border-slate-100 pt-3 dark:border-line': separated
    }"
    @click="$emit('select')"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
