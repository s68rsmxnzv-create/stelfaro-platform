<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { UiButton, UiEmailInput, UiFiscalDocumentInput, UiInput, UiPhoneInput, UiSaveIcon, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingModalShell from './BillingModalShell.vue';

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
    <template #footer>
      <UiButton variant="secondary" type="button" @click="emit('close')">Cancelar</UiButton>
      <UiButton :variant="mode === 'new' ? 'success' : 'primary'" type="submit" :disabled="!canSave">
        <UiSaveIcon v-if="mode === 'new' && !loading" class="mr-2 h-5 w-5" />
        <span>{{ loading ? 'Guardando...' : mode === 'new' ? 'Guardar cliente' : 'Usar cliente' }}</span>
      </UiButton>
    </template>
  </BillingModalShell>
</template>
