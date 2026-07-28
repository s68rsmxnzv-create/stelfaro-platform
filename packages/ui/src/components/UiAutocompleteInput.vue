<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { useId } from 'vue';

const controlId = useId();

defineProps<{
  label?: string;
  modelValue: string;
  placeholder?: string;
  options: any[];
  optionKey?: string;
  open?: boolean;
  loading?: boolean;
  emptyText?: string;
  inlineEmpty?: boolean;
  hideLabel?: boolean;
  showSuffix?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  focus: [];
  blur: [];
  select: [option: any];
}>();
</script>

<template>
  <div class="relative block">
    <label v-if="label" :for="controlId" class="block text-sm font-medium text-slate-700 dark:text-muted" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <span class="relative mt-1 block">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-soft" />
      <input
        :id="controlId"
        :value="modelValue"
        :placeholder="placeholder"
        class="h-12 w-full rounded-xl border border-blue-100 bg-white/90 py-0 pl-10 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 hover:border-sky-300 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:hover:border-line-strong dark:focus:bg-surface-raised dark:focus:ring-primary-soft"
        :class="showSuffix ? 'pr-52' : 'pr-3'"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <slot name="suffix" />
      </span>
    </span>

    <p
      v-if="open && inlineEmpty && !loading && options.length === 0"
      class="mt-1.5 px-1 text-xs text-slate-500 dark:text-muted"
    >
      {{ emptyText || 'Sin resultados.' }}
    </p>

    <div
      v-if="open && (!inlineEmpty || loading || options.length > 0)"
      class="absolute z-[100] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-blue-100 bg-white p-1.5 text-sm shadow-xl shadow-blue-950/15 dark:border-line dark:bg-surface-raised dark:shadow-black/35"
    >
      <div v-if="loading" class="px-3 py-3 text-xs font-medium text-slate-500 dark:text-muted">Buscando…</div>
      <button
        v-for="(option, index) in options"
        :key="String(option[optionKey || 'id'] ?? index)"
        type="button"
        class="block w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-sky-50 focus:bg-sky-50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary/40 dark:hover:bg-surface-muted dark:focus:bg-surface-muted"
        @mousedown.prevent="$emit('select', option)"
      >
        <slot name="option" :option="option" />
      </button>
      <p v-if="!loading && options.length === 0" class="px-3 py-3 text-slate-500 dark:text-muted">
        {{ emptyText || 'Sin resultados.' }}
      </p>
    </div>
  </div>
</template>
