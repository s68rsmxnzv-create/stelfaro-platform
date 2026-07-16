<script setup lang="ts">
import { useSlots } from 'vue';

const slots = useSlots();

withDefaults(defineProps<{
  label: string;
  modelValue: string | number | null | undefined;
  placeholder?: string;
  buttonLabel?: string;
  showButton?: boolean;
}>(), {
  placeholder: 'Buscar',
  buttonLabel: 'Buscar',
  showButton: false
});

defineEmits<{
  'update:modelValue': [value: string];
  search: [];
}>();
</script>

<template>
  <label class="block">
    <span class="block text-sm font-medium text-slate-700 dark:text-muted">{{ label }}</span>
    <span class="relative mt-1 block">
      <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-soft">
        <svg class="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
      </span>
      <input
        type="search"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        class="block h-12 w-full rounded-md border border-blue-100 bg-white/90 py-0 pl-9 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:focus:bg-surface-raised"
        :class="showButton ? 'pr-28' : slots.trailing ? 'pr-12' : 'pr-4'"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('search')"
      >
      <button
        v-if="showButton"
        type="button"
        class="absolute inset-y-0 right-0 inline-flex min-w-24 items-center justify-center rounded-r-md border border-sky-600 bg-sky-600 px-4 text-sm font-semibold leading-none text-white shadow-sm transition hover:border-sky-500 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
        @click="$emit('search')"
      >
        {{ buttonLabel }}
      </button>
      <span v-else-if="slots.trailing" class="absolute inset-y-0 right-0 flex items-center pr-2">
        <slot name="trailing" />
      </span>
    </span>
  </label>
</template>
