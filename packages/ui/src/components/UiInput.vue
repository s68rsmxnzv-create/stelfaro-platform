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
  suffix?: string;
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

function clearInitialZero(event: FocusEvent) {
  const input = event.target as HTMLInputElement;
  if (inputType.value === 'number' && input.value !== '' && Number(input.value) === 0) {
    input.value = '';
    emit('update:modelValue', '');
  }
}
</script>

<template>
  <label class="block">
    <span
      v-if="label"
      class="block text-sm font-medium text-slate-700 dark:text-muted"
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
        class="h-12 w-full rounded-xl border border-blue-100 bg-white/90 py-0 pl-3 text-left text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:focus:bg-surface-raised"
        :class="[
          canReveal ? 'pr-20' : suffix ? 'pr-16' : 'pr-3',
          suffix && inputType === 'number' ? 'ui-input-number-with-suffix' : ''
        ]"
        @focus="clearInitialZero"
        @input="updateValue"
      >
      <button
        v-if="canReveal"
        type="button"
        class="absolute inset-y-1.5 right-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
        @click="visible = !visible"
      >
        {{ visible ? 'Ocultar' : 'Ver' }}
      </button>
      <span
        v-if="suffix && !canReveal"
        class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] font-semibold text-slate-500 dark:text-muted"
      >
        {{ suffix }}
      </span>
    </span>
  </label>
</template>

<style scoped>
.ui-input-number-with-suffix {
  appearance: textfield;
  -moz-appearance: textfield;
}

.ui-input-number-with-suffix::-webkit-inner-spin-button,
.ui-input-number-with-suffix::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}
</style>
