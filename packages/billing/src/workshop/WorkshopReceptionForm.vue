<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Camera, Check, ChevronLeft, ChevronRight, SlidersHorizontal, Smartphone, UserRound, X } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSearchInput, UiSelect, UiTextarea } from '@stelfaro/ui';
import type { BillingCustomer, WorkshopOrderPayload } from '@stelfaro/api-client';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';

const props = defineProps<{ customers: BillingCustomer[]; customerLoading?: boolean; onCreateCustomer: (payload: BillingCustomerModalPayload) => Promise<BillingCustomer>; onSave: (payload: WorkshopOrderPayload) => Promise<unknown> }>();
const emit = defineEmits<{ search: [query: string] }>();
const step = ref(1);
const selected = ref<BillingCustomer | null>(null);
const customerQuery = ref('');
const customerCreateOpen = ref(false);
const customerCreateLoading = ref(false);
const optionalOpen = ref(false);
const accessoriesText = ref('');
const saving = ref(false);
const validationMessage = ref('');
const form = reactive({ type: 'phone', brand: '', model: '', color: '', imei: '', serial_number: '', reported_fault: '', physical_condition: '', priority: 'normal', advance_amount: '', advance_method: 'cash', advance_reference: '' });
const deviceTypes = [{ value: 'phone', label: 'Celular' }, { value: 'tablet', label: 'Tablet' }, { value: 'laptop', label: 'Laptop' }, { value: 'desktop', label: 'Computadora' }, { value: 'console', label: 'Consola' }, { value: 'controller', label: 'Mando' }, { value: 'instrument', label: 'Instrumento' }, { value: 'tv', label: 'Televisor' }, { value: 'audio', label: 'Audio' }, { value: 'other', label: 'Otro' }];
const priorities = [{ value: 'low', label: 'Baja' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' }];
const mobileDevice = computed(() => ['phone', 'tablet'].includes(form.type));
const selectedTypeLabel = computed(() => deviceTypes.find(option => option.value === form.type)?.label ?? 'Equipo');
const progress = computed(() => `${Math.round((step.value / 3) * 100)}%`);

function updateCustomerSearch(value: string) { if (selected.value && value !== selected.value.name) selected.value = null; customerQuery.value = value; emit('search', value); }
function clearCustomerSearch() { selected.value = null; customerQuery.value = ''; emit('search', ''); }
function choose(customer: BillingCustomer) { selected.value = customer; customerQuery.value = customer.name; emit('search', ''); validationMessage.value = ''; }
async function createCustomer(payload: BillingCustomerModalPayload) {
  customerCreateLoading.value = true;
  try { choose(await props.onCreateCustomer(payload)); customerCreateOpen.value = false; }
  finally { customerCreateLoading.value = false; }
}
function next() {
  validationMessage.value = '';
  if (step.value === 1 && !selected.value) { validationMessage.value = 'Selecciona un cliente para continuar.'; return; }
  if (step.value === 2 && (!form.brand.trim() || !form.model.trim() || !form.reported_fault.trim())) { validationMessage.value = 'Completa marca, modelo y falla reportada.'; return; }
  step.value = Math.min(3, step.value + 1);
}
function previous() { validationMessage.value = ''; step.value = Math.max(1, step.value - 1); }
async function submit() {
  if (!selected.value || saving.value) return;
  saving.value = true;
  try {
    await props.onSave({ customer: { core_customer_id: selected.value.id, name: selected.value.name, phone: selected.value.phone, email: selected.value.email }, device: { type: form.type, brand: form.brand, model: form.model, color: form.color || null, imei: mobileDevice.value ? form.imei || null : null, serial_number: mobileDevice.value ? null : form.serial_number || null }, reported_fault: form.reported_fault, physical_condition: form.physical_condition || null, accessories: accessoriesText.value.split(',').map(value => value.trim()).filter(Boolean), priority: form.priority, advance: form.advance_amount ? { amount: Number(form.advance_amount), method: form.advance_method, reference: form.advance_reference || null } : undefined });
    selected.value = null; customerQuery.value = ''; accessoriesText.value = ''; optionalOpen.value = false; step.value = 1;
    Object.assign(form, { type: 'phone', brand: '', model: '', color: '', imei: '', serial_number: '', reported_fault: '', physical_condition: '', priority: 'normal', advance_amount: '', advance_method: 'cash', advance_reference: '' });
  } finally { saving.value = false; }
}
</script>

<template>
  <BillingCustomerModal :open="customerCreateOpen" mode="new" :loading="customerCreateLoading" :allow-optional-address="false" @close="customerCreateOpen = false" @save="createCustomer" />

  <UiCard class="w-full overflow-hidden">
    <div class="border-b border-line px-5 py-4 sm:px-7">
      <div class="flex items-center justify-between gap-4 text-sm"><span class="font-semibold text-primary">Paso {{ step }} de 3</span><span class="text-muted">{{ step === 1 ? 'Cliente' : step === 2 ? 'Equipo y falla' : 'Confirmar' }}</span></div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div class="h-full rounded-full bg-primary transition-all" :style="{ width: progress }"></div></div>
    </div>

    <form class="p-5 sm:p-7" @submit.prevent="submit">
      <section v-if="step === 1">
        <div class="flex items-center justify-between gap-3"><div class="flex items-center gap-3"><UserRound class="h-6 w-6 text-primary" /><h2 class="text-xl font-semibold text-text">¿Quién trae el equipo?</h2></div><UiButton type="button" variant="secondary" @click="customerCreateOpen = true">Nuevo cliente</UiButton></div>
        <div class="mt-6"><UiSearchInput :model-value="customerQuery" label="Buscar cliente" placeholder="Nombre, documento o teléfono" @update:model-value="updateCustomerSearch"><template v-if="selected" #trailing><button type="button" class="grid h-8 w-8 place-items-center rounded-md text-danger transition hover:bg-danger-soft" aria-label="Quitar cliente seleccionado" @click="clearCustomerSearch"><X class="h-4 w-4" /></button></template></UiSearchInput></div>
        <div v-if="customerLoading" class="mt-2 text-sm text-muted">Buscando clientes…</div>
        <div v-else-if="!selected && customerQuery.trim().length >= 2 && customers.length" class="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-surface-raised"><button v-for="customer in customers" :key="customer.id" type="button" class="block w-full px-4 py-3 text-left hover:bg-primary-soft" @click="choose(customer)"><strong class="block text-text">{{ customer.name }}</strong><span class="mt-1 block text-xs text-muted">{{ customer.document_number || 'Sin documento' }}<template v-if="customer.phone"> · {{ customer.phone }}</template></span></button></div>
        <p v-else-if="!selected && customerQuery.trim().length >= 2" class="mt-2 rounded-md bg-surface-muted px-4 py-3 text-sm text-muted">No encontramos clientes con esa búsqueda.</p>
      </section>

      <section v-else-if="step === 2">
        <div class="flex items-start gap-3"><Smartphone class="mt-0.5 h-6 w-6 text-primary" /><div><h2 class="text-xl font-semibold text-text">¿Qué equipo recibimos?</h2><p class="mt-1 text-sm text-muted">Solo necesitamos lo esencial para abrir la orden.</p></div></div>
        <div class="mt-6 grid gap-4 sm:grid-cols-2"><UiSelect v-model="form.type" label="Tipo de equipo" :options="deviceTypes" /><UiInput v-model="form.brand" label="Marca" placeholder="Ej. Samsung, HP, Sony" /><UiInput v-model="form.model" label="Modelo" placeholder="Ej. A54, Pavilion, PS5" /><UiInput v-if="mobileDevice" v-model="form.imei" label="IMEI (si está visible)" maxlength="15" inputmode="numeric" /><UiInput v-else v-model="form.serial_number" label="Serial (si está visible)" /></div>
        <div class="mt-4"><UiTextarea v-model="form.reported_fault" label="¿Qué problema tiene?" placeholder="Describe brevemente lo que reporta el cliente" /></div>
      </section>

      <section v-else>
        <div class="flex items-start gap-3"><Check class="mt-0.5 h-6 w-6 text-success" /><div><h2 class="text-xl font-semibold text-text">Revisa y registra</h2><p class="mt-1 text-sm text-muted">Puedes abrir la orden así o agregar información secundaria.</p></div></div>
        <div class="mt-6 divide-y divide-line rounded-lg border border-line bg-surface-muted px-4">
          <div class="py-4"><p class="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</p><p class="mt-1 font-semibold text-text">{{ selected?.name }}</p></div>
          <div class="py-4"><p class="text-xs font-semibold uppercase tracking-wide text-muted">Equipo</p><p class="mt-1 font-semibold text-text">{{ selectedTypeLabel }} · {{ form.brand }} {{ form.model }}</p><p v-if="form.imei || form.serial_number" class="mt-1 text-sm text-muted">{{ mobileDevice ? 'IMEI' : 'Serial' }}: {{ mobileDevice ? form.imei : form.serial_number }}</p></div>
          <div class="py-4"><p class="text-xs font-semibold uppercase tracking-wide text-muted">Falla reportada</p><p class="mt-1 text-sm text-text">{{ form.reported_fault }}</p></div>
        </div>

        <button type="button" class="mt-4 flex w-full items-center justify-between rounded-md border border-line px-4 py-3 text-left text-sm font-semibold text-text hover:bg-surface-muted" @click="optionalOpen = !optionalOpen"><span class="inline-flex items-center gap-2"><SlidersHorizontal class="h-4 w-4 text-primary" />Agregar detalles opcionales</span><span class="text-muted">{{ optionalOpen ? 'Ocultar' : 'Abrir' }}</span></button>
        <div v-if="optionalOpen" class="mt-4 grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
          <UiInput v-model="form.color" label="Color" /><UiSelect v-model="form.priority" label="Prioridad" :options="priorities" /><UiTextarea v-model="form.physical_condition" label="Condición física" placeholder="Golpes, rayones u otras observaciones" /><UiInput v-model="accessoriesText" label="Accesorios" hint="Separados por coma" /><UiInput v-model="form.advance_amount" label="Anticipo" type="number" min="0" step="0.01" /><UiSelect v-model="form.advance_method" label="Forma de pago" :options="[{value:'cash',label:'Efectivo'},{value:'card',label:'Tarjeta'},{value:'transfer',label:'Transferencia'},{value:'other',label:'Otro'}]" /><UiInput v-if="form.advance_amount" v-model="form.advance_reference" class="sm:col-span-2" label="Referencia del pago" />
        </div>
        <p class="mt-4 inline-flex items-center gap-2 text-sm text-muted"><Camera class="h-4 w-4" />Las fotos se podrán agregar después desde la orden.</p>
      </section>

      <p v-if="validationMessage" class="mt-5 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{{ validationMessage }}</p>
      <div class="mt-7 flex items-center justify-between border-t border-line pt-5"><UiButton v-if="step > 1" type="button" variant="secondary" @click="previous"><ChevronLeft class="mr-2 h-4 w-4" />Atrás</UiButton><span v-else></span><UiButton v-if="step < 3" type="button" @click="next">Siguiente<ChevronRight class="ml-2 h-4 w-4" /></UiButton><UiButton v-else type="submit" :disabled="saving">{{ saving ? 'Registrando…' : 'Registrar equipo' }}</UiButton></div>
    </form>
  </UiCard>
</template>
