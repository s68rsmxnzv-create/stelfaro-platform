<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { UiButton, UiEmailInput, UiFiscalDocumentInput, UiInput, UiPhoneInput, UiSaveIcon, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingModalShell from './BillingModalShell.vue';

type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export type BillingFiscalCustomerModalPayload = {
  name: string;
  document_type: '36';
  document_number: string;
  nit: string;
  nrc: string;
  cod_actividad: string;
  desc_actividad: string;
  nombre_comercial: string | null;
  departamento: string;
  municipio: string;
  distrito: string;
  direccion_complemento: string;
  email: string;
  phone: string;
  allowed_dte_codes: ['03'];
};

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  actividadOptions: SelectOption[];
  departamentoOptions: SelectOption[];
  municipioOptions: SelectOption[];
  distritoOptions: SelectOption[];
  initialValue?: Partial<BillingFiscalCustomerModalPayload> | null;
}>(), {
  loading: false,
  initialValue: null
});

const emit = defineEmits<{
  close: [];
  save: [payload: BillingFiscalCustomerModalPayload];
  'update:departamento': [value: string];
  'update:municipio': [value: string];
}>();

const form = reactive({
  name: '',
  document: '',
  nrc: '',
  actividad: '',
  nombreComercial: '',
  departamento: '',
  municipio: '',
  distrito: '',
  direccion: '',
  email: '',
  phone: ''
});
const commercialNameTouched = ref(false);

const detection = reactive<FiscalDocumentDetection>({
  valid: false,
  type: '',
  typeLabel: '',
  number: '',
  message: ''
});

const selectedActividad = computed(() => props.actividadOptions.find((option) => option.value === form.actividad) ?? null);
const title = computed(() => props.initialValue ? 'Completar datos fiscales' : 'Nuevo cliente fiscal');
const description = computed(() => props.initialValue
  ? 'Agrega solo la informacion fiscal que falta para emitir Comprobante de Credito Fiscal.'
  : 'Datos fiscales requeridos para emitir Comprobante de Credito Fiscal.');
const documentIsValid = computed(() => {
  const digits = form.document.replace(/\D+/g, '');
  return detection.valid || digits.length === 9 || digits.length === 14;
});
const commercialNameNeedsReview = computed(() => Boolean(
  props.initialValue
  && !commercialNameTouched.value
  && form.nombreComercial.trim() !== ''
  && form.nombreComercial.trim() === form.name.trim()
));
const canSave = computed(() => Boolean(
  form.name.trim()
  && documentIsValid.value
  && form.nrc.trim()
  && form.actividad.trim()
  && selectedActividad.value
  && form.departamento.trim()
  && form.municipio.trim()
  && form.distrito.trim()
  && form.direccion.trim()
  && form.email.trim()
  && form.phone.trim()
  && !props.loading
));

watch(() => props.open, (open) => {
  if (!open) return;
  commercialNameTouched.value = false;
  form.name = props.initialValue?.name ?? '';
  form.document = formatFiscalDocument(props.initialValue?.document_number ?? props.initialValue?.nit ?? '');
  form.nrc = props.initialValue?.nrc ?? '';
  form.actividad = props.initialValue?.cod_actividad ?? '';
  form.nombreComercial = props.initialValue?.nombre_comercial ?? '';
  form.departamento = props.initialValue?.departamento ?? '';
  form.municipio = props.initialValue?.municipio ?? '';
  form.distrito = props.initialValue?.distrito ?? '';
  form.direccion = props.initialValue?.direccion_complemento ?? '';
  form.email = props.initialValue?.email ?? '';
  form.phone = props.initialValue?.phone ?? '';
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

function updateCommercialName(value: string): void {
  commercialNameTouched.value = true;
  form.nombreComercial = value;
}

function formatFiscalDocument(value: string): string {
  const digits = value.replace(/\D+/g, '').slice(0, 14);

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

function submit(): void {
  if (!canSave.value || !selectedActividad.value) return;

  const digits = form.document.replace(/\D+/g, '');
  const distrito = form.distrito.replace(/\D+/g, '').padStart(2, '0');
  emit('save', {
    name: form.name.trim(),
    document_type: '36',
    document_number: digits,
    nit: digits,
    nrc: form.nrc.replace(/\D+/g, ''),
    cod_actividad: form.actividad,
    desc_actividad: selectedActividad.value.label,
    nombre_comercial: form.nombreComercial.trim() || null,
    departamento: form.departamento,
    municipio: form.municipio,
    distrito,
    direccion_complemento: form.direccion.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    allowed_dte_codes: ['03']
  });
}
</script>

<template>
  <BillingModalShell
    :open="open"
    eyebrow="Receptor CCF"
    :title="title"
    :description="description"
    max-width="max-w-3xl"
    panel-as="form"
    panel-class="max-h-[92vh] overflow-hidden"
    body-class="grid min-h-0 gap-4 overflow-y-auto px-5 py-5"
    @close="emit('close')"
    @submit="submit"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <UiInput v-model="form.name" label="Nombre fiscal / razon social" />
      <div>
        <UiInput
          :model-value="form.nombreComercial"
          label="Nombre comercial"
          :class="commercialNameNeedsReview ? 'border-orange-300 bg-orange-50 text-orange-950 focus:border-orange-500 focus:ring-orange-100 dark:border-orange-400/70 dark:bg-orange-950/25 dark:text-orange-100' : ''"
          @update:model-value="updateCommercialName"
        />
        <p v-if="commercialNameNeedsReview" class="mt-1 text-xs font-medium text-orange-700 dark:text-orange-300">
          Se completo con el nombre fiscal. Cambialo si la tarjeta muestra otro nombre comercial.
        </p>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <UiFiscalDocumentInput
        v-model="form.document"
        label="NIT o DUI homologado"
        @detected="updateDetection"
      />
      <UiInput v-model="form.nrc" label="NRC" />
    </div>

    <UiSearchSelect
      v-model="form.actividad"
      label="Actividad economica"
      :options="actividadOptions"
      placeholder="Buscar por codigo o descripcion"
    />

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

    <div class="grid gap-4 md:grid-cols-2">
      <UiEmailInput v-model="form.email" label="Correo" />
      <UiPhoneInput v-model="form.phone" label="Telefono" />
    </div>

    <p v-if="form.document.trim() && !documentIsValid" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
      Usa NIT de 14 digitos o DUI homologado de 9 digitos. En CCF viajará como NIT del receptor.
    </p>

    <template #footer>
      <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
      <UiButton variant="success" type="submit" :disabled="!canSave">
        <UiSaveIcon v-if="!loading" class="mr-2 h-5 w-5" />
        <span>{{ loading ? 'Guardando...' : 'Guardar cliente fiscal' }}</span>
      </UiButton>
    </template>
  </BillingModalShell>
</template>
