<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { detectFiscalDocument, formatFiscalDocument, looksLikeForeignId, type FiscalDocumentDetection } from '../support/fiscalDocument';

export type { FiscalDocumentDetection };

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined;
  label?: string;
  allowedTypes?: 'dui_or_nit' | 'nit';
  allowForeignId?: boolean;
  showMessage?: boolean;
  initialTypeCode?: string | null;
}>(), {
  label: 'DUI/NIT',
  allowedTypes: 'dui_or_nit',
  allowForeignId: false,
  showMessage: true,
  initialTypeCode: null
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  detected: [value: FiscalDocumentDetection];
}>();

const foreignIdKind = ref<'passport' | 'residentCard'>('passport');
const forceForeign = ref(false);

watch(() => props.initialTypeCode, (value) => {
  if (value === '02') {
    foreignIdKind.value = 'residentCard';
    forceForeign.value = true;
  } else if (value === '03') {
    foreignIdKind.value = 'passport';
    forceForeign.value = true;
  } else {
    foreignIdKind.value = 'passport';
    forceForeign.value = false;
  }
}, { immediate: true });

const detected = computed(() => detectFiscalDocument(props.modelValue ?? '', props.allowedTypes, props.allowForeignId, foreignIdKind.value, forceForeign.value));
const isForeignActive = computed(() => props.allowForeignId && props.allowedTypes !== 'nit' && (forceForeign.value || looksLikeForeignId(props.modelValue ?? '')));
const showForeignIdToggle = computed(() => props.allowForeignId && props.allowedTypes !== 'nit' && (props.modelValue ?? '').trim() !== '');
const toggleLabel = computed(() => {
  if (!isForeignActive.value) return '¿Es pasaporte o carné de residente?';
  if (foreignIdKind.value === 'passport') return '¿Es carné de residencia?';
  return looksLikeForeignId(props.modelValue ?? '') ? '¿Es pasaporte?' : 'Usar detección automática (DUI/NIT)';
});
const placeholder = computed(() => {
  if (props.allowedTypes === 'nit') return 'NIT de 14 dígitos';
  return props.allowForeignId ? 'DUI, NIT o pasaporte' : 'DUI de 9 o NIT de 14 dígitos';
});
const inputMode = computed(() => (props.allowForeignId && isForeignActive.value) ? 'text' : 'numeric');
const maxLength = computed(() => (props.allowForeignId ? 20 : 17));

watch(detected, (value) => {
  emit('detected', value);
}, { immediate: true });

function formatInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const formatted = formatFiscalDocument(input.value, props.allowedTypes, props.allowForeignId, forceForeign.value);
  input.value = formatted;
  emit('update:modelValue', formatted);
}

function cycleForeignId(): void {
  const hasLetters = looksLikeForeignId(props.modelValue ?? '');

  if (!isForeignActive.value) {
    forceForeign.value = true;
    foreignIdKind.value = 'passport';
    return;
  }

  if (foreignIdKind.value === 'passport') {
    foreignIdKind.value = 'residentCard';
    return;
  }

  foreignIdKind.value = 'passport';
  if (!hasLetters) {
    forceForeign.value = false;
  }
}
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium text-muted">{{ label }}</span>
    <span class="relative mt-1 block">
      <input
        :value="modelValue ?? ''"
        class="h-12 w-full rounded-xl border border-line bg-surface-raised/90 py-0 pl-3 pr-24 text-sm text-text shadow-sm shadow-surface outline-none transition placeholder:text-soft focus:border-primary focus:bg-surface-raised focus:ring-2 focus:ring-primary/20 dark:shadow-none"
        :placeholder="placeholder"
        :inputmode="inputMode"
        :maxlength="maxLength"
        @input="formatInput"
      >
      <span v-if="detected.valid" class="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center gap-1 text-xs font-semibold text-success">
        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-soft text-[10px]">✓</span>
        {{ detected.typeLabel }}
      </span>
    </span>
    <span v-if="showForeignIdToggle" class="mt-1 block">
      <button
        type="button"
        class="text-xs font-semibold text-sky-700 transition hover:text-sky-600 dark:text-primary"
        :aria-pressed="isForeignActive"
        :aria-label="toggleLabel"
        @click="cycleForeignId"
      >
        {{ toggleLabel }}
      </button>
    </span>
    <span v-if="showMessage && !detected.valid && detected.message" class="mt-1 block text-xs text-soft">{{ detected.message }}</span>
  </label>
</template>
