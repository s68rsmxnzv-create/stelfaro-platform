<script setup lang="ts">
import { computed, ref, watch } from 'vue';

export type SearchSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

const props = defineProps<{
  label: string;
  modelValue: string | null | undefined;
  options: SearchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const query = ref('');
const open = ref(false);

const selected = computed(() => props.options.find((option) => option.value === props.modelValue) ?? null);
const filtered = computed(() => {
  const needle = normalize(query.value);
  const options = needle === ''
    ? props.options
    : props.options.filter((option) => normalize(`${option.value} ${option.label} ${option.hint ?? ''}`).includes(needle));

  return options.slice(0, 80);
});

watch(selected, (option) => {
  query.value = option ? option.label : '';
}, { immediate: true });

function choose(option: SearchSelectOption): void {
  emit('update:modelValue', option.value);
  query.value = option.label;
  open.value = false;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
</script>

<template>
  <label class="relative block">
    <span class="text-sm font-medium text-slate-700">{{ label }}</span>
    <input
      v-model="query"
      :disabled="disabled"
      :placeholder="placeholder"
      class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
      @focus="open = true"
      @input="open = true"
      @keydown.escape="open = false"
    >
    <div
      v-if="open && !disabled"
      class="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      <button
        v-for="option in filtered"
        :key="option.value + option.label"
        type="button"
        class="block w-full px-3 py-2 text-left hover:bg-sky-50"
        @mousedown.prevent="choose(option)"
      >
        <span class="font-medium text-slate-900">{{ option.label }}</span>
        <span v-if="option.hint" class="ml-2 text-xs text-slate-500">{{ option.hint }}</span>
      </button>
      <p v-if="filtered.length === 0" class="px-3 py-2 text-slate-500">Sin resultados</p>
    </div>
  </label>
</template>
