<script setup lang="ts">
import { computed, ref } from 'vue';

defineOptions({
  inheritAttrs: false
});

const props = defineProps<{
  label?: string;
  modelValue: string | number | null | undefined;
  type?: string;
  placeholder?: string;
  revealable?: boolean;
  hideLabel?: boolean;
  modelModifiers?: {
    number?: boolean;
  };
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const visible = ref(false);
const inputType = computed(() => props.type === 'password' && props.revealable && visible.value ? 'text' : props.type ?? 'text');
const canReveal = computed(() => props.type === 'password' && props.revealable);

function updateValue(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', props.modelModifiers?.number ? Number(value) : value);
}
</script>

<template>
  <label class="block">
    <span
      v-if="label"
      class="text-sm font-medium text-slate-700 dark:text-muted"
      :class="{ 'sr-only': hideLabel }"
    >
      {{ label }}
    </span>
    <span class="relative mt-1 block">
      <input
        v-bind="$attrs"
        :type="inputType"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        class="w-full rounded-md border border-blue-100 bg-white/90 py-2 pl-3 text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:focus:bg-surface-raised"
        :class="canReveal ? 'pr-20' : 'pr-3'"
        @input="updateValue"
      >
      <button
        v-if="canReveal"
        type="button"
        class="absolute inset-y-1 right-1 rounded px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
        @click="visible = !visible"
      >
        {{ visible ? 'Ocultar' : 'Ver' }}
      </button>
    </span>
  </label>
</template>
