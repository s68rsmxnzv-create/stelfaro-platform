<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { UiButton, UiCloseCircleIcon, UiFiscalDocumentInput, UiInput, type FiscalDocumentDetection } from '@stelfaro/ui';

export type BillingCustomerModalMode = 'new' | 'quick';

export type BillingCustomerModalPayload = {
  name: string;
  document_type: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
};

const props = withDefaults(defineProps<{
  open: boolean;
  mode: BillingCustomerModalMode;
  loading?: boolean;
  initialValue?: Partial<BillingCustomerModalPayload> | null;
}>(), {
  loading: false,
  initialValue: null
});

const emit = defineEmits<{
  close: [];
  save: [payload: BillingCustomerModalPayload];
}>();

const form = reactive({
  name: '',
  document: '',
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

const title = computed(() => props.mode === 'new' ? 'Nuevo cliente' : 'Cliente rapido');
const subtitle = computed(() => props.mode === 'new'
  ? 'Se guardara en la base de clientes de esta empresa.'
  : 'Solo se usara en esta factura; no queda guardado.');
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
}, { immediate: true });

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
    phone: form.phone.trim() || null
  });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-6">
      <form class="w-full max-w-xl rounded-md bg-white shadow-2xl" @submit.prevent="submit">
        <div class="border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Receptor</p>
              <h2 class="mt-1 text-xl font-bold text-slate-950">{{ title }}</h2>
              <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
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

        <div class="grid gap-4 px-6 py-5">
          <UiInput v-model="form.name" :label="mode === 'quick' ? 'Nombre en factura' : 'Nombre del cliente'" />
          <UiFiscalDocumentInput
            v-model="form.document"
            :label="documentRequired ? 'DUI/NIT del cliente' : 'DUI/NIT del cliente (opcional)'"
            @detected="updateDetection"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UiInput v-model="form.email" label="Correo" type="email" />
            <UiInput v-model="form.phone" label="Telefono" />
          </div>
          <p v-if="!documentIsValid" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {{ documentRequired ? 'Para guardar un cliente necesitamos DUI/NIT valido.' : 'Si colocas documento, debe tener formato valido.' }}
          </p>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
          <UiButton type="submit" :disabled="!canSave">{{ loading ? 'Guardando...' : mode === 'new' ? 'Guardar cliente' : 'Usar cliente' }}</UiButton>
        </div>
      </form>
    </div>
  </Teleport>
</template>
