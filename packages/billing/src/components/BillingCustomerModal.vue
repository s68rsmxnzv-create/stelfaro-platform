<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { UiButton, UiEmailInput, UiFiscalDocumentInput, UiInput, UiPhoneInput, UiSaveIcon, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingModalShell from './BillingModalShell.vue';

export type BillingCustomerModalMode = 'new' | 'quick';
type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export type BillingCustomerModalPayload = {
  name: string;
  document_type: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  departamento?: string | null;
  municipio?: string | null;
  distrito?: string | null;
  direccion_complemento?: string | null;
};

const props = withDefaults(defineProps<{
  open: boolean;
  mode: BillingCustomerModalMode;
  loading?: boolean;
  initialValue?: Partial<BillingCustomerModalPayload> | null;
  departamentoOptions?: SelectOption[];
  municipioOptions?: SelectOption[];
  distritoOptions?: SelectOption[];
}>(), {
  loading: false,
  initialValue: null,
  departamentoOptions: () => [],
  municipioOptions: () => [],
  distritoOptions: () => []
});

const emit = defineEmits<{
  close: [];
  save: [payload: BillingCustomerModalPayload];
  'update:departamento': [value: string];
  'update:municipio': [value: string];
}>();

const form = reactive({
  name: '',
  document: '',
  email: '',
  phone: '',
  departamento: '',
  municipio: '',
  distrito: '',
  direccion: ''
});
const showAddress = ref(false);

const detection = reactive<FiscalDocumentDetection>({
  valid: false,
  type: '',
  typeLabel: '',
  number: '',
  message: ''
});

const title = computed(() => props.mode === 'new' ? 'Nuevo cliente' : 'Cliente rapido');
const documentRequired = computed(() => props.mode === 'new');
const documentIsValid = computed(() => {
  if (!form.document.trim()) return !documentRequired.value;
  return detection.valid;
});
const canSave = computed(() => Boolean(form.name.trim()) && documentIsValid.value && !props.loading);

watch(() => props.open, (open) => {
  if (!open) return;
  form.name = props.initialValue?.name ?? '';
  form.document = props.initialValue?.document_number ?? '';
  form.email = props.initialValue?.email ?? '';
  form.phone = props.initialValue?.phone ?? '';
  form.departamento = props.initialValue?.departamento ?? '';
  form.municipio = props.initialValue?.municipio ?? '';
  form.distrito = props.initialValue?.distrito ?? '';
  form.direccion = props.initialValue?.direccion_complemento ?? '';
  showAddress.value = Boolean(form.departamento || form.municipio || form.distrito || form.direccion);
}, { immediate: true });

watch(() => form.departamento, (value, oldValue) => {
  emit('update:departamento', value);
  if (oldValue !== undefined && value !== oldValue) {
    form.municipio = '';
    form.distrito = '';
  }
});

watch(() => form.municipio, (value, oldValue) => {
  emit('update:municipio', value);
  if (oldValue !== undefined && value !== oldValue) {
    form.distrito = '';
  }
});

function updateDetection(value: FiscalDocumentDetection): void {
  detection.valid = value.valid;
  detection.type = value.type;
  detection.typeLabel = value.typeLabel;
  detection.number = value.number;
  detection.message = value.message;
}

function submit(): void {
  if (!canSave.value) return;

  emit('save', {
    name: form.name.trim(),
    document_type: form.document.trim() === '' ? null : detection.typeLabel === 'NIT' ? '36' : '13',
    document_number: form.document.trim() === '' ? null : form.document.replace(/\D+/g, ''),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    departamento: showAddress.value ? form.departamento || null : null,
    municipio: showAddress.value ? form.municipio || null : null,
    distrito: showAddress.value && form.distrito ? form.distrito.replace(/\D+/g, '').padStart(2, '0') : null,
    direccion_complemento: showAddress.value ? form.direccion.trim() || null : null
  });
}
</script>

<template>
  <BillingModalShell
    :open="open"
    eyebrow="Receptor"
    :title="title"
    max-width="max-w-xl"
    panel-as="form"
    body-class="grid gap-4 px-5 py-5"
    @close="emit('close')"
    @submit="submit"
  >
    <UiInput v-model="form.name" :label="mode === 'quick' ? 'Nombre en factura' : 'Nombre del cliente'" />
    <UiFiscalDocumentInput
      v-model="form.document"
      :label="documentRequired ? 'DUI/NIT del cliente' : 'DUI/NIT del cliente (opcional)'"
      @detected="updateDetection"
    />
    <div class="grid gap-4 sm:grid-cols-2">
      <UiEmailInput v-model="form.email" label="Correo" />
      <UiPhoneInput v-model="form.phone" label="Telefono" />
    </div>
    <button
      type="button"
      class="text-left text-sm font-semibold text-sky-700 transition hover:text-sky-600 dark:text-primary"
      @click="showAddress = !showAddress"
    >
      {{ showAddress ? 'Ocultar direccion opcional' : 'Agregar direccion opcional' }}
    </button>
    <div v-if="showAddress" class="grid gap-4 rounded-md border border-blue-100 bg-blue-50/40 p-4 dark:border-line dark:bg-surface-muted">
      <div class="grid gap-4 md:grid-cols-2">
        <UiSearchSelect
          v-model="form.departamento"
          label="Departamento"
          :options="departamentoOptions"
          placeholder="Seleccionar departamento"
        />
        <UiSearchSelect
          v-model="form.municipio"
          label="Municipio"
          :options="municipioOptions"
          :disabled="!form.departamento"
          placeholder="Seleccionar municipio"
        />
      </div>
      <UiSearchSelect
        v-model="form.distrito"
        label="Distrito"
        :options="distritoOptions"
        :disabled="!form.municipio"
        placeholder="Seleccionar distrito"
      />
      <UiInput v-model="form.direccion" label="Direccion" />
    </div>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
      <UiButton :variant="mode === 'new' ? 'success' : 'primary'" type="submit" :disabled="!canSave">
        <UiSaveIcon v-if="mode === 'new' && !loading" class="mr-2 h-5 w-5" />
        <span>{{ loading ? 'Guardando...' : mode === 'new' ? 'Guardar cliente' : 'Usar cliente' }}</span>
      </UiButton>
    </template>
  </BillingModalShell>
</template>
