<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  buildFacturaRequest,
  CoreDteClient,
  type BillingCustomer,
  type BillingContext,
  type BillingEmpresa,
  type BillingItemTemplate,
  type BillingPuntoVenta,
  type BillingSucursal,
  type CorrelativoReservation,
  type DteDraftSummary,
  type DteHistoryEntry,
  type DteIssueResponse,
  type DtePreviewResponse
} from '@stelfaro/api-client';
import { currency, type BillingItem, type DocumentType } from '@stelfaro/shared';
import { UiButton, UiCard, UiInput } from '@stelfaro/ui';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';
import BillingTicketPreview from '../components/BillingTicketPreview.vue';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  initialDocumentType?: DocumentType;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  initialDocumentType: '01'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const contextLoading = ref(false);
const error = ref<string | null>(null);
const context = ref<BillingContext | null>(null);
const correlativoPreview = ref<CorrelativoReservation | null>(null);
const preview = ref<DtePreviewResponse | null>(null);
const draft = ref<DteDraftSummary | null>(null);
const history = ref<DteHistoryEntry[]>([]);
const issuing = ref(false);
const currentStep = ref<'draft' | 'ready' | 'signed' | 'sent' | null>(null);
const issueModalOpen = ref(false);
const issuePhaseIndex = ref(0);
const issueResult = ref<DteIssueResponse | null>(null);
const issueProgress = ref(0);
const issueLog = ref<string[]>([]);
const customers = ref<BillingCustomer[]>([]);
const customerSearch = ref('');
const customerSearchLocked = ref(false);
const selectedCustomerId = ref<number | null>(null);
const itemTemplates = ref<BillingItemTemplate[]>([]);
const itemTemplateSearch = ref('');
const customerModalMode = ref<'new' | 'quick' | null>(null);

type InvoiceLine = BillingItem & {
  id: number;
  discountPercent: number;
};
type CustomerMode = 'generic' | 'base' | 'new' | 'quick';
const customerModes: Array<{ key: CustomerMode; label: string }> = [
  { key: 'generic', label: 'Generico default' },
  { key: 'base', label: 'Cliente base' },
  { key: 'new', label: 'Nuevo cliente' },
  { key: 'quick', label: 'Cliente rapido' },
];

const form = reactive({
  documentType: props.initialDocumentType,
  empresaId: null as number | null,
  sucursalId: null as number | null,
  puntoVentaId: null as number | null,
  customerName: '',
  customerDocumentType: '' as string,
  customerDocument: '',
  customerNrc: '',
  customerActivityCode: '',
  customerActivityDescription: '',
  customerCommercialName: '',
  customerDepartment: '',
  customerMunicipality: '',
  customerAddress: '',
  customerPhone: '',
  customerEmail: '',
  itemDescription: '',
  itemQuantity: 1,
  itemUnitPrice: 0
});
const customerMode = ref<CustomerMode>('generic');
const lines = ref<InvoiceLine[]>([
  { id: 1, description: '', quantity: 1, unitPrice: 0, discount: 0, discountPercent: 0 }
]);
let lineId = 2;

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed<BillingEmpresa | null>(() => empresas.value.find((empresa) => empresa.id === form.empresaId) ?? null);
const sucursales = computed(() => selectedEmpresa.value?.sucursales ?? []);
const selectedSucursal = computed<BillingSucursal | null>(() => sucursales.value.find((sucursal) => sucursal.id === form.sucursalId) ?? null);
const puntosVenta = computed(() => selectedSucursal.value?.puntosVenta ?? []);
const selectedPuntoVenta = computed<BillingPuntoVenta | null>(() => puntosVenta.value.find((punto) => punto.id === form.puntoVentaId) ?? null);
const documentTypes = computed(() => context.value?.documentTypes ?? []);
const availableDocumentTypes = computed(() => {
  const enabled = selectedEmpresa.value?.enabled_document_types ?? [];
  return documentTypes.value.filter((type) => ['01', '03'].includes(type.code) && (enabled.length === 0 || enabled.includes(type.code)));
});
const isCreditoFiscal = computed(() => form.documentType === '03');
const items = computed<BillingItem[]>(() => lines.value
  .map((line) => ({
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    discount: lineDiscountAmount(line)
  }))
  .filter((line) => line.description !== '' && line.quantity > 0 && line.unitPrice >= 0));
const subtotal = computed(() => items.value.reduce((sum, item) => sum + lineGrossTotal(item), 0));
const discountTotal = computed(() => items.value.reduce((sum, item) => sum + lineDiscountAmount(item), 0));
const total = computed(() => items.value.reduce((sum, item) => sum + lineNetTotal(item), 0));
const iva = computed(() => isCreditoFiscal.value ? total.value * 0.13 : 0);
const totalLabel = computed(() => isCreditoFiscal.value ? total.value + iva.value : total.value);
const canBuild = computed(() => Boolean(
  selectedEmpresa.value
  && selectedSucursal.value
  && selectedPuntoVenta.value
  && correlativoPreview.value
  && form.customerName.trim()
  && items.value.length > 0
  && (!isCreditoFiscal.value || canBuildCreditoFiscal.value)
));
const canBuildCreditoFiscal = computed(() => Boolean(
  form.customerDocument.trim()
  && form.customerNrc.trim()
  && form.customerActivityCode.trim()
  && form.customerActivityDescription.trim()
  && form.customerDepartment.trim()
  && form.customerMunicipality.trim()
  && form.customerAddress.trim()
  && form.customerEmail.trim()
));
const issuePhases = computed(() => [
  { label: 'Preparando emision', detail: 'Validando datos fiscales, receptor y detalle.' },
  { label: 'Reservando correlativo', detail: 'Core DTE esta tomando el siguiente numero disponible.' },
  { label: 'Generando DTE', detail: 'Armando JSON normativo con identificacion final.' },
  { label: 'Firmando documento', detail: 'Enviando el DTE al firmador configurado.' },
  { label: 'Transmitiendo a MH', detail: 'Usando bearer activo y recepcion del ambiente seleccionado.' },
  { label: 'Esperando respuesta', detail: 'Registrando resultado y posibles saltos de correlativo.' }
]);
const issueRejected = computed(() => issueResult.value?.document.transmission?.status === 'REJECTED' || issueResult.value?.document.estado === 'rejected');
const issueMhJson = computed(() => JSON.stringify(
  issueResult.value?.document.mh_response
    ?? issueResult.value?.document.transmission?.raw_response
    ?? issueResult.value?.document.transmission
    ?? {},
  null,
  2
));
const issueTransmissionAttempts = computed(() => issueResult.value?.document.transmission_attempts ?? []);
const selectedCustomer = computed(() => customers.value.find((customer) => customer.id === selectedCustomerId.value) ?? null);
const selectedDocumentType = computed(() => availableDocumentTypes.value.find((type) => type.code === form.documentType) ?? null);
const documentLabel = computed(() => `${form.documentType} · ${selectedDocumentType.value?.label ?? 'Factura Electronica'}`);
const customerResults = computed(() => !customerSearchLocked.value && customerSearch.value.trim().length >= 2 ? customers.value : []);
const customerSummary = computed(() => {
  if (customerMode.value === 'generic') return 'Sin documento, telefono ni correo.';
  const details = [
    form.customerDocument ? `${form.customerDocumentType || 'Doc'} ${form.customerDocument}` : null,
    form.customerEmail || null,
    form.customerPhone || null,
  ].filter(Boolean);
  return details.length > 0 ? details.join(' · ') : 'Datos opcionales pendientes.';
});

function lineGrossTotal(line: BillingItem): number {
  return Math.max(0, Number(line.quantity || 0) * Number(line.unitPrice || 0));
}

function lineDiscountAmount(line: BillingItem): number {
  const percent = 'discountPercent' in line ? Math.max(0, Math.min(100, Number(line.discountPercent || 0))) : null;
  const discount = percent === null
    ? Math.max(0, Number(line.discount || 0))
    : lineGrossTotal(line) * percent / 100;

  return Math.round(Math.min(lineGrossTotal(line), discount) * 100) / 100;
}

function lineNetTotal(line: BillingItem): number {
  return Math.max(0, lineGrossTotal(line) - lineDiscountAmount(line));
}

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
  currentStep.value = null;

  if (selectedEmpresa.value && selectedSucursal.value && selectedPuntoVenta.value) {
    void previewNextCorrelativo();
  }
});

watch([
  () => form.empresaId,
  () => form.documentType,
  customerSearch,
], () => {
  void loadCustomers();
});

watch([
  () => form.empresaId,
  itemTemplateSearch,
], () => {
  void loadItemTemplates();
});

watch(() => form.empresaId, () => {
  form.sucursalId = selectedEmpresa.value?.sucursales[0]?.id ?? null;
});

watch(() => form.sucursalId, () => {
  form.puntoVentaId = selectedSucursal.value?.puntosVenta[0]?.id ?? null;
});

watch(() => props.initialDocumentType, (documentType) => {
  if (['01', '03'].includes(documentType)) {
    form.documentType = documentType;
  }
});

async function loadContext(): Promise<void> {
  contextLoading.value = true;
  error.value = null;

  try {
    context.value = await client.value.billingContext();
    form.empresaId = context.value.empresas[0]?.id ?? null;
    form.sucursalId = context.value.empresas[0]?.sucursales[0]?.id ?? null;
    form.puntoVentaId = context.value.empresas[0]?.sucursales[0]?.puntosVenta[0]?.id ?? null;
    setGenericCustomer();
    lines.value = [{ id: 1, description: '', quantity: 1, unitPrice: 0, discount: 0, discountPercent: 0 }];
    lineId = 2;
    await Promise.all([loadCustomers(), loadItemTemplates()]);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el contexto real de facturacion.';
  } finally {
    contextLoading.value = false;
  }
}

watch(customerMode, (mode) => {
  selectedCustomerId.value = null;
  customerSearchLocked.value = false;
  if (mode === 'generic') {
    setGenericCustomer();
  }

  if (mode === 'base') {
    clearCustomerFields('');
    void loadCustomers();
  }
});

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
    currentStep.value = 'draft';
    preview.value = null;
    history.value = [];
  }
}

async function issueDocument(): Promise<void> {
  issuing.value = true;
  error.value = null;
  issueModalOpen.value = true;
  issueResult.value = null;
  issueProgress.value = 5;
  issueLog.value = [];
  issuePhaseIndex.value = 0;

  try {
    const payload = buildPayloadOrNull(correlativoPreview.value ?? {
      correlativo_id: 0,
      correlativo: 1,
      numero_control: '',
      remaining: 0
    });
    if (!payload) {
      error.value = 'Completa emisor, punto de venta, receptor e item antes de emitir.';
      return;
    }

    currentStep.value = 'sent';
    const result = await client.value.issueProgress(payload, (event) => {
      if (event.type === 'stage') {
        issueProgress.value = event.progress;
        issueLog.value = [...issueLog.value.slice(-8), event.message];
        const idx = issuePhases.value.findIndex((phase) => phase.label.toLowerCase().includes(event.stage));
        if (idx >= 0) issuePhaseIndex.value = idx;
        return;
      }

      if (event.type === 'completed') {
        issueProgress.value = event.progress ?? 100;
        issueLog.value = [...issueLog.value.slice(-8), event.message];
      }
    });
    if (result) {
      issueResult.value = result;
      draft.value = result.document;
      correlativoPreview.value = null;
      preview.value = null;
      history.value = [];
      await previewNextCorrelativo();
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible emitir el DTE.';
    issueLog.value = [...issueLog.value.slice(-8), error.value];
  } finally {
    issuing.value = false;
  }
}

function closeIssueModal(): void {
  if (issuing.value) {
    return;
  }

  const shouldResetInvoice = Boolean(issueResult.value);
  issueModalOpen.value = false;
  if (shouldResetInvoice) {
    resetInvoiceForm();
  }
}

function resetInvoiceForm(): void {
  preview.value = null;
  draft.value = null;
  history.value = [];
  currentStep.value = null;
  error.value = null;
  issueResult.value = null;
  issueProgress.value = 0;
  issueLog.value = [];
  issuePhaseIndex.value = 0;
  selectedCustomerId.value = null;
  customerSearch.value = '';
  customerSearchLocked.value = false;
  customers.value = [];
  customerModalMode.value = null;
  itemTemplateSearch.value = '';
  customerMode.value = 'generic';
  setGenericCustomer();
  lines.value = [{ id: 1, description: '', quantity: 1, unitPrice: 0, discount: 0, discountPercent: 0 }];
  lineId = 2;
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
    currentStep.value = result.estado === 'ready_to_sign'
      ? 'ready'
      : result.estado === 'signed'
        ? 'signed'
        : result.estado === 'sent'
          ? 'sent'
          : currentStep.value;
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
    customerNrc: form.customerNrc.trim() === '' ? null : form.customerNrc.trim(),
    customerActivityCode: form.customerActivityCode.trim() === '' ? null : form.customerActivityCode.trim(),
    customerActivityDescription: form.customerActivityDescription.trim() === '' ? null : form.customerActivityDescription.trim(),
    customerCommercialName: form.customerCommercialName.trim() === '' ? null : form.customerCommercialName.trim(),
    customerDepartment: form.customerDepartment.trim() === '' ? null : form.customerDepartment.trim(),
    customerMunicipality: form.customerMunicipality.trim() === '' ? null : form.customerMunicipality.trim(),
    customerAddress: form.customerAddress.trim() === '' ? null : form.customerAddress.trim(),
    customerPhone: form.customerPhone.trim() === '' ? null : form.customerPhone.trim(),
    customerEmail: form.customerEmail.trim() === '' ? null : form.customerEmail.trim(),
    items: items.value
  });
}

function clearCustomerFields(name = ''): void {
  form.customerName = name;
  form.customerDocumentType = '';
  form.customerDocument = '';
  form.customerNrc = '';
  form.customerActivityCode = '';
  form.customerActivityDescription = '';
  form.customerCommercialName = '';
  form.customerDepartment = '';
  form.customerMunicipality = '';
  form.customerAddress = '';
  form.customerPhone = '';
  form.customerEmail = '';
}

function setGenericCustomer(): void {
  clearCustomerFields('Consumidor Final');
}

function selectCustomerMode(mode: CustomerMode): void {
  if (mode === 'new' || mode === 'quick') {
    customerModalMode.value = mode;
    return;
  }

  customerMode.value = mode;
}

function applyQuickCustomer(payload: BillingCustomerModalPayload): void {
  selectedCustomerId.value = null;
  customerMode.value = 'quick';
  form.customerName = payload.name;
  form.customerDocumentType = payload.document_type ?? '';
  form.customerDocument = payload.document_number ?? '';
  form.customerEmail = payload.email ?? '';
  form.customerPhone = payload.phone ?? '';
}

async function handleCustomerModalSave(payload: BillingCustomerModalPayload): Promise<void> {
  if (customerModalMode.value === 'quick') {
    applyQuickCustomer(payload);
    customerModalMode.value = null;
    return;
  }

  if (!selectedEmpresa.value) {
    error.value = 'Selecciona una empresa emisora antes de guardar clientes.';
    return;
  }

  const response = await run(() => client.value.saveCustomer({
    empresa_id: selectedEmpresa.value!.id,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    document_type: payload.document_type,
    document_number: payload.document_number,
    allowed_dte_codes: [form.documentType],
  }));

  if (response) {
    await loadCustomers();
    customerMode.value = 'base';
    applyCustomer(response.customer);
    customerModalMode.value = null;
  }
}

async function loadCustomers(): Promise<void> {
  if (!selectedEmpresa.value) {
    customers.value = [];
    return;
  }

  if (customerSearchLocked.value) {
    customers.value = [];
    return;
  }

  if (customerMode.value === 'base' && customerSearch.value.trim().length < 2) {
    customers.value = [];
    return;
  }

  try {
    const response = await client.value.customers({
      empresa_id: selectedEmpresa.value.id,
      tipo_dte: form.documentType,
      q: customerSearch.value.trim()
    });
    customers.value = response.data;
  } catch {
    customers.value = [];
  }
}

function applyCustomer(customer: BillingCustomer): void {
  selectedCustomerId.value = customer.id;
  customerSearchLocked.value = true;
  form.customerName = customer.name;
  form.customerEmail = customer.email ?? '';
  form.customerPhone = customer.phone ?? '';
  const normalized = normalizeCustomerDocument(customer.document_type ?? (customer.nit ? '36' : ''), customer.nit ?? customer.document_number ?? '');
  form.customerDocumentType = normalized.documentType;
  form.customerDocument = normalized.documentNumber;
  form.customerNrc = onlyDigits(customer.nrc ?? '');
  form.customerActivityCode = customer.cod_actividad ?? '';
  form.customerActivityDescription = customer.desc_actividad ?? '';
  form.customerCommercialName = customer.nombre_comercial ?? customer.name;
  form.customerDepartment = customer.departamento ?? '';
  form.customerMunicipality = customer.municipio ?? '';
  form.customerAddress = customer.direccion_complemento ?? '';
  customerSearch.value = customerSearchLabel(customer);
  customers.value = [];
}

function clearSelectedCustomer(): void {
  selectedCustomerId.value = null;
  customerSearchLocked.value = false;
  customerSearch.value = '';
  customers.value = [];
  clearCustomerFields('');
}

function customerSearchLabel(customer: BillingCustomer): string {
  const normalized = normalizeCustomerDocument(customer.document_type ?? (customer.nit ? '36' : ''), customer.nit ?? customer.document_number ?? '');
  const doc = normalized.documentNumber ? ` · ${normalized.documentType} ${normalized.documentNumber}` : '';

  return `${customer.name}${doc}`;
}

function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

function normalizeCustomerDocument(documentType: string | null | undefined, value: string | null | undefined): { documentType: string; documentNumber: string } {
  const digits = onlyDigits(value);

  if (digits.length === 9) {
    return { documentType: '13', documentNumber: digits };
  }

  if (digits.length === 14) {
    return { documentType: '36', documentNumber: digits };
  }

  return {
    documentType: documentType ?? '',
    documentNumber: digits,
  };
}

async function loadItemTemplates(): Promise<void> {
  if (!selectedEmpresa.value) {
    itemTemplates.value = [];
    return;
  }

  try {
    const response = await client.value.itemTemplates({
      empresa_id: selectedEmpresa.value.id,
      q: itemTemplateSearch.value.trim()
    });
    itemTemplates.value = response.data;
  } catch {
    itemTemplates.value = [];
  }
}

function addTemplateLine(template: BillingItemTemplate): void {
  const next = {
    id: lineId++,
    description: template.description,
    quantity: Number(template.default_quantity || 1),
    unitPrice: Number(template.default_price || 0),
    discount: 0,
    discountPercent: 0
  };
  const emptyIndex = lines.value.findIndex((line) => line.description.trim() === '' && Number(line.unitPrice) === 0);
  if (emptyIndex >= 0) {
    lines.value.splice(emptyIndex, 1, next);
    lines.value = [...lines.value];
    return;
  }
  lines.value = [...lines.value, next];
}

async function saveLineAsTemplate(line: InvoiceLine): Promise<void> {
  if (!selectedEmpresa.value || !line.description.trim()) {
    error.value = 'La linea debe tener descripcion para guardarla como producto rapido.';
    return;
  }

  const response = await run(() => client.value.saveItemTemplate({
    empresa_id: selectedEmpresa.value!.id,
    name: line.description.trim().slice(0, 160),
    description: line.description.trim(),
    default_price: Number(line.unitPrice || 0),
    default_quantity: Number(line.quantity || 1),
    item_type: 1,
    unit_measure: 59,
  }));

  if (response) {
    await loadItemTemplates();
  }
}

function addLine(): void {
  lines.value = [...lines.value, { id: lineId++, description: '', quantity: 1, unitPrice: 0, discount: 0, discountPercent: 0 }];
}

function removeLine(id: number): void {
  if (lines.value.length === 1) {
    lines.value = [{ id: lineId++, description: '', quantity: 1, unitPrice: 0, discount: 0, discountPercent: 0 }];
    return;
  }

  lines.value = lines.value.filter((line) => line.id !== id);
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <BillingCustomerModal
      v-if="customerModalMode"
      :open="Boolean(customerModalMode)"
      :mode="customerModalMode"
      :loading="loading"
      :initial-value="customerModalMode === 'quick' ? {
        name: form.customerName,
        document_number: form.customerDocument,
        email: form.customerEmail,
        phone: form.customerPhone
      } : null"
      @close="customerModalMode = null"
      @save="handleCustomerModalSave"
    />

    <div v-if="issueModalOpen" class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-6">
      <div class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div class="border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Emision DTE</p>
              <h2 class="mt-1 text-xl font-bold text-slate-950">
                {{ issuing ? 'Emitiendo factura real' : issueRejected ? 'Documento rechazado por MH' : issueResult ? 'Emision procesada' : 'Emision detenida' }}
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Ambiente {{ selectedEmpresa?.ambiente ?? '00' }} · {{ selectedEmpresa?.nombre_comercial ?? 'Empresa emisora' }}
              </p>
            </div>
            <button
              class="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="issuing"
              type="button"
              @click="closeIssueModal"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div class="min-h-0 overflow-y-auto px-6 py-5">
          <div class="flex items-center gap-4 rounded-md border border-sky-100 bg-sky-50 p-4">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white">
              <span v-if="issuing" class="h-4 w-4 animate-ping rounded-full bg-sky-500"></span>
              <span v-else-if="issueRejected" class="h-4 w-4 rounded-full bg-red-500"></span>
              <span v-else-if="issueResult" class="h-4 w-4 rounded-full bg-emerald-500"></span>
              <span v-else class="h-4 w-4 rounded-full bg-red-500"></span>
            </div>
            <div>
              <p class="font-semibold text-slate-950">
                {{ issuing ? issuePhases[issuePhaseIndex].label : issueRejected ? 'MH rechazo el documento' : issueResult ? 'Documento transmitido' : 'No fue posible emitir' }}
              </p>
              <p class="mt-1 text-sm text-slate-600">
                {{ issuing ? issuePhases[issuePhaseIndex].detail : issueRejected ? issueResult?.document.transmission?.descripcion_msg : issueResult ? issueResult.document.numeroControl : error }}
              </p>
            </div>
          </div>

          <div class="mt-4">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Progreso real backend</span>
              <span>{{ issueProgress }}%</span>
            </div>
            <div class="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-sky-600 transition-all"
                :class="issuing ? 'animate-pulse' : issueRejected ? 'bg-red-500' : issueResult ? 'bg-emerald-500' : ''"
                :style="{ width: `${issueProgress}%` }"
              ></div>
            </div>
            <div v-if="issueLog.length" class="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold uppercase text-slate-500">Eventos</p>
              <ul class="mt-2 space-y-1 text-sm text-slate-600">
                <li v-for="(entry, index) in issueLog" :key="`${entry}-${index}`">{{ entry }}</li>
              </ul>
            </div>
          </div>

          <ol class="mt-5 grid gap-3 md:grid-cols-2">
            <li
              v-for="(phase, index) in issuePhases"
              :key="phase.label"
              class="flex gap-3 rounded-md border px-3 py-2"
              :class="index <= issuePhaseIndex || issueResult ? 'border-sky-100 bg-sky-50/60' : 'border-slate-200 bg-white'"
            >
              <span
                class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                :class="index <= issuePhaseIndex || issueResult ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'"
              >
                {{ index + 1 }}
              </span>
              <span>
                <span class="block text-sm font-semibold text-slate-900">{{ phase.label }}</span>
                <span class="block text-xs text-slate-500">{{ phase.detail }}</span>
              </span>
            </li>
          </ol>

          <div v-if="issueResult" class="mt-5 rounded-md border p-4" :class="issueRejected ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'">
            <p class="text-sm font-semibold" :class="issueRejected ? 'text-red-900' : 'text-emerald-900'">Resultado MH/Core</p>
            <p class="mt-1 font-mono text-sm" :class="issueRejected ? 'text-red-950' : 'text-emerald-950'">{{ issueResult.document.numeroControl }}</p>
            <p class="mt-1 text-sm" :class="issueRejected ? 'text-red-800' : 'text-emerald-800'">Documento #{{ issueResult.document.id }} · Estado {{ issueResult.document.estado }}</p>
            <p class="mt-1 text-sm" :class="issueRejected ? 'text-red-800' : 'text-emerald-800'">
              HTTP {{ issueResult.document.transmission?.http_status ?? 'N/D' }} · MH {{ issueResult.document.transmission?.mh_estado ?? issueResult.document.transmission?.status ?? 'sin estado' }}
            </p>
            <p v-if="issueRejected" class="mt-2 text-sm text-red-800">
              {{ issueResult.document.transmission?.descripcion_msg }}
            </p>
            <ul v-if="issueRejected && issueResult.document.transmission?.observaciones?.length" class="mt-2 list-disc pl-5 text-sm text-red-800">
              <li v-for="observation in issueResult.document.transmission.observaciones" :key="observation">{{ observation }}</li>
            </ul>
            <div v-if="issueResult.attempts.length > 1" class="mt-3 rounded-md bg-white/70 p-3 text-xs" :class="issueRejected ? 'text-red-900' : 'text-emerald-900'">
              Se resolvio con {{ issueResult.attempts.length }} intentos de correlativo.
            </div>
          </div>

          <div v-if="issueResult" class="mt-5 rounded-md border border-slate-200 bg-white p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm font-semibold text-slate-950">Respuestas MH guardadas</p>
              <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {{ issueTransmissionAttempts.length }} intento{{ issueTransmissionAttempts.length === 1 ? '' : 's' }}
              </span>
            </div>

            <div v-if="issueTransmissionAttempts.length" class="mt-3 overflow-hidden rounded-md border border-slate-200">
              <div
                v-for="attempt in issueTransmissionAttempts"
                :key="attempt.id"
                class="border-b border-slate-200 p-3 text-sm last:border-b-0"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-semibold text-slate-900">
                    Intento {{ attempt.attempt_number }} · {{ attempt.result_status ?? 'sin resultado' }}
                  </p>
                  <p class="text-xs text-slate-500">
                    HTTP {{ attempt.http_status ?? 'N/D' }} · {{ attempt.duration_ms ?? 0 }} ms
                  </p>
                </div>
                <p class="mt-1 break-all text-xs text-slate-500">{{ attempt.endpoint }}</p>
                <p v-if="attempt.error_message" class="mt-2 text-sm text-red-700">{{ attempt.error_message }}</p>
              </div>
            </div>

            <pre class="mt-4 max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{{ issueMhJson }}</pre>
          </div>

          <div v-else-if="error && !issuing" class="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {{ error }}
          </div>
        </div>
      </div>
    </div>

    <UiCard>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Billing transversal real</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-950">Nueva factura</h1>
          <p class="mt-1 text-sm text-slate-500">Emite usando empresas configuradas, correlativos, firma y bearer del Core DTE.</p>
        </div>
        <div class="rounded-md bg-slate-100 px-3 py-2 text-right">
          <p class="text-xs text-slate-500">Total neto</p>
          <p class="font-bold text-slate-950">{{ currency(totalLabel) }}</p>
          <p v-if="discountTotal > 0" class="mt-1 text-[11px] text-slate-500">Subtotal {{ currency(subtotal) }}</p>
          <p v-if="discountTotal > 0" class="mt-1 text-[11px] text-emerald-700">Descuento {{ currency(discountTotal) }}</p>
        </div>
      </div>

      <div v-if="contextLoading" class="mt-6 text-sm text-slate-500">Cargando contexto real...</div>
      <div v-else-if="empresas.length === 0" class="mt-6 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
        No hay empresas configuradas en Core DTE. Billing real necesita empresa, sucursal, punto de venta y correlativos activos.
      </div>

      <div v-else class="mt-6 grid gap-6">
        <section class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Emisor activo</p>
              <p class="mt-1 truncate text-sm font-bold text-slate-950">{{ selectedEmpresa?.razon_social }}</p>
              <p class="mt-1 truncate text-xs text-slate-500">
                {{ selectedEmpresa?.ambiente === '01' ? 'Produccion' : 'Pruebas' }} ·
                {{ documentLabel }} ·
                {{ selectedSucursal?.codigo }} {{ selectedSucursal?.nombre }} ·
                {{ selectedPuntoVenta?.codigo }} {{ selectedPuntoVenta?.nombre }}
              </p>
            </div>
            <div class="text-right">
              <span
                class="rounded px-2 py-1 text-xs font-semibold"
                :class="correlativoPreview ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
              >
                {{ correlativoPreview ? 'Correlativo activo' : 'Sin correlativo' }}
              </span>
              <p v-if="correlativoPreview" class="mt-2 max-w-[320px] truncate font-mono text-[11px] text-slate-500">
                {{ correlativoPreview.numero_control }}
              </p>
            </div>
          </div>

          <p v-if="correlativoPreview" class="mt-2 text-xs text-slate-500">
            Disponibles despues de este: {{ correlativoPreview.remaining }}
          </p>
          <p v-else class="mt-2 text-sm text-red-700">No hay correlativo activo para esta combinacion.</p>
        </section>

        <section class="rounded-md border border-slate-200 bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-950">Receptor</h2>
              <p class="mt-1 text-xs text-slate-500">{{ isCreditoFiscal ? 'CCF requiere NIT, NRC, actividad y direccion.' : 'Factura consumidor final permite receptor simple.' }}</p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="mode in customerModes"
              :key="mode.key"
              class="rounded-full border px-3 py-1.5 text-sm font-semibold transition"
              :class="customerMode === mode.key ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50'"
              type="button"
              @click="selectCustomerMode(mode.key)"
            >
              {{ mode.label }}
            </button>
          </div>

          <div v-if="customerMode === 'generic' || customerMode === 'quick' || customerMode === 'new'" class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-950">{{ form.customerName || 'Consumidor Final' }}</p>
                <p class="mt-1 text-sm text-slate-600">{{ customerSummary }}</p>
              </div>
              <UiButton v-if="customerMode === 'quick'" variant="secondary" type="button" @click="customerModalMode = 'quick'">Editar rapido</UiButton>
            </div>
          </div>

          <div v-else-if="customerMode === 'base'" class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">Buscar cliente guardado</span>
              <span class="relative mt-1 block">
                <input
                  v-model="customerSearch"
                  class="w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  :class="selectedCustomer ? 'font-semibold text-slate-950' : 'text-slate-900'"
                  placeholder="DUI, NIT, nombre, correo o telefono"
                  type="text"
                  @input="customerSearchLocked = false; selectedCustomerId = null"
                >
                <button
                  v-if="selectedCustomer || customerSearch"
                  class="absolute inset-y-1 right-1 grid w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                  type="button"
                  aria-label="Quitar cliente seleccionado"
                  @click="clearSelectedCustomer"
                >
                  x
                </button>
              </span>
            </label>

            <div v-if="customerResults.length" class="mt-3 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
              <button
                v-for="customer in customerResults"
                :key="customer.id"
                class="block w-full px-4 py-3 text-left transition hover:bg-sky-50"
                :class="selectedCustomerId === customer.id ? 'bg-sky-50' : ''"
                type="button"
                @click="applyCustomer(customer)"
              >
                <span class="block font-semibold text-slate-950">{{ customer.name }}</span>
                <span class="mt-1 block text-xs text-slate-500">
                  {{ customer.document_type ?? 'Doc' }} {{ customer.nit ?? customer.document_number ?? 'sin documento' }}
                  <span v-if="customer.email"> · {{ customer.email }}</span>
                  <span v-if="customer.phone"> · {{ customer.phone }}</span>
                </span>
              </button>
            </div>
            <p v-else class="mt-3 text-xs text-slate-500">
              {{ selectedCustomer ? customerSummary : customerSearch.trim().length < 2 ? 'Escribe al menos 2 caracteres para buscar.' : 'Sin clientes encontrados para esa busqueda.' }}
            </p>
          </div>

          <template v-if="isCreditoFiscal">
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <UiInput v-model="form.customerNrc" label="NRC receptor" />
              <UiInput v-model="form.customerCommercialName" label="Nombre comercial receptor" />
              <UiInput v-model="form.customerActivityCode" label="Codigo actividad receptor" />
              <UiInput v-model="form.customerActivityDescription" label="Actividad receptor" />
              <UiInput v-model="form.customerDepartment" label="Departamento receptor" />
              <UiInput v-model="form.customerMunicipality" label="Municipio receptor" />
              <UiInput v-model="form.customerAddress" label="Direccion receptor" />
            </div>
          </template>
        </section>

        <section class="rounded-md border border-slate-200 bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-950">Detalle</h2>
              <p class="mt-1 text-xs text-slate-500">Agrega productos o servicios. El core calcula normativa y valida schema.</p>
            </div>
            <UiButton variant="secondary" @click="addLine">Agregar linea</UiButton>
          </div>

          <div class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div class="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <UiInput v-model="itemTemplateSearch" label="Productos rapidos" placeholder="Buscar producto o servicio" />
              <div class="flex flex-wrap content-end gap-2">
                <button
                  v-for="template in itemTemplates.slice(0, 8)"
                  :key="template.id"
                  class="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs hover:border-sky-300 hover:bg-sky-50"
                  type="button"
                  @click="addTemplateLine(template)"
                >
                  <span class="block font-semibold text-slate-950">{{ template.name }}</span>
                  <span class="block text-slate-500">{{ currency(template.default_price) }}</span>
                </button>
                <span v-if="itemTemplates.length === 0" class="self-end text-sm text-slate-500">Sin productos rapidos guardados.</span>
              </div>
            </div>
          </div>

          <div class="mt-4 overflow-hidden rounded-md border border-slate-200">
            <table class="w-full min-w-[780px] text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="px-3 py-2">Descripcion</th>
                  <th class="w-28 px-3 py-2">Cantidad</th>
                  <th class="w-36 px-3 py-2">Precio</th>
                  <th class="w-36 px-3 py-2">% desc.</th>
                  <th class="w-32 px-3 py-2 text-right">Neto</th>
                  <th class="w-32 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="line in lines" :key="line.id">
                  <td class="px-3 py-2">
                    <input v-model="line.description" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Producto o servicio">
                  </td>
                  <td class="px-3 py-2">
                    <input v-model.number="line.quantity" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" min="0.01" step="0.01" type="number">
                  </td>
                  <td class="px-3 py-2">
                    <input v-model.number="line.unitPrice" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" min="0" step="0.01" type="number">
                  </td>
                  <td class="px-3 py-2">
                    <input v-model.number="line.discountPercent" class="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" max="100" min="0" step="0.01" type="number">
                    <p v-if="lineDiscountAmount(line) > 0" class="mt-1 text-[11px] text-slate-500">-{{ currency(lineDiscountAmount(line)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <p class="font-semibold text-slate-900">{{ currency(lineNetTotal(line)) }}</p>
                    <p v-if="lineDiscountAmount(line) > 0" class="text-[11px] text-slate-500">Bruto {{ currency(lineGrossTotal(line)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button class="rounded px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50" type="button" @click="saveLineAsTemplate(line)">Guardar</button>
                    <button class="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-700" type="button" @click="removeLine(line.id)">Quitar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="flex flex-wrap gap-3">
          <UiButton :disabled="loading || !canBuild" @click="previewDocument">Validar</UiButton>
          <UiButton variant="secondary" :disabled="loading || !canBuild" @click="createDraft">Crear draft</UiButton>
          <UiButton :disabled="loading || issuing || !canBuild" @click="issueDocument">
            {{ issuing ? 'Emitiendo...' : 'Emitir ahora' }}
          </UiButton>
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
          <UiButton variant="secondary" :disabled="loading" @click="transition('ready')">Preparar</UiButton>
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

    <aside class="content-start">
      <BillingTicketPreview
        :empresa="selectedEmpresa"
        :sucursal="selectedSucursal"
        :punto-venta="selectedPuntoVenta"
        :document-label="documentLabel"
        :correlativo="correlativoPreview"
        :customer-name="form.customerName"
        :customer-document-type="form.customerDocumentType || null"
        :customer-document="form.customerDocument || null"
        :customer-email="form.customerEmail || null"
        :customer-phone="form.customerPhone || null"
        :items="items"
        :total="total"
        :iva="iva"
        :total-label="totalLabel"
        :preview="preview"
        :draft="draft"
      />
    </aside>
  </div>
</template>
