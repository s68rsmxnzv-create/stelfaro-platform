<script setup lang="ts">
import { computed } from 'vue';

defineOptions({
  inheritAttrs: false
});

const props = withDefaults(defineProps<{
  label: string;
  modelValue: string | null | undefined;
  placeholder?: string;
  variant?: 'default' | 'dark';
}>(), {
  variant: 'default'
});

defineEmits<{
  'update:modelValue': [value: string];
}>();

const labelClass = computed(() => props.variant === 'dark' ? 'text-slate-100' : 'text-slate-700 dark:text-muted');
const iconClass = computed(() => props.variant === 'dark' ? 'text-slate-500' : 'text-slate-400 dark:text-soft');
const inputClass = computed(() => props.variant === 'dark'
  ? 'bg-white/5 pl-10 pr-3 text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-slate-500 focus:outline-2 focus:-outline-offset-2 focus:outline-sky-500 disabled:bg-white/5 disabled:text-slate-500'
  : 'border border-blue-100 bg-white/90 pl-10 pr-3 text-slate-950 shadow-sm shadow-blue-950/5 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:focus:bg-surface-raised');
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium" :class="labelClass">{{ label }}</span>

    <span class="relative mt-1 flex items-center">
      <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" :class="iconClass">
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      </span>

      <input
        v-bind="$attrs"
        type="email"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        class="w-full rounded-md py-2 text-sm outline-none transition"
        :class="inputClass"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
    </span>
  </label>
</template>
