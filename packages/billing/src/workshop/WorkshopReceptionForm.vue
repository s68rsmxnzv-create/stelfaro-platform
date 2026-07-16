<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Camera, Search, Smartphone, Wrench } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSelect, UiTextarea } from '@stelfaro/ui';
import type { BillingCustomer, WorkshopOrderPayload } from '@stelfaro/api-client';
import BillingCustomerSearchModal from '../components/BillingCustomerSearchModal.vue';

const props = defineProps<{ customers: BillingCustomer[]; customerLoading?: boolean; onSave: (payload: WorkshopOrderPayload) => Promise<unknown> }>();
const emit = defineEmits<{ search: [query: string] }>();
const selected = ref<BillingCustomer | null>(null);
const customerQuery = ref('');
const customerSearchOpen = ref(false);
const accessoriesText = ref('');
const saving = ref(false);
const form = reactive({ type: 'phone', brand: '', model: '', color: '', imei: '', serial_number: '', reported_fault: '', physical_condition: '', priority: 'normal', advance_amount: '', advance_method: 'cash', advance_reference: '' });
const deviceTypes = [{ value: 'phone', label: 'Celular' }, { value: 'tablet', label: 'Tablet' }, { value: 'laptop', label: 'Laptop' }, { value: 'desktop', label: 'Computadora' }, { value: 'console', label: 'Consola' }, { value: 'controller', label: 'Mando' }, { value: 'instrument', label: 'Instrumento' }, { value: 'tv', label: 'Televisor' }, { value: 'audio', label: 'Audio' }, { value: 'other', label: 'Otro' }];
const priorities = [{ value: 'low', label: 'Baja' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' }];

function openCustomerSearch() { customerSearchOpen.value = true; }
function updateCustomerSearch(value: string) { customerQuery.value = value; emit('search', value); }
function clearCustomerSearch() { customerQuery.value = ''; emit('search', ''); }
function choose(customer: BillingCustomer) { selected.value = customer; customerQuery.value = customer.name; customerSearchOpen.value = false; }
async function submit() {
  if (!selected.value) return;
  saving.value = true;
  try {
    await props.onSave({ customer: { core_customer_id: selected.value.id, name: selected.value.name, phone: selected.value.phone, email: selected.value.email }, device: { type: form.type, brand: form.brand, model: form.model, color: form.color || null, imei: form.imei || null, serial_number: form.serial_number || null }, reported_fault: form.reported_fault, physical_condition: form.physical_condition || null, accessories: accessoriesText.value.split(',').map(v => v.trim()).filter(Boolean), priority: form.priority, advance: form.advance_amount ? { amount: Number(form.advance_amount), method: form.advance_method, reference: form.advance_reference || null } : undefined });
    selected.value = null;
    customerQuery.value = '';
    accessoriesText.value = '';
    Object.assign(form, { type: 'phone', brand: '', model: '', color: '', imei: '', serial_number: '', reported_fault: '', physical_condition: '', priority: 'normal', advance_amount: '', advance_method: 'cash', advance_reference: '' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BillingCustomerSearchModal
    :open="customerSearchOpen"
    :search="customerQuery"
    :results="props.customers"
    :loading="props.customerLoading"
    :selected-customer-id="selected?.id ?? null"
    @close="customerSearchOpen = false"
    @clear="clearCustomerSearch"
    @select="choose"
    @update:search="updateCustomerSearch"
  />
  <form class="grid gap-5 xl:grid-cols-2" @submit.prevent="submit">
    <UiCard class="p-5">
      <div class="flex items-center gap-3"><Search class="h-5 w-5 text-primary" /><div><h2 class="font-semibold text-text">Cliente</h2><p class="text-sm text-muted">Se reutiliza el perfil disponible en facturación.</p></div></div>
      <div class="mt-4 rounded-md border border-line bg-surface-muted p-4">
        <p v-if="selected" class="text-sm text-text"><strong>{{ selected.name }}</strong><span class="ml-2 text-muted">{{ selected.phone || selected.document_number || 'Sin contacto' }}</span></p>
        <p v-else class="text-sm text-muted">Selecciona un cliente guardado para continuar.</p>
        <UiButton class="mt-3" type="button" variant="secondary" @click="openCustomerSearch"><Search class="mr-2 h-4 w-4" />{{ selected ? 'Cambiar cliente' : 'Buscar cliente' }}</UiButton>
      </div>
    </UiCard>
    <UiCard class="p-5">
      <div class="flex items-center gap-3"><Smartphone class="h-5 w-5 text-primary" /><h2 class="font-semibold text-text">Equipo físico</h2></div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2"><UiSelect v-model="form.type" label="Tipo" :options="deviceTypes" /><UiInput v-model="form.brand" label="Marca" required /><UiInput v-model="form.model" label="Modelo" required /><UiInput v-model="form.color" label="Color" /><UiInput v-model="form.imei" label="IMEI" maxlength="15" inputmode="numeric" /><UiInput v-model="form.serial_number" label="Serial / S/N" /></div>
    </UiCard>
    <UiCard class="p-5 xl:col-span-2">
      <div class="flex items-center gap-3"><Wrench class="h-5 w-5 text-primary" /><h2 class="font-semibold text-text">Recepción</h2></div>
      <div class="mt-4 grid gap-3 lg:grid-cols-2"><UiTextarea v-model="form.reported_fault" label="Falla reportada" required /><UiTextarea v-model="form.physical_condition" label="Condición física al recibir" /><UiInput v-model="accessoriesText" label="Accesorios recibidos" hint="Separados por coma" /><UiSelect v-model="form.priority" label="Prioridad" :options="priorities" /></div>
      <div class="mt-4 grid gap-3 sm:grid-cols-3"><UiInput v-model="form.advance_amount" label="Anticipo" type="number" min="0" step="0.01" /><UiSelect v-model="form.advance_method" label="Forma de pago" :options="[{value:'cash',label:'Efectivo'},{value:'card',label:'Tarjeta'},{value:'transfer',label:'Transferencia'},{value:'other',label:'Otro'}]" /><UiInput v-model="form.advance_reference" label="Referencia" /></div>
      <div class="mt-5 flex items-center justify-between gap-3"><p class="inline-flex items-center gap-2 text-sm text-muted"><Camera class="h-4 w-4" />Las fotos por QR se habilitarán sobre la orden creada.</p><UiButton type="submit" :disabled="!selected || saving">Registrar recepción</UiButton></div>
    </UiCard>
  </form>
</template>
