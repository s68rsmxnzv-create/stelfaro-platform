<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

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
  clearable?: boolean;
  clearLabel?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const query = ref('');
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

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

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true);
});

function choose(option: SearchSelectOption): void {
  emit('update:modelValue', option.value);
  query.value = option.label;
  open.value = false;
}

function clearSelection(): void {
  emit('update:modelValue', '');
  query.value = '';
  open.value = false;
}

function closeOnOutsidePointerDown(event: PointerEvent): void {
  if (!open.value || !rootRef.value) return;
  if (rootRef.value.contains(event.target as Node)) return;

  open.value = false;
  query.value = selected.value ? selected.value.label : '';
}

function closeOnBlur(): void {
  window.setTimeout(() => {
    if (rootRef.value?.contains(document.activeElement)) return;

    open.value = false;
    query.value = selected.value ? selected.value.label : '';
  }, 120);
}

function closeAndRestore(): void {
  open.value = false;
  query.value = selected.value ? selected.value.label : '';
}

function chooseFirstFiltered(): void {
  if (filtered.value.length > 0) {
    choose(filtered.value[0]);
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
</script>

<template>
  <label ref="rootRef" class="relative block">
    <span class="text-sm font-medium text-muted">{{ label }}</span>
    <input
      v-model="query"
      :disabled="disabled"
      :placeholder="placeholder"
      class="mt-1 h-12 w-full rounded-xl border border-line bg-surface-raised py-0 pl-3 text-sm text-text shadow-surface outline-none transition placeholder:text-soft focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:bg-surface-muted disabled:text-muted"
      :class="clearable && modelValue ? 'pr-10' : 'pr-3'"
      @focus="open = true"
      @input="open = true"
      @keydown.escape.prevent="closeAndRestore"
      @keydown.enter.prevent="chooseFirstFiltered"
      @blur="closeOnBlur"
    >
    <button
      v-if="clearable && modelValue && !disabled"
      type="button"
      class="absolute right-1 top-8 grid h-8 w-8 place-items-center rounded-lg text-soft transition hover:bg-surface-muted hover:text-text"
      :aria-label="clearLabel ?? 'Limpiar seleccion'"
      @click="clearSelection"
    >
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
    <div
      v-if="open && !disabled"
      class="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface-raised py-1 text-sm text-text shadow-surface"
    >
      <button
        v-if="clearable"
        type="button"
        class="block w-full border-b border-line px-3 py-2 text-left font-medium text-muted hover:bg-surface-muted"
        @mousedown.prevent="clearSelection"
      >
        {{ clearLabel ?? 'Sin seleccionar' }}
      </button>
      <button
        v-for="option in filtered"
        :key="option.value + option.label"
        type="button"
        class="block w-full px-3 py-2 text-left hover:bg-surface-muted"
        @mousedown.prevent="choose(option)"
      >
        <span class="font-medium text-text">{{ option.label }}</span>
        <span v-if="option.hint" class="ml-2 text-xs text-soft">{{ option.hint }}</span>
      </button>
      <p v-if="filtered.length === 0" class="px-3 py-2 text-muted">Sin resultados</p>
    </div>
  </label>
</template>
