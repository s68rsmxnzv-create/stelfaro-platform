<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  buildFacturaRequest,
  type BillingCatalogs,
  CoreDteClient,
  type BillingCustomer,
  type BillingContext,
  type BillingEmpresa,
  type BillingPuntoVenta,
  type BillingSucursal,
  type CorrelativoReservation,
  type DteDraftSummary,
  type DteHistoryEntry,
  type DteIssueProgressEvent,
  type DteIssueResponse,
  type DtePreviewResponse,
  PlatformClient,
  type PlatformCatalogItem,
  type PlatformInventoryReservation
} from '@stelfaro/api-client';
import { currency, type BillingItem, type DocumentType } from '@stelfaro/shared';
import { UiButton, UiCard, UiInput, UiSearchInput, UiLoadingMark, UiSelect, UiTextarea } from '@stelfaro/ui';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';
import BillingFiscalCustomerModal, { type BillingFiscalCustomerModalPayload } from '../components/BillingFiscalCustomerModal.vue';
import BillingSujetoExcluidoModal, { type BillingSujetoExcluidoModalPayload } from '../components/BillingSujetoExcluidoModal.vue';
import BillingFiscalOptions from '../components/BillingFiscalOptions.vue';
import BillingCustomerSearchModal from '../components/BillingCustomerSearchModal.vue';
import BillingInvoiceSummaryBar from '../components/BillingInvoiceSummaryBar.vue';
import BillingModalShell from '../components/BillingModalShell.vue';
import BillingProcessModal from '../components/BillingProcessModal.vue';
import BillingProcessToastOverlay from '../components/BillingProcessToastOverlay.vue';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';
import {
  getBillingCatalogs,
  getBillingContext,
  peekBillingCatalogs,
  peekBillingContext
} from '../support/billingDataCache';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  initialDocumentType?: DocumentType;
  billingContextCacheScope?: string;
  platformSession?: Record<string, unknown> | null;
  platformBaseUrl?: string;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  initialDocumentType: '01',
  billingContextCacheScope: 'default',
  platformSession: null,
  platformBaseUrl: '/api/v1'
});

type PlatformSessionProp = {
  tenant?: {
    id?: number | string | null;
  } | null;
} | null;

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const platformClient = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const platformTenantId = computed(() => Number((props.platformSession as PlatformSessionProp)?.tenant?.id || 0));
const workshopOrderId = Number(new URLSearchParams(window.location.search).get('workshop_order') || 0);
const loading = ref(false);
const contextLoading = ref(false);
const correlativoLoading = ref(false);
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
const issueLiveMessage = ref<string | null>(null);
const floatingToasts = ref<BillingFloatingToast[]>([]);
const pendingEmailToast = ref<Omit<BillingFloatingToast, 'id'> | null>(null);
const stationPreferenceVersion = ref(0);
type IssueLogEntry = {
  message: string;
  status: 'ok' | 'error';
};
const INVENTORY_CHANGED_EVENT = 'stelfaro:inventory-changed';
const issueLog = ref<IssueLogEntry[]>([]);
const customers = ref<BillingCustomer[]>([]);
const customerSearch = ref('');
const customerSearchLocked = ref(false);
const selectedCustomerId = ref<number | null>(null);
const selectedCustomerRecord = ref<BillingCustomer | null>(null);
const fiscalCustomerTarget = ref<BillingCustomer | null>(null);
const sourceDocumentSearch = ref('');
const sourceDocuments = ref<DteDraftSummary[]>([]);
const selectedSourceDocument = ref<DteDraftSummary | null>(null);
const catalogLineSuggestions = ref<PlatformCatalogItem[]>([]);
const catalogLineSuggestionsOpen = ref(false);
const catalogLineLoading = ref(false);
let catalogLineSearchToken = 0;
const customerModalMode = ref<'new' | 'quick' | null>(null);
const fiscalCustomerModalOpen = ref(false);
const sujetoExcluidoModalOpen = ref(false);
const customerSearchModalOpen = ref(false);
const paymentModalOpen = ref(false);
const observationsModalOpen = ref(false);
const zeroValueLineWarningOpen = ref(false);
const zeroValueLineWarningConfirmed = ref(false);
const fiscalModalDepartamento = ref('');
const fiscalModalMunicipio = ref('');
const ccfPriceIncludesIva = ref(true);
const ccfRetainIva10 = ref(false);
let issueAutoCloseTimer: ReturnType<typeof window.setTimeout> | null = null;
let floatingToastId = 0;
const floatingToastTimers: ReturnType<typeof window.setTimeout>[] = [];
const deliveryPollTimers: ReturnType<typeof window.setTimeout>[] = [];
let currentIssueIdempotencyKey: string | null = null;
let catalogLineSearchTimer: ReturnType<typeof window.setTimeout> | null = null;
let unmounted = false;
const finalConsumerIdentificationThreshold = 25000;

type InvoiceLine = BillingItem & {
  id: number;
  discountPercent: number;
  catalogItemId?: number | null;
  catalogSku?: string | null;
  catalogName?: string | null;
  lineOrigin?: 'free' | 'catalog' | 'inventory';
  unitCode?: string | null;
  taxable?: boolean;
  controlsInventory?: boolean;
  itemPriceIncludesIva?: boolean;
  inventoryBypassReason?: 'insufficient_stock' | null;
  originalQuantity?: number;
  originalUnitPrice?: number;
  originalIva?: number;
  sourceLine?: boolean;
};
type CustomerMode = 'generic' | 'base' | 'new' | 'quick' | 'fiscal_new';
type PaymentCondition = 1 | 2 | 3;
type PaymentLine = {
  id: number;
  codigo: string;
  montoPago: number;
  referencia: string;
  plazo: string;
  periodo: number | null;
};
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
const sujetoExcluidoCustomerModes: Array<{ key: CustomerMode; label: string }> = [
  { key: 'base', label: 'Sujeto excluido guardado' },
  { key: 'fiscal_new', label: 'Nuevo sujeto excluido' },
];
const paymentConditionOptions: Array<{ value: PaymentCondition; label: string }> = [
  { value: 1, label: '1 - Contado' },
  { value: 2, label: '2 - A credito' },
  { value: 3, label: '3 - Otro' },
];
const paymentMethodOptions = [
  { value: '01', label: '01 Billetes y monedas' },
  { value: '02', label: '02 Tarjeta' },
  { value: '03', label: '03 Cheque' },
  { value: '04', label: '04 Transferencia' },
  { value: '99', label: '99 Otro' },
];
const paymentTermOptions = [
  { value: '', label: 'Sin plazo' },
  { value: '01', label: '01 Dias' },
  { value: '02', label: '02 Meses' },
  { value: '03', label: '03 Anos' },
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
  observations: '',
  itemDescription: '',
  itemQuantity: 1,
  itemUnitPrice: 0
});
const customerMode = ref<CustomerMode>('generic');
let lineId = 1;
const draftLine = ref<InvoiceLine>(newInvoiceLine());
const lines = ref<InvoiceLine[]>([]);
let paymentLineId = 1;
const paymentCondition = ref<PaymentCondition>(1);
const paymentLines = ref<PaymentLine[]>([]);

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed<BillingEmpresa | null>(() => empresas.value.find((empresa) => empresa.id === form.empresaId) ?? null);
const sucursales = computed(() => selectedEmpresa.value?.sucursales ?? []);
const sucursalOptions = computed(() => sucursales.value.map((sucursal) => ({
  value: sucursal.id,
  label: `${sucursal.codigo} · ${sucursal.nombre}`
})));
const selectedSucursal = computed<BillingSucursal | null>(() => sucursales.value.find((sucursal) => sucursal.id === form.sucursalId) ?? null);
const puntosVenta = computed(() => selectedSucursal.value?.puntosVenta ?? []);
const puntoVentaOptions = computed(() => puntosVenta.value.map((punto) => ({
  value: punto.id,
  label: `${punto.codigo} · ${punto.nombre}`
})));
const selectedPuntoVenta = computed<BillingPuntoVenta | null>(() => puntosVenta.value.find((punto) => punto.id === form.puntoVentaId) ?? null);
const canManageBillingStation = computed(() => {
  const role = context.value?.user?.role ?? '';
  return ['super_admin', 'admin_fiscal', 'company_admin'].includes(role);
});
const billingStationPreference = computed(() => {
  stationPreferenceVersion.value;
  return selectedEmpresa.value ? readBillingStationPreference(selectedEmpresa.value) : null;
});
const selectedStationIsFixed = computed(() => Boolean(
  billingStationPreference.value
  && billingStationPreference.value.sucursalId === selectedSucursal.value?.id
  && billingStationPreference.value.puntoVentaId === selectedPuntoVenta.value?.id
));
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
  return documentTypes.value.filter((type) => ['01', '03', '05', '06', '14'].includes(type.code) && (enabled.length === 0 || enabled.includes(type.code)));
});
const isCreditoFiscal = computed(() => form.documentType === '03');
const isFacturaElectronica = computed(() => form.documentType === '01');
const isNotaCredito = computed(() => form.documentType === '05');
const isNotaDebito = computed(() => form.documentType === '06');
const isSujetoExcluido = computed(() => form.documentType === '14');
const isAdjustmentNote = computed(() => isNotaCredito.value || isNotaDebito.value);
const adjustmentNoteLabel = computed(() => isNotaDebito.value ? 'Nota de Debito' : 'Nota de Credito');
const isFiscalStyleDocument = computed(() => isCreditoFiscal.value || isAdjustmentNote.value);
const supportsAdvancedPayments = computed(() => isFacturaElectronica.value || isCreditoFiscal.value || isSujetoExcluido.value);
const requiresStructuredCustomer = computed(() => isCreditoFiscal.value || isAdjustmentNote.value || isSujetoExcluido.value);
const customerModes = computed(() => {
  if (isAdjustmentNote.value) return [];

  if (isSujetoExcluido.value) return sujetoExcluidoCustomerModes;

  return requiresStructuredCustomer.value ? fiscalCustomerModes : simpleCustomerModes;
});
function customerModeButtonClass(mode: { key: CustomerMode }): string[] {
  const selected = customerMode.value === mode.key;
  const disabledByAmount = mode.key === 'generic' && requiresCustomerIdentificationByAmount.value;

  return [
    selected
      ? 'bg-sky-700 text-white shadow-sm shadow-sky-950/15 hover:bg-sky-600 dark:bg-primary-soft dark:text-white dark:hover:bg-primary'
      : 'border border-blue-100 bg-blue-50/45 text-slate-900 shadow-sm shadow-blue-950/5 hover:bg-blue-100/60 dark:border-line dark:bg-surface-raised dark:text-text dark:shadow-none dark:hover:bg-surface-strong',
    disabledByAmount ? 'cursor-not-allowed opacity-50 hover:bg-blue-50/45' : ''
  ];
}
const items = computed<BillingItem[]>(() => lines.value
  .map((line) => ({
    description: line.description.trim(),
    quantity: isNotaDebito.value ? notaDebitoPayloadQuantity(line) : Number(line.quantity),
    unitPrice: isNotaDebito.value ? notaDebitoPayloadUnitPrice(line) : Number(line.unitPrice),
    discount: isNotaDebito.value ? 0 : lineDiscountAmount(line),
    ivaAmount: isNotaCredito.value ? lineIvaAmount(line) : undefined,
    priceIncludesIva: isCreditoFiscal.value ? ccfPriceIncludesIva.value : false,
    unitMeasure: line.unitCode ?? 59,
    code: line.catalogSku ?? null,
    catalogItemId: line.catalogItemId ?? null,
    lineOrigin: line.lineOrigin ?? 'free'
  }))
  .filter((line) => line.description !== '' && line.quantity > 0 && (isNotaDebito.value ? line.unitPrice > 0 : line.unitPrice >= 0)));
const subtotal = computed(() => items.value.reduce((sum, item) => sum + lineGrossTotal(item), 0));
const discountTotal = computed(() => items.value.reduce((sum, item) => sum + lineDiscountAmount(item), 0));
const total = computed(() => items.value.reduce((sum, item) => sum + lineNetTotal(item), 0));
const iva = computed(() => isFiscalStyleDocument.value ? items.value.reduce((sum, item) => sum + lineIvaAmount(item), 0) : 0);
const taxableBase = computed(() => isFiscalStyleDocument.value ? items.value.reduce((sum, item) => sum + lineTaxableBase(item), 0) : 0);
const ivaRetention = computed(() => isCreditoFiscal.value && ccfRetainIva10.value ? roundMoney(taxableBase.value * 0.01) : 0);
const paymentTotal = computed(() => roundMoney(paymentLines.value.reduce((sum, payment) => sum + Number(payment.montoPago || 0), 0)));
const paymentTotalMatches = computed(() => Math.abs(paymentTotal.value - roundMoney(totalLabel.value)) <= 0.01);
const paymentConditionLabel = computed(() => paymentConditionOptions.find((option) => option.value === paymentCondition.value)?.label ?? '1 - Contado');
const primaryPaymentLabel = computed(() => {
  const payment = paymentLines.value[0];
  if (!payment) return 'Sin forma de pago';

  return paymentMethodOptions.find((option) => option.value === payment.codigo)?.label ?? payment.codigo;
});
const paymentSummaryLabel = computed(() => {
  if (paymentLines.value.length <= 1) return primaryPaymentLabel.value;

  return `${paymentLines.value.length} formas de pago`;
});
const hasValidAdvancedPayments = computed(() => {
  if (!supportsAdvancedPayments.value) return true;
  if (paymentLines.value.length === 0 || !paymentTotalMatches.value) return false;

  return paymentLines.value.every((payment) => {
    const amount = Number(payment.montoPago || 0);
    const hasAmount = Number.isFinite(amount) && amount >= 0;
    const hasMethod = payment.codigo.trim().length === 2;
    const hasTermPair = payment.plazo === '' || Number(payment.periodo || 0) > 0;
    const conditionTermIsValid = paymentCondition.value === 1
      ? payment.plazo === ''
      : paymentCondition.value !== 2 || (payment.plazo !== '' && Number(payment.periodo || 0) > 0);

    return hasAmount && hasMethod && hasTermPair && conditionTermIsValid;
  });
});

function paymentReferenceDisabled(payment: PaymentLine): boolean {
  return paymentCondition.value === 2 || payment.codigo === '01';
}

function normalizedPaymentReference(payment: PaymentLine): string | null {
  if (paymentReferenceDisabled(payment)) return null;

  const reference = payment.referencia.trim();

  return reference === '' ? null : reference;
}
const inventoryIssueLines = computed(() => items.value
  .filter((line) => line.lineOrigin === 'inventory' && Number(line.catalogItemId || 0) > 0)
  .map((line) => ({
    catalog_item_id: Number(line.catalogItemId),
    quantity: Number(line.quantity),
    description: line.description
  })));
const notaCreditoSourceTotalGravada = computed(() => {
  if (!selectedSourceDocument.value) return 0;

  const payload = documentPayload(selectedSourceDocument.value);
  const resumenTotal = sourceSummaryNumber(payload, ['totalGravada']);
  if (resumenTotal > 0) return resumenTotal;

  const sourceItems = Array.isArray(payload.cuerpoDocumento) ? payload.cuerpoDocumento : [];

  return roundMoney(sourceItems
    .map((item) => sourceLineTaxableBase(asRecord(item)))
    .reduce((sum, value) => sum + value, 0));
});
const notaCreditoRatio = computed(() => {
  if (!isAdjustmentNote.value || notaCreditoSourceTotalGravada.value <= 0) return 0;

  return Math.min(1, taxableBase.value / notaCreditoSourceTotalGravada.value);
});
const notaCreditoSourceIvaRete = computed(() => selectedSourceDocument.value ? sourceSummaryNumber(documentPayload(selectedSourceDocument.value), ['ivaRete', 'ivaRete1', 'ivaRetenido']) : 0);
const notaCreditoSourceIvaPerci = computed(() => selectedSourceDocument.value ? sourceSummaryNumber(documentPayload(selectedSourceDocument.value), ['ivaPerci', 'ivaPerci1', 'ivaPercibido']) : 0);
const notaCreditoIvaRete = computed(() => 0);
const notaCreditoIvaPerci = computed(() => 0);
const notaCreditoTotalNoGravado = computed(() => proportionalSourceSummaryAmount(['totalNoGravado', 'noGravado']));
const notaCreditoHasFiscalAdjustments = computed(() => notaCreditoSourceIvaRete.value > 0 || notaCreditoSourceIvaPerci.value > 0);
const sujetoExcluidoReteRenta = computed(() => isSujetoExcluido.value ? roundMoney(total.value * 0.10) : 0);
const totalLabel = computed(() => {
  if (isSujetoExcluido.value) {
    return roundMoney(Math.max(0, total.value - sujetoExcluidoReteRenta.value));
  }

  if (!isFiscalStyleDocument.value) return total.value;

  const totalWithIva = isCreditoFiscal.value && ccfPriceIncludesIva.value
    ? total.value
    : total.value + iva.value + (isNotaCredito.value ? notaCreditoTotalNoGravado.value : 0);
  const retention = isNotaCredito.value ? notaCreditoIvaRete.value : ivaRetention.value;
  const perception = isNotaCredito.value ? notaCreditoIvaPerci.value : 0;

  return roundMoney(Math.max(0, totalWithIva + perception - retention));
});
const zeroValueLines = computed(() => items.value.filter((line) => lineNetTotal(line) <= 0 || Number(line.unitPrice || 0) <= 0));
const hasZeroValueLines = computed(() => zeroValueLines.value.length > 0);
const canIssuePositiveTotal = computed(() => roundMoney(totalLabel.value) > 0);
const unitCount = computed(() => items.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
const complianceTotal = computed(() => roundMoney(totalLabel.value));
const requiresCustomerIdentificationByAmount = computed(() => (
  isFacturaElectronica.value
  && complianceTotal.value >= finalConsumerIdentificationThreshold
));
const hasRequiredCustomerIdentification = computed(() => Boolean(
  form.customerName.trim()
  && form.customerDocumentType.trim()
  && form.customerDocument.trim()
));
const genericCustomerBlockedByAmount = computed(() => (
  requiresCustomerIdentificationByAmount.value
  && customerMode.value === 'generic'
));
const canBuild = computed(() => Boolean(
  selectedEmpresa.value
  && selectedSucursal.value
  && selectedPuntoVenta.value
  && correlativoPreview.value
  && form.customerName.trim()
  && items.value.length > 0
  && canIssuePositiveTotal.value
  && !genericCustomerBlockedByAmount.value
  && (!requiresCustomerIdentificationByAmount.value || hasRequiredCustomerIdentification.value)
  && hasValidAdvancedPayments.value
  && (!isFiscalStyleDocument.value || canBuildCreditoFiscal.value)
  && (!isSujetoExcluido.value || canBuildSujetoExcluido.value)
  && (!isAdjustmentNote.value || selectedSourceDocument.value)
));
const canUseCatalogLineSearch = computed(() => Boolean(
  platformTenantId.value
  && !isAdjustmentNote.value
  && !isSujetoExcluido.value
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
const canBuildSujetoExcluido = computed(() => Boolean(
  form.customerDocument.trim()
  && form.customerDepartment.trim()
  && form.customerMunicipality.trim()
  && form.customerDistrict.trim()
  && form.customerAddress.trim()
));
const issuePhases = computed(() => [
  { label: 'Preparando emision', detail: 'Validando datos fiscales, receptor y detalle.' },
  { label: 'Asignando numero', detail: 'Reservando el correlativo del documento.' },
  { label: 'Preparando documento', detail: 'Completando la informacion fiscal.' },
  { label: 'Firmando documento', detail: 'Firmando el documento con el certificado configurado.' },
  { label: 'Enviando a Hacienda', detail: 'Transmitiendo el documento para su recepcion.' },
  { label: 'Esperando respuesta', detail: 'Registrando el resultado de Hacienda.' }
]);
const issueRejected = computed(() => issueResult.value?.document.transmission?.status === 'REJECTED' || issueResult.value?.document.estado === 'rejected');
const issueInContingency = computed(() => Boolean(
  issueResult.value
  && !issueRejected.value
  && (issueResult.value.document.estado === 'contingency' || issueResult.value.document.contingencia)
));
const issueOverlayOpen = computed(() => Boolean(issuing.value || (issueResult.value && !issueRejected.value)));
const issueDiagnosticModalOpen = computed(() => Boolean(issueModalOpen.value && (issueRejected.value || (error.value && !issuing.value && !issueResult.value))));
const issueCompactError = computed(() => Boolean(error.value && !issuing.value && !issueResult.value));
const inventoryStockError = computed(() => {
  const message = error.value ?? '';
  const affectedLines = lines.value.filter((line) => {
    if (line.lineOrigin !== 'inventory') return false;
    const product = (line.catalogName || line.description).trim();
    return product !== '' && message.startsWith(`Stock insuficiente para ${product} en `);
  });
  const quantities = message.match(/Disponible: ([\d.,]+); requerido: ([\d.,]+)\./i);
  if (affectedLines.length === 0 || !quantities) return null;

  return {
    lineIds: affectedLines.map((line) => line.id),
    product: (affectedLines[0].catalogName || affectedLines[0].description).trim(),
    available: quantities[1],
    required: quantities[2],
    hasStockElsewhere: message.includes('En otras sucursales:'),
  };
});
const issueFriendlyError = computed(() => {
  const message = error.value ?? '';
  if (inventoryStockError.value) {
    const stock = inventoryStockError.value;
    const otherBranchHint = stock.hasStockElsewhere ? ' Hay existencias en otra sucursal.' : '';
    return `No hay suficiente ${stock.product}. Disponible: ${stock.available} · Necesitas: ${stock.required}.${otherBranchHint}`;
  }
  const stock = message.match(/^Stock insuficiente para (.+?) en .+?\. Disponible: ([\d.,]+); requerido: ([\d.,]+)\./i);
  if (!stock) return message;

  const [, product, available, required] = stock;
  const otherBranchHint = message.includes('En otras sucursales:') ? ' Hay existencias en otra sucursal.' : '';
  return `No hay suficiente ${product}. Disponible: ${available} · Necesitas: ${required}.${otherBranchHint}`;
});
const issueErrorTitle = computed(() => inventoryStockError.value ? 'Sin existencias' : 'No se pudo emitir');
const issueOverlayVariant = computed<'loading' | 'success' | 'warning'>(() => {
  if (issuing.value) return 'loading';
  if (issueInContingency.value) return 'warning';
  return 'success';
});
const issueOverlayTitle = computed(() => {
  if (issuing.value) return 'Transmitiendo DTE';
  if (issueInContingency.value) return 'Documento en contingencia';
  return 'Documento transmitido';
});
const issueOverlayMessage = computed(() => {
  if (issuing.value) return issueLiveMessage.value ?? issuePhases.value[issuePhaseIndex.value]?.detail ?? 'Procesando documento.';
  if (issueInContingency.value) return `${issueResult.value?.document.numeroControl ?? 'DTE'} quedo pendiente para reportar contingencia.`;
  return issueResult.value?.document.numeroControl ?? null;
});
const issueStatusDetail = computed(() => {
  if (issuing.value) return issueLiveMessage.value ?? issuePhases.value[issuePhaseIndex.value]?.detail ?? 'Procesando documento.';
  if (issueRejected.value) return issueResult.value?.document.transmission?.descripcion_msg;
  if (issueInContingency.value) return `${issueResult.value?.document.numeroControl} quedo pendiente de reporte en contingencia.`;
  if (issueResult.value) return issueResult.value.document.numeroControl;
  return issueFriendlyError.value;
});
const issueAttemptCount = computed(() => {
  const attempts = issueResult.value?.attempts ?? [];
  return attempts.some((attempt) => Boolean((attempt as { conflict?: boolean }).conflict)) ? attempts.length : 0;
});
const pushIssueLog = (message: string, status: IssueLogEntry['status'] = 'ok'): void => {
  issueLog.value = [...issueLog.value.slice(-8), { message, status }];
};
const issueEventMessage = (event: DteIssueProgressEvent): string => {
  if (event.type === 'stage' && event.attempt && event.max_attempts && event.attempt > 1) {
    return `Reintento ${event.attempt}/${event.max_attempts} · Identificando correlativo disponible`;
  }

  if (event.type === 'retry') {
    const maxAttempts = event.max_attempts ? `/${event.max_attempts}` : '';
    return `Reintento ${event.next_attempt}${maxAttempts} · Identificando correlativo disponible`;
  }

  return 'message' in event ? event.message : 'Proceso actualizado.';
};
const selectedCustomer = computed(() => selectedCustomerRecord.value);
const hasReceptorCard = computed(() => Boolean(selectedCustomer.value || (isAdjustmentNote.value && selectedSourceDocument.value)));
const selectedCustomerNeedsFiscalComplement = computed(() => Boolean(
  selectedCustomer.value
  && isCreditoFiscal.value
  && !isCustomerReadyForCreditoFiscal(selectedCustomer.value)
));
const selectedDocumentType = computed(() => availableDocumentTypes.value.find((type) => type.code === form.documentType) ?? null);
const documentLabel = computed(() => `${form.documentType} · ${selectedDocumentType.value?.label ?? (isAdjustmentNote.value ? adjustmentNoteLabel.value : 'Factura Electronica')}`);
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
const customerIdentificationByAmountMessage = computed(() => (
  `Factura Electronica por ${currency(finalConsumerIdentificationThreshold)} o mas requiere identificar al cliente antes de enviar a MH. Selecciona un cliente de base o agrega un cliente con nombre y DUI/NIT.`
));
const issueDisabledReason = computed(() => {
  if (!requiresCustomerIdentificationByAmount.value || hasRequiredCustomerIdentification.value) {
    if (!canIssuePositiveTotal.value) {
      return null;
    }

    if (supportsAdvancedPayments.value && !hasValidAdvancedPayments.value) {
      return 'Revisa las formas de pago.';
    }

    return null;
  }

  return 'Identifica al cliente para emitir esta FE.';
});
const customerDocumentTypeLabel = computed(() => {
  if (isCreditoFiscal.value && form.customerDocument) return form.customerDocument.length === 9 ? 'NIT / DUI homologado' : 'NIT';
  if (form.customerDocumentType === '36') return 'NIT';
  if (form.customerDocumentType === '13') return 'DUI';

  return form.customerDocumentType || 'Sin documento';
});
const customerDocumentNumberLabel = computed(() => formatCustomerDocument(form.customerDocument));

function lineGrossTotal(line: BillingItem): number {
  if (isNotaDebito.value && (line as Partial<InvoiceLine>).sourceLine !== false) {
    return notaDebitoIncrementTotal(line as Partial<InvoiceLine>);
  }

  const unitPrice = isNotaDebito.value
    ? notaDebitoPayloadUnitPrice(line as Partial<InvoiceLine>)
    : Number(line.unitPrice || 0);

  return Math.max(0, Number(line.quantity || 0) * unitPrice);
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
  if (!isFiscalStyleDocument.value) return 0;

  if (isNotaCredito.value && typeof line.ivaAmount === 'number') {
    return roundMoney(line.ivaAmount);
  }

  const notaCreditoLine = line as Partial<InvoiceLine>;
  if (isNotaCredito.value && typeof notaCreditoLine.originalIva === 'number') {
    const originalQuantity = Math.max(0, Number(notaCreditoLine.originalQuantity || line.quantity || 0));
    const originalUnitPrice = Math.max(0, Number(notaCreditoLine.originalUnitPrice || line.unitPrice || 0));
    const originalBase = originalQuantity * originalUnitPrice;

    if (originalBase > 0) {
      return roundMoney(notaCreditoLine.originalIva * Math.min(1, lineNetTotal(line) / originalBase));
    }
  }

  if (isCreditoFiscal.value && ccfPriceIncludesIva.value) {
    return roundMoney(lineNetTotal(line) - lineTaxableBase(line));
  }

  return roundMoney(lineTaxableBase(line) * 0.13);
}

function notaDebitoPayloadUnitPrice(line: Partial<InvoiceLine> | BillingItem): number {
  const unitPrice = Math.max(0, Number(line.unitPrice || 0));

  if (!isNotaDebito.value || (line as Partial<InvoiceLine>).sourceLine === false) {
    return roundMoney(unitPrice);
  }

  return notaDebitoIncrementTotal(line);
}

function notaDebitoPayloadQuantity(line: Partial<InvoiceLine> | BillingItem): number {
  if (!isNotaDebito.value || (line as Partial<InvoiceLine>).sourceLine === false) {
    return Math.max(0, Number(line.quantity || 0));
  }

  return notaDebitoIncrementTotal(line) > 0 ? 1 : 0;
}

function notaDebitoIncrementTotal(line: Partial<InvoiceLine> | BillingItem): number {
  const quantity = Math.max(0, Number(line.quantity || 0));
  const unitPrice = Math.max(0, Number(line.unitPrice || 0));
  const originalQuantity = Math.max(0, Number((line as Partial<InvoiceLine>).originalQuantity || 0));
  const originalUnitPrice = Math.max(0, Number((line as Partial<InvoiceLine>).originalUnitPrice || 0));

  return roundMoney(Math.max(0, (quantity * unitPrice) - (originalQuantity * originalUnitPrice)));
}

function notaDebitoOriginalLabel(line: InvoiceLine): string {
  return `Origen ${Number(line.originalQuantity ?? 0)} x ${currency(Number(line.originalUnitPrice ?? 0))}`;
}

function notaDebitoIncrementLabel(line: InvoiceLine): string {
  return `Incremento ${currency(notaDebitoPayloadUnitPrice(line))}`;
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
    catalogItemId: null,
    catalogSku: null,
    catalogName: null,
    lineOrigin: 'free',
    unitCode: '59',
    taxable: true,
    controlsInventory: false,
    itemPriceIncludesIva: false,
    inventoryBypassReason: null,
  };
}

function clearCatalogMetadata(line: InvoiceLine): void {
  line.catalogItemId = null;
  line.catalogSku = null;
  line.catalogName = null;
  line.lineOrigin = 'free';
  line.unitCode = '59';
  line.taxable = true;
  line.controlsInventory = false;
  line.itemPriceIncludesIva = false;
  line.inventoryBypassReason = null;
}

function newPaymentLine(amount = 0): PaymentLine {
  return {
    id: paymentLineId++,
    codigo: '01',
    montoPago: roundMoney(amount),
    referencia: '',
    plazo: paymentCondition.value === 2 ? '02' : '',
    periodo: paymentCondition.value === 2 ? 1 : null,
  };
}

function resetPayments(): void {
  paymentCondition.value = 1;
  paymentLineId = 1;
  paymentLines.value = supportsAdvancedPayments.value ? [newPaymentLine(roundMoney(totalLabel.value))] : [];
}

onMounted(async () => {
  window.addEventListener('keydown', handleIssueModalKeydown);
  await loadContext();
  await loadWorkshopOrderPrefill();
});

async function loadWorkshopOrderPrefill(): Promise<void> {
  if (!workshopOrderId || !platformTenantId.value) return;
  try {
    const order = (await platformClient.value.workshopOrder(platformTenantId.value, workshopOrderId)).data;
    if (order.billing.status === 'invoiced') {
      error.value = `La orden ${order.ticket} ya está vinculada al DTE ${order.billing.number || ''}.`;
      return;
    }
    if (!order.financial.closed_at || order.status === 'cancelled') {
      error.value = 'Solo una orden de trabajo cerrada puede prepararse para facturación.';
      return;
    }
    const customer = (await client.value.customer(order.customer.id)).customer;
    customerMode.value = 'base';
    applyCustomer(customer);
    const line = newInvoiceLine();
    line.description = `Servicio de reparación ${order.device.brand} ${order.device.model} · ${order.ticket}`;
    line.unitPrice = Number(order.financial.final_total ?? 0);
    lines.value = [line];
    form.observations = `Generado desde orden de trabajo ${order.ticket}.`;
    resetPayments();
    if (order.balance > 0) {
      paymentCondition.value = 2;
      paymentLines.value = supportsAdvancedPayments.value ? [newPaymentLine(roundMoney(totalLabel.value))] : [];
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar la orden de trabajo para facturación.';
  }
}

onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener('keydown', handleIssueModalKeydown);
  clearIssueAutoClose();
  clearCatalogLineSearchTimer();
  floatingToastTimers.forEach((timer) => window.clearTimeout(timer));
  deliveryPollTimers.forEach((timer) => window.clearTimeout(timer));
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

watch(() => form.documentType, () => {
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  fiscalCustomerTarget.value = null;
  customerSearch.value = '';
  customerSearchLocked.value = false;
  customers.value = [];
  customerMode.value = requiresStructuredCustomer.value ? 'base' : 'generic';

  if (requiresStructuredCustomer.value) {
    clearCustomerFields('');
  } else {
    setGenericCustomer();
  }
  resetPayments();
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
  () => form.documentType,
  sourceDocumentSearch,
], () => {
  void loadSourceDocuments();
});

watch(() => form.empresaId, () => {
  applyBillingStationPreference(selectedEmpresa.value);
});

watch(() => form.sucursalId, () => {
  if (!puntosVenta.value.some((punto) => punto.id === form.puntoVentaId)) {
    form.puntoVentaId = selectedSucursal.value?.puntosVenta[0]?.id ?? null;
  }
});

watch(() => props.initialDocumentType, (documentType) => {
  if (['01', '03', '05', '06', '14'].includes(documentType)) {
    form.documentType = documentType;
  }
});

async function loadContext(): Promise<void> {
  const cachedContext = peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope);
  const cachedCatalogs = peekBillingCatalogs(props.coreBaseUrl, props.billingContextCacheScope);

  if (cachedContext && cachedCatalogs) {
    applyInitialContext(cachedContext, cachedCatalogs);
  } else {
    contextLoading.value = true;
  }

  error.value = null;

  try {
    const [contextResult, catalogsResult] = await Promise.all([
      getBillingContext(client.value, props.coreBaseUrl, props.billingContextCacheScope),
      getBillingCatalogs(client.value, props.coreBaseUrl, props.billingContextCacheScope)
    ]);
    applyInitialContext(contextResult, catalogsResult);
    await loadCustomers();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar la configuracion de facturacion.';
  } finally {
    contextLoading.value = false;
  }
}

function applyInitialContext(contextResult: BillingContext, catalogsResult: BillingCatalogs): void {
  context.value = contextResult;
  catalogs.value = catalogsResult;
  form.empresaId = context.value.empresas[0]?.id ?? null;
  applyBillingStationPreference(context.value.empresas[0] ?? null);
  if (requiresStructuredCustomer.value) {
    customerMode.value = 'base';
    clearCustomerFields('');
  } else {
    setGenericCustomer();
  }
  lineId = 1;
  draftLine.value = newInvoiceLine();
  lines.value = [];
}

type BillingStationPreference = {
  sucursalId: number;
  puntoVentaId: number;
};

function billingStationStorageKey(empresaId: number): string {
  return `stelfaro.billing.station.${empresaId}`;
}

function readBillingStationPreference(empresa: BillingEmpresa): BillingStationPreference | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(billingStationStorageKey(empresa.id));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BillingStationPreference>;
    const sucursal = empresa.sucursales.find((item) => item.id === parsed.sucursalId) ?? null;
    const puntoVenta = sucursal?.puntosVenta.find((item) => item.id === parsed.puntoVentaId) ?? null;

    if (!sucursal || !puntoVenta) {
      window.localStorage.removeItem(billingStationStorageKey(empresa.id));
      return null;
    }

    return {
      sucursalId: sucursal.id,
      puntoVentaId: puntoVenta.id
    };
  } catch {
    return null;
  }
}

function applyBillingStationPreference(empresa: BillingEmpresa | null): void {
  if (!empresa) {
    form.sucursalId = null;
    form.puntoVentaId = null;
    return;
  }

  const preference = readBillingStationPreference(empresa);
  const sucursal = preference
    ? empresa.sucursales.find((item) => item.id === preference.sucursalId) ?? null
    : empresa.sucursales[0] ?? null;
  const puntoVenta = preference && sucursal
    ? sucursal.puntosVenta.find((item) => item.id === preference.puntoVentaId) ?? null
    : sucursal?.puntosVenta[0] ?? null;

  form.sucursalId = sucursal?.id ?? null;
  form.puntoVentaId = puntoVenta?.id ?? sucursal?.puntosVenta[0]?.id ?? null;
}

function saveBillingStationPreference(): void {
  if (!selectedEmpresa.value || !selectedSucursal.value || !selectedPuntoVenta.value || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(billingStationStorageKey(selectedEmpresa.value.id), JSON.stringify({
    sucursalId: selectedSucursal.value.id,
    puntoVentaId: selectedPuntoVenta.value.id
  }));
  stationPreferenceVersion.value++;
  pushFloatingToast({
    title: 'Equipo configurado',
    message: `${selectedSucursal.value.codigo} · ${selectedPuntoVenta.value.codigo} quedo fijado para este navegador.`,
    variant: 'success'
  });
}

function clearBillingStationPreference(): void {
  if (!selectedEmpresa.value || typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(billingStationStorageKey(selectedEmpresa.value.id));
  stationPreferenceVersion.value++;
  pushFloatingToast({
    title: 'Equipo liberado',
    message: 'Este navegador volvera a usar la primera sucursal disponible.',
    variant: 'success'
  });
}

watch(customerMode, (mode) => {
  customerSearchLocked.value = false;
  if (mode === 'generic') {
    if (requiresCustomerIdentificationByAmount.value) {
      customerMode.value = 'base';
      clearCustomerFields('');
      error.value = customerIdentificationByAmountMessage.value;
      return;
    }

    selectedCustomerId.value = null;
    selectedCustomerRecord.value = null;
    fiscalCustomerTarget.value = null;
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
  fiscalCustomerTarget.value = null;
  customerSearch.value = '';
  customerSearchLocked.value = false;
  customers.value = [];
  selectedSourceDocument.value = null;
  sourceDocumentSearch.value = '';
  sourceDocuments.value = [];
  resetPayments();

  if (documentType === '03' || documentType === '05' || documentType === '06' || documentType === '14') {
    customerMode.value = 'base';
    clearCustomerFields('');
    return;
  }

  customerMode.value = 'generic';
  setGenericCustomer();
});

watch(totalLabel, () => {
  if (supportsAdvancedPayments.value && paymentLines.value.length === 1) {
    paymentLines.value[0].montoPago = roundMoney(totalLabel.value);
  }
});

watch(supportsAdvancedPayments, () => {
  resetPayments();
}, { immediate: true });

watch(requiresCustomerIdentificationByAmount, (required) => {
  if (!required || customerMode.value !== 'generic') {
    return;
  }

  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  fiscalCustomerTarget.value = null;
  customerSearchLocked.value = false;
  customerSearch.value = '';
  customers.value = [];
  customerMode.value = 'base';
  clearCustomerFields('');
  customerSearchModalOpen.value = true;
  error.value = customerIdentificationByAmountMessage.value;
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

  correlativoLoading.value = true;
  try {
    const result = await client.value.previewCorrelativo(scope);
    correlativoPreview.value = result;
  } catch (caught) {
    correlativoPreview.value = null;
    if (!isAdjustmentNote.value) {
      error.value = caught instanceof Error ? caught.message : 'No fue posible consultar el correlativo.';
    }
  } finally {
    correlativoLoading.value = false;
  }
}

async function issueDocument(): Promise<void> {
  if (genericCustomerBlockedByAmount.value || (requiresCustomerIdentificationByAmount.value && !hasRequiredCustomerIdentification.value)) {
    error.value = customerIdentificationByAmountMessage.value;
    return;
  }

  if (!canIssuePositiveTotal.value) {
    error.value = 'No se puede emitir un DTE con total cero. Ajusta precio, cantidad o descuento antes de continuar.';
    return;
  }

  if (hasZeroValueLines.value && !zeroValueLineWarningConfirmed.value) {
    zeroValueLineWarningOpen.value = true;
    error.value = null;
    return;
  }

  zeroValueLineWarningConfirmed.value = false;
  clearIssueAutoClose();
  issuing.value = true;
  error.value = null;
  issueModalOpen.value = true;
  issueResult.value = null;
  issueProgress.value = 5;
  issueLiveMessage.value = 'Preparando emision del documento...';
  issueLog.value = [];
  issuePhaseIndex.value = 0;
  let inventoryReservation: PlatformInventoryReservation | null = null;
  let keepInventoryReservation = false;

  try {
    if (!await refreshSelectedCustomerForIssue()) {
      currentIssueIdempotencyKey = null;
      return;
    }

    const payload = buildPayloadOrNull(correlativoPreview.value ?? {
      correlativo_id: 0,
      correlativo: 1,
      numero_control: '',
      remaining: 0
    });
    if (!payload) {
      error.value = 'Completa emisor, punto de venta, receptor e item antes de emitir.';
      currentIssueIdempotencyKey = null;
      return;
    }

    currentIssueIdempotencyKey ??= issueIdempotencyKey();
    inventoryReservation = await reserveInventoryForIssue(currentIssueIdempotencyKey);
    payload.idempotency_key = currentIssueIdempotencyKey;
    currentStep.value = 'sent';
    const result = await client.value.issueProgress(payload, (event) => {
      if (event.type === 'stage') {
        const message = issueEventMessage(event);
        issueProgress.value = event.progress;
        issueLiveMessage.value = message;
        pushIssueLog(message);
        const idx = issuePhases.value.findIndex((phase) => phase.label.toLowerCase().includes(event.stage));
        if (idx >= 0) issuePhaseIndex.value = idx;
        return;
      }

      if (event.type === 'retry') {
        const message = issueEventMessage(event);
        issueProgress.value = event.progress;
        issueLiveMessage.value = message;
        pushIssueLog(message);
        const idx = issuePhases.value.findIndex((phase) => phase.label.toLowerCase().includes(event.stage));
        if (idx >= 0) issuePhaseIndex.value = idx;
        return;
      }

      if (event.type === 'completed') {
        issueProgress.value = event.progress ?? 100;
        issueLiveMessage.value = event.message;
        pushIssueLog(event.message, event.ok ? 'ok' : 'error');
      }
    });
    if (result) {
      const rejected = isIssueResponseRejected(result);
      if (inventoryReservation) {
        if (rejected) {
          await releaseInventoryReservation(inventoryReservation);
        } else {
          keepInventoryReservation = true;
          inventoryReservation = await confirmInventoryReservation(inventoryReservation, result);
        }
      }
      if (!rejected) {
        await recordInventorySale(result);
        if (workshopOrderId && platformTenantId.value) {
          try {
            await platformClient.value.linkWorkshopOrderInvoice(platformTenantId.value, workshopOrderId, {
              core_dte_document_id: result.document.id,
              dte_number: result.document.numeroControl,
            dte_generation_code: result.document.codigoGeneracion,
            dte_type: result.document.tipoDte === '03' ? '03' : '01',
            });
          } catch {
            pushIssueLog('El DTE fue emitido, pero quedó pendiente vincularlo con la orden de taller.', 'error');
          }
        }
      }
      issueResult.value = result;
      draft.value = result.document;
      void notifyEmailDelivery(result.document);
      correlativoPreview.value = null;
      preview.value = null;
      history.value = [];
      currentIssueIdempotencyKey = null;
      await previewNextCorrelativo();
    }
  } catch (caught) {
    if (inventoryReservation && !keepInventoryReservation) {
      await releaseInventoryReservation(inventoryReservation);
    }
    error.value = caught instanceof Error ? caught.message : 'No fue posible emitir el DTE.';
    pushIssueLog(error.value, 'error');
  } finally {
    issuing.value = false;
  }
}

async function confirmZeroValueLineWarning(): Promise<void> {
  zeroValueLineWarningOpen.value = false;
  zeroValueLineWarningConfirmed.value = true;
  await issueDocument();
}

async function sellWithoutInventoryOnce(): Promise<void> {
  const stockError = inventoryStockError.value;
  if (!stockError) return;

  lines.value = lines.value.map((line) => stockError.lineIds.includes(line.id) ? {
    ...line,
    lineOrigin: 'catalog',
    controlsInventory: false,
    inventoryBypassReason: 'insufficient_stock',
  } : line);
  error.value = null;
  issueModalOpen.value = false;
  currentIssueIdempotencyKey = null;
  await issueDocument();
}

function reviewInvoiceAfterStockError(): void {
  error.value = null;
  issueModalOpen.value = false;
  currentIssueIdempotencyKey = null;
}

async function refreshSelectedCustomerForIssue(): Promise<boolean> {
  if (!selectedCustomerId.value) {
    return true;
  }

  try {
    const response = await client.value.customer(selectedCustomerId.value);
    applyCustomer(response.customer);

    if (isCreditoFiscal.value && !isCustomerReadyForCreditoFiscal(response.customer)) {
      error.value = 'Completa los datos fiscales actualizados del cliente antes de emitir CCF.';
      return false;
    }

    return true;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible actualizar los datos del cliente seleccionado.';
    return false;
  }
}

function issueIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `issue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function reserveInventoryForIssue(idempotencyKey: string): Promise<PlatformInventoryReservation | null> {
  if (!platformTenantId.value || inventoryIssueLines.value.length === 0) return null;
  if (!selectedSucursal.value) {
    throw new Error('Selecciona una sucursal para reservar inventario.');
  }

  pushIssueLog('Reservando inventario FIFO...');
  const response = await platformClient.value.createInventoryReservation(platformTenantId.value, {
    idempotency_key: `dte-${idempotencyKey}`,
    core_sucursal_id: selectedSucursal.value.id,
    core_sucursal_code: selectedSucursal.value.codigo || null,
    core_sucursal_name: selectedSucursal.value.nombre || null,
    source_type: 'dte',
    metadata: {
      document_type: form.documentType,
      total: totalLabel.value,
      punto_venta_id: selectedPuntoVenta.value?.id ?? null,
      punto_venta_codigo: selectedPuntoVenta.value?.codigo ?? null,
    },
    lines: inventoryIssueLines.value
  });
  pushIssueLog('Inventario reservado.', 'ok');
  broadcastInventoryChange('reserved', response.data);

  return response.data;
}

async function confirmInventoryReservation(reservation: PlatformInventoryReservation, result: DteIssueResponse): Promise<PlatformInventoryReservation> {
  if (!platformTenantId.value) return reservation;

  pushIssueLog('Confirmando salida de inventario...');
  const response = await platformClient.value.confirmInventoryReservation(platformTenantId.value, reservation.id, {
    source_type: 'dte',
    source_id: String(result.document.id),
    source_number: result.document.numeroControl || result.document.codigoGeneracion || null,
  });
  pushIssueLog('Salida de inventario registrada.', 'ok');
  broadcastInventoryChange('confirmed', response.data);

  return response.data;
}

async function releaseInventoryReservation(reservation: PlatformInventoryReservation): Promise<void> {
  if (!platformTenantId.value || reservation.status !== 'reserved') return;

  try {
    const response = await platformClient.value.releaseInventoryReservation(platformTenantId.value, reservation.id);
    pushIssueLog('Inventario liberado.', 'ok');
    broadcastInventoryChange('released', response.data);
  } catch {
    pushIssueLog('No se pudo liberar la reserva de inventario automaticamente.', 'error');
  }
}

function broadcastInventoryChange(action: 'reserved' | 'confirmed' | 'released', reservation: PlatformInventoryReservation): void {
  if (typeof window === 'undefined' || !platformTenantId.value) return;

  const detail = {
    action,
    tenant_id: platformTenantId.value,
    core_sucursal_id: reservation.core_sucursal_id ?? selectedSucursal.value?.id ?? null,
    reservation_id: reservation.id,
    at: Date.now()
  };
  window.dispatchEvent(new CustomEvent(INVENTORY_CHANGED_EVENT, { detail }));

  try {
    window.localStorage.setItem(INVENTORY_CHANGED_EVENT, JSON.stringify(detail));
  } catch {
    // localStorage solo sincroniza otras pestañas; el evento local ya fue emitido.
  }
}

async function recordInventorySale(result: DteIssueResponse): Promise<void> {
  if (!platformTenantId.value || !selectedSucursal.value || items.value.length === 0) return;

  try {
    await platformClient.value.recordInventorySale(platformTenantId.value, {
      core_sucursal_id: selectedSucursal.value.id,
      core_sucursal_code: selectedSucursal.value.codigo || null,
      core_sucursal_name: selectedSucursal.value.nombre || null,
      source_type: workshopOrderId ? 'workshop_order' : 'dte',
      source_id: workshopOrderId ? String(workshopOrderId) : String(result.document.id),
      source_number: result.document.numeroControl || result.document.codigoGeneracion || null,
      sale_date: new Date().toISOString().slice(0, 10),
      metadata: {
        document_type: form.documentType,
        core_dte_document_id: result.document.id,
        dte_number: result.document.numeroControl || result.document.codigoGeneracion || null,
        customer_name: form.customerName || null,
        total: totalLabel.value,
        inventory_bypass: lines.value
          .filter((line) => line.inventoryBypassReason)
          .map((line) => ({
            catalog_item_id: line.catalogItemId ? Number(line.catalogItemId) : null,
            description: line.description,
            quantity: Number(line.quantity || 0),
            reason: line.inventoryBypassReason,
          })),
      },
      lines: items.value
        .filter((line) => line.description.trim() !== '' && Number(line.quantity || 0) > 0)
        .map((line) => ({
          catalog_item_id: line.catalogItemId ? Number(line.catalogItemId) : null,
          line_origin: line.lineOrigin ?? 'free',
          description: line.description,
          quantity: Number(line.quantity || 0),
          unit_price: Number(line.unitPrice || 0),
          discount_amount: lineDiscountAmount(line),
          net_total: lineNetTotal(line),
          reference_unit_cost: null,
        })),
    });
    pushIssueLog('Venta registrada para reportes de inventario.', 'ok');
    window.dispatchEvent(new CustomEvent(INVENTORY_CHANGED_EVENT, { detail: { action: 'sale_recorded', tenant_id: platformTenantId.value, at: Date.now() } }));
  } catch {
    pushIssueLog('El DTE fue emitido, pero no se pudo registrar la venta para reportes.', 'error');
  }
}

function isIssueResponseRejected(result: DteIssueResponse): boolean {
  return result.document.transmission?.status === 'REJECTED' || result.document.estado === 'rejected';
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
  flushPendingEmailToast();
}

function resetInvoiceForm(): void {
  preview.value = null;
  draft.value = null;
  history.value = [];
  currentStep.value = null;
  error.value = null;
  issueResult.value = null;
  issueProgress.value = 0;
  issueLiveMessage.value = null;
  issueLog.value = [];
  issuePhaseIndex.value = 0;
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  fiscalCustomerTarget.value = null;
  customerSearch.value = '';
  customerSearchLocked.value = false;
  customers.value = [];
  customerModalMode.value = null;
  fiscalCustomerModalOpen.value = false;
  sujetoExcluidoModalOpen.value = false;
  customerSearchModalOpen.value = false;
  fiscalModalDepartamento.value = '';
  fiscalModalMunicipio.value = '';
  form.observations = '';
  selectedSourceDocument.value = null;
  sourceDocumentSearch.value = '';
  sourceDocuments.value = [];
  resetPayments();
  customerMode.value = requiresStructuredCustomer.value ? 'base' : 'generic';
  if (requiresStructuredCustomer.value) {
    clearCustomerFields('');
  } else {
    setGenericCustomer();
  }
  lineId = 1;
  draftLine.value = newInvoiceLine();
  lines.value = [];
}

async function notifyEmailDelivery(document: DteDraftSummary): Promise<void> {
  const delivery = document.notifications?.dte_delivery
    ?? (document as DteDraftSummary & { metadata?: { notifications?: DteDraftSummary['notifications'] } }).metadata?.notifications?.dte_delivery;
  if (!delivery) {
    return;
  }

  const status = String(delivery?.status ?? '').toLowerCase();
  if (!['pending', 'queued', 'waiting_transport', 'sent', 'delivered', 'failed'].includes(status)) {
    return;
  }

  if (['sent', 'delivered'].includes(status)) {
    queueEmailSentToast(delivery.recipient_email ?? null);
    return;
  }

  if (status === 'failed') {
    return;
  }

  try {
    await waitForEmailSent(document.id, delivery.recipient_email ?? null);
  } catch {
    // La emision ya termino; si la consulta de entrega falla, evitamos mostrar un estado no confirmado.
  }
}

async function waitForEmailSent(documentId: number, fallbackRecipient?: string | null): Promise<void> {
  for (let attempt = 0; attempt < 14 && !unmounted; attempt += 1) {
    if (attempt > 0) {
      await waitForDeliveryPoll(1500);
    }

    const response = await client.value.dteEmailDelivery(documentId);
    if (draft.value?.id === documentId) {
      draft.value = response.document;
    }

    const status = String(response.notification?.status ?? '').toLowerCase();
    if (['sent', 'delivered'].includes(status)) {
      queueEmailSentToast(response.notification?.recipient_email ?? fallbackRecipient ?? null);
      return;
    }

    if (status === 'failed') {
      return;
    }
  }
}

function queueEmailSentToast(recipientEmail?: string | null): void {
  const recipient = recipientEmail ? ` a ${recipientEmail}` : ' al correo del cliente';
  const toast = {
    title: 'Correo enviado',
    message: `El comprobante fue enviado${recipient}.`,
    variant: 'success'
  } satisfies Omit<BillingFloatingToast, 'id'>;

  if (issueOverlayOpen.value || issueModalOpen.value) {
    pendingEmailToast.value = toast;
    return;
  }

  pushFloatingToast(toast);
}

function waitForDeliveryPoll(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, milliseconds);
    deliveryPollTimers.push(timer);
  });
}

function flushPendingEmailToast(): void {
  if (!pendingEmailToast.value) {
    return;
  }

  pushFloatingToast(pendingEmailToast.value);
  pendingEmailToast.value = null;
}

function pushFloatingToast(toast: Omit<BillingFloatingToast, 'id'>): void {
  const id = ++floatingToastId;
  floatingToasts.value = [...floatingToasts.value, { id, ...toast }];
  const timer = window.setTimeout(() => {
    floatingToasts.value = floatingToasts.value.filter((item) => item.id !== id);
  }, toast.variant === 'success' || !toast.variant ? 4000 : 4300);
  floatingToastTimers.push(timer);
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
    ivaRete: isNotaCredito.value ? notaCreditoIvaRete.value : undefined,
    ivaPerci: isNotaCredito.value ? notaCreditoIvaPerci.value : undefined,
    reteRenta: isSujetoExcluido.value ? sujetoExcluidoReteRenta.value : undefined,
    totalNoGravado: isNotaCredito.value ? notaCreditoTotalNoGravado.value : undefined,
    relatedDocument: isAdjustmentNote.value ? selectedSourceDocument.value : null,
    observations: isAdjustmentNote.value && selectedSourceDocument.value
      ? `${adjustmentNoteLabel.value} relacionada a ${selectedSourceDocument.value.numeroControl}`
      : form.observations.trim() === '' ? null : form.observations.trim(),
    paymentCondition: supportsAdvancedPayments.value ? paymentCondition.value : undefined,
    payments: supportsAdvancedPayments.value
      ? paymentLines.value.map((payment) => ({
        codigo: payment.codigo,
        montoPago: Number(payment.montoPago || 0),
        referencia: normalizedPaymentReference(payment),
        plazo: payment.plazo || null,
        periodo: payment.plazo ? Number(payment.periodo || 0) : null,
      }))
      : undefined,
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
  if (mode === 'generic' && requiresCustomerIdentificationByAmount.value) {
    error.value = customerIdentificationByAmountMessage.value;
    return;
  }

  if (mode === 'fiscal_new') {
    if (isSujetoExcluido.value) {
      sujetoExcluidoModalOpen.value = true;
      return;
    }

    fiscalCustomerTarget.value = null;
    fiscalModalDepartamento.value = '';
    fiscalModalMunicipio.value = '';
    fiscalCustomerModalOpen.value = true;
    return;
  }

  if (mode === 'new' || mode === 'quick') {
    fiscalModalDepartamento.value = form.customerDepartment;
    fiscalModalMunicipio.value = form.customerMunicipality;
    customerModalMode.value = mode;
    return;
  }

  customerMode.value = mode;
  if (mode === 'base') {
    customerSearchModalOpen.value = true;
  }
}

function isCustomerReadyForCreditoFiscal(customer: BillingCustomer): boolean {
  return Boolean(
    (customer.nit || customer.document_number)
    && customer.nrc
    && customer.cod_actividad
    && customer.desc_actividad
    && customer.departamento
    && customer.municipio
    && customer.distrito
    && customer.direccion_complemento
    && customer.email
  );
}

function fiscalCustomerInitialValue(customer: BillingCustomer | null): Partial<BillingFiscalCustomerModalPayload> | null {
  if (!customer) return null;

  return {
    name: customer.name,
    document_type: '36',
    document_number: customer.nit ?? customer.document_number ?? '',
    nit: customer.nit ?? customer.document_number ?? '',
    nrc: customer.nrc ?? '',
    cod_actividad: customer.cod_actividad ?? '',
    desc_actividad: customer.desc_actividad ?? '',
    nombre_comercial: customer.nombre_comercial ?? customer.name,
    departamento: customer.departamento ?? '',
    municipio: customer.municipio ?? '',
    distrito: customer.distrito ?? '',
    direccion_complemento: customer.direccion_complemento ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
  };
}

function openFiscalComplement(customer: BillingCustomer): void {
  fiscalCustomerTarget.value = customer;
  fiscalModalDepartamento.value = customer.departamento ?? '';
  fiscalModalMunicipio.value = customer.municipio ?? '';
  fiscalCustomerModalOpen.value = true;
}

function closeFiscalCustomerModal(): void {
  fiscalCustomerModalOpen.value = false;
  fiscalCustomerTarget.value = null;
}

async function handleFiscalCustomerSave(payload: BillingFiscalCustomerModalPayload): Promise<void> {
  if (!selectedEmpresa.value) {
    error.value = 'Selecciona una empresa emisora antes de guardar clientes.';
    return;
  }

  const target = fiscalCustomerTarget.value;
  const response = await run(() => target
    ? client.value.updateCustomer(target.id, payload)
    : client.value.saveCustomer({
      empresa_id: selectedEmpresa.value!.id,
      ...payload
    }));

  if (response) {
    await loadCustomers();
    customerMode.value = 'base';
    applyCustomer(response.customer);
    fiscalCustomerModalOpen.value = false;
    fiscalCustomerTarget.value = null;
  }
}

async function handleSujetoExcluidoSave(payload: BillingSujetoExcluidoModalPayload): Promise<void> {
  if (!selectedEmpresa.value) {
    error.value = 'Selecciona una empresa emisora antes de guardar sujetos excluidos.';
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
    sujetoExcluidoModalOpen.value = false;
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
  form.customerDepartment = payload.departamento ?? '';
  form.customerMunicipality = payload.municipio ?? '';
  form.customerDistrict = payload.distrito ?? '';
  form.customerAddress = payload.direccion_complemento ?? '';
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
    departamento: payload.departamento,
    municipio: payload.municipio,
    distrito: payload.distrito,
    direccion_complemento: payload.direccion_complemento,
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
  const normalized = customerDocumentForCurrentDte(customer);
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

  if (isCreditoFiscal.value && !isCustomerReadyForCreditoFiscal(customer)) {
    openFiscalComplement(customer);
  }
}

function clearSelectedCustomer(): void {
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  fiscalCustomerTarget.value = null;
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
  fiscalCustomerTarget.value = null;
}

function customerSearchLabel(customer: BillingCustomer): string {
  const normalized = customerDocumentForCurrentDte(customer);
  const doc = normalized.documentNumber ? ` · ${normalized.documentType} ${normalized.documentNumber}` : '';

  return `${customer.name}${doc}`;
}

function customerDocumentForCurrentDte(customer: BillingCustomer): { documentType: string; documentNumber: string } {
  const documentValue = isCreditoFiscal.value
    ? customer.nit ?? customer.document_number ?? ''
    : customer.document_number ?? customer.nit ?? '';
  const documentType = isCreditoFiscal.value
    ? '36'
    : customer.document_type ?? (customer.nit && !customer.document_number ? '36' : '');

  return normalizeCustomerDocument(documentType, documentValue);
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

async function loadSourceDocuments(): Promise<void> {
  if (selectedSourceDocument.value && sourceDocumentSearch.value.includes(selectedSourceDocument.value.numeroControl)) {
    sourceDocuments.value = [];
    return;
  }

  if (!isAdjustmentNote.value || !selectedEmpresa.value || sourceDocumentSearch.value.trim().length < 2) {
    sourceDocuments.value = [];
    return;
  }

  try {
    const response = await client.value.documents({
      empresa_id: selectedEmpresa.value.id,
      tipo_dte: '03',
      estado: 'accepted',
      q: sourceDocumentSearch.value.trim(),
      limit: 10,
    });
    sourceDocuments.value = response.data;
  } catch {
    sourceDocuments.value = [];
  }
}

async function selectSourceDocument(document: DteDraftSummary): Promise<void> {
  if (document.is_related_by_adjustment) {
    error.value = `Ese documento ya esta relacionado con ${document.related_by_adjustment?.numeroControl ?? 'otra nota de ajuste'}.`;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const detail = await client.value.document(document.id);
    selectedSourceDocument.value = detail;
    sourceDocumentSearch.value = `${detail.numeroControl} · ${sourceReceptorName(detail)}`;
    sourceDocuments.value = [];
    applyNotaCreditoSource(detail);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el documento origen.';
  } finally {
    loading.value = false;
  }
}

function clearSourceDocument(): void {
  selectedSourceDocument.value = null;
  sourceDocumentSearch.value = '';
  sourceDocuments.value = [];
  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  clearCustomerFields('');
  lines.value = [];
  draftLine.value = newInvoiceLine();
}

function applyNotaCreditoSource(document: DteDraftSummary): void {
  const payload = documentPayload(document);
  const receptor = asRecord(payload.receptor);
  const direccion = asRecord(receptor.direccion);
  const documentNumber = onlyDigits(String(receptor.numDocumento ?? receptor.nit ?? ''));

  selectedCustomerId.value = null;
  selectedCustomerRecord.value = null;
  customerSearchLocked.value = true;
  customerMode.value = 'base';
  form.customerName = String(receptor.nombre ?? '');
  form.customerDocumentType = String(receptor.tipoDocumento ?? '36');
  form.customerDocument = documentNumber;
  form.customerNrc = onlyDigits(String(receptor.nrc ?? ''));
  form.customerActivityCode = String(receptor.codActividad ?? '');
  form.customerActivityDescription = String(receptor.descActividad ?? '');
  form.customerCommercialName = String(receptor.nombreComercial ?? receptor.nombre ?? '');
  form.customerDepartment = String(direccion.departamento ?? '');
  form.customerMunicipality = String(direccion.municipio ?? '');
  form.customerDistrict = String(direccion.distrito ?? '');
  form.customerAddress = String(direccion.complemento ?? '');
  form.customerPhone = String(receptor.telefono ?? '');
  form.customerEmail = String(receptor.correo ?? '');

  const sourceItems = Array.isArray(payload.cuerpoDocumento) ? payload.cuerpoDocumento : [];
  const sourceRecords = sourceItems.map((sourceItem) => asRecord(sourceItem));
  const sourceIva = allocateSourceIva(payload, sourceRecords);
  lines.value = sourceItems
    .map((sourceItem, index) => sourceLineToInvoiceLine(asRecord(sourceItem), index, sourceIva[index] ?? 0))
    .filter((line) => line.description.trim() !== '' && Number(line.quantity) > 0);
  draftLine.value = newInvoiceLine();
}

function sourceLineToInvoiceLine(sourceItem: Record<string, unknown>, index: number, ivaAmount: number): InvoiceLine {
  const quantity = Number(sourceItem.cantidad ?? 1);
  const unitPrice = Number(sourceItem.precioUni ?? 0);

  return {
    id: lineId++,
    description: String(sourceItem.descripcion ?? `Linea ${index + 1}`),
    quantity,
    unitPrice,
    discount: 0,
    discountPercent: 0,
    originalQuantity: quantity,
    originalUnitPrice: unitPrice,
    originalIva: ivaAmount,
    sourceLine: true,
  };
}

function allocateSourceIva(payload: Record<string, unknown>, sourceItems: Record<string, unknown>[]): number[] {
  const totalIva = sourceTotalIva(payload);
  if (sourceItems.length === 0 || totalIva <= 0) return sourceItems.map(() => 0);

  const bases = sourceItems.map((item) => sourceLineTaxableBase(item));
  const totalBase = bases.reduce((sum, base) => sum + base, 0);
  if (totalBase <= 0) {
    return sourceItems.map((_, index) => index === 0 ? totalIva : 0);
  }

  let assigned = 0;

  return sourceItems.map((_, index) => {
    if (index === sourceItems.length - 1) {
      return roundMoney(Math.max(0, totalIva - assigned));
    }

    const value = roundMoney(totalIva * (bases[index] / totalBase));
    assigned = roundMoney(assigned + value);

    return value;
  });
}

function sourceTotalIva(payload: Record<string, unknown>): number {
  const resumen = asRecord(payload.resumen);
  const totalIva = Number(resumen.totalIva ?? 0);
  if (totalIva > 0) return roundMoney(totalIva);

  const tributos = Array.isArray(resumen.tributos) ? resumen.tributos : [];
  const ivaTributo = tributos
    .map((tributo) => asRecord(tributo))
    .find((tributo) => String(tributo.codigo ?? '') === '20');

  return roundMoney(Number(ivaTributo?.valor ?? 0));
}

function sourceSummaryNumber(payload: Record<string, unknown>, keys: string[]): number {
  const resumen = asRecord(payload.resumen);

  for (const key of keys) {
    const value = Number(resumen[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return roundMoney(value);
  }

  return 0;
}

function proportionalSourceSummaryAmount(keys: string[]): number {
  if (!selectedSourceDocument.value || !isAdjustmentNote.value || notaCreditoRatio.value <= 0) return 0;

  const sourceAmount = sourceSummaryNumber(documentPayload(selectedSourceDocument.value), keys);

  return roundMoney(sourceAmount * notaCreditoRatio.value);
}

function sourceLineTaxableBase(sourceItem: Record<string, unknown>): number {
  const explicitBase = Number(sourceItem.ventaGravada ?? 0);
  if (explicitBase > 0) return explicitBase;

  const quantity = Number(sourceItem.cantidad ?? 1);
  const unitPrice = Number(sourceItem.precioUni ?? 0);
  const discount = Number(sourceItem.montoDescu ?? 0);

  return Math.max(0, (quantity * unitPrice) - discount);
}

function updateNotaCreditoPrice(line: InvoiceLine, value: number | string): void {
  if (isNotaDebito.value) {
    const minimum = line.sourceLine === false ? 0 : Number(line.originalUnitPrice ?? 0);
    line.unitPrice = roundMoney(Math.max(minimum, Number(value || 0)));
    return;
  }

  const max = Number(line.originalUnitPrice ?? line.unitPrice ?? 0);
  const next = Math.max(0, Math.min(max, Number(value || 0)));
  line.unitPrice = roundMoney(next);
}

function updateAdjustmentQuantity(line: InvoiceLine, value: number | string): void {
  const next = Math.max(0, Number(value || 0));

  if (isNotaDebito.value) {
    const minimum = line.sourceLine === false ? 0.01 : Number(line.originalQuantity ?? line.quantity ?? 0);
    line.quantity = roundMoney(Math.max(minimum, next));
    return;
  }

  if (isNotaCredito.value) {
    const max = Number(line.originalQuantity ?? line.quantity ?? 0);
    line.quantity = roundMoney(Math.min(max, next));
    return;
  }

  line.quantity = roundMoney(next);
}

function sourceLineMaxLabel(line: InvoiceLine): string {
  return `Max. ${currency(Number(line.originalUnitPrice ?? line.unitPrice ?? 0))}`;
}

function documentPayload(document: DteDraftSummary): Record<string, unknown> {
  return asRecord(document.payload ?? document.dte_json ?? {});
}

function sourceReceptorName(document: DteDraftSummary): string {
  return String(asRecord(documentPayload(document).receptor).nombre ?? document.empresa?.razon_social ?? 'Receptor fiscal');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function onDraftLineDescriptionInput(value: string): void {
  draftLine.value.description = value;

  if (value.trim() === '') {
    clearCatalogMetadata(draftLine.value);
  } else if (draftLine.value.catalogItemId && !descriptionMatchesCatalog(value, draftLine.value.catalogName)) {
    clearCatalogMetadata(draftLine.value);
  }

  scheduleCatalogLineSearch(value);
}

function descriptionMatchesCatalog(value: string, catalogName: string | null | undefined): boolean {
  const current = normalizedLineSearchText(value);
  const selected = normalizedLineSearchText(catalogName ?? '');
  if (!current || !selected) return false;
  if (current.includes(selected) || selected.includes(current)) return true;

  const currentTokens = new Set(current.split(' ').filter((token) => token.length >= 4));

  return selected.split(' ').some((token) => token.length >= 4 && currentTokens.has(token));
}

function normalizedLineSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scheduleCatalogLineSearch(value: string): void {
  clearCatalogLineSearchTimer();

  if (!canUseCatalogLineSearch.value || value.trim().length < 2) {
    resetCatalogLineSuggestions();
    return;
  }

  const token = ++catalogLineSearchToken;
  catalogLineSearchTimer = window.setTimeout(() => {
    void loadCatalogLineSuggestions(value, token);
  }, 220);
}

function clearCatalogLineSearchTimer(): void {
  if (catalogLineSearchTimer) {
    window.clearTimeout(catalogLineSearchTimer);
    catalogLineSearchTimer = null;
  }
}

function resetCatalogLineSuggestions(): void {
  catalogLineSearchToken += 1;
  catalogLineSuggestions.value = [];
  catalogLineSuggestionsOpen.value = false;
  catalogLineLoading.value = false;
}

async function loadCatalogLineSuggestions(value: string, token: number): Promise<void> {
  const query = value.trim();
  if (!platformTenantId.value || query.length < 2) return;

  catalogLineLoading.value = true;
  try {
    const response = await platformClient.value.catalogItems(platformTenantId.value, {
      q: query,
      status: 'active',
      per_page: 8,
    });
    if (token !== catalogLineSearchToken || normalizedLineSearchText(draftLine.value.description) !== normalizedLineSearchText(query)) {
      return;
    }

    catalogLineSuggestions.value = response.data;
    catalogLineSuggestionsOpen.value = true;
  } catch {
    if (token === catalogLineSearchToken) {
      resetCatalogLineSuggestions();
    }
  } finally {
    if (token === catalogLineSearchToken) {
      catalogLineLoading.value = false;
    }
  }
}

function selectCatalogItemForDraft(item: PlatformCatalogItem): void {
  draftLine.value = {
    ...draftLine.value,
    description: item.name,
    unitPrice: Number(item.base_price || 0),
    discount: 0,
    discountPercent: 0,
    catalogItemId: item.id,
    catalogSku: item.sku,
    catalogName: item.name,
    lineOrigin: item.controls_inventory ? 'inventory' : 'catalog',
    unitCode: item.unit_code,
    taxable: item.taxable,
    controlsInventory: item.controls_inventory,
    itemPriceIncludesIva: item.base_price_includes_tax,
    inventoryBypassReason: null,
  };
  resetCatalogLineSuggestions();
}

function closeCatalogLineSuggestions(): void {
  window.setTimeout(() => {
    catalogLineSuggestionsOpen.value = false;
  }, 140);
}

function lineOriginLabel(line: InvoiceLine): string {
  if (line.inventoryBypassReason) return 'Catálogo · esta venta';
  if (line.lineOrigin === 'inventory') return 'Inventario';
  if (line.lineOrigin === 'catalog') return 'Catálogo';

  return 'Libre';
}

function lineOriginClass(line: InvoiceLine): string {
  if (line.inventoryBypassReason) return 'bg-amber-50 text-amber-700 dark:bg-warning-soft dark:text-warning';
  if (line.lineOrigin === 'inventory') return 'bg-emerald-50 text-emerald-700 dark:bg-success-soft dark:text-success';
  if (line.lineOrigin === 'catalog') return 'bg-sky-50 text-sky-700 dark:bg-primary-soft dark:text-primary';

  return 'bg-slate-100 text-slate-500 dark:bg-surface-muted dark:text-muted';
}

function addLine(): void {
  const line = draftLine.value;
  if (!line.description.trim() || Number(line.quantity) <= 0 || Number(line.unitPrice) < 0 || (isNotaDebito.value && Number(line.unitPrice) <= 0)) {
    error.value = 'Completa descripcion, cantidad y precio antes de agregar la linea.';
    return;
  }

  lines.value = [...lines.value, {
    ...line,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    discount: isNotaDebito.value ? 0 : lineDiscountAmount(line),
    discountPercent: isNotaDebito.value ? 0 : Math.max(0, Math.min(100, Number(line.discountPercent || 0))),
    sourceLine: false,
  }];
  draftLine.value = newInvoiceLine();
  resetCatalogLineSuggestions();
  error.value = null;
}

function removeLine(id: number): void {
  lines.value = lines.value.filter((line) => line.id !== id);
}

function addPaymentLine(): void {
  paymentLines.value = [...paymentLines.value, newPaymentLine(0)];
}

function setCashPayment(): void {
  paymentCondition.value = 1;
  paymentLineId = 1;
  paymentLines.value = [newPaymentLine(roundMoney(totalLabel.value))];
}

function openPaymentModal(): void {
  if (paymentLines.value.length === 0) {
    paymentLines.value = [newPaymentLine(roundMoney(totalLabel.value))];
  }

  paymentModalOpen.value = true;
}

function removePaymentLine(id: number): void {
  paymentLines.value = paymentLines.value.filter((payment) => payment.id !== id);
  if (supportsAdvancedPayments.value && paymentLines.value.length === 0) {
    paymentLines.value = [newPaymentLine(roundMoney(totalLabel.value))];
  }
}

function fillRemainingPayment(payment: PaymentLine): void {
  const others = paymentLines.value
    .filter((entry) => entry.id !== payment.id)
    .reduce((sum, entry) => sum + Number(entry.montoPago || 0), 0);
  payment.montoPago = roundMoney(Math.max(0, totalLabel.value - others));
}

function updatePaymentCondition(value: string): void {
  paymentCondition.value = Number(value) as PaymentCondition;
  if (paymentCondition.value === 1) {
    paymentLines.value = paymentLines.value.map((payment) => ({
      ...payment,
      plazo: '',
      periodo: null,
    }));
  }

  if (paymentCondition.value === 2) {
    paymentLines.value = paymentLines.value.map((payment) => ({
      ...payment,
      referencia: '',
      plazo: payment.plazo || '02',
      periodo: Number(payment.periodo || 0) > 0 ? payment.periodo : 1,
    }));
  }
}
</script>

<template>
  <div class="grid gap-6 pb-28">
    <BillingCustomerModal
      v-if="customerModalMode"
      :open="Boolean(customerModalMode)"
      :mode="customerModalMode"
      :loading="loading"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      :initial-value="customerModalMode === 'quick' ? {
        name: form.customerName,
        document_number: form.customerDocument,
        email: form.customerEmail,
        phone: form.customerPhone,
        departamento: form.customerDepartment,
        municipio: form.customerMunicipality,
        distrito: form.customerDistrict,
        direccion_complemento: form.customerAddress
      } : null"
      @close="customerModalMode = null"
      @save="handleCustomerModalSave"
      @update:departamento="fiscalModalDepartamento = $event"
      @update:municipio="fiscalModalMunicipio = $event"
    />

    <BillingFiscalCustomerModal
      :open="fiscalCustomerModalOpen"
      :loading="loading"
      :initial-value="fiscalCustomerInitialValue(fiscalCustomerTarget)"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="closeFiscalCustomerModal"
      @save="handleFiscalCustomerSave"
      @update:departamento="fiscalModalDepartamento = $event"
      @update:municipio="fiscalModalMunicipio = $event"
    />

    <BillingSujetoExcluidoModal
      :open="sujetoExcluidoModalOpen"
      :loading="loading"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="sujetoExcluidoModalOpen = false"
      @save="handleSujetoExcluidoSave"
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

    <BillingModalShell
      :open="paymentModalOpen"
      title="Pago"
      eyebrow="Resumen DTE"
      description="Ajusta condicion, formas de pago, referencias y plazo cuando aplique."
      max-width="max-w-5xl"
      body-class="px-5 py-5"
      @close="paymentModalOpen = false"
    >
      <div class="grid gap-4">
        <div class="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)] md:items-end">
          <UiSelect
            label="Condicion de la operacion"
            :model-value="paymentCondition"
            :options="paymentConditionOptions"
            @update:model-value="updatePaymentCondition(String($event))"
          />
          <div class="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-surface-muted">
            <span class="font-semibold text-slate-500 dark:text-muted">Total formas de pago:</span>
            <span class="ml-2 font-bold" :class="paymentTotalMatches ? 'text-emerald-700 dark:text-success' : 'text-red-700 dark:text-danger'">{{ currency(paymentTotal) }}</span>
            <span class="ml-2 text-slate-500 dark:text-muted">de {{ currency(totalLabel) }}</span>
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-slate-200 dark:border-line">
          <table class="w-full min-w-[960px] text-left text-sm">
            <thead class="bg-blue-50/70 text-xs uppercase text-slate-500 dark:bg-surface-muted dark:text-soft">
              <tr>
                <th class="px-3 py-2">Forma</th>
                <th class="w-32 px-3 py-2">Monto</th>
                <th class="w-48 px-3 py-2">Referencia</th>
                <th class="w-36 px-3 py-2">Plazo</th>
                <th class="w-28 px-3 py-2">Periodo</th>
                <th class="w-28 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-line">
              <tr v-for="payment in paymentLines" :key="payment.id">
                <td class="px-3 py-2">
                  <UiSelect v-model="payment.codigo" label="Forma de pago" :options="paymentMethodOptions" hide-label />
                </td>
                <td class="px-3 py-2">
                  <UiInput v-model.number="payment.montoPago" label="Monto" hide-label min="0" step="0.01" type="number" />
                  <UiButton class="mt-1 px-2 py-1 text-[11px]" variant="ghost" size="sm" type="button" @click="fillRemainingPayment(payment)">Usar saldo</UiButton>
                </td>
                <td class="px-3 py-2">
                  <UiInput
                    v-model="payment.referencia"
                    label="Referencia"
                    hide-label
                    :disabled="paymentReferenceDisabled(payment)"
                    maxlength="50"
                    :placeholder="paymentReferenceDisabled(payment) ? 'No aplica' : 'Opcional'"
                  />
                </td>
                <td class="px-3 py-2">
                  <UiSelect v-model="payment.plazo" label="Plazo" :options="paymentTermOptions" hide-label />
                </td>
                <td class="px-3 py-2">
                  <UiInput v-model.number="payment.periodo" label="Periodo" hide-label min="1" step="1" type="number" :disabled="!payment.plazo" />
                </td>
                <td class="px-3 py-2 text-right">
                  <UiButton variant="ghost" size="sm" type="button" @click="removePaymentLine(payment.id)">Quitar</UiButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="!hasValidAdvancedPayments" class="text-sm font-medium text-red-700 dark:text-danger">
          Las formas de pago deben sumar el total y completar plazo/periodo cuando aplique.
        </p>
      </div>

      <template #footer>
        <UiButton variant="secondary" type="button" @click="addPaymentLine">Agregar forma de pago</UiButton>
        <UiButton type="button" @click="paymentModalOpen = false">Listo</UiButton>
      </template>
    </BillingModalShell>

    <BillingModalShell
      :open="observationsModalOpen"
      title="Observaciones"
      eyebrow="Informacion adicional"
      max-width="max-w-2xl"
      @close="observationsModalOpen = false"
    >
      <UiTextarea
        v-model="form.observations"
        label="Detalle"
        maxlength="3000"
        placeholder="Ej. Compra patrocinada para cliente B"
        :rows="5"
      />

      <template #footer>
        <UiButton variant="secondary" type="button" @click="form.observations = ''">Limpiar</UiButton>
        <UiButton type="button" @click="observationsModalOpen = false">Listo</UiButton>
      </template>
    </BillingModalShell>

    <BillingModalShell
      :open="zeroValueLineWarningOpen"
      title="Lineas con valor cero"
      eyebrow="Revision antes de emitir"
      max-width="max-w-xl"
      @close="zeroValueLineWarningOpen = false"
    >
      <div class="space-y-4">
        <div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Hay {{ zeroValueLines.length }} linea{{ zeroValueLines.length === 1 ? '' : 's' }} con precio o total cero. El DTE tiene total mayor que cero, pero conviene confirmar que esas lineas realmente deben emitirse asi.
        </div>

        <div class="max-h-56 overflow-y-auto rounded-md border border-slate-200 dark:border-line">
          <div
            v-for="line in zeroValueLines"
            :key="line.description"
            class="flex items-center justify-between gap-4 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 dark:border-line"
          >
            <span class="min-w-0 truncate font-semibold text-slate-950 dark:text-text">{{ line.description }}</span>
            <span class="shrink-0 text-slate-600 dark:text-muted">{{ currency(lineNetTotal(line)) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" type="button" @click="zeroValueLineWarningOpen = false">Revisar lineas</UiButton>
        <UiButton type="button" @click="confirmZeroValueLineWarning">Emitir de todos modos</UiButton>
      </template>
    </BillingModalShell>

    <BillingProcessToastOverlay
      :open="issueOverlayOpen"
      :variant="issueOverlayVariant"
      :title="issueOverlayTitle"
      :message="issueOverlayMessage"
      @close="closeIssueModal"
    />

    <BillingProcessModal
      :open="issueDiagnosticModalOpen"
      :eyebrow="issueCompactError ? '' : 'Emision DTE'"
      :title="issuing ? 'Emitiendo documento' : issueRejected ? 'Documento rechazado por MH' : issueInContingency ? 'Emision en contingencia' : issueResult ? 'Emision procesada' : 'No se pudo emitir'"
      :subtitle="issueCompactError ? '' : `Ambiente ${selectedEmpresa?.ambiente ?? '00'} · ${selectedEmpresa?.nombre_comercial ?? 'Empresa emisora'}`"
      :compact="issueCompactError"
      :processing="issuing"
      :accepted="Boolean(issueResult && !issueRejected && !issueInContingency)"
      :warning="issueInContingency"
      :rejected="issueRejected || Boolean(error && !issuing && !issueResult)"
      :status-label="issuing ? issuePhases[issuePhaseIndex].label : issueRejected ? 'MH rechazo el documento' : issueInContingency ? 'Documento enviado a contingencia' : issueResult ? 'Documento transmitido' : issueErrorTitle"
      :status-detail="issueStatusDetail"
      :progress="issueProgress"
      progress-label="Emision"
      :logs="issueLog"
      @close="closeIssueModal"
    >
      <template #status-badge>
        <span
          v-if="issueResult && issueAttemptCount > 1"
          class="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-600"
        >
          {{ issueAttemptCount }} intentos
        </span>
      </template>

      <div v-if="inventoryStockError" class="mt-4 rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
        <p class="text-sm font-semibold text-slate-950 dark:text-text">¿Deseas venderlo sin descontar inventario?</p>
        <p class="mt-1 text-sm text-slate-600 dark:text-muted">
          Se usará como artículo de catálogo solo en esta venta. El producto seguirá controlando inventario para futuras operaciones.
        </p>
        <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UiButton variant="secondary" type="button" @click="reviewInvoiceAfterStockError">Revisar factura</UiButton>
          <UiButton type="button" @click="sellWithoutInventoryOnce">Vender esta vez</UiButton>
        </div>
      </div>

      <div v-if="issueResult && issueRejected" class="mt-5 rounded-md border border-red-200 bg-red-50 p-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-red-900">
                  Documento rechazado
                </p>
                <p class="mt-1 truncate font-mono text-xs text-red-950">{{ issueResult.document.numeroControl }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-red-800">
                <span class="rounded bg-white/75 px-2 py-1">HTTP {{ issueResult.document.transmission?.http_status ?? 'N/D' }}</span>
                <span class="rounded bg-white/75 px-2 py-1">MH {{ issueResult.document.transmission?.mh_estado ?? issueResult.document.transmission?.status ?? 'sin estado' }}</span>
              </div>
            </div>
            <p v-if="issueResult.document.transmission?.descripcion_msg" class="mt-2 text-sm text-red-800">
              {{ issueResult.document.transmission.descripcion_msg }}
            </p>
            <ul v-if="issueResult.document.transmission?.observaciones?.length" class="mt-2 list-disc pl-5 text-sm text-red-800">
              <li v-for="observation in issueResult.document.transmission.observaciones" :key="observation">{{ observation }}</li>
            </ul>
            <div v-if="issueResult.attempts.length > 1" class="mt-2 rounded-md bg-white/70 px-3 py-2 text-xs text-red-900">
              Se resolvio con {{ issueResult.attempts.length }} intentos de correlativo.
            </div>
          </div>
    </BillingProcessModal>

    <UiCard variant="bare">
      <UiLoadingMark v-if="contextLoading" label="Cargando datos para facturar" />
      <div v-else-if="empresas.length === 0" class="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
        No hay empresas configuradas. Debes registrar empresa, sucursal, punto de venta y correlativos activos.
      </div>

      <div v-else class="grid gap-6">
        <section v-if="isAdjustmentNote" class="rounded-md border border-blue-100/80 bg-white/85 p-4 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:text-text dark:shadow-surface">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-950 dark:text-text">Documento origen</h2>
              <p class="mt-1 text-sm text-slate-500 dark:text-muted">
                Selecciona un CCF aceptado para {{ isNotaDebito ? 'incrementar o ajustar cargos' : 'acreditar total o parcialmente' }}.
              </p>
            </div>
            <button
              v-if="selectedSourceDocument"
              class="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white"
              type="button"
              @click="clearSourceDocument"
            >
              Quitar origen
            </button>
          </div>

          <div class="mt-4">
            <UiSearchInput
              v-model="sourceDocumentSearch"
              label="Buscar CCF aceptado"
              placeholder="Numero de control, codigo de generacion o cliente"
              @search="loadSourceDocuments"
            />
            <div v-if="sourceDocuments.length" class="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 dark:border-line">
              <button
                v-for="document in sourceDocuments"
                :key="document.id"
                class="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 dark:border-line"
                :class="document.is_related_by_adjustment ? 'cursor-not-allowed bg-slate-50 opacity-60 dark:bg-surface-muted' : 'hover:bg-sky-50 dark:hover:bg-surface-muted'"
                type="button"
                :disabled="document.is_related_by_adjustment"
                @click="selectSourceDocument(document)"
              >
                <span class="flex flex-wrap items-center gap-2 font-semibold text-slate-950 dark:text-text">
                  {{ document.numeroControl }}
                  <span v-if="document.is_related_by_adjustment" class="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-warning-soft dark:text-warning">
                    Relacionado
                  </span>
                </span>
                <span class="block text-xs text-slate-500 dark:text-muted">
                  {{ sourceReceptorName(document) }} · {{ currency(Number(document.totalPagar ?? 0)) }}
                  <template v-if="document.related_by_adjustment?.numeroControl">
                    · {{ document.related_by_adjustment.numeroControl }}
                  </template>
                </span>
              </button>
            </div>
            <p v-else-if="!selectedSourceDocument && sourceDocumentSearch.trim().length >= 2" class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No encontramos CCF aceptados para esa busqueda en la empresa activa.
            </p>
          </div>

          <div v-if="selectedSourceDocument" class="mt-4 grid gap-3 rounded-md border border-sky-100 bg-sky-50 p-4 text-sm md:grid-cols-4 dark:border-line dark:bg-surface-muted">
            <p>
              <span class="block text-xs font-semibold uppercase text-slate-500 dark:text-soft">CCF origen</span>
              <span class="mt-1 block font-mono text-xs text-slate-950 dark:text-text">{{ selectedSourceDocument.numeroControl }}</span>
            </p>
            <p>
              <span class="block text-xs font-semibold uppercase text-slate-500 dark:text-soft">Receptor</span>
              <span class="mt-1 block truncate font-semibold text-slate-950 dark:text-text">{{ form.customerName }}</span>
            </p>
            <p>
              <span class="block text-xs font-semibold uppercase text-slate-500 dark:text-soft">Total origen</span>
              <span class="mt-1 block font-semibold text-slate-950 dark:text-text">{{ currency(Number(selectedSourceDocument.totalPagar ?? 0)) }}</span>
            </p>
            <p v-if="notaCreditoHasFiscalAdjustments">
              <span class="block text-xs font-semibold uppercase text-slate-500 dark:text-soft">Ajustes IVA</span>
              <span class="mt-1 block text-xs font-semibold text-slate-950 dark:text-text">
                Origen ret. {{ currency(notaCreditoSourceIvaRete) }} · perc. {{ currency(notaCreditoSourceIvaPerci) }}
              </span>
            </p>
            <p>
              <span class="block text-xs font-semibold uppercase text-slate-500 dark:text-soft">{{ isNotaDebito ? 'NDE' : 'NCE' }}</span>
              <span
                class="mt-1 inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-semibold"
                :class="correlativoLoading
                  ? 'bg-sky-100 text-sky-700 dark:bg-primary-soft dark:text-white'
                  : correlativoPreview
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-success-soft dark:text-success'
                    : 'bg-red-100 text-red-700 dark:bg-danger-soft dark:text-danger'"
              >
                <span v-if="correlativoLoading" class="h-3 w-3 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700"></span>
                {{ correlativoLoading ? 'Consultando correlativo' : correlativoPreview ? correlativoPreview.numero_control : 'Sin correlativo' }}
              </span>
            </p>
          </div>
        </section>

        <div v-if="!isAdjustmentNote" class="grid gap-4 xl:grid-cols-3">
          <section class="rounded-md border border-blue-100/80 bg-white/75 px-4 py-3 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:text-text dark:shadow-surface">
            <div class="flex h-full flex-col justify-between gap-4">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-soft">Emisor activo</p>
                <p class="mt-1 truncate text-sm font-bold text-slate-950 dark:text-text">{{ selectedEmpresa?.razon_social }}</p>
                <div class="mt-3 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
                  <p>
                    <span class="font-semibold text-slate-500 dark:text-muted">Ambiente:</span>
                    <span class="ml-1 font-semibold text-slate-950 dark:text-text">{{ selectedEmpresa?.ambiente === '01' ? 'Produccion' : 'Pruebas' }}</span>
                  </p>
                  <p>
                    <span class="font-semibold text-slate-500 dark:text-muted">DTE:</span>
                    <span class="ml-1 font-semibold text-slate-950 dark:text-text">{{ documentLabel }}</span>
                  </p>
                  <p>
                    <span class="font-semibold text-slate-500 dark:text-muted">Estab.:</span>
                    <span class="ml-1 font-semibold text-slate-950 dark:text-text">{{ selectedSucursal?.codigo }}</span>
                  </p>
                  <p class="min-w-0">
                    <span class="font-semibold text-slate-500 dark:text-muted">Punto venta:</span>
                    <span class="ml-1 font-semibold text-slate-950 dark:text-text">{{ selectedPuntoVenta?.codigo }}</span>
                  </p>
                </div>
                <div v-if="sucursales.length > 1 || puntosVenta.length > 1" class="mt-3 grid gap-2 sm:grid-cols-2">
                  <UiSelect v-if="sucursales.length > 1" v-model.number="form.sucursalId" label="Sucursal" :options="sucursalOptions" />
                  <UiSelect v-if="puntosVenta.length > 1" v-model.number="form.puntoVentaId" label="Punto de venta" :options="puntoVentaOptions" />
                </div>
                <div v-if="selectedSucursal && selectedPuntoVenta" class="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    v-if="billingStationPreference"
                    class="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-success-soft dark:text-success"
                  >
                    Equipo fijado: {{ billingStationPreference.sucursalId === selectedSucursal.id && billingStationPreference.puntoVentaId === selectedPuntoVenta.id ? `${selectedSucursal.codigo} · ${selectedPuntoVenta.codigo}` : 'otra sucursal' }}
                  </span>
                  <template v-if="canManageBillingStation">
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary dark:hover:bg-primary-soft dark:hover:text-white"
                      :disabled="selectedStationIsFixed"
                      @click="saveBillingStationPreference"
                    >
                      Fijar en este equipo
                    </button>
                    <button
                      v-if="billingStationPreference"
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                      @click="clearBillingStationPreference"
                    >
                      Quitar fijacion
                    </button>
                  </template>
                </div>
              </div>
              <div class="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-3 dark:border-line">
                <p v-if="correlativoLoading" class="inline-flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-primary">
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700"></span>
                  Consultando correlativo disponible...
                </p>
                <p v-else-if="!correlativoPreview" class="text-sm text-red-700">No hay correlativo activo para esta combinacion.</p>
                <div class="min-w-0 text-right">
                  <span
                    class="inline-flex max-w-full items-center gap-2 rounded px-2 py-1 text-xs font-semibold"
                    :class="correlativoLoading
                      ? 'bg-sky-100 text-sky-700 dark:bg-primary-soft dark:text-white'
                      : correlativoPreview
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-success-soft dark:text-success'
                        : 'bg-red-100 text-red-700 dark:bg-danger-soft dark:text-danger'"
                  >
                    <template v-if="correlativoPreview">
                      <span class="shrink-0">Numero correlativo</span>
                      <span class="min-w-0 truncate font-mono text-[11px]">{{ correlativoPreview.numero_control }}</span>
                    </template>
                    <template v-else>
                      {{ correlativoLoading ? 'Consultando' : 'Sin correlativo' }}
                    </template>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-md border border-blue-100/80 bg-white/85 p-4 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:text-text dark:shadow-surface">
          <div v-if="hasReceptorCard" class="rounded-md border border-sky-100 bg-sky-50/80 p-3 dark:border-line dark:bg-surface-muted">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                  <span class="rounded bg-white px-2 py-1 dark:bg-primary-soft dark:text-primary">{{ isAdjustmentNote ? 'Receptor del CCF origen' : isSujetoExcluido ? 'Receptor - Sujeto excluido' : isCreditoFiscal ? 'Receptor - Cliente fiscal' : 'Receptor - Cliente base' }}</span>
                </div>
                <div class="mt-3 grid gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
                  <p class="min-w-0 sm:col-span-2">
                    <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Nombre</span>
                    <span class="block truncate font-semibold text-slate-950 dark:text-text">{{ form.customerName }}</span>
                  </p>
                  <p>
                    <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Tipo de documento</span>
                    <span class="block font-semibold text-slate-950 dark:text-text">{{ customerDocumentTypeLabel }}</span>
                  </p>
                  <p class="min-w-0">
                    <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Numero</span>
                    <span class="block truncate font-semibold text-slate-950 dark:text-text">{{ customerDocumentNumberLabel }}</span>
                  </p>
                  <p>
                    <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Telefono</span>
                    <span class="block font-semibold text-slate-950 dark:text-text">{{ form.customerPhone || 'Sin telefono' }}</span>
                  </p>
                  <p class="min-w-0">
                    <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Correo</span>
                    <span class="block truncate font-semibold text-slate-950 dark:text-text">{{ form.customerEmail || 'Sin correo' }}</span>
                  </p>
                  <template v-if="requiresStructuredCustomer">
                    <p v-if="!isSujetoExcluido">
                      <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">NRC</span>
                      <span class="block font-semibold text-slate-950 dark:text-text">{{ form.customerNrc || 'Pendiente' }}</span>
                    </p>
                    <p>
                      <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Actividad</span>
                      <span class="block truncate font-semibold text-slate-950 dark:text-text">{{ form.customerActivityCode && form.customerActivityDescription ? `${form.customerActivityCode} · ${form.customerActivityDescription}` : 'Pendiente' }}</span>
                    </p>
                    <p class="min-w-0 sm:col-span-2">
                      <span class="block text-[11px] font-semibold text-slate-500 dark:text-soft">Direccion</span>
                      <span class="block truncate font-semibold text-slate-950 dark:text-text">{{ form.customerDepartment && form.customerMunicipality && form.customerAddress ? `${form.customerDepartment} / ${form.customerMunicipality} / ${form.customerDistrict} · ${form.customerAddress}` : 'Pendiente' }}</span>
                    </p>
                  </template>
                </div>
                <UiButton
                  v-if="selectedCustomerNeedsFiscalComplement && selectedCustomer"
                  class="mt-4"
                  variant="primary"
                  type="button"
                  @click="openFiscalComplement(selectedCustomer)"
                >
                  Completar datos fiscales
                </UiButton>
              </div>
              <button
                class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-red-50 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white"
                type="button"
                aria-label="Quitar cliente seleccionado"
                @click="isAdjustmentNote ? clearSourceDocument() : clearSelectedCustomer()"
              >
                x
              </button>
            </div>
          </div>

          <div v-else-if="!isAdjustmentNote" class="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              v-for="mode in customerModes"
              :key="mode.key"
              class="rounded-lg px-4 py-2 text-sm font-semibold tracking-wide transition-colors duration-200 focus:outline-none focus:ring focus:ring-sky-300 focus:ring-opacity-70"
              :class="customerModeButtonClass(mode)"
              :disabled="mode.key === 'generic' && requiresCustomerIdentificationByAmount"
              type="button"
              @click="selectCustomerMode(mode.key)"
            >
              {{ mode.label }}
            </button>
          </div>

          <div v-if="!selectedCustomer && !isAdjustmentNote && (customerMode === 'generic' || customerMode === 'quick' || customerMode === 'new')" class="mt-4 rounded-md border border-blue-100/80 bg-slate-50/80 p-4 dark:border-line dark:bg-surface-muted">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-950 dark:text-text">{{ form.customerName || 'Consumidor Final' }}</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-muted">{{ customerSummary }}</p>
              </div>
              <UiButton v-if="customerMode === 'quick'" variant="secondary" type="button" @click="customerModalMode = 'quick'">Editar rapido</UiButton>
            </div>
          </div>

          <p v-if="requiresCustomerIdentificationByAmount && !hasRequiredCustomerIdentification" class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {{ customerIdentificationByAmountMessage }}
          </p>
          <p v-if="isAdjustmentNote && !selectedSourceDocument" class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Selecciona un CCF aceptado para cargar automaticamente el receptor.
          </p>
          </section>

          <section v-if="supportsAdvancedPayments" class="rounded-md border border-blue-100/80 bg-white/85 p-4 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:text-text dark:shadow-surface">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-slate-950 dark:text-text">Pago</h2>
              </div>
              <span
                class="rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="paymentTotalMatches ? 'bg-emerald-50 text-emerald-700 dark:bg-success-soft dark:text-success' : 'bg-red-50 text-red-700 dark:bg-danger-soft dark:text-danger'"
              >
                {{ currency(paymentTotal) }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 text-sm">
              <div class="rounded-md border border-slate-200 bg-white p-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Condicion</p>
                <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ paymentConditionLabel }}</p>
                <p class="mt-1 truncate text-xs text-slate-500 dark:text-muted">{{ paymentSummaryLabel }}</p>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <UiButton variant="secondary" type="button" @click="setCashPayment">Contado</UiButton>
                  <UiButton variant="secondary" type="button" @click="openPaymentModal">Editar pago</UiButton>
                </div>
              </div>

              <div class="w-full min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-3 dark:border-line dark:bg-surface">
                <div class="flex min-w-0 items-center justify-between gap-3">
                  <div class="min-w-0 flex-1 overflow-hidden">
                    <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Observaciones</p>
                    <p class="mt-1 max-w-full truncate text-xs text-slate-500 dark:text-muted">
                      {{ form.observations.trim() || 'Sin observaciones' }}
                    </p>
                  </div>
                  <UiButton class="shrink-0" variant="secondary" type="button" @click="observationsModalOpen = true">
                    {{ form.observations.trim() ? 'Editar' : 'Agregar' }}
                  </UiButton>
                </div>
              </div>

              <p v-if="!hasValidAdvancedPayments" class="text-xs font-medium text-red-700">
                Las formas de pago deben sumar {{ currency(totalLabel) }}.
              </p>
            </div>
          </section>
        </div>

        <section
          class="relative rounded-md border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:text-text dark:shadow-surface"
          :class="catalogLineSuggestionsOpen ? 'z-40' : 'z-10'"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-950 dark:text-text">{{ isSujetoExcluido ? 'Detalle de compra' : 'Detalle' }}</h2>
            </div>
            <BillingFiscalOptions
              v-if="isCreditoFiscal"
              v-model:price-includes-iva="ccfPriceIncludesIva"
              v-model:retain-iva="ccfRetainIva10"
            />
          </div>
          <div class="mt-4 overflow-visible rounded-md border border-slate-200 dark:border-line">
            <table class="w-full min-w-[780px] text-left text-sm dark:text-text">
              <thead class="bg-blue-50/70 text-xs uppercase text-slate-500 dark:bg-surface-muted dark:text-muted">
                <tr>
                  <th class="px-3 py-2">Descripcion</th>
                  <th class="w-28 px-3 py-2">Cantidad</th>
                  <th class="w-36 px-3 py-2">{{ isNotaDebito ? 'Nuevo valor' : isSujetoExcluido ? 'Monto compra' : 'Precio' }}</th>
                  <th class="w-36 px-3 py-2">{{ isAdjustmentNote ? (isNotaDebito ? 'Incremento' : 'Ajuste') : isSujetoExcluido ? 'Descuento' : '% desc.' }}</th>
                  <th class="w-32 px-3 py-2 text-right">Neto</th>
                  <th class="w-32 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-line">
                <tr v-if="!isAdjustmentNote" class="bg-blue-50/40 dark:bg-surface-muted">
                  <td class="px-3 py-2">
                    <div class="relative">
                      <input
                        :value="draftLine.description"
                        class="w-full rounded-md border border-blue-100 bg-white/90 px-3 py-2 shadow-sm shadow-blue-950/5 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:shadow-none dark:focus:bg-surface-raised"
                        :placeholder="isSujetoExcluido ? 'Compra o servicio recibido' : 'Buscar catalogo o escribir descripcion libre'"
                        @blur="closeCatalogLineSuggestions"
                        @focus="scheduleCatalogLineSearch(draftLine.description)"
                        @input="onDraftLineDescriptionInput(($event.target as HTMLInputElement).value)"
                      >
                      <div
                        v-if="catalogLineSuggestionsOpen && canUseCatalogLineSearch"
                        class="absolute z-[100] mt-1 max-h-36 w-full overflow-y-auto rounded-md border border-blue-100 bg-white py-1 text-sm shadow-xl shadow-blue-950/10 dark:border-line dark:bg-surface-raised dark:shadow-black/30"
                      >
                        <div v-if="catalogLineLoading" class="px-3 py-2 text-xs font-medium text-slate-500 dark:text-muted">Buscando catalogo...</div>
                        <button
                          v-for="item in catalogLineSuggestions"
                          :key="item.id"
                          class="block w-full px-3 py-2 text-left hover:bg-sky-50 dark:hover:bg-primary-soft"
                          type="button"
                          @mousedown.prevent="selectCatalogItemForDraft(item)"
                        >
                          <span class="block font-semibold text-slate-950 dark:text-text">{{ item.name }}</span>
                          <span class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-soft">
                            <span>{{ item.sku || 'Sin codigo' }}</span>
                            <span>{{ currency(item.base_price) }}</span>
                            <span>{{ item.controls_inventory ? 'Inventario' : 'Catalogo' }}</span>
                          </span>
                        </button>
                        <p v-if="!catalogLineLoading && catalogLineSuggestions.length === 0" class="px-3 py-2 text-slate-500 dark:text-muted">
                          Sin resultados. Se agregara como descripcion libre.
                        </p>
                      </div>
                    </div>
                    <div v-if="draftLine.description.trim()" class="mt-1 flex flex-wrap items-center gap-2">
                      <span class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="lineOriginClass(draftLine)">
                        {{ lineOriginLabel(draftLine) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <UiInput v-model.number="draftLine.quantity" label="Cantidad" hide-label min="0.01" step="0.01" type="number" />
                  </td>
                  <td class="px-3 py-2">
                    <UiInput v-model.number="draftLine.unitPrice" :label="isNotaDebito ? 'Nuevo valor' : isSujetoExcluido ? 'Monto compra' : 'Precio'" hide-label min="0" step="0.01" type="number" />
                  </td>
                  <td class="px-3 py-2">
                    <UiInput v-model.number="draftLine.discountPercent" :label="isAdjustmentNote ? (isNotaDebito ? 'Incremento' : 'Ajuste') : isSujetoExcluido ? 'Descuento' : 'Porcentaje descuento'" hide-label max="100" min="0" step="0.01" type="number" />
                    <p v-if="lineDiscountAmount(draftLine) > 0" class="mt-1 text-[11px] text-slate-500 dark:text-muted">-{{ currency(lineDiscountAmount(draftLine)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <p class="font-semibold text-slate-900 dark:text-text">{{ currency(lineNetTotal(draftLine)) }}</p>
                    <p v-if="isFiscalStyleDocument" class="text-[11px] text-slate-500 dark:text-muted">IVA {{ currency(lineIvaAmount(draftLine)) }}</p>
                    <p v-if="lineDiscountAmount(draftLine) > 0" class="text-[11px] text-slate-500 dark:text-muted">Bruto {{ currency(lineGrossTotal(draftLine)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <UiButton @click="addLine">Agregar</UiButton>
                  </td>
                </tr>
                <tr v-for="line in lines" :key="line.id">
                  <td class="px-3 py-2">
                    <span class="font-medium text-slate-950 dark:text-text">{{ line.description }}</span>
                    <span
                      v-if="!isAdjustmentNote"
                      class="ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      :class="lineOriginClass(line)"
                    >
                      {{ lineOriginLabel(line) }}
                    </span>
                    <p v-if="isAdjustmentNote" class="mt-1 text-[11px] text-slate-500 dark:text-muted">
                      {{ line.sourceLine === false ? 'Linea nueva agregada a la Nota de Debito' : 'Descripcion tomada del CCF origen' }}
                    </p>
                  </td>
                  <td class="px-3 py-2">
                    <template v-if="isAdjustmentNote">
                      <UiInput
                        label="Cantidad"
                        hide-label
                        :max="isNotaCredito ? Number(line.originalQuantity ?? line.quantity ?? 0) : undefined"
                        :min="isNotaDebito && line.sourceLine !== false ? Number(line.originalQuantity ?? line.quantity ?? 0) : 0.01"
                        step="0.01"
                        type="number"
                        :model-value="Number(line.quantity)"
                        @update:model-value="updateAdjustmentQuantity(line, String($event))"
                      />
                      <p v-if="isNotaCredito" class="mt-1 text-[11px] text-slate-500 dark:text-muted">
                        Max. {{ Number(line.originalQuantity ?? line.quantity ?? 0) }}
                      </p>
                      <p v-else-if="line.sourceLine !== false" class="mt-1 text-[11px] text-slate-500 dark:text-muted">
                        Origen {{ Number(line.originalQuantity ?? line.quantity ?? 0) }}
                      </p>
                    </template>
                    <span v-else>{{ Number(line.quantity) }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <template v-if="isAdjustmentNote">
                      <UiInput
                        label="Precio"
                        hide-label
                        :max="isNotaCredito ? Number(line.originalUnitPrice ?? line.unitPrice ?? 0) : undefined"
                        min="0"
                        step="0.01"
                        type="number"
                        :model-value="Number(line.unitPrice)"
                        @update:model-value="updateNotaCreditoPrice(line, String($event))"
                      />
                      <p v-if="isNotaCredito" class="mt-1 text-[11px] text-slate-500 dark:text-muted">{{ sourceLineMaxLabel(line) }}</p>
                      <p v-else-if="line.sourceLine === false" class="mt-1 text-[11px] text-slate-500 dark:text-muted">Monto de la linea nueva</p>
                      <p v-else class="mt-1 text-[11px] text-slate-500 dark:text-muted">{{ notaDebitoOriginalLabel(line) }}</p>
                    </template>
                    <template v-else>
                      {{ currency(Number(line.unitPrice)) }}
                    </template>
                  </td>
                  <td class="px-3 py-2">
                    <template v-if="isAdjustmentNote">
                      <span v-if="isNotaDebito && line.sourceLine !== false" class="font-semibold text-slate-700 dark:text-muted">{{ notaDebitoIncrementLabel(line) }}</span>
                      <span v-else class="text-slate-400 dark:text-soft">No aplica</span>
                    </template>
                    <template v-else>
                      <span>{{ Number(line.discountPercent || 0) }}%</span>
                      <p v-if="lineDiscountAmount(line) > 0" class="text-[11px] text-slate-500 dark:text-muted">-{{ currency(lineDiscountAmount(line)) }}</p>
                    </template>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <p class="font-semibold text-slate-900 dark:text-text">{{ currency(lineNetTotal(line)) }}</p>
                    <p v-if="isFiscalStyleDocument" class="text-[11px] text-slate-500 dark:text-muted">IVA {{ currency(lineIvaAmount(line)) }}</p>
                    <p v-if="lineDiscountAmount(line) > 0" class="text-[11px] text-slate-500 dark:text-muted">Bruto {{ currency(lineGrossTotal(line)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <UiButton variant="ghost" size="sm" type="button" @click="removeLine(line.id)">Quitar</UiButton>
                  </td>
                </tr>
                <tr v-if="lines.length === 0">
                  <td class="px-3 py-4 text-sm text-slate-500 dark:text-muted" colspan="6">{{ isAdjustmentNote ? `Selecciona un CCF origen para cargar las lineas de ${isNotaDebito ? 'debito' : 'credito'}.` : 'Aun no hay lineas agregadas.' }}</td>
                </tr>
                <tr v-if="isNotaDebito && selectedSourceDocument" class="border-t-2 border-slate-200 bg-slate-50/70 dark:border-line-strong dark:bg-surface-muted">
                  <td class="px-3 py-2">
                    <UiInput v-model="draftLine.description" label="Nueva línea a debitar" hide-label placeholder="Nueva línea a debitar" />
                    <p class="mt-1 text-[11px] text-slate-500 dark:text-muted">Agregar línea nueva a la Nota de Débito</p>
                  </td>
                  <td class="px-3 py-2">
                    <UiInput v-model.number="draftLine.quantity" label="Cantidad" hide-label min="0.01" step="0.01" type="number" />
                  </td>
                  <td class="px-3 py-2">
                    <UiInput v-model.number="draftLine.unitPrice" label="Monto" hide-label min="0.01" step="0.01" type="number" />
                  </td>
                  <td class="px-3 py-2">
                    <span class="text-slate-400">No aplica</span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <p class="font-semibold text-slate-900 dark:text-text">{{ currency(lineNetTotal(draftLine)) }}</p>
                    <p class="text-[11px] text-slate-500 dark:text-muted">IVA {{ currency(lineIvaAmount(draftLine)) }}</p>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <UiButton @click="addLine">Agregar</UiButton>
                  </td>
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
          <UiButton variant="secondary" :disabled="loading" @click="transition('receive')">Registrar recepcion</UiButton>
          <UiButton variant="ghost" :disabled="loading" @click="loadHistory">Historial</UiButton>
        </div>
        <p class="mt-3 text-xs text-slate-500">Acciones disponibles para el documento preparado.</p>
      </div>

      <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>

    <BillingInvoiceSummaryBar
      v-if="!contextLoading && empresas.length > 0 && items.length > 0"
      :line-count="items.length"
      :unit-count="unitCount"
      :subtotal="subtotal"
      :discount-total="discountTotal"
      :iva-total="isFiscalStyleDocument ? iva : undefined"
      :retention-total="isSujetoExcluido ? sujetoExcluidoReteRenta : (isCreditoFiscal ? ivaRetention : (isNotaCredito && notaCreditoIvaRete > 0 ? notaCreditoIvaRete : undefined))"
      :total-label="totalLabel"
      :issue-disabled="loading || issuing || !canBuild"
      :issue-disabled-reason="issueDisabledReason"
      :issuing="issuing"
      @issue="issueDocument"
    />

    <BillingFloatingToastStack :toasts="floatingToasts" />
  </div>
</template>
