<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  modelValue: string | number | null | undefined;
  placeholder?: string;
  buttonLabel?: string;
  showButton?: boolean;
}>(), {
  placeholder: 'Buscar',
  buttonLabel: 'Buscar',
  showButton: true
});

defineEmits<{
  'update:modelValue': [value: string];
  search: [];
}>();
</script>

<template>
  <label class="block">
    <span class="mb-2 block text-sm font-medium text-slate-700">{{ label }}</span>
    <span class="relative block">
      <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
        <svg class="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
      </span>
      <input
        type="search"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        class="block w-full rounded-md border border-blue-100 bg-white/90 py-3 pl-9 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
        :class="showButton ? 'pr-24' : 'pr-12'"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('search')"
      >
      <button
        v-if="showButton"
        type="button"
        class="absolute bottom-1.5 right-1.5 rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold leading-5 text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
        @click="$emit('search')"
      >
        {{ buttonLabel }}
      </button>
    </span>
  </label>
</template>
