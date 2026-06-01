<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  buildFacturaRequest,
  CoreDteClient,
  type BillingContext,
  type BillingEmpresa,
  type BillingPuntoVenta,
  type BillingSucursal,
  type CorrelativoReservation,
  type DteDraftSummary,
  type DteHistoryEntry,
  type DtePreviewResponse
} from '@stelfaro/api-client';
import { currency, type BillingItem, type DocumentType } from '@stelfaro/shared';
import { UiButton, UiCard, UiInput, UiTextarea } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
}>(), {
  coreBaseUrl: '/api/v1'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl));
const loading = ref(false);
const contextLoading = ref(false);
const error = ref<string | null>(null);
const context = ref<BillingContext | null>(null);
const correlativoPreview = ref<CorrelativoReservation | null>(null);
const preview = ref<DtePreviewResponse | null>(null);
const draft = ref<DteDraftSummary | null>(null);
const history = ref<DteHistoryEntry[]>([]);

const form = reactive({
  documentType: '01' as DocumentType,
  empresaId: null as number | null,
  sucursalId: null as number | null,
  puntoVentaId: null as number | null,
  customerName: '',
  customerDocumentType: '' as string,
  customerDocument: '',
  customerEmail: '',
  itemDescription: '',
  itemQuantity: 1,
  itemUnitPrice: 0
});

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed<BillingEmpresa | null>(() => empresas.value.find((empresa) => empresa.id === form.empresaId) ?? null);
const sucursales = computed(() => selectedEmpresa.value?.sucursales ?? []);
const selectedSucursal = computed<BillingSucursal | null>(() => sucursales.value.find((sucursal) => sucursal.id === form.sucursalId) ?? null);
const puntosVenta = computed(() => selectedSucursal.value?.puntosVenta ?? []);
const selectedPuntoVenta = computed<BillingPuntoVenta | null>(() => puntosVenta.value.find((punto) => punto.id === form.puntoVentaId) ?? null);
const documentTypes = computed(() => context.value?.documentTypes ?? []);
const receptorDocumentTypes = computed(() => context.value?.receptorDocumentTypes ?? []);
const items = computed<BillingItem[]>(() => [
  {
    description: form.itemDescription,
    quantity: Number(form.itemQuantity),
    unitPrice: Number(form.itemUnitPrice)
  }
]);
const total = computed(() => items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
const canBuild = computed(() => Boolean(
  selectedEmpresa.value
  && selectedSucursal.value
  && selectedPuntoVenta.value
  && correlativoPreview.value
  && form.customerName.trim()
  && form.itemDescription.trim()
  && Number(form.itemQuantity) > 0
  && Number(form.itemUnitPrice) >= 0
));
const previewJson = computed(() => JSON.stringify(preview.value?.payload ?? buildPayloadOrNull() ?? {}, null, 2));

onMounted(() => {
  void loadContext();
});

watch([
  () => form.documentType,
  () => form.empresaId,
  () => form.sucursalId,
  () => form.puntoVentaId
], () => {
  correlativoPreview.value = null;
  preview.value = null;
  draft.value = null;
  history.value = [];

  if (selectedEmpresa.value && selectedSucursal.value && selectedPuntoVenta.value) {
    void previewNextCorrelativo();
  }
});

watch(() => form.empresaId, () => {
  form.sucursalId = selectedEmpresa.value?.sucursales[0]?.id ?? null;
});

watch(() => form.sucursalId, () => {
  form.puntoVentaId = selectedSucursal.value?.puntosVenta[0]?.id ?? null;
});

async function loadContext(): Promise<void> {
  contextLoading.value = true;
  error.value = null;

  try {
    context.value = await client.value.billingContext();
    form.empresaId = context.value.empresas[0]?.id ?? null;
    form.sucursalId = context.value.empresas[0]?.sucursales[0]?.id ?? null;
    form.puntoVentaId = context.value.empresas[0]?.sucursales[0]?.puntosVenta[0]?.id ?? null;
    form.customerName = 'Consumidor Final';
    form.customerDocumentType = '';
    form.customerDocument = '';
    form.customerEmail = '';
    form.itemDescription = '';
    form.itemUnitPrice = 0;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el contexto real de facturacion.';
  } finally {
    contextLoading.value = false;
  }
}

async function run<T>(task: () => Promise<T>): Promise<T | null> {
  loading.value = true;
  error.value = null;

  try {
    return await task();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Error inesperado';
    return null;
  } finally {
    loading.value = false;
  }
}

async function previewNextCorrelativo(): Promise<void> {
  const scope = correlativoScope();
  if (!scope) {
    return;
  }

  const result = await run(() => client.value.previewCorrelativo(scope));
  if (result) {
    correlativoPreview.value = result;
  }
}

async function previewDocument(): Promise<void> {
  const payload = buildPayloadOrNull();
  if (!payload) {
    error.value = 'Completa emisor, punto de venta, correlativo, receptor e item antes de previsualizar.';
    return;
  }

  const result = await run(() => client.value.preview(payload));
  if (result) {
    preview.value = result;
  }
}

async function createDraft(): Promise<void> {
  const scope = correlativoScope();
  if (!scope) {
    error.value = 'Selecciona empresa, sucursal y punto de venta antes de crear el draft.';
    return;
  }

  const reservation = await run(() => client.value.reserveCorrelativo(scope));
  if (!reservation) {
    return;
  }

  correlativoPreview.value = reservation;
  const payload = buildPayloadOrNull(reservation);
  if (!payload) {
    error.value = 'No fue posible construir el payload DTE con el correlativo reservado.';
    return;
  }

  const result = await run(() => client.value.createDraft(payload));
  if (result) {
    draft.value = result;
    preview.value = null;
    history.value = [];
  }
}

async function transition(action: 'ready' | 'sign' | 'send' | 'receive'): Promise<void> {
  if (!draft.value) {
    return;
  }

  const id = draft.value.id;
  const result = await run(() => {
    if (action === 'ready') return client.value.readyToSign(id);
    if (action === 'sign') return client.value.signDraft(id);
    if (action === 'send') return client.value.sendDraft(id);
    return client.value.receiveDraft(id);
  });

  if (result) {
    draft.value = result;
    await loadHistory();
  }
}

async function loadHistory(): Promise<void> {
  if (!draft.value) {
    return;
  }

  const result = await run(() => client.value.history(draft.value!.id));
  if (result) {
    history.value = result;
  }
}

function correlativoScope() {
  if (!selectedEmpresa.value || !selectedSucursal.value || !selectedPuntoVenta.value) {
    return null;
  }

  return {
    empresa_id: selectedEmpresa.value.id,
    sucursal_id: selectedSucursal.value.id,
    punto_venta_id: selectedPuntoVenta.value.id,
    ambiente: selectedEmpresa.value.ambiente,
    tipo_dte: form.documentType
  };
}

function buildPayloadOrNull(reservation: CorrelativoReservation | null = correlativoPreview.value) {
  if (!selectedEmpresa.value || !selectedSucursal.value || !selectedPuntoVenta.value || !reservation) {
    return null;
  }

  return buildFacturaRequest({
    documentType: form.documentType,
    empresa: selectedEmpresa.value,
    sucursal: selectedSucursal.value,
    puntoVenta: selectedPuntoVenta.value,
    correlativo: reservation.correlativo,
    customerName: form.customerName,
    customerDocumentType: form.customerDocumentType === '' ? null : form.customerDocumentType,
    customerDocument: form.customerDocument.trim() === '' ? null : form.customerDocument.trim(),
    customerEmail: form.customerEmail.trim() === '' ? null : form.customerEmail.trim(),
    items: items.value
  });
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <UiCard>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Billing transversal real</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-950">Emision DTE</h1>
          <p class="mt-1 text-sm text-slate-500">Usa contexto, schemas, catalogos y correlativos del Core DTE.</p>
        </div>
        <div class="rounded-md bg-slate-100 px-3 py-2 text-right">
          <p class="text-xs text-slate-500">Total</p>
          <p class="font-bold text-slate-950">{{ currency(total) }}</p>
        </div>
      </div>

      <div v-if="contextLoading" class="mt-6 text-sm text-slate-500">Cargando contexto real...</div>
      <div v-else-if="empresas.length === 0" class="mt-6 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
        No hay empresas configuradas en Core DTE. Billing real necesita empresa, sucursal, punto de venta y correlativos activos.
      </div>

      <div v-else class="mt-6 grid gap-5">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block">
            <span class="text-sm font-medium text-slate-700">Empresa emisora</span>
            <select v-model.number="form.empresaId" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">
                {{ empresa.razon_social }} · {{ empresa.ambiente }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Tipo DTE</span>
            <select v-model="form.documentType" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option v-for="type in documentTypes" :key="type.code" :value="type.code">
                {{ type.code }} · {{ type.label }} v{{ type.version }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Sucursal</span>
            <select v-model.number="form.sucursalId" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option v-for="sucursal in sucursales" :key="sucursal.id" :value="sucursal.id">
                {{ sucursal.codigo }} · {{ sucursal.nombre }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Punto de venta</span>
            <select v-model.number="form.puntoVentaId" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option v-for="punto in puntosVenta" :key="punto.id" :value="punto.id">
                {{ punto.codigo }} · {{ punto.nombre }}
              </option>
            </select>
          </label>
        </div>

        <div class="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p class="text-sm font-semibold text-slate-900">Correlativo real</p>
          <p v-if="correlativoPreview" class="mt-1 text-sm text-slate-600">
            Proximo: <strong>{{ correlativoPreview.numero_control }}</strong>
            <span class="ml-2 text-xs text-slate-500">Disponibles despues de este: {{ correlativoPreview.remaining }}</span>
          </p>
          <p v-else class="mt-1 text-sm text-red-700">No hay correlativo activo para esta combinacion.</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UiInput v-model="form.customerName" label="Nombre receptor" />
          <label class="block">
            <span class="text-sm font-medium text-slate-700">Tipo documento receptor</span>
            <select v-model="form.customerDocumentType" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Sin documento (null permitido por schema FE)</option>
              <option v-for="doc in receptorDocumentTypes" :key="doc.code" :value="doc.code">
                {{ doc.code }} · {{ doc.label }}
              </option>
            </select>
          </label>
          <UiInput v-model="form.customerDocument" label="Numero documento receptor" />
          <UiInput v-model="form.customerEmail" label="Correo receptor" />
          <UiInput v-model="form.itemDescription" label="Servicio o producto" />
          <UiInput v-model="form.itemQuantity" label="Cantidad" type="number" />
          <UiInput v-model="form.itemUnitPrice" label="Precio unitario" type="number" />
        </div>

        <div class="flex flex-wrap gap-3">
          <UiButton :disabled="loading || !canBuild" @click="previewDocument">Validar preview</UiButton>
          <UiButton variant="secondary" :disabled="loading || !canBuild" @click="createDraft">Reservar correlativo y crear draft</UiButton>
        </div>
      </div>

      <div v-if="draft" class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm text-slate-500">Draft #{{ draft.id }}</p>
            <p class="font-semibold text-slate-950">{{ draft.numeroControl }}</p>
          </div>
          <span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">{{ draft.estado }}</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <UiButton variant="secondary" :disabled="loading" @click="transition('ready')">Ready</UiButton>
          <UiButton variant="secondary" :disabled="loading" @click="transition('sign')">Firmar</UiButton>
          <UiButton variant="secondary" :disabled="loading" @click="transition('send')">Transmitir</UiButton>
          <UiButton variant="secondary" :disabled="loading" @click="transition('receive')">Aceptar sandbox</UiButton>
          <UiButton variant="ghost" :disabled="loading" @click="loadHistory">Historial</UiButton>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          Si Core DTE esta en provider <strong>mh</strong>, transmitir usa MH real. Si esta en <strong>stub</strong>, solo simula salida.
        </p>
      </div>

      <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>

    <div class="grid gap-6">
      <UiCard>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold text-slate-950">JSON DTE</h2>
          <span v-if="preview" class="rounded-full px-3 py-1 text-xs font-semibold" :class="preview.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">
            {{ preview.valid ? 'Valido' : 'Invalido' }}
          </span>
        </div>
        <UiTextarea label="Payload" :model-value="previewJson" :rows="18" readonly />
      </UiCard>

      <UiCard>
        <h2 class="font-semibold text-slate-950">Historial</h2>
        <div v-if="history.length === 0" class="mt-3 text-sm text-slate-500">Sin eventos cargados todavia.</div>
        <ol v-else class="mt-4 space-y-3">
          <li v-for="entry in history" :key="`${entry.event}-${entry.created_at}`" class="rounded-md border border-slate-200 p-3">
            <p class="font-medium text-slate-900">{{ entry.event }}</p>
            <p class="text-xs text-slate-500">{{ entry.created_at }}</p>
          </li>
        </ol>
      </UiCard>
    </div>
  </div>
</template>
