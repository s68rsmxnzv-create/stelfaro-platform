<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: boolean;
  label: string;
  disabled?: boolean;
  hideLabel?: boolean;
}>(), {
  modelValue: false,
  disabled: false,
  hideLabel: false
});

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <label
    class="inline-flex min-h-5 items-center gap-2 text-sm font-semibold text-muted"
    :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
  >
    <span class="relative grid h-5 w-5 shrink-0 place-items-center">
      <input
        class="peer h-5 w-5 appearance-none rounded border border-line bg-surface-raised transition checked:border-primary checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary-soft disabled:cursor-not-allowed"
        type="checkbox"
        :checked="Boolean(modelValue)"
        :disabled="disabled"
        @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <svg class="pointer-events-none absolute h-3.5 w-3.5 text-primary-contrast opacity-0 transition peer-checked:opacity-100" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.32a1 1 0 0 1-1.42.002L3.29 9.236a1 1 0 1 1 1.42-1.408l4.04 4.072 6.54-6.604a1 1 0 0 1 1.414-.006Z" clip-rule="evenodd" />
      </svg>
    </span>
    <span :class="hideLabel ? 'sr-only' : ''">{{ label }}</span>
  </label>
</template>
