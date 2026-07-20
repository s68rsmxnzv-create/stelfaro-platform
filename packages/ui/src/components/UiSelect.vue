<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from 'vue';

defineOptions({ inheritAttrs: false });

type SelectValue = string | number;
type SelectOption = {
  value: SelectValue;
  label: string;
  hint?: string;
  disabled?: boolean;
};

const props = withDefaults(defineProps<{
  label?: string;
  modelValue: SelectValue | null | undefined;
  options: SelectOption[];
  placeholder?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  modelModifiers?: { number?: boolean };
}>(), {
  placeholder: '',
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: any];
  change: [value: any];
}>();

const attrs = useAttrs();
const controlId = useId();
const labelId = `${controlId}-label`;
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const activeIndex = ref(-1);
const selected = computed(() => props.options.find((option) => String(option.value) === String(props.modelValue ?? '')) ?? null);
const displayLabel = computed(() => selected.value?.label || props.placeholder || 'Seleccionar');
const isDisabled = computed(() => props.disabled || attrs.disabled === true || attrs.disabled === '');
const rootClass = computed(() => attrs.class);
const rootStyle = computed(() => attrs.style);
const triggerAttrs = computed(() => Object.fromEntries(
  Object.entries(attrs).filter(([key]) => !['class', 'style', 'disabled'].includes(key))
));

watch(() => props.options, () => {
  if (open.value) setActiveFromSelection();
});

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutside, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside, true);
});

function toggle(): void {
  if (isDisabled.value) return;
  open.value = !open.value;
  if (open.value) setActiveFromSelection();
}

function setActiveFromSelection(): void {
  const selectedIndex = props.options.findIndex((option) => String(option.value) === String(props.modelValue ?? ''));
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : props.options.findIndex((option) => !option.disabled);
}

function move(direction: 1 | -1): void {
  if (!open.value) {
    open.value = true;
    setActiveFromSelection();
    return;
  }

  if (!props.options.length) return;
  let index = activeIndex.value;
  for (let attempts = 0; attempts < props.options.length; attempts += 1) {
    index = (index + direction + props.options.length) % props.options.length;
    if (!props.options[index]?.disabled) {
      activeIndex.value = index;
      nextTick(() => root.value?.querySelector<HTMLElement>(`[data-option-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }));
      return;
    }
  }
}

function choose(option: SelectOption): void {
  if (option.disabled) return;
  const value = props.modelModifiers?.number ? Number(option.value) : option.value;
  emit('update:modelValue', value);
  emit('change', value);
  open.value = false;
  nextTick(() => trigger.value?.focus());
}

function chooseActive(): void {
  const option = props.options[activeIndex.value];
  if (option) choose(option);
}

function moveToBoundary(position: 'first' | 'last'): void {
  const indexes = props.options.map((_, index) => index).filter((index) => !props.options[index]?.disabled);
  activeIndex.value = position === 'first' ? (indexes[0] ?? -1) : (indexes[indexes.length - 1] ?? -1);
}

function closeOnOutside(event: PointerEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}
</script>

<template>
  <div ref="root" class="relative block" :class="rootClass" :style="rootStyle">
    <span v-if="label" :id="labelId" class="block text-sm font-medium text-slate-700 dark:text-muted" :class="{ 'sr-only': hideLabel }">
      {{ label }}
    </span>
    <button
      ref="trigger"
      v-bind="triggerAttrs"
      type="button"
      class="mt-1 flex h-12 w-full items-center gap-3 rounded-xl border border-blue-100 bg-white/90 px-3 text-left text-sm text-slate-950 shadow-sm shadow-blue-950/5 outline-none transition hover:border-sky-300 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-line dark:bg-surface-raised dark:text-text dark:shadow-none dark:hover:border-line-strong dark:focus:bg-surface-raised dark:focus:ring-primary-soft dark:disabled:bg-surface-muted"
      :disabled="isDisabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-labelledby="label ? labelId : undefined"
      :aria-label="label ? undefined : displayLabel"
      @click="toggle"
      @keydown.arrow-down.prevent="move(1)"
      @keydown.arrow-up.prevent="move(-1)"
      @keydown.enter.prevent="open ? chooseActive() : toggle()"
      @keydown.space.prevent="open ? chooseActive() : toggle()"
      @keydown.escape.prevent="open = false"
      @keydown.tab="open = false"
      @keydown.home.prevent="moveToBoundary('first')"
      @keydown.end.prevent="moveToBoundary('last')"
    >
      <span class="min-w-0 flex-1 truncate" :class="selected ? 'text-slate-950 dark:text-text' : 'text-slate-400 dark:text-soft'">
        {{ displayLabel }}
      </span>
      <ChevronDown class="h-4 w-4 shrink-0 text-slate-400 transition dark:text-soft" :class="open ? 'rotate-180' : ''" />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="absolute z-[100] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-blue-100 bg-white p-1.5 text-sm shadow-xl shadow-blue-950/15 dark:border-line dark:bg-surface-raised dark:shadow-black/35"
        role="listbox"
      >
        <button
          v-for="(option, index) in options"
          :key="String(option.value)"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition"
          :class="[
            String(option.value) === String(modelValue ?? '') ? 'bg-primary-soft text-primary' : 'text-slate-700 hover:bg-sky-50 dark:text-muted dark:hover:bg-surface-muted',
            option.disabled ? 'cursor-not-allowed opacity-45' : '',
            activeIndex === index && !option.disabled ? 'ring-1 ring-inset ring-primary/40' : ''
          ]"
          :disabled="option.disabled"
          :data-option-index="index"
          role="option"
          :aria-selected="String(option.value) === String(modelValue ?? '')"
          @mouseenter="activeIndex = index"
          @click="choose(option)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ option.label }}</span>
            <span v-if="option.hint" class="mt-0.5 block truncate text-xs text-slate-500 dark:text-soft">{{ option.hint }}</span>
          </span>
          <Check v-if="String(option.value) === String(modelValue ?? '')" class="h-4 w-4 shrink-0" />
        </button>
        <p v-if="options.length === 0" class="px-3 py-3 text-center text-sm text-slate-500 dark:text-muted">Sin opciones disponibles</p>
      </div>
    </Transition>
  </div>
</template>
