<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Camera, Check, ChevronLeft, ChevronRight, SlidersHorizontal, Smartphone, UserRound, X } from 'lucide-vue-next';
import { UiButton, UiCard, UiInput, UiSearchInput, UiSelect, UiTextarea, UiToggle } from '@stelfaro/ui';
import type { BillingCustomer, WorkshopOrderPayload } from '@stelfaro/api-client';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';
import WorkshopPatternInput from './WorkshopPatternInput.vue';

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
const form = reactive({ type: 'phone', brand: '', model: '', color: '', identifier: '', identifier_not_visible: false, power_status: 'not_tested', reported_fault: '', physical_condition: '', priority: 'normal', estimated_total: '', advance_amount: '', advance_method: 'cash', advance_reference: '', is_locked: false, access_type: 'code', access_secret: '' });
const functionalTests = reactive<Record<string, string>>({});
const physicalConditions = ref<string[]>([]);
const deviceTypes = [{ value: 'phone', label: 'Celular' }, { value: 'tablet', label: 'Tablet' }, { value: 'laptop', label: 'Laptop' }, { value: 'desktop', label: 'Computadora' }, { value: 'console', label: 'Consola' }, { value: 'controller', label: 'Mando' }, { value: 'instrument', label: 'Instrumento' }, { value: 'tv', label: 'Televisor' }, { value: 'audio', label: 'Audio' }, { value: 'other', label: 'Otro' }];
const priorities = [{ value: 'low', label: 'Baja' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' }];
const testOptions = [{key:'display',label:'Imagen'},{key:'touch_controls',label:'Touch / controles'},{key:'charging',label:'Carga'},{key:'cameras',label:'Cámaras'},{key:'audio',label:'Audio'},{key:'microphone',label:'Micrófono'},{key:'buttons',label:'Botones'},{key:'connectivity',label:'Conectividad'}];
const conditionOptions = [{key:'scratches',label:'Rayones'},{key:'dents',label:'Golpes'},{key:'cracked',label:'Quebraduras'},{key:'missing_parts',label:'Piezas faltantes'},{key:'moisture',label:'Humedad visible'},{key:'opened',label:'Abierto previamente'},{key:'tampered_screws',label:'Tornillos manipulados'},{key:'no_accessories',label:'Sin accesorios'}];
const selectedTypeLabel = computed(() => deviceTypes.find(option => option.value === form.type)?.label ?? 'Equipo');
const progress = computed(() => `${Math.round((step.value / 3) * 100)}%`);
const imeiSuggestion = computed(() => /^\d{14}$/.test(form.identifier) ? `${form.identifier}${imeiCheckDigit(form.identifier)}` : '');
const estimated = computed(() => Number(form.estimated_total || 0));
const advance = computed(() => Number(form.advance_amount || 0));
const balance = computed(() => Math.max(estimated.value - advance.value, 0));

function updateCustomerSearch(value: string) { if (selected.value && value !== selected.value.name) selected.value = null; customerQuery.value = value; emit('search', value); }
function clearCustomerSearch() { selected.value = null; customerQuery.value = ''; emit('search', ''); }
function choose(customer: BillingCustomer) { selected.value = customer; customerQuery.value = customer.name; emit('search', ''); validationMessage.value = ''; }
function imeiCheckDigit(base: string) { let sum = 0; [...base].forEach((digit, index) => { let value = Number(digit) * (index % 2 === 1 ? 2 : 1); sum += Math.floor(value / 10) + value % 10; }); return (10 - (sum % 10)) % 10; }
function setPower(status: string) { form.power_status = status; if (status !== 'on') Object.keys(functionalTests).forEach(key => delete functionalTests[key]); }
function cycleTest(key: string) { functionalTests[key] = functionalTests[key] === 'passed' ? 'failed' : functionalTests[key] === 'failed' ? 'not_tested' : 'passed'; }
function toggleCondition(key: string) { physicalConditions.value = physicalConditions.value.includes(key) ? physicalConditions.value.filter(item => item !== key) : [...physicalConditions.value, key]; }
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
    if (form.advance_amount && (!form.estimated_total || advance.value > estimated.value)) { validationMessage.value = 'El anticipo requiere un monto estimado y no puede superarlo.'; return; }
    if (form.is_locked && form.access_type === 'code' && !/^\d{4,12}$/.test(form.access_secret)) { validationMessage.value = 'El código debe tener entre 4 y 12 dígitos.'; return; }
    if (form.is_locked && form.access_type === 'pattern' && form.access_secret.split('-').filter(Boolean).length < 4) { validationMessage.value = 'El patrón debe tener al menos 4 puntos.'; return; }
    const identifier = imeiSuggestion.value || form.identifier.trim();
    const imei = /^\d{15}$/.test(identifier);
    await props.onSave({ customer: { core_customer_id: selected.value.id, name: selected.value.name, phone: selected.value.phone, email: selected.value.email }, device: { type: form.type, brand: form.brand, model: form.model, color: form.color || null, imei: !form.identifier_not_visible && imei ? identifier : null, serial_number: !form.identifier_not_visible && !imei ? identifier || null : null, identifier_not_visible: form.identifier_not_visible, power_status: form.power_status, functional_tests: form.power_status === 'on' ? {...functionalTests} : {}, is_locked: form.is_locked, access_type: form.is_locked ? form.access_type : null, access_secret: form.is_locked ? form.access_secret || null : null }, reported_fault: form.reported_fault, physical_condition: form.physical_condition || null, physical_conditions: physicalConditions.value, accessories: accessoriesText.value.split(',').map(value => value.trim()).filter(Boolean), priority: form.priority, estimated_total: form.estimated_total ? estimated.value : null, advance: form.advance_amount ? { amount: advance.value, method: form.advance_method, reference: form.advance_reference || null } : undefined });
    selected.value = null; customerQuery.value = ''; accessoriesText.value = ''; optionalOpen.value = false; step.value = 1;
    Object.keys(functionalTests).forEach(key => delete functionalTests[key]); physicalConditions.value = [];
    Object.assign(form, { type: 'phone', brand: '', model: '', color: '', identifier: '', identifier_not_visible: false, power_status: 'not_tested', reported_fault: '', physical_condition: '', priority: 'normal', estimated_total: '', advance_amount: '', advance_method: 'cash', advance_reference: '', is_locked: false, access_type: 'code', access_secret: '' });
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
        <div class="workshop-customer-search relative mt-6"><UiSearchInput :model-value="customerQuery" label="Buscar cliente" placeholder="Nombre, documento o teléfono" @update:model-value="updateCustomerSearch" /><button v-if="selected" type="button" class="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-md text-danger transition hover:bg-danger-soft" aria-label="Quitar cliente seleccionado" @click="clearCustomerSearch"><X class="h-4 w-4" /></button></div>
        <div v-if="customerLoading" class="mt-2 text-sm text-muted">Buscando clientes…</div>
        <div v-else-if="!selected && customerQuery.trim().length >= 2 && customers.length" class="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-surface-raised"><button v-for="customer in customers" :key="customer.id" type="button" class="block w-full px-4 py-3 text-left hover:bg-primary-soft" @click="choose(customer)"><strong class="block text-text">{{ customer.name }}</strong><span class="mt-1 block text-xs text-muted">{{ customer.document_number || 'Sin documento' }}<template v-if="customer.phone"> · {{ customer.phone }}</template></span></button></div>
        <p v-else-if="!selected && customerQuery.trim().length >= 2" class="mt-2 rounded-md bg-surface-muted px-4 py-3 text-sm text-muted">No encontramos clientes con esa búsqueda.</p>
      </section>

      <section v-else-if="step === 2">
        <div class="flex items-start gap-3"><Smartphone class="mt-0.5 h-6 w-6 text-primary" /><div><h2 class="text-xl font-semibold text-text">¿Qué equipo recibimos?</h2><p class="mt-1 text-sm text-muted">Solo necesitamos lo esencial para abrir la orden.</p></div></div>
        <div class="mt-6 grid gap-4 sm:grid-cols-2"><UiSelect v-model="form.type" label="Tipo de equipo" :options="deviceTypes" /><UiInput v-model="form.brand" label="Marca" placeholder="Ej. Samsung, HP, Sony" /><UiInput v-model="form.model" label="Modelo" placeholder="Ej. A54, Pavilion, PS5" /><div><UiInput v-model="form.identifier" label="IMEI o serial" :disabled="form.identifier_not_visible" placeholder="14 dígitos de IMEI o serial" /><button v-if="imeiSuggestion && !form.identifier_not_visible" type="button" class="mt-1 text-xs font-semibold text-primary" @click="form.identifier = imeiSuggestion">Completar IMEI: {{ imeiSuggestion }}</button><div class="mt-2 flex items-center justify-between"><span class="text-xs text-muted">No visible</span><UiToggle v-model="form.identifier_not_visible" aria-label="Identificador no visible" /></div></div></div>
        <div class="mt-4"><UiTextarea v-model="form.reported_fault" label="¿Qué problema tiene?" placeholder="Describe brevemente lo que reporta el cliente" /></div>
        <div class="mt-5"><p class="text-sm font-semibold text-text">¿El equipo enciende?</p><div class="mt-2 grid grid-cols-3 gap-2"><button v-for="option in [{value:'on',label:'Sí'},{value:'off',label:'No'},{value:'not_tested',label:'No comprobado'}]" :key="option.value" type="button" class="rounded-md border px-3 py-2 text-sm font-semibold transition" :class="form.power_status === option.value ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted hover:bg-surface-muted'" @click="setPower(option.value)">{{ option.label }}</button></div></div>
        <div v-if="form.power_status === 'on'" class="mt-5 rounded-lg border border-line bg-surface-muted p-4"><p class="font-semibold text-text">Pruebas rápidas</p><p class="mt-1 text-xs text-muted">Pulsa para cambiar entre funciona, falla y no probado.</p><div class="mt-3 grid gap-2 sm:grid-cols-2"><button v-for="test in testOptions" :key="test.key" type="button" class="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm" @click="cycleTest(test.key)"><span class="text-text">{{ test.label }}</span><span class="rounded px-2 py-0.5 text-xs font-semibold" :class="functionalTests[test.key] === 'passed' ? 'bg-success-soft text-success' : functionalTests[test.key] === 'failed' ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-muted'">{{ functionalTests[test.key] === 'passed' ? 'Funciona' : functionalTests[test.key] === 'failed' ? 'Falla' : 'No probado' }}</span></button></div></div>
        <p v-else-if="form.power_status === 'off'" class="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">Se registrará que no fue posible realizar pruebas funcionales porque el equipo no encendió.</p>
      </section>

      <section v-else>
        <div class="flex items-start gap-3"><Check class="mt-0.5 h-6 w-6 text-success" /><div><h2 class="text-xl font-semibold text-text">Revisa y registra</h2><p class="mt-1 text-sm text-muted">Puedes abrir la orden así o agregar información secundaria.</p></div></div>
        <div class="mt-6 divide-y divide-line rounded-lg border border-line bg-surface-muted px-4">
          <div class="py-4"><p class="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</p><p class="mt-1 font-semibold text-text">{{ selected?.name }}</p></div>
          <div class="py-4"><p class="text-xs font-semibold uppercase tracking-wide text-muted">Equipo</p><p class="mt-1 font-semibold text-text">{{ selectedTypeLabel }} · {{ form.brand }} {{ form.model }}</p><p class="mt-1 text-sm text-muted">{{ form.identifier_not_visible ? 'IMEI / serial no visible' : form.identifier || 'Sin identificador' }} · {{ form.power_status === 'on' ? 'Enciende' : form.power_status === 'off' ? 'No enciende' : 'Encendido no comprobado' }}</p></div>
          <div class="py-4"><p class="text-xs font-semibold uppercase tracking-wide text-muted">Falla reportada</p><p class="mt-1 text-sm text-text">{{ form.reported_fault }}</p></div>
        </div>

        <button type="button" class="mt-4 flex w-full items-center justify-between rounded-md border border-line px-4 py-3 text-left text-sm font-semibold text-text hover:bg-surface-muted" @click="optionalOpen = !optionalOpen"><span class="inline-flex items-center gap-2"><SlidersHorizontal class="h-4 w-4 text-primary" />Agregar detalles opcionales</span><span class="text-muted">{{ optionalOpen ? 'Ocultar' : 'Abrir' }}</span></button>
        <div v-if="optionalOpen" class="mt-4 grid gap-5 rounded-lg border border-line bg-surface p-4">
          <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="form.color" label="Color" /><UiSelect v-model="form.priority" label="Prioridad" :options="priorities" /></div>
          <div><p class="text-sm font-semibold text-text">Condición física</p><div class="mt-2 flex flex-wrap gap-2"><button v-for="condition in conditionOptions" :key="condition.key" type="button" class="rounded-full border px-3 py-1.5 text-sm transition" :class="physicalConditions.includes(condition.key) ? 'border-warning bg-warning-soft text-warning' : 'border-line text-muted hover:bg-surface-muted'" @click="toggleCondition(condition.key)">{{ condition.label }}</button></div><UiTextarea v-model="form.physical_condition" class="mt-3" label="Observación adicional" placeholder="Solo si hace falta agregar algo más" /></div>
          <UiInput v-model="accessoriesText" label="Accesorios recibidos" hint="Separados por coma" />
          <div class="rounded-md border border-line bg-surface-muted p-4"><div class="flex items-center justify-between"><div><p class="font-semibold text-text">Acceso al equipo</p><p class="text-xs text-muted">Código o patrón proporcionado por el cliente.</p></div><UiToggle v-model="form.is_locked" aria-label="Equipo con bloqueo" /></div><div v-if="form.is_locked" class="mt-4"><UiSelect v-model="form.access_type" label="Tipo de acceso" :options="[{value:'code',label:'Código numérico'},{value:'pattern',label:'Patrón Android'}]" /><UiInput v-if="form.access_type === 'code'" v-model="form.access_secret" class="mt-3" label="Código" type="password" inputmode="numeric" /><WorkshopPatternInput v-else v-model="form.access_secret" class="mt-4" /></div></div>
          <div class="grid gap-4 sm:grid-cols-2"><UiSelect model-value="" label="Técnico asignado" :options="[{value:'',label:'Sin asignar'}]" disabled /><p class="self-end rounded-md bg-surface-muted px-3 py-3 text-xs text-muted">Los técnicos se habilitarán desde Usuarios cuando exista el rol correspondiente.</p></div>
          <div class="grid gap-4 rounded-md border border-line bg-surface-muted p-4 sm:grid-cols-2"><UiInput v-model="form.estimated_total" label="Monto estimado" type="number" min="0" step="0.01" /><UiInput v-model="form.advance_amount" label="Anticipo" type="number" min="0" step="0.01" /><UiSelect v-if="form.advance_amount" v-model="form.advance_method" label="Forma de pago" :options="[{value:'cash',label:'Efectivo'},{value:'card',label:'Tarjeta'},{value:'transfer',label:'Transferencia'},{value:'other',label:'Otro'}]" /><UiInput v-if="form.advance_amount" v-model="form.advance_reference" label="Referencia del pago" /><div v-if="form.estimated_total" class="sm:col-span-2 flex items-center justify-between border-t border-line pt-3 text-sm"><span class="text-muted">Saldo pendiente</span><strong class="text-text">${{ balance.toFixed(2) }}</strong></div></div>
        </div>
        <p class="mt-4 inline-flex items-center gap-2 text-sm text-muted"><Camera class="h-4 w-4" />Las fotos se podrán agregar después desde la orden.</p>
      </section>

      <p v-if="validationMessage" class="mt-5 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{{ validationMessage }}</p>
      <div class="mt-7 flex items-center justify-between border-t border-line pt-5"><UiButton v-if="step > 1" type="button" variant="secondary" @click="previous"><ChevronLeft class="mr-2 h-4 w-4" />Atrás</UiButton><span v-else></span><UiButton v-if="step < 3" type="button" @click="next">Siguiente<ChevronRight class="ml-2 h-4 w-4" /></UiButton><UiButton v-else type="submit" :disabled="saving">{{ saving ? 'Registrando…' : 'Registrar equipo' }}</UiButton></div>
    </form>
  </UiCard>
</template>

<style scoped>
.workshop-customer-search :deep(input[type='search']::-webkit-search-cancel-button) {
  display: none;
  appearance: none;
}
</style>
