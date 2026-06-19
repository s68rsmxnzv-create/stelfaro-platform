<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { UiButton, UiEmailInput, UiFiscalDocumentInput, UiInput, UiPhoneInput, UiSaveIcon, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingModalShell from './BillingModalShell.vue';

type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export type BillingSujetoExcluidoModalPayload = {
  name: string;
  document_type: string;
  document_number: string;
  nit: string;
  nrc: string;
  cod_actividad: string | null;
  desc_actividad: string | null;
  nombre_comercial: string | null;
  departamento: string;
  municipio: string;
  distrito: string;
  direccion_complemento: string;
  email: string | null;
  phone: string | null;
  allowed_dte_codes: ['14'];
};

const props = withDefaults(defineProps<{
  open: boolean;
  loading?: boolean;
  actividadOptions: SelectOption[];
  departamentoOptions: SelectOption[];
  municipioOptions: SelectOption[];
  distritoOptions: SelectOption[];
}>(), {
  loading: false
});

const emit = defineEmits<{
  close: [];
  save: [payload: BillingSujetoExcluidoModalPayload];
  'update:departamento': [value: string];
  'update:municipio': [value: string];
}>();

const form = reactive({
  name: '',
  document: '',
  actividad: '',
  departamento: '',
  municipio: '',
  distrito: '',
  direccion: '',
  email: '',
  phone: ''
});

const detection = reactive<FiscalDocumentDetection>({
  valid: false,
  type: '',
  typeLabel: '',
  number: '',
  message: ''
});

const selectedActividad = computed(() => props.actividadOptions.find((option) => option.value === form.actividad) ?? null);
const canSave = computed(() => Boolean(
  form.name.trim()
  && detection.valid
  && form.departamento.trim()
  && form.municipio.trim()
  && form.distrito.trim()
  && form.direccion.trim()
  && !props.loading
));

watch(() => props.open, (open) => {
  if (!open) return;
  form.name = '';
  form.document = '';
  form.actividad = '';
  form.departamento = '';
  form.municipio = '';
  form.distrito = '';
  form.direccion = '';
  form.email = '';
  form.phone = '';
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

  const digits = form.document.replace(/\D+/g, '');
  const distrito = form.distrito.replace(/\D+/g, '').padStart(2, '0');
  emit('save', {
    name: form.name.trim(),
    document_type: detection.typeLabel === 'NIT' ? '36' : '13',
    document_number: digits,
    nit: detection.typeLabel === 'NIT' ? digits : '',
    nrc: '',
    cod_actividad: form.actividad || null,
    desc_actividad: selectedActividad.value?.label ?? null,
    nombre_comercial: null,
    departamento: form.departamento,
    municipio: form.municipio,
    distrito,
    direccion_complemento: form.direccion.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    allowed_dte_codes: ['14']
  });
}
</script>

<template>
  <BillingModalShell
    :open="open"
    eyebrow="Sujeto excluido"
    title="Nuevo sujeto excluido"
    description="Datos requeridos para emitir Factura de Sujeto Excluido."
    max-width="max-w-3xl"
    panel-as="form"
    panel-class="max-h-[92vh] overflow-hidden"
    body-class="grid min-h-0 gap-4 overflow-y-auto px-5 py-5"
    @close="emit('close')"
    @submit="submit"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <UiInput v-model="form.name" label="Nombre / razon social" />
      <UiFiscalDocumentInput
        v-model="form.document"
        label="DUI o NIT"
        @detected="updateDetection"
      />
    </div>

    <UiSearchSelect
      v-model="form.actividad"
      label="Actividad economica (opcional)"
      :options="actividadOptions"
      placeholder="Buscar por codigo o descripcion"
      clearable
      clear-label="Sin actividad"
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
      <UiEmailInput v-model="form.email" label="Correo (opcional)" />
      <UiPhoneInput v-model="form.phone" label="Telefono (opcional)" />
    </div>

    <p v-if="form.document.trim() && !detection.valid" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
      Usa DUI de 9 digitos o NIT de 14 digitos.
    </p>

    <template #footer>
      <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
      <UiButton variant="success" type="submit" :disabled="!canSave">
        <UiSaveIcon v-if="!loading" class="mr-2 h-5 w-5" />
        <span>{{ loading ? 'Guardando...' : 'Guardar sujeto excluido' }}</span>
      </UiButton>
    </template>
  </BillingModalShell>
</template>
