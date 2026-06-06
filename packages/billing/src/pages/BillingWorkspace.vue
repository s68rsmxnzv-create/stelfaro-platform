<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  buildFacturaRequest,
  type BillingCatalogs,
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
import { UiButton, UiCard, UiInput, UiLoadingMark } from '@stelfaro/ui';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';
import BillingFiscalCustomerModal, { type BillingFiscalCustomerModalPayload } from '../components/BillingFiscalCustomerModal.vue';
import BillingFiscalOptions from '../components/BillingFiscalOptions.vue';
import BillingCustomerSearchModal from '../components/BillingCustomerSearchModal.vue';
import BillingInvoiceSummaryBar from '../components/BillingInvoiceSummaryBar.vue';

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
const catalogs = ref<BillingCatalogs | null>(null);
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
type IssueLogEntry = {
  message: string;
  status: 'ok' | 'error';
};
const issueLog = ref<IssueLogEntry[]>([]);
const customers = ref<BillingCustomer[]>([]);
const customerSearch = ref('');
const customerSearchLocked = ref(false);
const selectedCustomerId = ref<number | null>(null);
const selectedCustomerRecord = ref<BillingCustomer | null>(null);
const itemTemplates = ref<BillingItemTemplate[]>([]);
const itemTemplateSearch = ref('');
const customerModalMode = ref<'new' | 'quick' | null>(null);
const fiscalCustomerModalOpen = ref(false);
const customerSearchModalOpen = ref(false);
const fiscalModalDepartamento = ref('');
const fiscalModalMunicipio = ref('');
const ccfPriceIncludesIva = ref(true);
const ccfRetainIva10 = ref(false);
let issueAutoCloseTimer: ReturnType<typeof window.setTimeout> | null = null;

type InvoiceLine = BillingItem & {
  id: number;
  discountPercent: number;
};
type CustomerMode = 'generic' | 'base' | 'new' | 'quick' | 'fiscal_new';
const simpleCustomerModes: Array<{ key: CustomerMode; label: string }> = [
  { key: 'generic', label: 'Generico default' },
  { key: 'base', label: 'Cliente base' },
  { key: 'new', label: 'Nuevo cliente' },
  { key: 'quick', label: 'Cliente rapido' },
];
const fiscalCustomerModes: Array<{ key: CustomerMode; label: string }> = [
  { key: 'base', label: 'Cliente fiscal guardado' },
  { key: 'fiscal_new', label: 'Nuevo cliente fiscal' },
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
  customerDistrict: '',
  customerAddress: '',
  customerPhone: '',
  customerEmail: '',
  itemDescription: '',
  itemQuantity: 1,
  itemUnitPrice: 0
});
const customerMode = ref<CustomerMode>('generic');
let lineId = 1;
const draftLine = ref<InvoiceLine>(newInvoiceLine());
const lines = ref<InvoiceLine[]>([]);

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed<BillingEmpresa | null>(() => empresas.value.find((empresa) => empresa.id === form.empresaId) ?? null);
const sucursales = computed(() => selectedEmpresa.value?.sucursales ?? []);
const selectedSucursal = computed<BillingSucursal | null>(() => sucursales.value.find((sucursal) => sucursal.id === form.sucursalId) ?? null);
const puntosVenta = computed(() => selectedSucursal.value?.puntosVenta ?? []);
const selectedPuntoVenta = computed<BillingPuntoVenta | null>(() => puntosVenta.value.find((punto) => punto.id === form.puntoVentaId) ?? null);
const documentTypes = computed(() => context.value?.documentTypes ?? []);
const departamentos = computed(() => catalogs.value?.departamentos ?? []);
const municipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(fiscalModalDepartamento.value)));
const distritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(fiscalModalDepartamento.value)
  && String(item.municipio) === String(fiscalModalMunicipio.value)
)));
const actividadesEconomicas = computed(() => catalogs.value?.actividadesEconomicas ?? []);
const departamentoOptions = computed(() => departamentos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const municipioOptions = computed(() => municipios.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const distritoOptions = computed(() => distritos.value.map((item) => {
  const code = item.code.replace(/\D+/g, '').padStart(2, '0');

  return { value: code, label: item.label, hint: code };
}));
const actividadOptions = computed(() => actividadesEconomicas.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const availableDocumentTypes = computed(() => {
  const enabled = selectedEmpresa.value?.enabled_document_types ?? [];
  return documentTypes.value.filter((type) => ['01', '03'].includes(type.code) && (enabled.length === 0 || enabled.includes(type.code)));
});
const isCreditoFiscal = computed(() => form.documentType === '03');
const customerModes = computed(() => isCreditoFiscal.value ? fiscalCustomerModes : simpleCustomerModes);
const items = computed<BillingItem[]>(() => lines.value
  .map((line) => ({
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    discount: lineDiscountAmount(line),
    priceIncludesIva: isCreditoFiscal.value ? ccfPriceIncludesIva.value : false
  }))
  .filter((line) => line.description !== '' && line.quantity > 0 && line.unitPrice >= 0));
const subtotal = computed(() => items.value.reduce((sum, item) => sum + lineGrossTotal(item), 0));
const discountTotal = computed(() => items.value.reduce((sum, item) => sum + lineDiscountAmount(item), 0));
const total = computed(() => items.value.reduce((sum, item) => sum + lineNetTotal(item), 0));
const iva = computed(() => isCreditoFiscal.value ? items.value.reduce((sum, item) => sum + lineIvaAmount(item), 0) : 0);
const taxableBase = computed(() => isCreditoFiscal.value ? items.value.reduce((sum, item) => sum + lineTaxableBase(item), 0) : 0);
const ivaRetention = computed(() => isCreditoFiscal.value && ccfRetainIva10.value ? roundMoney(taxableBase.value * 0.01) : 0);
const totalLabel = computed(() => {
  if (!isCreditoFiscal.value) return total.value;

  const totalWithIva = ccfPriceIncludesIva.value ? total.value : total.value + iva.value;

  return roundMoney(Math.max(0, totalWithIva - ivaRetention.value));
});
const unitCount = computed(() => items.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
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
  && form.customerDistrict.trim()
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
const issueTransmissionAttempts = computed(() => issueResult.value?.document.transmission_attempts ?? []);
const issueAttemptCount = computed(() => Math.max(
  issueResult.value?.attempts.length ?? 0,
  issueTransmissionAttempts.value.length
));
const pushIssueLog = (message: string, status: IssueLogEntry['status'] = 'ok'): void => {
  issueLog.value = [...issueLog.value.slice(-8), { message, status }];
};
const selectedCustomer = computed(() => selectedCustomerRecord.value);
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
const customerDocumentTypeLabel = computed(() => {
  if (isCreditoFiscal.value && form.customerDocument) return form.customerDocument.length === 9 ? 'NIT / DUI homologado' : 'NIT';
  if (form.customerDocumentType === '36') return 'NIT';
  if (form.customerDocumentType === '13') return 'DUI';

  return form.customerDocumentType || 'Sin documento';
});
const customerDocumentNumberLabel = computed(() => formatCustomerDocument(form.customerDocument));

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

function lineTaxableBase(line: BillingItem): number {
  if (!isCreditoFiscal.value || !ccfPriceIncludesIva.value) return lineNetTotal(line);

  const quantity = Math.max(0, Number(line.quantity || 0));
  const gross = lineGrossTotal(line);
  const discount = lineDiscountAmount(line);
  const baseUnit = quantity > 0 ? roundUpMoney((gross / 1.13) / quantity) : 0;
  const baseDiscount = roundUpMoney(discount / 1.13);

  return roundMoney(Math.max(0, (baseUnit * quantity) - baseDiscount));
}

function lineIvaAmount(line: BillingItem): number {
  if (!isCreditoFiscal.value) return 0;

  if (ccfPriceIncludesIva.value) {
    return roundMoney(lineNetTotal(line) - lineTaxableBase(line));
  }

  return roundMoney(lineTaxableBase(line) * 0.13);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundUpMoney(value: number): number {
  return Math.ceil((value - 0.000000001) * 100) / 100;
}

function formatCustomerDocument(value: string): string {
  const digits = value.replace(/\D+/g, '');

  if (digits.length === 9) {
    return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  }

  if (digits.length === 14) {
    return [
      digits.slice(0, 4),
      digits.slice(4, 10),
      digits.slice(10, 13),
      digits.slice(13, 14),
    ].join('-');
  }

  return value || 'Sin numero';
}

function departmentCode(value: string | number | null | undefined): string {
  const digits = String(value ?? '').replace(/\D+/g, '');

  return digits.padStart(2, '0');
}

function newInvoiceLine(): InvoiceLine {
  return {
    id: lineId++,
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    discountPercent: 0,
  };
}

onMounted(() => {
  window.addEventListener('keydown', handleIssueModalKeydown);
  void loadContext();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleIssueModalKeydown);
  clearIssueAutoClose();
});

watch(issueResult, (result) => {
  clearIssueAutoClose();
  if (result && !issueRejected.value) {
    issueAutoCloseTimer = window.setTimeout(() => {
      closeIssueModal();
    }, 4500);
  }
});

function clearIssueAutoClose(): void {
  if (issueAutoCloseTimer) {
    window.clearTimeout(issueAutoCloseTimer);
    issueAutoCloseTimer = null;
  }
}

function handleIssueModalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && issueModalOpen.value && !issuing.value) {
    closeIssueModal();
  }
}

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
    const [contextResult, catalogsResult] = await Promise.all([
      client.value.billingContext(),
      client.value.billingCatalogs()
    ]);
    context.value = contextResult;
    catalogs.value = catalogsResult;
    form.empresaId = context.value.empresas[0]?.id ?? null;
    form.sucursalId = context.value.empresas[0]?.sucursales[0]?.id ?? null;
    form.puntoVentaId = context.value.empresas[0]?.sucursales[0]?.puntosVenta[0]?.id ?? null;
    if (isCreditoFiscal.value) {
      customerMode.value = 'base';
      clearCustomerFields('');
    } else {
      setGenericCustomer();
    }
    lineId = 1;
    draftLine.value = newInvoiceLine();
    lines.value = [];
    await Promise.all([loadCustomers(), loadItemTemplates()]);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el contexto real de facturacion.';
  } finally {
    contextLoading.value = false;
  }
}

watch(customerMode, (mode) => {
  customerSearchLocked.value = false;
  if (mode === 'generic') {
    selectedCustomerId.value = null;
    selectedCustomerRecord.value = null;
    setGenericCustomer();
  }

  if (mode === 'base' && !selectedCustomer.value) {
    clearCustomerFields('');
    void loadCustomers();
  }
});

watch(() => form.documentType, (documentType) => {
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  customerSearch.value = '';
  customerSearchLocked.value = false;
  customers.value = [];

  if (documentType === '03') {
    customerMode.value = 'base';
    clearCustomerFields('');
    return;
  }

  customerMode.value = 'generic';
  setGenericCustomer();
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

async function issueDocument(): Promise<void> {
  clearIssueAutoClose();
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
        pushIssueLog(event.message);
        const idx = issuePhases.value.findIndex((phase) => phase.label.toLowerCase().includes(event.stage));
        if (idx >= 0) issuePhaseIndex.value = idx;
        return;
      }

      if (event.type === 'completed') {
        issueProgress.value = event.progress ?? 100;
        pushIssueLog(event.message, event.ok ? 'ok' : 'error');
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
    pushIssueLog(error.value, 'error');
  } finally {
    issuing.value = false;
  }
}

function closeIssueModal(): void {
  if (issuing.value) {
    return;
  }

  clearIssueAutoClose();
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
  selectedCustomerRecord.value = null;
  customerSearch.value = '';
  customerSearchLocked.value = false;
  customers.value = [];
  customerModalMode.value = null;
  fiscalCustomerModalOpen.value = false;
  customerSearchModalOpen.value = false;
  fiscalModalDepartamento.value = '';
  fiscalModalMunicipio.value = '';
  itemTemplateSearch.value = '';
  customerMode.value = isCreditoFiscal.value ? 'base' : 'generic';
  if (isCreditoFiscal.value) {
    clearCustomerFields('');
  } else {
    setGenericCustomer();
  }
  lineId = 1;
  draftLine.value = newInvoiceLine();
  lines.value = [];
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
    customerDistrict: form.customerDistrict.trim() === '' ? null : form.customerDistrict.trim(),
    customerAddress: form.customerAddress.trim() === '' ? null : form.customerAddress.trim(),
    customerPhone: form.customerPhone.trim() === '' ? null : form.customerPhone.trim(),
    customerEmail: form.customerEmail.trim() === '' ? null : form.customerEmail.trim(),
    priceIncludesIva: isCreditoFiscal.value ? ccfPriceIncludesIva.value : false,
    retainIva10: isCreditoFiscal.value ? ccfRetainIva10.value : false,
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
  form.customerDistrict = '';
  form.customerAddress = '';
  form.customerPhone = '';
  form.customerEmail = '';
}

function setGenericCustomer(): void {
  clearCustomerFields('Consumidor Final');
}

function selectCustomerMode(mode: CustomerMode): void {
  if (mode === 'fiscal_new') {
    fiscalCustomerModalOpen.value = true;
    return;
  }

  if (mode === 'new' || mode === 'quick') {
    customerModalMode.value = mode;
    return;
  }

  customerMode.value = mode;
  if (mode === 'base') {
    customerSearchModalOpen.value = true;
  }
}

async function handleFiscalCustomerSave(payload: BillingFiscalCustomerModalPayload): Promise<void> {
  if (!selectedEmpresa.value) {
    error.value = 'Selecciona una empresa emisora antes de guardar clientes.';
    return;
  }

  const response = await run(() => client.value.saveCustomer({
    empresa_id: selectedEmpresa.value!.id,
    ...payload
  }));

  if (response) {
    await loadCustomers();
    customerMode.value = 'base';
    applyCustomer(response.customer);
    fiscalCustomerModalOpen.value = false;
  }
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
  selectedCustomerRecord.value = customer;
  customerSearchLocked.value = true;
  form.customerName = customer.name;
  form.customerEmail = customer.email ?? '';
  form.customerPhone = customer.phone ?? '';
  const normalized = normalizeCustomerDocument(customer.document_type ?? (customer.nit ? '36' : ''), customer.nit ?? customer.document_number ?? '');
  form.customerDocumentType = isCreditoFiscal.value && normalized.documentNumber ? '36' : normalized.documentType;
  form.customerDocument = normalized.documentNumber;
  form.customerNrc = onlyDigits(customer.nrc ?? '');
  form.customerActivityCode = customer.cod_actividad ?? '';
  form.customerActivityDescription = customer.desc_actividad ?? '';
  form.customerCommercialName = customer.nombre_comercial ?? customer.name;
  form.customerDepartment = customer.departamento ?? '';
  form.customerMunicipality = customer.municipio ?? '';
  form.customerDistrict = customer.distrito ?? '';
  form.customerAddress = customer.direccion_complemento ?? '';
  customerSearch.value = customerSearchLabel(customer);
  customers.value = [];
  customerSearchModalOpen.value = false;
}

function clearSelectedCustomer(): void {
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  customerSearchLocked.value = false;
  customerSearch.value = '';
  customers.value = [];
  clearCustomerFields('');
}

function updateCustomerSearch(value: string): void {
  customerSearch.value = value;
  customerSearchLocked.value = false;
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
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

function fillCurrentLineFromTemplate(template: BillingItemTemplate): void {
  draftLine.value = {
    ...draftLine.value,
    description: template.description,
    quantity: Number(template.default_quantity || 1),
    unitPrice: Number(template.default_price || 0),
    discount: 0,
    discountPercent: 0
  };
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
  const line = draftLine.value;
  if (!line.description.trim() || Number(line.quantity) <= 0 || Number(line.unitPrice) < 0) {
    error.value = 'Completa descripcion, cantidad y precio antes de agregar la linea.';
    return;
  }

  lines.value = [...lines.value, {
    ...line,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    discount: lineDiscountAmount(line),
    discountPercent: Math.max(0, Math.min(100, Number(line.discountPercent || 0))),
  }];
  draftLine.value = newInvoiceLine();
  error.value = null;
}

function removeLine(id: number): void {
  lines.value = lines.value.filter((line) => line.id !== id);
}
</script>

<template>
  <div class="grid gap-6 pb-28">
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

    <BillingFiscalCustomerModal
      :open="fiscalCustomerModalOpen"
      :loading="loading"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="fiscalCustomerModalOpen = false"
      @save="handleFiscalCustomerSave"
      @update:departamento="fiscalModalDepartamento = $event"
      @update:municipio="fiscalModalMunicipio = $event"
    />

    <BillingCustomerSearchModal
      :open="customerSearchModalOpen"
      :loading="loading"
      :search="customerSearch"
      :results="customerResults"
      :selected-customer-id="selectedCustomerId"
      @close="customerSearchModalOpen = false"
      @clear="clearSelectedCustomer"
      @select="applyCustomer"
      @update:search="updateCustomerSearch"
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
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-slate-950">
                {{ issuing ? issuePhases[issuePhaseIndex].label : issueRejected ? 'MH rechazo el documento' : issueResult ? 'Documento transmitido' : 'No fue posible emitir' }}
              </p>
              <p class="mt-1 break-all text-sm text-slate-600">
                {{ issuing ? issuePhases[issuePhaseIndex].detail : issueRejected ? issueResult?.document.transmission?.descripcion_msg : issueResult ? issueResult.document.numeroControl : error }}
              </p>
            </div>
            <span
              v-if="issueResult && issueAttemptCount > 1"
              class="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {{ issueAttemptCount }} intentos
            </span>
          </div>

          <div class="mt-4">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Sistema en produccion</span>
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
              <ul class="mt-2 max-h-16 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                <li v-for="(entry, index) in issueLog" :key="`${entry.message}-${index}`" class="flex items-start gap-2">
                  <span
                    class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                    :class="entry.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'"
                  >
                    {{ entry.status === 'error' ? 'x' : '✓' }}
                  </span>
                  <span>{{ entry.message }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="issueResult" class="mt-5 rounded-md border p-4" :class="issueRejected ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold" :class="issueRejected ? 'text-red-900' : 'text-emerald-900'">
                  {{ issueRejected ? 'Documento rechazado' : 'Documento aceptado' }}
                </p>
                <p class="mt-1 font-mono text-sm" :class="issueRejected ? 'text-red-950' : 'text-emerald-950'">{{ issueResult.document.numeroControl }}</p>
              </div>
              <span class="rounded bg-white/75 px-2 py-1 text-xs font-semibold" :class="issueRejected ? 'text-red-800' : 'text-emerald-800'">
                HTTP {{ issueResult.document.transmission?.http_status ?? 'N/D' }}
              </span>
            </div>
            <p class="mt-2 text-sm" :class="issueRejected ? 'text-red-800' : 'text-emerald-800'">
              MH {{ issueResult.document.transmission?.mh_estado ?? issueResult.document.transmission?.status ?? 'sin estado' }}
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
            <div v-if="!issueRejected" class="mt-4 flex flex-wrap gap-2 border-t border-emerald-200/80 pt-3">
              <button
                class="rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm opacity-75"
                disabled
                type="button"
              >
                Imprimir
              </button>
              <button
                class="rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm opacity-75"
                disabled
                type="button"
              >
                Enviar correo
              </button>
              <button
                class="rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm opacity-75"
                disabled
                type="button"
              >
                Descargar PDF
              </button>
              <span class="self-center text-xs text-emerald-700">Acciones proximas</span>
            </div>
          </div>

          <div v-else-if="error && !issuing" class="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {{ error }}
          </div>
        </div>
      </div>
    </div>

    <UiCard>
      <UiLoadingMark v-if="contextLoading" label="Estamos verificando conexiones" />
      <div v-else-if="empresas.length === 0" class="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
        No hay empresas configuradas en Core DTE. Billing real necesita empresa, sucursal, punto de venta y correlativos activos.
      </div>

      <div v-else class="grid gap-6">
        <div class="grid gap-4 xl:grid-cols-3">
          <section class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="flex h-full flex-col justify-between gap-4">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Emisor activo</p>
                <p class="mt-1 truncate text-sm font-bold text-slate-950">{{ selectedEmpresa?.razon_social }}</p>
                <div class="mt-3 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
                  <p>
                    <span class="font-semibold text-slate-500">Ambiente:</span>
                    <span class="ml-1 font-semibold text-slate-950">{{ selectedEmpresa?.ambiente === '01' ? 'Produccion' : 'Pruebas' }}</span>
                  </p>
                  <p>
                    <span class="font-semibold text-slate-500">DTE:</span>
                    <span class="ml-1 font-semibold text-slate-950">{{ documentLabel }}</span>
                  </p>
                  <p>
                    <span class="font-semibold text-slate-500">Estab.:</span>
                    <span class="ml-1 font-semibold text-slate-950">{{ selectedSucursal?.codigo }}</span>
                  </p>
                  <p class="min-w-0">
                    <span class="font-semibold text-slate-500">Punto venta:</span>
                    <span class="ml-1 font-semibold text-slate-950">{{ selectedPuntoVenta?.codigo }}</span>
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-3">
                <p v-if="!correlativoPreview" class="text-sm text-red-700">No hay correlativo activo para esta combinacion.</p>
                <div class="text-right">
                  <span
                    class="rounded px-2 py-1 text-xs font-semibold"
                    :class="correlativoPreview ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                  >
                    {{ correlativoPreview ? 'Numero correlativo' : 'Sin correlativo' }}
                  </span>
                  <p v-if="correlativoPreview" class="mt-2 max-w-[320px] truncate font-mono text-[11px] text-slate-500">
                    {{ correlativoPreview.numero_control }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-md border border-slate-200 bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-950">Receptor</h2>
            </div>
          </div>

          <div v-if="selectedCustomer" class="mt-4 rounded-md border border-sky-100 bg-sky-50/80 p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                  <span class="rounded bg-white px-2 py-1">{{ isCreditoFiscal ? 'Cliente fiscal' : 'Cliente base' }}</span>
                </div>
                <div class="mt-3 grid gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
                  <p class="min-w-0 sm:col-span-2">
                    <span class="block text-[11px] font-semibold text-slate-500">Nombre</span>
                    <span class="block truncate font-semibold text-slate-950">{{ form.customerName }}</span>
                  </p>
                  <p>
                    <span class="block text-[11px] font-semibold text-slate-500">Tipo de documento</span>
                    <span class="block font-semibold text-slate-950">{{ customerDocumentTypeLabel }}</span>
                  </p>
                  <p class="min-w-0">
                    <span class="block text-[11px] font-semibold text-slate-500">Numero</span>
                    <span class="block truncate font-semibold text-slate-950">{{ customerDocumentNumberLabel }}</span>
                  </p>
                  <p>
                    <span class="block text-[11px] font-semibold text-slate-500">Telefono</span>
                    <span class="block font-semibold text-slate-950">{{ form.customerPhone || 'Sin telefono' }}</span>
                  </p>
                  <p class="min-w-0">
                    <span class="block text-[11px] font-semibold text-slate-500">Correo</span>
                    <span class="block truncate font-semibold text-slate-950">{{ form.customerEmail || 'Sin correo' }}</span>
                  </p>
                  <template v-if="isCreditoFiscal">
                    <p>
                      <span class="block text-[11px] font-semibold text-slate-500">NRC</span>
                      <span class="block font-semibold text-slate-950">{{ form.customerNrc }}</span>
                    </p>
                    <p>
                      <span class="block text-[11px] font-semibold text-slate-500">Actividad</span>
                      <span class="block truncate font-semibold text-slate-950">{{ form.customerActivityCode }} · {{ form.customerActivityDescription }}</span>
                    </p>
                    <p class="min-w-0 sm:col-span-2">
                      <span class="block text-[11px] font-semibold text-slate-500">Direccion</span>
                      <span class="block truncate font-semibold text-slate-950">{{ form.customerDepartment }} / {{ form.customerMunicipality }} / {{ form.customerDistrict }} · {{ form.customerAddress }}</span>
                    </p>
                  </template>
                </div>
              </div>
              <button
                class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-red-50 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white"
                type="button"
                aria-label="Quitar cliente seleccionado"
                @click="clearSelectedCustomer"
              >
                x
              </button>
            </div>
          </div>

          <div v-else class="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              v-for="mode in customerModes"
              :key="mode.key"
              class="rounded-lg px-4 py-2 text-sm font-semibold tracking-wide transition-colors duration-200 focus:outline-none focus:ring focus:ring-sky-300 focus:ring-opacity-70"
              :class="customerMode === mode.key ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'"
              type="button"
              @click="selectCustomerMode(mode.key)"
            >
              {{ mode.label }}
            </button>
          </div>

          <div v-if="!selectedCustomer && (customerMode === 'generic' || customerMode === 'quick' || customerMode === 'new')" class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-950">{{ form.customerName || 'Consumidor Final' }}</p>
                <p class="mt-1 text-sm text-slate-600">{{ customerSummary }}</p>
              </div>
              <UiButton v-if="customerMode === 'quick'" variant="secondary" type="button" @click="customerModalMode = 'quick'">Editar rapido</UiButton>
            </div>
          </div>

          <p v-if="isCreditoFiscal && !selectedCustomer" class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            CCF requiere un cliente fiscal guardado con NIT/DUI homologado, NRC, actividad, direccion, telefono y correo.
          </p>
          </section>

          <section class="rounded-md border border-slate-200 bg-white p-4">
            <div>
              <h2 class="text-base font-semibold text-slate-950">Productos rapidos</h2>
              <p class="mt-1 text-xs text-slate-500">Agrega servicios frecuentes al detalle.</p>
            </div>
            <UiInput v-model="itemTemplateSearch" class="mt-4" label="Buscar producto o servicio" placeholder="Nombre o descripcion" />
            <div v-if="itemTemplateSearch.trim()" class="mt-3 max-h-40 overflow-y-auto rounded-md border border-slate-200">
              <button
                v-for="template in itemTemplates.slice(0, 8)"
                :key="template.id"
                class="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-sky-50"
                type="button"
                @click="fillCurrentLineFromTemplate(template)"
              >
                <span class="block truncate font-semibold text-slate-950">{{ template.name }}</span>
                <span class="block text-xs text-slate-500">{{ currency(template.default_price) }}</span>
              </button>
              <span v-if="itemTemplates.length === 0" class="block px-3 py-3 text-sm text-slate-500">Sin resultados.</span>
            </div>
          </section>
        </div>

        <section class="rounded-md border border-slate-200 bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-950">Detalle</h2>
            </div>
          </div>
          <BillingFiscalOptions
            v-if="isCreditoFiscal"
            v-model:price-includes-iva="ccfPriceIncludesIva"
            v-model:retain-iva="ccfRetainIva10"
            class="mt-4"
          />
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
                <tr class="bg-slate-50/70">
                  <td class="px-3 py-2">
                    <input v-model="draftLine.description" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Producto o servicio">
                  </td>
                  <td class="px-3 py-2">
                    <input v-model.number="draftLine.quantity" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" min="0.01" step="0.01" type="number">
                  </td>
                  <td class="px-3 py-2">
                    <input v-model.number="draftLine.unitPrice" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" min="0" step="0.01" type="number">
                  </td>
                  <td class="px-3 py-2">
                    <input v-model.number="draftLine.discountPercent" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" max="100" min="0" step="0.01" type="number">
                    <p v-if="lineDiscountAmount(draftLine) > 0" class="mt-1 text-[11px] text-slate-500">-{{ currency(lineDiscountAmount(draftLine)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <p class="font-semibold text-slate-900">{{ currency(lineNetTotal(draftLine)) }}</p>
                    <p v-if="isCreditoFiscal" class="text-[11px] text-slate-500">IVA {{ currency(lineIvaAmount(draftLine)) }}</p>
                    <p v-if="lineDiscountAmount(draftLine) > 0" class="text-[11px] text-slate-500">Bruto {{ currency(lineGrossTotal(draftLine)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <UiButton @click="addLine">Agregar</UiButton>
                  </td>
                </tr>
                <tr v-for="line in lines" :key="line.id">
                  <td class="px-3 py-2">
                    <span class="font-medium text-slate-950">{{ line.description }}</span>
                  </td>
                  <td class="px-3 py-2">
                    {{ Number(line.quantity) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ currency(Number(line.unitPrice)) }}
                  </td>
                  <td class="px-3 py-2">
                    <span>{{ Number(line.discountPercent || 0) }}%</span>
                    <p v-if="lineDiscountAmount(line) > 0" class="text-[11px] text-slate-500">-{{ currency(lineDiscountAmount(line)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <p class="font-semibold text-slate-900">{{ currency(lineNetTotal(line)) }}</p>
                    <p v-if="isCreditoFiscal" class="text-[11px] text-slate-500">IVA {{ currency(lineIvaAmount(line)) }}</p>
                    <p v-if="lineDiscountAmount(line) > 0" class="text-[11px] text-slate-500">Bruto {{ currency(lineGrossTotal(line)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button class="rounded px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50" type="button" @click="saveLineAsTemplate(line)">Guardar</button>
                    <button class="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-700" type="button" @click="removeLine(line.id)">Quitar</button>
                  </td>
                </tr>
                <tr v-if="lines.length === 0">
                  <td class="px-3 py-4 text-sm text-slate-500" colspan="6">Aun no hay lineas agregadas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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

    <BillingInvoiceSummaryBar
      v-if="!contextLoading && empresas.length > 0"
      :line-count="items.length"
      :unit-count="unitCount"
      :subtotal="subtotal"
      :discount-total="discountTotal"
      :iva-total="isCreditoFiscal ? iva : undefined"
      :retention-total="isCreditoFiscal ? ivaRetention : undefined"
      :total-label="totalLabel"
      :issue-disabled="loading || issuing || !canBuild"
      :issuing="issuing"
      @issue="issueDocument"
    />
  </div>
</template>
