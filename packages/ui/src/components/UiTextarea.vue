<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

defineProps<{
  label: string;
  modelValue: string;
  rows?: number;
  readonly?: boolean;
  placeholder?: string;
  hideLabel?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label class="block">
    <span
      class="text-sm font-medium text-slate-700 dark:text-muted"
      :class="{ 'sr-only': hideLabel }"
    >
      {{ label }}
    </span>
    <textarea
      v-bind="$attrs"
      :rows="rows ?? 5"
      :value="modelValue"
      :readonly="readonly"
      :placeholder="placeholder"
      class="mt-1 w-full rounded-md border border-blue-100 bg-white/90 px-3 py-2 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:focus:bg-surface-raised"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </label>
</template>
