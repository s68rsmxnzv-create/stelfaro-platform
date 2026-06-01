<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: string;
  rows?: number;
  readonly?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium text-slate-700">{{ label }}</span>
    <textarea
      :rows="rows ?? 5"
      :value="modelValue"
      :readonly="readonly"
      class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </label>
</template>
