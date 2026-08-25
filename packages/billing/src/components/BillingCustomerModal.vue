<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { UiButton, UiEmailInput, UiFiscalDocumentInput, UiInput, UiPhoneInput, UiSaveIcon, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingModalShell from './BillingModalShell.vue';

export type BillingCustomerModalMode = 'new' | 'quick' | 'edit';
export type BillingCustomerModalIntent = 'standard' | 'fiscal';
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
  nit?: string | null;
  nrc?: string | null;
  cod_actividad?: string | null;
  desc_actividad?: string | null;
  nombre_comercial?: string | null;
  departamento?: string | null;
  municipio?: string | null;
  distrito?: string | null;
  direccion_complemento?: string | null;
  allowed_dte_codes?: string[];
};

const props = withDefaults(defineProps<{
  open: boolean;
  mode: BillingCustomerModalMode;
  intent?: BillingCustomerModalIntent;
  loading?: boolean;
  initialValue?: Partial<BillingCustomerModalPayload> | null;
  actividadOptions?: SelectOption[];
  departamentoOptions?: SelectOption[];
  municipioOptions?: SelectOption[];
  distritoOptions?: SelectOption[];
  allowOptionalAddress?: boolean;
}>(), {
  loading: false,
  intent: 'standard',
  initialValue: null,
  actividadOptions: () => [],
  departamentoOptions: () => [],
  municipioOptions: () => [],
  distritoOptions: () => [],
  allowOptionalAddress: true
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
  nombreComercial: '',
  nrc: '',
  actividad: '',
  departamento: '',
  municipio: '',
  distrito: '',
  direccion: ''
});
const showAddress = ref(false);
const commercialNameTouched = ref(false);
const hydrating = ref(false);
const nameInput = ref<{ $el?: HTMLElement } | null>(null);

const detection = reactive<FiscalDocumentDetection>({
  valid: false,
  type: '',
  typeCode: '',
  typeLabel: '',
  number: '',
  message: ''
});

const title = computed(() => {
  if (props.intent === 'fiscal') return props.initialValue ? 'Completar datos fiscales' : 'Nuevo cliente fiscal';
  if (props.mode === 'edit') return 'Editar cliente';
  return props.mode === 'new' ? 'Nuevo cliente' : 'Cliente rapido';
});
const description = computed(() => props.intent === 'fiscal'
  ? 'Completa la información necesaria para emitir Crédito Fiscal.'
  : props.mode === 'quick'
    ? 'Usaremos únicamente este nombre durante la emisión actual.'
    : null);
const documentRequired = computed(() => props.mode === 'new' || props.intent === 'fiscal');
const documentIsValid = computed(() => {
  if (!form.document.trim()) return !documentRequired.value;
  const digits = form.document.replace(/\D+/g, '');
  return detection.valid || digits.length === 9 || digits.length === 14;
});
const selectedActividad = computed(() => props.actividadOptions.find((option) => option.value === form.actividad) ?? null);
const isEditMode = computed(() => props.mode === 'edit');
const isFiscalMode = computed(() => props.intent === 'fiscal' || isEditMode.value);
const hasFiscalIntent = computed(() => Boolean(
  props.intent === 'fiscal'
  || (isEditMode.value && (
    form.nrc.trim()
    || form.actividad.trim()
    || (props.initialValue?.allowed_dte_codes ?? []).includes('03')
  ))
));
const isForeignDocument = computed(() => detection.typeCode === '03' || detection.typeCode === '02');
const fiscalComplete = computed(() => Boolean(
  !hasFiscalIntent.value
  || (
    !isForeignDocument.value
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
  )
));
const commercialNameNeedsReview = computed(() => Boolean(
  isEditMode.value
  && !commercialNameTouched.value
  && form.nombreComercial.trim() !== ''
  && form.nombreComercial.trim() === form.name.trim()
));
const canSave = computed(() => Boolean(form.name.trim()) && documentIsValid.value && fiscalComplete.value && !props.loading);

watch(() => props.open, (open) => {
  if (!open) return;
  hydrating.value = true;
  commercialNameTouched.value = false;
  form.name = props.mode === 'quick' ? '' : props.initialValue?.name ?? '';
  form.document = props.initialValue?.document_number ?? '';
  form.email = props.initialValue?.email ?? '';
  form.phone = props.initialValue?.phone ?? '';
  form.nombreComercial = props.initialValue?.nombre_comercial ?? '';
  form.nrc = props.initialValue?.nrc ?? '';
  form.actividad = props.initialValue?.cod_actividad ?? '';
  form.departamento = props.initialValue?.departamento ?? '';
  form.municipio = props.initialValue?.municipio ?? '';
  form.distrito = props.initialValue?.distrito ?? '';
  form.direccion = props.initialValue?.direccion_complemento ?? '';
  showAddress.value = props.intent === 'fiscal' || isEditMode.value || Boolean(form.departamento || form.municipio || form.distrito || form.direccion);
  nextTick(() => {
    hydrating.value = false;
    if (props.mode === 'quick') {
      const input = nameInput.value?.$el?.querySelector('input');
      input?.focus({ preventScroll: true });
    }
  });
}, { immediate: true });

watch(() => form.departamento, (value, oldValue) => {
  emit('update:departamento', value);
  if (!hydrating.value && oldValue !== undefined && value !== oldValue) {
    form.municipio = '';
    form.distrito = '';
  }
});

watch(() => form.municipio, (value, oldValue) => {
  emit('update:municipio', value);
  if (!hydrating.value && oldValue !== undefined && value !== oldValue) {
    form.distrito = '';
  }
});

function updateDetection(value: FiscalDocumentDetection): void {
  detection.valid = value.valid;
  detection.type = value.type;
  detection.typeCode = value.typeCode;
  detection.typeLabel = value.typeLabel;
  detection.number = value.number;
  detection.message = value.message;
}

function updateCommercialName(value: string): void {
  commercialNameTouched.value = true;
  form.nombreComercial = value;
}

function submit(): void {
  if (!canSave.value) return;

  if (props.mode === 'quick') {
    emit('save', {
      name: form.name.trim(),
      document_type: null,
      document_number: null,
      email: null,
      phone: null,
    });
    return;
  }

  const documentDigits = form.document.replace(/\D+/g, '');
  const documentNumber = isForeignDocument.value ? detection.number : documentDigits;
  const documentType = form.document.trim() === '' ? null : (detection.typeCode || (documentDigits.length === 14 ? '36' : '13'));
  const activity = selectedActividad.value;
  const allowedDteCodes = new Set(props.initialValue?.allowed_dte_codes ?? []);
  if (hasFiscalIntent.value && fiscalComplete.value) {
    allowedDteCodes.add('03');
    allowedDteCodes.add('01');
  }

  emit('save', {
    name: form.name.trim(),
    document_type: documentType,
    document_number: form.document.trim() === '' ? null : documentNumber,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    nit: hasFiscalIntent.value ? documentDigits || null : props.initialValue?.nit ?? null,
    nrc: hasFiscalIntent.value ? form.nrc.replace(/\D+/g, '') || null : props.initialValue?.nrc ?? null,
    cod_actividad: hasFiscalIntent.value ? form.actividad || null : props.initialValue?.cod_actividad ?? null,
    desc_actividad: hasFiscalIntent.value ? activity?.label ?? null : props.initialValue?.desc_actividad ?? null,
    nombre_comercial: isFiscalMode.value ? form.nombreComercial.trim() || null : props.initialValue?.nombre_comercial ?? null,
    departamento: showAddress.value ? form.departamento || null : null,
    municipio: showAddress.value ? form.municipio || null : null,
    distrito: showAddress.value && form.distrito ? form.distrito.replace(/\D+/g, '').padStart(2, '0') : null,
    direccion_complemento: showAddress.value ? form.direccion.trim() || null : null,
    allowed_dte_codes: hasFiscalIntent.value ? Array.from(allowedDteCodes) : isEditMode.value ? Array.from(allowedDteCodes) : undefined
  });
}
</script>

<template>
  <BillingModalShell
    :open="open"
    :eyebrow="intent === 'fiscal' ? 'Receptor CCF' : 'Receptor'"
    :title="title"
    :description="description"
    :max-width="isFiscalMode ? 'max-w-3xl' : 'max-w-xl'"
    panel-as="form"
    :panel-class="isFiscalMode ? 'max-h-[92vh] overflow-hidden' : ''"
    :body-class="isFiscalMode ? 'grid min-h-0 gap-4 overflow-y-auto px-5 py-5' : 'grid gap-4 px-5 py-5'"
    @close="emit('close')"
    @submit="submit"
  >
    <div class="grid gap-4" :class="isFiscalMode ? 'md:grid-cols-2' : ''">
      <UiInput ref="nameInput" v-model="form.name" :autofocus="mode === 'quick'" autocomplete="name" :label="intent === 'fiscal' ? 'Nombre fiscal / razón social' : mode === 'quick' ? 'Nombre en factura' : 'Nombre del cliente'" />
      <div v-if="isFiscalMode">
        <UiInput
          :model-value="form.nombreComercial"
          label="Nombre comercial"
          :class="commercialNameNeedsReview ? 'border-orange-300 bg-orange-50 text-orange-950 focus:border-orange-500 focus:ring-orange-100 dark:border-orange-400/70 dark:bg-orange-950/25 dark:text-orange-100' : ''"
          @update:model-value="updateCommercialName"
        />
        <p v-if="commercialNameNeedsReview" class="mt-1 text-xs font-medium text-orange-700 dark:text-orange-300">
          Se completo con el nombre del cliente. Cambialo si la tarjeta muestra otro nombre comercial.
        </p>
      </div>
    </div>

    <div v-if="mode !== 'quick'" class="grid gap-4 md:grid-cols-2">
      <UiFiscalDocumentInput
        v-model="form.document"
        :label="documentRequired ? 'DUI/NIT/Pasaporte del cliente' : 'DUI/NIT/Pasaporte del cliente (opcional)'"
        allow-foreign-id
        @detected="updateDetection"
      />
      <UiInput v-if="isFiscalMode" v-model="form.nrc" label="NRC" />
    </div>

    <UiSearchSelect
      v-if="mode !== 'quick' && isFiscalMode"
      v-model="form.actividad"
      label="Actividad economica"
      :options="actividadOptions"
      placeholder="Buscar por codigo o descripcion"
    />

    <div v-if="mode !== 'quick'" class="grid gap-4 sm:grid-cols-2">
      <UiEmailInput v-model="form.email" label="Correo" />
      <UiPhoneInput v-model="form.phone" label="Telefono" />
    </div>

    <button
      v-if="mode !== 'quick' && !isFiscalMode && allowOptionalAddress"
      type="button"
      class="text-left text-sm font-semibold text-sky-700 transition hover:text-sky-600 dark:text-primary"
      @click="showAddress = !showAddress"
    >
      {{ showAddress ? 'Ocultar direccion opcional' : 'Agregar direccion opcional' }}
    </button>
    <div v-if="mode !== 'quick' && showAddress" class="grid gap-4 rounded-md border border-blue-100 bg-blue-50/40 p-4 dark:border-line dark:bg-surface-muted">
      <p v-if="isFiscalMode" class="text-sm font-semibold text-slate-700 dark:text-muted">Dirección</p>
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

    <p v-if="hasFiscalIntent && !fiscalComplete" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-warning-soft dark:text-warning">
      {{ isForeignDocument
        ? 'Crédito Fiscal requiere NIT del cliente. Un cliente con pasaporte o carné de residente solo puede facturarse con Factura simple.'
        : 'Para usar este cliente en Credito Fiscal completa NIT/DUI, NRC, actividad, direccion, correo y telefono.' }}
    </p>

    <template #footer>
      <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
      <UiButton :variant="mode === 'quick' ? 'primary' : 'success'" type="submit" :disabled="!canSave">
        <UiSaveIcon v-if="mode !== 'quick' && !loading" class="mr-2 h-5 w-5" />
        <span>{{ loading ? 'Guardando...' : mode === 'quick' ? 'Usar cliente' : mode === 'edit' ? 'Guardar cambios' : 'Guardar cliente' }}</span>
      </UiButton>
    </template>
  </BillingModalShell>
</template>
