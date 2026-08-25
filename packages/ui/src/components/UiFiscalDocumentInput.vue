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

watch(() => props.initialTypeCode, (value) => {
  foreignIdKind.value = value === '02' ? 'residentCard' : 'passport';
}, { immediate: true });

const detected = computed(() => detectFiscalDocument(props.modelValue ?? '', props.allowedTypes, props.allowForeignId, foreignIdKind.value));
const showForeignIdToggle = computed(() => props.allowForeignId && props.allowedTypes !== 'nit' && looksLikeForeignId(props.modelValue ?? ''));
const placeholder = computed(() => {
  if (props.allowedTypes === 'nit') return 'NIT de 14 dígitos';
  return props.allowForeignId ? 'DUI, NIT, pasaporte o carné de residente' : 'DUI de 9 o NIT de 14 dígitos';
});
const inputMode = computed(() => (props.allowForeignId && looksLikeForeignId(props.modelValue ?? '')) ? 'text' : 'numeric');
const maxLength = computed(() => (props.allowForeignId ? 20 : 17));

watch(detected, (value) => {
  emit('detected', value);
}, { immediate: true });

function formatInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const formatted = formatFiscalDocument(input.value, props.allowedTypes, props.allowForeignId);
  input.value = formatted;
  emit('update:modelValue', formatted);
}

function toggleForeignIdKind(): void {
  foreignIdKind.value = foreignIdKind.value === 'passport' ? 'residentCard' : 'passport';
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
        :aria-pressed="foreignIdKind === 'residentCard'"
        :aria-label="foreignIdKind === 'passport' ? 'Marcar como carné de residencia' : 'Marcar como pasaporte'"
        @click="toggleForeignIdKind"
      >
        {{ foreignIdKind === 'passport' ? '¿Es carné de residencia?' : '¿Es pasaporte?' }}
      </button>
    </span>
    <span v-if="showMessage && !detected.valid && detected.message" class="mt-1 block text-xs text-soft">{{ detected.message }}</span>
  </label>
</template>
