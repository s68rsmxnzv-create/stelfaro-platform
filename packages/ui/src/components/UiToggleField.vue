<script setup lang="ts">
import UiToggle from './UiToggle.vue';

withDefaults(defineProps<{
  modelValue?: boolean;
  title: string;
  description?: string;
  disabled?: boolean;
  variant?: 'default' | 'success';
}>(), {
  modelValue: false,
  description: '',
  disabled: false,
  variant: 'default'
});

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div
    class="flex min-h-20 items-start justify-between gap-4 rounded-xl border border-line bg-surface-muted p-4 text-text shadow-surface transition"
    :class="disabled ? 'opacity-70' : 'hover:border-primary'"
  >
    <button
      type="button"
      class="min-w-0 flex-1 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft disabled:cursor-not-allowed"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span class="block text-sm font-bold">{{ title }}</span>
      <span v-if="description" class="mt-1 block text-xs text-soft">{{ description }}</span>
    </button>
    <UiToggle
      :model-value="modelValue"
      :disabled="disabled"
      :variant="variant"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>
