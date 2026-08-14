<script setup lang="ts">
import { ref } from 'vue';

const input = ref<HTMLInputElement | null>(null);

withDefaults(defineProps<{
  label: string;
  modelValue: string | number | null | undefined;
  placeholder?: string;
  buttonLabel?: string;
  showButton?: boolean;
  autofocus?: boolean;
}>(), {
  placeholder: 'Buscar',
  buttonLabel: 'Buscar',
  showButton: false,
  autofocus: false
});

defineEmits<{
  'update:modelValue': [value: string];
  search: [];
}>();

defineExpose({
  focus: () => input.value?.focus({ preventScroll: true })
});
</script>

<template>
  <label class="block">
    <span class="block text-sm font-medium text-muted">{{ label }}</span>
    <span class="relative mt-1 block">
      <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-soft">
        <svg class="h-4 w-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
      </span>
      <input
        ref="input"
        type="search"
        :autofocus="autofocus"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        class="block h-12 w-full rounded-full border border-line bg-surface-raised py-0 pl-9 text-base text-text shadow-surface outline-none transition placeholder:text-soft focus:border-primary focus:ring-2 focus:ring-primary-soft md:text-sm"
        :class="showButton ? 'pr-28' : 'pr-12'"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('search')"
      >
      <button
        v-if="showButton"
        type="button"
        class="absolute inset-y-0 right-0 inline-flex min-w-24 items-center justify-center rounded-r-full border border-primary bg-primary px-4 text-sm font-semibold leading-none text-primary-contrast shadow-surface transition hover:border-primary-hover hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-soft"
        @click="$emit('search')"
      >
        {{ buttonLabel }}
      </button>
    </span>
  </label>
</template>
