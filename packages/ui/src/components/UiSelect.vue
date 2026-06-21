<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

withDefaults(defineProps<{
  label: string;
  modelValue: string | number | null | undefined;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
}>(), {
  placeholder: ''
});

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium text-slate-700 dark:text-muted">{{ label }}</span>
    <select
      v-bind="$attrs"
      :value="modelValue ?? ''"
      class="mt-1 h-10 w-full rounded-md border border-blue-100 bg-white/90 px-3 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500 dark:border-line dark:bg-surface-raised dark:text-text dark:shadow-none dark:focus:bg-surface-raised dark:focus:ring-primary-soft"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="option in options" :key="String(option.value)" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
