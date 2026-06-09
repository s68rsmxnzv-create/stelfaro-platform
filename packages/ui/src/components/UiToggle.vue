<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'warning';
  offVariant?: 'default' | 'success' | 'warning' | 'neutral';
  ariaLabel?: string;
}>(), {
  disabled: false,
  variant: 'default',
  offVariant: 'neutral',
  ariaLabel: 'Cambiar estado'
});

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <label class="inline-flex items-center">
    <span
      class="relative block h-8 w-14 rounded-full bg-slate-300 transition-colors [-webkit-tap-highlight-color:transparent]"
      :class="[
        Boolean(modelValue) && variant === 'success' ? 'bg-emerald-500' : '',
        Boolean(modelValue) && variant === 'warning' ? 'bg-amber-500' : '',
        Boolean(modelValue) && variant === 'default' ? 'bg-sky-500' : '',
        !Boolean(modelValue) && offVariant === 'success' ? 'bg-emerald-500' : '',
        !Boolean(modelValue) && offVariant === 'warning' ? 'bg-amber-500' : '',
        !Boolean(modelValue) && offVariant === 'default' ? 'bg-sky-500' : '',
        !Boolean(modelValue) && offVariant === 'neutral' ? 'bg-slate-300' : '',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      ]"
    >
      <input
        class="peer sr-only"
        type="checkbox"
        :checked="Boolean(modelValue)"
        :disabled="disabled"
        :aria-label="ariaLabel"
        @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span class="absolute inset-y-0 start-0 m-1 size-6 rounded-full bg-white shadow-sm transition-[inset-inline-start] peer-checked:start-6"></span>
    </span>
  </label>
</template>
