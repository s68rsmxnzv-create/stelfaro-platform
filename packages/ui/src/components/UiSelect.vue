<script setup lang="ts">
import { Check, ChevronDown, Search } from 'lucide-vue-next';
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
  searchable?: boolean;
  searchPlaceholder?: string;
  modelModifiers?: { number?: boolean };
}>(), {
  placeholder: '',
  disabled: false,
  searchable: false,
  searchPlaceholder: 'Buscar'
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
const menu = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
const activeIndex = ref(-1);
const menuPosition = ref({ left: 0, top: 0, bottom: 0, width: 0, maxHeight: 288, above: false });
const selected = computed(() => props.options.find((option) => String(option.value) === String(props.modelValue ?? '')) ?? null);
const filteredOptions = computed(() => {
  const needle = normalize(query.value);
  if (!props.searchable || needle === '') return props.options;

  return props.options.filter((option) => normalize(`${option.label} ${option.hint ?? ''}`).includes(needle));
});
const displayLabel = computed(() => selected.value?.label || props.placeholder || 'Seleccionar');
const isDisabled = computed(() => props.disabled || attrs.disabled === true || attrs.disabled === '');
const rootClass = computed(() => attrs.class);
const rootStyle = computed(() => attrs.style);
const triggerAttrs = computed(() => Object.fromEntries(
  Object.entries(attrs).filter(([key]) => !['class', 'style', 'disabled'].includes(key))
));
const menuStyle = computed(() => ({
  left: `${menuPosition.value.left}px`,
  top: menuPosition.value.above ? 'auto' : `${menuPosition.value.top}px`,
  bottom: menuPosition.value.above ? `${menuPosition.value.bottom}px` : 'auto',
  width: `${menuPosition.value.width}px`,
  maxHeight: `${menuPosition.value.maxHeight}px`
}));

watch(() => props.options, () => {
  if (open.value) setActiveFromSelection();
});
watch(query, () => {
  if (open.value && props.searchable) setActiveFromSelection();
});

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutside, true);
  window.addEventListener('resize', updateMenuPosition);
  window.addEventListener('scroll', updateMenuPosition, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutside, true);
  window.removeEventListener('resize', updateMenuPosition);
  window.removeEventListener('scroll', updateMenuPosition, true);
});

function toggle(): void {
  if (isDisabled.value) return;
  if (open.value) return closeMenu();

  openMenu();
}

function openMenu(): void {
  open.value = true;
  query.value = '';
  setActiveFromSelection();
  nextTick(() => {
    updateMenuPosition();
    if (props.searchable) searchInput.value?.focus();
  });
}

function closeMenu(restoreFocus = false): void {
  open.value = false;
  query.value = '';
  if (restoreFocus) nextTick(() => trigger.value?.focus());
}

function updateMenuPosition(): void {
  if (!open.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const gap = 8;
  const availableBelow = window.innerHeight - rect.bottom - gap;
  const availableAbove = rect.top - gap;
  const above = availableBelow < 180 && availableAbove > availableBelow;
  const available = above ? availableAbove : availableBelow;

  menuPosition.value = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
    top: rect.bottom + gap,
    bottom: window.innerHeight - rect.top + gap,
    width: Math.min(rect.width, window.innerWidth - 16),
    maxHeight: Math.max(120, Math.min(288, available)),
    above
  };
}

function setActiveFromSelection(): void {
  const selectedIndex = filteredOptions.value.findIndex((option) => String(option.value) === String(props.modelValue ?? ''));
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : filteredOptions.value.findIndex((option) => !option.disabled);
}

function move(direction: 1 | -1): void {
  if (!open.value) {
    openMenu();
    return;
  }

  if (!filteredOptions.value.length) return;
  let index = activeIndex.value;
  for (let attempts = 0; attempts < filteredOptions.value.length; attempts += 1) {
    index = (index + direction + filteredOptions.value.length) % filteredOptions.value.length;
    if (!filteredOptions.value[index]?.disabled) {
      activeIndex.value = index;
      nextTick(() => menu.value?.querySelector<HTMLElement>(`[data-option-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }));
      return;
    }
  }
}

function choose(option: SelectOption): void {
  if (option.disabled) return;
  const value = props.modelModifiers?.number ? Number(option.value) : option.value;
  emit('update:modelValue', value);
  emit('change', value);
  closeMenu(true);
}

function chooseActive(): void {
  const option = filteredOptions.value[activeIndex.value];
  if (option) choose(option);
}

function moveToBoundary(position: 'first' | 'last'): void {
  const indexes = filteredOptions.value.map((_, index) => index).filter((index) => !filteredOptions.value[index]?.disabled);
  activeIndex.value = position === 'first' ? (indexes[0] ?? -1) : (indexes[indexes.length - 1] ?? -1);
}

function closeOnOutside(event: PointerEvent): void {
  const target = event.target as Node;
  if (open.value && !root.value?.contains(target) && !menu.value?.contains(target)) closeMenu();
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
</script>

<template>
  <div ref="root" class="relative block" :class="rootClass" :style="rootStyle">
    <span v-if="label" :id="labelId" class="block text-sm font-medium text-muted" :class="{ 'sr-only': hideLabel }">
      {{ label }}
    </span>
    <button
      ref="trigger"
      v-bind="triggerAttrs"
      type="button"
      class="mt-1 flex h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface-raised px-3 text-left text-sm text-text shadow-surface outline-none transition hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
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
      @keydown.escape.prevent="closeMenu()"
      @keydown.tab="closeMenu()"
      @keydown.home.prevent="moveToBoundary('first')"
      @keydown.end.prevent="moveToBoundary('last')"
    >
      <span class="min-w-0 flex-1 truncate" :class="selected ? 'text-text' : 'text-soft'">
        {{ displayLabel }}
      </span>
      <ChevronDown class="h-4 w-4 shrink-0 text-soft transition" :class="open ? 'rotate-180' : ''" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-[0.98] opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-[0.98] opacity-0"
      >
        <div
          v-if="open"
          ref="menu"
          class="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-line bg-surface-raised p-1.5 text-sm text-text shadow-surface"
          :class="menuPosition.above ? 'origin-bottom' : 'origin-top'"
          :style="menuStyle"
        >
          <label v-if="searchable" class="relative mb-1.5 block shrink-0 border-b border-line pb-1.5">
            <span class="sr-only">{{ searchPlaceholder }}</span>
            <Search class="pointer-events-none absolute left-3 top-5 h-4 w-4 -translate-y-1/2 text-soft" aria-hidden="true" />
            <input
              ref="searchInput"
              v-model="query"
              type="search"
              class="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-text outline-none placeholder:text-soft focus:border-primary focus:ring-2 focus:ring-primary-soft"
              :placeholder="searchPlaceholder"
              autocomplete="off"
              @keydown.arrow-down.prevent="move(1)"
              @keydown.arrow-up.prevent="move(-1)"
              @keydown.enter.prevent="chooseActive"
              @keydown.escape.prevent="closeMenu(true)"
              @keydown.home.prevent="moveToBoundary('first')"
              @keydown.end.prevent="moveToBoundary('last')"
            >
          </label>
          <div class="min-h-0 overflow-y-auto" role="listbox" :aria-labelledby="label ? labelId : undefined">
            <button
              v-for="(option, index) in filteredOptions"
              :key="String(option.value)"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition"
              :class="[
                String(option.value) === String(modelValue ?? '') ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-muted',
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
                <span v-if="option.hint" class="mt-0.5 block truncate text-xs text-soft">{{ option.hint }}</span>
              </span>
              <Check v-if="String(option.value) === String(modelValue ?? '')" class="h-4 w-4 shrink-0" />
            </button>
            <p v-if="filteredOptions.length === 0" class="px-3 py-3 text-center text-sm text-muted">
              {{ query ? 'Sin resultados para esta búsqueda' : 'Sin opciones disponibles' }}
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
