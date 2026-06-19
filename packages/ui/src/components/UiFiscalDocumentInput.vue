<script setup lang="ts">
import { computed, watch } from 'vue';

export type FiscalDocumentDetection = {
  valid: boolean;
  type: string;
  typeLabel: string;
  number: string;
  message: string;
};

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined;
  label?: string;
  allowedTypes?: 'dui_or_nit' | 'nit';
  showMessage?: boolean;
}>(), {
  label: 'DUI/NIT',
  allowedTypes: 'dui_or_nit',
  showMessage: true
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  detected: [value: FiscalDocumentDetection];
}>();

const detected = computed(() => detectFiscalDocument(props.modelValue ?? ''));
const placeholder = computed(() => props.allowedTypes === 'nit' ? '0000-000000-000-0' : '00000000-0 o 0000-000000-000-0');

watch(detected, (value) => {
  emit('detected', value);
}, { immediate: true });

function formatInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const formatted = formatFiscalDocument(input.value);
  input.value = formatted;
  emit('update:modelValue', formatted);
}

function detectFiscalDocument(value: string): FiscalDocumentDetection {
  const digits = value.replace(/\D+/g, '');

  if (props.allowedTypes !== 'nit' && digits.length === 9) {
    return {
      valid: true,
      type: 'DUI/NIT homologado',
      typeLabel: 'DUI',
      number: `${digits.slice(0, 8)}-${digits.slice(8)}`,
      message: 'Validaremos compatibilidad del certificado contra este documento homologado.'
    };
  }

  if (digits.length === 14) {
    return {
      valid: true,
      type: 'NIT',
      typeLabel: 'NIT',
      number: `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`,
      message: 'Formato NIT largo detectado.'
    };
  }

  return {
    valid: false,
    type: '',
    typeLabel: '',
    number: value,
    message: props.allowedTypes === 'nit'
      ? 'Ingresa NIT largo de 14 digitos.'
      : 'Ingresa DUI/NIT homologado de 9 digitos o NIT de 14 digitos.'
  };
}

function formatFiscalDocument(value: string): string {
  const digits = value.replace(/\D+/g, '').slice(0, 14);

  if (props.allowedTypes === 'nit') {
    return [
      digits.slice(0, 4),
      digits.slice(4, 10),
      digits.slice(10, 13),
      digits.slice(13, 14)
    ].filter(Boolean).join('-');
  }

  if (digits.length <= 8) {
    return digits;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  }

  return [
    digits.slice(0, 4),
    digits.slice(4, 10),
    digits.slice(10, 13),
    digits.slice(13, 14)
  ].filter(Boolean).join('-');
}
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium text-slate-700">{{ label }}</span>
    <span class="relative mt-1 block">
      <input
        :value="modelValue ?? ''"
        class="w-full rounded-md border border-slate-300 py-2 pl-3 pr-24 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        :placeholder="placeholder"
        inputmode="numeric"
        maxlength="17"
        @input="formatInput"
      >
      <span v-if="detected.valid" class="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">✓</span>
        {{ detected.typeLabel }}
      </span>
    </span>
    <span v-if="showMessage && !detected.valid && detected.message" class="mt-1 block text-xs text-slate-500">{{ detected.message }}</span>
  </label>
</template>
