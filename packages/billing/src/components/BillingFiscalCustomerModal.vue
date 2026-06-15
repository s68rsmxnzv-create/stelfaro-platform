<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { UiButton, UiCloseCircleIcon, UiFiscalDocumentInput, UiInput, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';

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
}>(), {
  loading: false
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
  form.name = '';
  form.document = '';
  form.nrc = '';
  form.actividad = '';
  form.nombreComercial = '';
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
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-6">
      <form class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-2xl" @submit.prevent="submit">
        <div class="shrink-0 border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Receptor CCF</p>
              <h2 class="mt-1 text-xl font-bold text-slate-950">Nuevo cliente fiscal</h2>
              <p class="mt-1 text-sm text-slate-500">Datos fiscales requeridos para emitir Comprobante de Credito Fiscal.</p>
            </div>
            <button
              class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500"
              type="button"
              aria-label="Cerrar"
              @click="emit('close')"
            >
              <UiCloseCircleIcon class="h-6 w-6" />
            </button>
          </div>
        </div>

        <div class="grid min-h-0 gap-4 overflow-y-auto px-6 py-5">
          <div class="grid gap-4 md:grid-cols-2">
            <UiInput v-model="form.name" label="Nombre fiscal / razon social" />
            <UiInput v-model="form.nombreComercial" label="Nombre comercial" />
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
            <UiInput v-model="form.email" label="Correo" type="email" />
            <UiInput v-model="form.phone" label="Telefono" />
          </div>

          <p v-if="form.document.trim() && !detection.valid" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Usa NIT de 14 digitos o DUI homologado de 9 digitos. En CCF viajará como NIT del receptor.
          </p>
        </div>

        <div class="shrink-0 flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
          <UiButton type="submit" :disabled="!canSave">{{ loading ? 'Guardando...' : 'Guardar cliente fiscal' }}</UiButton>
        </div>
      </form>
    </div>
  </Teleport>
</template>
