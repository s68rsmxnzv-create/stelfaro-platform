<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  CoreDteClient,
  type BillingEmpresa,
  type DteDraftSummary,
  type MhFiscalEventSummary,
  PlatformClient
} from '@stelfaro/api-client';
import { currency, fiscalDate, fiscalDateTime } from '@stelfaro/shared';
import { UiButton, UiCard, UiSearchInput, UiLoadingMark, UiRefreshButton, UiSaveIcon, UiTextarea } from '@stelfaro/ui';
import BillingModalShell from '../components/BillingModalShell.vue';
import BillingProcessModal from '../components/BillingProcessModal.vue';
import BillingProcessToastOverlay from '../components/BillingProcessToastOverlay.vue';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  initialEventType?: string;
  platformSession?: Record<string, unknown> | null;
  platformBaseUrl?: string;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  initialEventType: 'invalidacion',
  platformSession: null,
  platformBaseUrl: '/api/v1'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const platformClient = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const platformTenantId = computed(() => Number((props.platformSession as { tenant?: { id?: number | string | null } } | null)?.tenant?.id || 0));
const loading = ref(false);
const processing = ref(false);
const eventModalOpen = ref(false);
const eventProgress = ref(0);
const eventPhaseIndex = ref(0);
const error = ref<string | null>(null);
const query = ref('');
const replacementQuery = ref('');
const searchLocked = ref(false);
const searched = ref(false);
const replacementSearched = ref(false);
const documents = ref<DteDraftSummary[]>([]);
const contingencyCandidates = ref<DteDraftSummary[]>([]);
const returnCandidates = ref<DteDraftSummary[]>([]);
const contingencyCandidatesLoading = ref(false);
const contingencyCandidatesLoaded = ref(false);
const returnCandidatesLoading = ref(false);
const returnCandidatesLoaded = ref(false);
const billingContextLoading = ref(false);
const billingCompanies = ref<BillingEmpresa[]>([]);
const replacementDocuments = ref<DteDraftSummary[]>([]);
const selected = ref<DteDraftSummary | null>(null);
const selectedReplacement = ref<DteDraftSummary | null>(null);
const selectedContingencyDocuments = ref<DteDraftSummary[]>([]);
const selectedReturnDocuments = ref<DteDraftSummary[]>([]);
const reportedContingencyDocuments = ref<DteDraftSummary[]>([]);
const contingencyRetransmissionLoading = ref(false);
const contingencyRetransmissionError = ref<string | null>(null);
const contingencyRetransmissionResults = ref<Array<{
  id: number;
  numeroControl: string;
  status: 'accepted' | 'sent' | 'rejected' | 'error' | string;
  source?: 'mh' | 'local';
  message?: string;
}>>([]);
const eventResult = ref<MhFiscalEventSummary | null>(null);
const eventLog = ref<Array<{ label: string; status: 'ok' | 'error' }>>([]);
const motivoModalOpen = ref(false);
const motivoDraft = ref('');
const motivoModalMode = ref<'invalidacion' | 'contingencia'>('invalidacion');
const contingencyStartTouched = ref(false);
const contingencyEndTouched = ref(false);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
let replacementSearchTimer: ReturnType<typeof window.setTimeout> | null = null;

type SpecialOperationMode = 'range' | 'single';
type SpecialOperationStatus = 'active' | 'annulled';
type SpecialOperationLine = {
  id: number;
  codigoGeneracionRef: string;
  tipoDocumento: '02' | '97';
  numDocumento: string;
  fechaEmision: string;
  cantidad: number;
  descripcion: string;
  docDel: string;
  docAl: string;
  precioUni: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
};
type ReturnEventLine = {
  id: number;
  codigoGeneracion: string;
  descripcion: string;
  tipoMonto: 'gravada' | 'exenta' | 'no_sujeta' | 'exportacion' | 'compra';
  montoRetorno: number;
  cantidad: number;
  precioUni: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  compra: number;
  noGravado: number;
  seguro: number;
  flete: number;
  ivaRete: number;
  reteRenta: number;
};
let specialLineSequence = 0;
let returnLineSequence = 0;

const eventTypes = [
  {
    key: 'invalidacion',
    label: 'Invalidacion',
    title: 'Invalidacion de DTE',
    description: 'Prepara y envia solicitudes de invalidacion segun las reglas vigentes.',
    ready: true,
  },
  {
    key: 'contingencia',
    label: 'Contingencia',
    title: 'Evento de Contingencia',
    description: 'Reporta documentos emitidos bajo contingencia.',
    ready: true,
  },
  {
    key: 'retorno',
    label: 'Retorno',
    title: 'Evento de Retorno',
    description: 'Registra devoluciones o reembolsos sobre documentos aceptados.',
    ready: true,
  },
  {
    key: 'operaciones_especiales',
    label: 'Operaciones especiales',
    title: 'Evento de Operaciones Especiales',
    description: 'Registra operaciones especiales cuando corresponda.',
    ready: true,
  },
];
const selectedEvent = computed(() => eventTypes.find((event) => event.key === props.initialEventType) ?? eventTypes[0]);
const isInvalidacion = computed(() => selectedEvent.value.key === 'invalidacion');
const isContingencia = computed(() => selectedEvent.value.key === 'contingencia');
const isOperacionesEspeciales = computed(() => selectedEvent.value.key === 'operaciones_especiales');
const isRetorno = computed(() => selectedEvent.value.key === 'retorno');
const showSearchResults = computed(() => query.value.trim().length >= 2 && isInvalidacion.value && !selected.value);

const form = reactive({
  tipoAnulacion: 2,
  motivoAnulacion: '',
  tipoContingencia: 1,
  motivoContingencia: '',
  contingenciaFInicio: currentLocalDate(),
  contingenciaHInicio: currentLocalTime(),
  contingenciaFFin: currentLocalDate(),
  contingenciaHFin: currentLocalTime(),
  operacionesEmpresaId: null as number | null,
  operacionesAmbiente: '00' as '00' | '01',
  operacionesStatus: 'active' as SpecialOperationStatus,
  operacionesMode: 'range' as SpecialOperationMode,
  operacionesDocumentType: '02' as '02' | '97',
  retornoDteType: '01' as '01' | '11' | '14',
  retornoEmpresaId: null as number | null,
  retornoTipoDocumentoRelacionado: '17',
  retornoCodigoGeneracionRelacionado: '',
  retornoFechaEmisionRelacionado: currentLocalDate(),
  retornoCodEstableMH: '',
  retornoCodEstable: '',
  retornoCodPuntoVentaMH: '',
  retornoCodPuntoVenta: '',
  retornoRecintoFiscal: '',
  retornoTipoRegimen: '',
  retornoRegimen: '',
  retornoTipoItemExpor: null as number | null,
});

const invalidacionTipos = [
  { value: 1, label: 'Error en la informacion del DTE' },
  { value: 2, label: 'Rescindir la operacion realizada' },
  { value: 3, label: 'Otro motivo' },
];
const contingenciaTipos = [
  { value: 1, label: 'Falla del proveedor de Internet' },
  { value: 2, label: 'Falla del proveedor de energia electrica' },
  { value: 3, label: 'Falla del sistema informatico del emisor' },
  { value: 4, label: 'Falla del sistema informatico de MH' },
  { value: 5, label: 'Otro motivo' },
];
const operacionesDocumentoTipos = [
  { value: '02', label: 'Factura simplificada' },
  { value: '97', label: 'Comprobante control interno' },
];
const retornoDocumentoTipos = [
  { value: '01', label: 'Factura electronica' },
  { value: '11', label: 'Factura de exportacion' },
  { value: '14', label: 'Factura sujeto excluido' },
];
const retornoMontoTipos = [
  { value: 'gravada', label: 'Gravado con IVA' },
  { value: 'exenta', label: 'Exento' },
  { value: 'no_sujeta', label: 'No sujeto' },
];
const operacionesLineas = ref<SpecialOperationLine[]>([
  createSpecialOperationLine()
]);
const retornoLineas = ref<ReturnEventLine[]>([
  createReturnEventLine()
]);
const contingencyAllowedTypes = new Set(['01', '03', '04', '05', '06', '07', '11', '14']);
const replacementRequiredTypes = new Set(['01', '03', '04', '06', '07', '09', '11', '14', '15']);
const replacementExemptTypes = new Set(['05', '08', '17', '18']);
const requiresMotivoAnulacion = computed(() => [1, 3].includes(Number(form.tipoAnulacion)));
const requiresReplacementDte = computed(() => Boolean(
  selected.value
  && [1, 3].includes(Number(form.tipoAnulacion))
  && replacementRequiredTypes.has(selected.value.tipoDte)
  && !replacementExemptTypes.has(selected.value.tipoDte)
));
const selectedIsGenericReceptor = computed(() => isGenericReceptor(selected.value));
const selectedReplacementIsGenericReceptor = computed(() => isGenericReceptor(selectedReplacement.value));
const replacementIdentificationError = computed(() => {
  if (!requiresReplacementDte.value || !selectedIsGenericReceptor.value || !selectedReplacement.value || !selectedReplacementIsGenericReceptor.value) {
    return null;
  }

  return 'El DTE original no tiene receptor identificado; selecciona un sustituto con documento de receptor.';
});
const canInvalidate = computed(() => Boolean(
  selected.value
  && selected.value.invalidacion?.eligible !== false
  && form.tipoAnulacion
  && (!requiresMotivoAnulacion.value || form.motivoAnulacion.trim())
  && (!requiresReplacementDte.value || selectedReplacement.value)
  && !replacementIdentificationError.value
));
const contingencyModalDocument = computed(() => selectedContingencyDocuments.value[0] ?? reportedContingencyDocuments.value[0] ?? null);
const selectedContingencyCompany = computed(() => contingencyModalDocument.value?.empresa ?? null);
const selectedContingencyPayload = computed(() => selectedContingencyDocuments.value[0]?.payload ?? selectedContingencyDocuments.value[0]?.dte_json ?? {});
const selectedContingencyIdentificacion = computed(() => recordValue(selectedContingencyPayload.value.identificacion));
const filteredContingencyCandidates = computed(() => {
  const search = query.value.trim().toLowerCase();

  return contingencyCandidates.value
    .filter((document) => canAddContingencyDocument(document))
    .filter((document) => {
      if (!search) return true;

      const payload = document.payload ?? document.dte_json ?? {};
      const receptor = recordValue(payload.receptor);
      const haystack = [
        document.tipoDte,
        document.numeroControl,
        document.codigoGeneracion,
        document.empresa?.razon_social,
        document.empresa?.nombre_comercial,
        receptor.nombre,
        receptor.numDocumento,
        receptor.nit,
      ].map((value) => String(value ?? '').toLowerCase()).join(' ');

      return haystack.includes(search);
    });
});
const canReportContingency = computed(() => Boolean(
  selectedContingencyDocuments.value.length > 0
  && form.tipoContingencia
  && (!requiresMotivoContingencia.value || form.motivoContingencia.trim())
  && contingencyWindowComplete.value
  && contingencyWindowChronological.value
  && selectedContingencyDocuments.value.every(isContingencyDocument)
));
const selectedOperacionesEmpresa = computed(() => billingCompanies.value.find((empresa) => empresa.id === Number(form.operacionesEmpresaId)) ?? null);
const operacionesTotals = computed(() => {
  const totalNoSuj = roundMoney(operacionesLineas.value.reduce((sum, line) => sum + numberValue(line.ventaNoSuj), 0));
  const totalExenta = roundMoney(operacionesLineas.value.reduce((sum, line) => sum + numberValue(line.ventaExenta), 0));
  const totalGravada = roundMoney(operacionesLineas.value.reduce((sum, line) => sum + numberValue(line.ventaGravada), 0));
  const subTotal = roundMoney(totalNoSuj + totalExenta + totalGravada);
  const iva = roundMoney(totalGravada * 0.13);

  return {
    totalNoSuj,
    totalExenta,
    totalGravada,
    subTotal,
    iva,
    total: roundMoney(subTotal + iva),
  };
});
const canReportOperacionesEspeciales = computed(() => Boolean(
  selectedOperacionesEmpresa.value
  && operacionesLineas.value.length > 0
  && operacionesLineas.value.length <= 500
  && operacionesLineas.value.every(isValidSpecialOperationLine)
));
const selectedRetornoEmpresa = computed(() => selectedReturnDocuments.value[0]?.empresa ?? billingCompanies.value.find((empresa) => empresa.id === Number(form.retornoEmpresaId)) ?? null);
const selectedRetornoAmbiente = computed(() => selectedReturnDocuments.value[0]?.ambiente ?? billingCompanies.value.find((empresa) => empresa.id === Number(form.retornoEmpresaId))?.ambiente ?? '00');
const selectedReturnCodes = computed(() => new Set(selectedReturnDocuments.value.map((document) => document.codigoGeneracion).filter(Boolean)));
const retornoTotals = computed(() => {
  const totalNoSuj = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.ventaNoSuj), 0));
  const totalExenta = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.ventaExenta), 0));
  const totalGravada = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.ventaGravada), 0));
  const totalCompra = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.compra), 0));
  const totalNoGravado = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.noGravado), 0));
  const totalSeguro = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.seguro), 0));
  const totalFlete = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.flete), 0));
  const ivaRete = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.ivaRete), 0));
  const reteRenta = roundMoney(retornoLineas.value.reduce((sum, line) => sum + numberValue(line.reteRenta), 0));
  const totalIva = roundMoney(retornoLineas.value.reduce((sum, line) => sum + returnEventLineIva(line), 0));
  const subTotalVentas = roundMoney(totalNoSuj + totalExenta + totalGravada);
  const montoTotalOperacion = roundMoney(subTotalVentas + totalCompra + totalNoGravado + totalSeguro + totalFlete);

  return {
    totalNoSuj,
    totalExenta,
    totalGravada,
    totalCompra,
    totalNoGravado,
    totalSeguro,
    totalFlete,
    ivaRete,
    reteRenta,
    totalIva,
    total: roundMoney(Math.max(0, montoTotalOperacion - ivaRete - reteRenta)),
  };
});
const canReportRetorno = computed(() => Boolean(
  selectedReturnDocuments.value.length > 0
  && selectedReturnDocuments.value.length <= 50
  && retornoLineas.value.length > 0
  && retornoLineas.value.length <= 2000
  && retornoLineas.value.every(isValidReturnEventLine)
));
const requiresMotivoContingencia = computed(() => Number(form.tipoContingencia) === 5);
const contingencyWindowComplete = computed(() => Boolean(
  form.contingenciaFInicio
  && form.contingenciaHInicio
  && form.contingenciaFFin
  && form.contingenciaHFin
));
const contingencyWindowChronological = computed(() => {
  const start = localDateTimeValue(form.contingenciaFInicio, form.contingenciaHInicio);
  const end = localDateTimeValue(form.contingenciaFFin, form.contingenciaHFin);

  return start !== null && end !== null && end >= start;
});
const contingencyWindowError = computed(() => {
  if (!contingencyWindowComplete.value) return null;
  if (!contingencyWindowChronological.value) return 'La fecha y hora de fin no pueden ser anteriores al inicio.';

  return null;
});
const contingencyWindowLabel = computed(() => {
  if (!contingencyWindowComplete.value) return 'Ventana incompleta';

  return `${form.contingenciaFInicio} ${form.contingenciaHInicio} - ${form.contingenciaFFin} ${form.contingenciaHFin}`;
});
const selectedPayload = computed(() => selected.value?.payload ?? selected.value?.dte_json ?? {});
const selectedReceptor = computed(() => recordValue(selectedPayload.value.receptor));
const selectedIdentificacion = computed(() => recordValue(selectedPayload.value.identificacion));
const eventPhases = computed(() => {
  if (isContingencia.value) return [
  { label: 'Preparando contingencia', detail: 'Revisando DTE emitidos en contingencia y motivo.' },
  { label: 'Validando datos', detail: 'Comprobando estructura del evento y documentos relacionados.' },
  { label: 'Firmando evento', detail: 'Aplicando la firma electronica.' },
  { label: 'Enviando a Hacienda', detail: 'Transmitiendo el evento de contingencia.' },
  { label: 'Registrando respuesta', detail: 'Guardando sello y ventana de transmision de DTE.' }
  ];

  if (isOperacionesEspeciales.value) return [
    { label: 'Preparando reporte', detail: 'Consolidando lineas y resumen de operaciones especiales.' },
    { label: 'Validando datos', detail: 'Comprobando estructura, rangos, anulaciones y totales.' },
    { label: 'Firmando evento', detail: 'Aplicando la firma electronica.' },
    { label: 'Enviando a Hacienda', detail: 'Transmitiendo el evento de operaciones especiales.' },
    { label: 'Registrando respuesta', detail: 'Guardando sello y respuesta de Hacienda.' }
  ];

  if (isRetorno.value) return [
    { label: 'Preparando retorno', detail: 'Consolidando documento relacionado y detalle de retorno.' },
    { label: 'Validando datos', detail: 'Comprobando estructura fiscal del evento.' },
    { label: 'Firmando evento', detail: 'Aplicando la firma electronica.' },
    { label: 'Enviando a Hacienda', detail: 'Transmitiendo el evento de retorno.' },
    { label: 'Registrando respuesta', detail: 'Guardando sello y respuesta de Hacienda.' }
  ];

  return [
  { label: 'Preparando invalidacion', detail: 'Revisando el documento, motivo y sustituto cuando aplica.' },
  { label: 'Validando datos', detail: 'Comprobando que la solicitud este completa.' },
  { label: 'Firmando solicitud', detail: 'Aplicando la firma electronica.' },
  { label: 'Enviando a Hacienda', detail: 'Transmitiendo la solicitud de invalidacion.' },
  { label: 'Registrando respuesta', detail: 'Guardando el resultado de Hacienda.' }
  ];
});
const eventRejected = computed(() => {
  const status = String(eventResult.value?.transmission?.status ?? eventResult.value?.estado ?? '').toUpperCase();
  return status.includes('REJECTED') || eventResult.value?.estado === 'rejected';
});
const eventAccepted = computed(() => {
  const status = String(eventResult.value?.transmission?.status ?? eventResult.value?.estado ?? '').toUpperCase();
  return status.includes('ACCEPTED') || eventResult.value?.estado === 'accepted';
});
const eventStopped = computed(() => Boolean(error.value && !processing.value && !eventAccepted.value && !eventRejected.value));
const contingencyRetransmissionFailed = computed(() => contingencyRetransmissionResults.value.some((result) => ['error', 'rejected'].includes(String(result.status).toLowerCase())));
const contingencyRetransmissionComplete = computed(() => Boolean(
  isContingencia.value
  && eventAccepted.value
  && contingencyRetransmissionResults.value.length > 0
  && !contingencyRetransmissionLoading.value
  && !contingencyRetransmissionFailed.value
));
const eventDiagnosticModalOpen = computed(() => Boolean(eventModalOpen.value && (eventRejected.value || eventStopped.value)));
const contingencyMomentModalOpen = computed(() => Boolean(
  eventModalOpen.value
  && isContingencia.value
  && eventAccepted.value
  && reportedContingencyDocuments.value.length > 0
  && !contingencyRetransmissionLoading.value
  && !contingencyRetransmissionComplete.value
));
const eventOverlayOpen = computed(() => Boolean(
  eventModalOpen.value
  && (
    processing.value
    || contingencyRetransmissionLoading.value
    || contingencyRetransmissionComplete.value
    || (eventAccepted.value && !isContingencia.value)
    || (eventAccepted.value && isContingencia.value && reportedContingencyDocuments.value.length === 0)
  )
));
const eventOverlayVariant = computed<'loading' | 'success' | 'warning'>(() => {
  if (processing.value || contingencyRetransmissionLoading.value) return 'loading';
  if (contingencyRetransmissionFailed.value) return 'warning';
  return 'success';
});
const eventOverlayTitle = computed(() => {
  if (contingencyRetransmissionLoading.value) return 'Retransmitiendo DTE';
  if (processing.value) return isContingencia.value ? 'Declarando contingencia' : isOperacionesEspeciales.value ? 'Reportando operaciones' : isRetorno.value ? 'Reportando retorno' : 'Procesando evento';
  if (contingencyRetransmissionComplete.value) return 'Contingencia finalizada';
  if (isContingencia.value) return 'Evento declarado';
  if (isOperacionesEspeciales.value) return 'Operaciones reportadas';
  if (isRetorno.value) return 'Retorno reportado';
  return 'Evento aceptado';
});
const eventOverlayMessage = computed(() => {
  if (contingencyRetransmissionLoading.value) return 'Enviando los DTE reportados a Hacienda.';
  if (processing.value) return eventPhases.value[eventPhaseIndex.value]?.detail ?? 'Procesando evento.';
  if (contingencyRetransmissionComplete.value) return 'El evento y los DTE reportados fueron procesados.';
  return eventResult.value?.codigoGeneracion ?? eventStatusDetail.value;
});
const eventStatusDetail = computed(() => {
  if (processing.value) return eventPhases.value[eventPhaseIndex.value].detail;
  if (eventStopped.value) return error.value;
  return eventResult.value?.transmission?.descripcion_msg
    ?? eventResult.value?.transmission?.mh_estado
    ?? eventResult.value?.codigoGeneracion
    ?? error.value;
});
const eventResultCardClass = computed(() => {
  if (eventAccepted.value) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (eventRejected.value || eventStopped.value) return 'border-red-200 bg-red-50 text-red-900';
  return 'border-sky-200 bg-sky-50 text-sky-900';
});
const eventResultLabel = computed(() => {
  if (eventAccepted.value) return 'Evento aceptado';
  if (eventRejected.value) return 'Evento rechazado';
  return 'Evento detenido';
});
const eventMhResponse = computed(() => eventResult.value?.mh_response
  ?? eventResult.value?.transmission?.raw_response
  ?? {});
const eventMhCodigoMsg = computed(() => String(
  eventResult.value?.transmission?.codigo_msg
  ?? recordValue(eventMhResponse.value).codigoMsg
  ?? 'Sin codigo'
));
const eventMhProcessedAt = computed(() => String(
  recordValue(eventMhResponse.value).fhProcesamiento
  ?? recordValue(eventMhResponse.value).fecProcesamiento
  ?? eventResult.value?.processed_at
  ?? eventResult.value?.transmitted_at
  ?? ''
));
const eventMhResponseJson = computed(() => JSON.stringify(eventMhResponse.value, null, 2));
const retransmittableContingencyDocuments = computed(() => reportedContingencyDocuments.value.filter(isRetransmittableContingencyDocument));
const canRetransmitContingencyDocuments = computed(() => eventAccepted.value
  && retransmittableContingencyDocuments.value.length > 0
  && !contingencyRetransmissionLoading.value);
const actionStatusLabel = computed(() => {
  if (isContingencia.value) {
    if (selectedContingencyDocuments.value.length === 0) return 'Pendiente';
    if (requiresMotivoContingencia.value && !form.motivoContingencia.trim()) return 'Falta motivo';
    if (!contingencyWindowComplete.value) return 'Falta ventana';
    if (!contingencyWindowChronological.value) return 'Ventana invalida';
    if (!selectedContingencyDocuments.value.every(isContingencyDocument)) return 'DTE no valido';
    return `${selectedContingencyDocuments.value.length} DTE listos`;
  }

  if (isOperacionesEspeciales.value) {
    if (!selectedOperacionesEmpresa.value) return 'Falta empresa';
    if (operacionesLineas.value.length === 0) return 'Sin lineas';
    if (operacionesLineas.value.length > 500) return 'Maximo 500';
    if (!operacionesLineas.value.every(isValidSpecialOperationLine)) return 'Revisa lineas';
    return `${operacionesLineas.value.length} linea${operacionesLineas.value.length === 1 ? '' : 's'} listas`;
  }

  if (isRetorno.value) {
    if (selectedReturnDocuments.value.length === 0) return 'Falta DTE origen';
    if (selectedReturnDocuments.value.length > 50) return 'Maximo 50 DTE';
    if (retornoLineas.value.length === 0) return 'Sin lineas';
    if (!retornoLineas.value.every(isValidReturnEventLine)) return 'Revisa lineas';
    return `${retornoLineas.value.length} item${retornoLineas.value.length === 1 ? '' : 's'} listos`;
  }

  if (!selected.value) return 'Pendiente';
  if (requiresMotivoAnulacion.value && !form.motivoAnulacion.trim()) return 'Falta motivo';
  if (requiresReplacementDte.value && !selectedReplacement.value) return 'Falta sustituto';
  if (replacementIdentificationError.value) return 'Sustituto generico';
  return invalidacionLabel(selected.value);
});

watch(query, () => {
  if (!isInvalidacion.value && !isRetorno.value) return;
  if (searchLocked.value) {
    searchLocked.value = false;
    return;
  }
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    if (isRetorno.value) {
      void loadReturnCandidates();
      return;
    }

    void loadDocuments();
  }, 250);
});

watch(replacementQuery, () => {
  if (!requiresReplacementDte.value || selectedReplacement.value) return;
  if (replacementSearchTimer) window.clearTimeout(replacementSearchTimer);
  replacementSearchTimer = window.setTimeout(() => void loadReplacementDocuments(), 250);
});

watch(() => form.tipoAnulacion, () => {
  clearReplacementDocument();

  if (requiresMotivoAnulacion.value) {
    openMotivoModal('invalidacion');
  } else {
    form.motivoAnulacion = '';
    motivoDraft.value = '';
    motivoModalOpen.value = false;
  }
});

watch(() => form.tipoContingencia, () => {
  selectedContingencyDocuments.value = [];
  reportedContingencyDocuments.value = [];
  contingencyRetransmissionResults.value = [];
  contingencyRetransmissionError.value = null;
  documents.value = [];
  contingencyCandidates.value = [];
  contingencyCandidatesLoaded.value = false;
  eventResult.value = null;
  eventLog.value = [];
  resetContingencyWindowAutomation();

  if (isContingencia.value && requiresMotivoContingencia.value) {
    openMotivoModal('contingencia');
  } else {
    form.motivoContingencia = '';
    if (motivoModalMode.value === 'contingencia') {
      motivoDraft.value = '';
      motivoModalOpen.value = false;
    }
  }

  if (isContingencia.value) {
    void loadContingencyCandidates();
  }
});

watch(() => props.initialEventType, () => {
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];
  selected.value = null;
  selectedContingencyDocuments.value = [];
  selectedReturnDocuments.value = [];
  reportedContingencyDocuments.value = [];
  contingencyRetransmissionResults.value = [];
  contingencyRetransmissionError.value = null;
  clearReplacementDocument();
  documents.value = [];
  contingencyCandidates.value = [];
  contingencyCandidatesLoaded.value = false;
  returnCandidates.value = [];
  returnCandidatesLoaded.value = false;
  query.value = '';
  searched.value = false;
  resetContingencyWindowAutomation();

  if (isContingencia.value) {
    void loadContingencyCandidates();
  }

  if (isOperacionesEspeciales.value) {
    void loadBillingCompanies();
  }
});

watch(isContingencia, (active) => {
  if (active && !contingencyCandidatesLoaded.value) {
    void loadContingencyCandidates();
  }
}, { immediate: true });

watch(isOperacionesEspeciales, (active) => {
  if (active && billingCompanies.value.length === 0) {
    void loadBillingCompanies();
  }
}, { immediate: true });

watch(() => form.retornoDteType, () => {
  selectedReturnDocuments.value = [];
  returnCandidates.value = [];
  returnCandidatesLoaded.value = false;
  retornoLineas.value = [createReturnEventLine()];
  clearEventResult();
});

watch(() => form.operacionesDocumentType, (tipoDocumento) => {
  operacionesLineas.value = operacionesLineas.value.map((line) => ({
    ...line,
    tipoDocumento: tipoDocumento === '97' ? '97' : '02',
  }));

  if (operacionesLineas.value.length === 0) {
    operacionesLineas.value = [createSpecialOperationLine()];
  }

  clearEventResult();
});

watch(() => form.operacionesMode, () => {
  operacionesLineas.value = [createSpecialOperationLine()];
  clearEventResult();
});

watch(() => form.operacionesStatus, () => {
  operacionesLineas.value = operacionesLineas.value.map((line) => ({ ...line, codigoGeneracionRef: '' }));
  clearEventResult();
});

watch(selectedContingencyDocuments, () => {
  syncContingencyWindowFromSelection();
}, { deep: true });

watch(selectedReturnDocuments, () => {
  syncReturnLinesFromSelection();
}, { deep: true });

async function loadDocuments(options: { preserveEventResult?: boolean } = {}): Promise<void> {
  const search = query.value.trim();
  if (isInvalidacion.value) {
    selected.value = null;
  }

  if (!options.preserveEventResult) {
    eventResult.value = null;
    eventLog.value = [];
  }

  if (search.length < 2) {
    documents.value = [];
    searched.value = false;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  searched.value = true;

  try {
    const response = await client.value.documents({
      q: search,
      estado: isContingencia.value ? 'signed' : 'accepted',
      limit: 12,
      include_payload: true
    });
    documents.value = response.data.filter((document) => {
      if (isContingencia.value) return isContingencyDocument(document) && canAddContingencyDocument(document);

      return document.selloRecibido;
    });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar documentos.';
  } finally {
    loading.value = false;
  }
}

async function loadContingencyCandidates(): Promise<void> {
  if (!isContingencia.value) return;

  contingencyCandidatesLoading.value = true;
  contingencyCandidatesLoaded.value = true;
  error.value = null;

  try {
    const responses = await Promise.all([
      client.value.documents({
        estado: 'signed',
        limit: 75,
        include_payload: true
      }),
      client.value.documents({
        estado: 'contingency',
        limit: 75,
        include_payload: true
      })
    ]);
    const documentsById = new Map<number, DteDraftSummary>();
    responses.flatMap((response) => response.data).forEach((document) => {
      documentsById.set(document.id, document);
    });
    contingencyCandidates.value = Array.from(documentsById.values()).filter(isContingencyDocument);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar los candidatos de contingencia.';
  } finally {
    contingencyCandidatesLoading.value = false;
  }
}

async function loadReturnCandidates(): Promise<void> {
  if (!isRetorno.value) return;

  const search = query.value.trim();
  if (search.length < 2) {
    returnCandidates.value = [];
    returnCandidatesLoaded.value = false;
    returnCandidatesLoading.value = false;
    return;
  }

  returnCandidatesLoading.value = true;
  returnCandidatesLoaded.value = true;
  error.value = null;

  try {
    const response = await client.value.documents({
      q: search,
      tipo_dte: form.retornoDteType,
      limit: 20,
      include_payload: true,
      include_audit: true,
      retorno_eligible: true
    });

    returnCandidates.value = response.data.filter(isReturnCandidateDocument);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar DTE para retorno.';
  } finally {
    returnCandidatesLoading.value = false;
  }
}

async function loadBillingCompanies(): Promise<void> {
  if (billingCompanies.value.length > 0 || billingContextLoading.value) return;

  billingContextLoading.value = true;
  error.value = null;

  try {
    const context = await client.value.billingContext();
    billingCompanies.value = context.empresas.filter((empresa) => empresa.lifecycle_status === 'active');
    if (!form.operacionesEmpresaId && billingCompanies.value.length === 1) {
      form.operacionesEmpresaId = billingCompanies.value[0].id;
      form.operacionesAmbiente = billingCompanies.value[0].ambiente;
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar las empresas.';
  } finally {
    billingContextLoading.value = false;
  }
}

function selectDocument(document: DteDraftSummary): void {
  selected.value = document;
  clearReplacementDocument();
  eventResult.value = null;
  eventLog.value = [];
  documents.value = [];
  searched.value = false;
  searchLocked.value = true;
  query.value = `${document.numeroControl} · ${String(recordValue((document.payload ?? document.dte_json ?? {}).receptor).nombre ?? 'DTE aceptado')}`;
}

function selectContingencyDocument(document: DteDraftSummary): void {
  if (!canAddContingencyDocument(document)) return;

  selectedContingencyDocuments.value.push(document);
  reportedContingencyDocuments.value = [];
  contingencyRetransmissionResults.value = [];
  contingencyRetransmissionError.value = null;
  eventResult.value = null;
  eventLog.value = [];
  documents.value = [];
  searched.value = false;
}

function selectReturnDocument(document: DteDraftSummary): void {
  if (!canAddReturnDocument(document)) return;

  selectedReturnDocuments.value.push(document);
  prefillReturnLineFromDocument(document);
  query.value = '';
  returnCandidates.value = [];
  returnCandidatesLoaded.value = false;
  returnCandidatesLoading.value = false;
  clearEventResult();
}

function removeReturnDocument(documentId: number): void {
  selectedReturnDocuments.value = selectedReturnDocuments.value.filter((document) => document.id !== documentId);
  clearEventResult();
}

function addVisibleContingencyCandidates(): void {
  for (const document of filteredContingencyCandidates.value) {
    if (canAddContingencyDocument(document)) {
      selectedContingencyDocuments.value.push(document);
    }
  }

  eventResult.value = null;
  eventLog.value = [];
  reportedContingencyDocuments.value = [];
  contingencyRetransmissionResults.value = [];
  contingencyRetransmissionError.value = null;
}

function removeContingencyDocument(documentId: number): void {
  selectedContingencyDocuments.value = selectedContingencyDocuments.value.filter((document) => document.id !== documentId);
  eventResult.value = null;
  eventLog.value = [];
  reportedContingencyDocuments.value = [];
  contingencyRetransmissionResults.value = [];
  contingencyRetransmissionError.value = null;
}

function clearSelectedDocument(): void {
  selected.value = null;
  eventResult.value = null;
  eventLog.value = [];
  query.value = '';
  documents.value = [];
  searched.value = false;
  clearReplacementDocument();
}

async function loadReplacementDocuments(): Promise<void> {
  if (!selected.value || !requiresReplacementDte.value) return;

  const search = replacementQuery.value.trim();

  if (search.length < 2) {
    replacementDocuments.value = [];
    replacementSearched.value = false;
    return;
  }

  replacementSearched.value = true;

  try {
    const response = await client.value.documents({
      q: search,
      estado: 'accepted',
      tipo_dte: selected.value.tipoDte,
      empresa_id: selected.value.empresa?.id,
      limit: 12,
      include_payload: true
    });

    replacementDocuments.value = response.data.filter((document) => document.id !== selected.value?.id && document.selloRecibido);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar DTE sustitutos.';
  }
}

function selectReplacementDocument(document: DteDraftSummary): void {
  selectedReplacement.value = document;
  replacementDocuments.value = [];
  replacementSearched.value = false;
  replacementQuery.value = `${document.numeroControl} · ${document.codigoGeneracion}`;
}

function clearReplacementDocument(): void {
  selectedReplacement.value = null;
  replacementDocuments.value = [];
  replacementQuery.value = '';
  replacementSearched.value = false;
}

function openMotivoModal(mode: 'invalidacion' | 'contingencia' = 'invalidacion'): void {
  motivoModalMode.value = mode;
  motivoDraft.value = mode === 'contingencia' ? form.motivoContingencia : form.motivoAnulacion;
  motivoModalOpen.value = true;
}

function closeMotivoModal(): void {
  if (motivoModalMode.value === 'invalidacion' && requiresMotivoAnulacion.value && !form.motivoAnulacion.trim() && !motivoDraft.value.trim()) {
    form.tipoAnulacion = 2;
    clearReplacementDocument();
  }

  motivoModalOpen.value = false;
}

function saveMotivoModal(): void {
  if (motivoModalMode.value === 'contingencia') {
    form.motivoContingencia = motivoDraft.value.trim();
  } else {
    form.motivoAnulacion = motivoDraft.value.trim();
  }

  motivoModalOpen.value = false;
}

async function invalidateSelected(): Promise<void> {
  if (!selected.value || !canInvalidate.value) return;

  let eventIdForRecovery: number | null = null;
  processing.value = true;
  eventModalOpen.value = true;
  eventProgress.value = 5;
  eventPhaseIndex.value = 0;
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];

  try {
    pushLog('Creando evento de invalidacion');
    const draft = await client.value.createMhEvent('invalidacion', {
      empresa_id: Number(selected.value.empresa?.id),
      ambiente: selected.value.ambiente as '00' | '01',
      payload: {
        documento: {
          codigoGeneracionR: selectedReplacement.value?.codigoGeneracion ?? null,
        },
        motivo: {
          tipoAnulacion: Number(form.tipoAnulacion),
          motivoAnulacion: requiresMotivoAnulacion.value ? form.motivoAnulacion.trim() : null
        }
      },
      relations: [{
        relation_type: 'invalidates',
        dte_document_id: selected.value.id
      }]
    });
    eventIdForRecovery = draft.id;

    pushLog('Validando datos de la solicitud');
    eventPhaseIndex.value = 1;
    eventProgress.value = 30;
    const validation = await client.value.validateMhEvent(draft.id);
    if (!validation.validation.valid) {
      eventResult.value = draft;
      throw new Error(formatValidationErrors(validation.validation.errors));
    }

    pushLog('Firmando evento');
    eventPhaseIndex.value = 2;
    eventProgress.value = 55;
    const signed = await client.value.signMhEvent(draft.id);
    eventIdForRecovery = signed.id;

    pushLog('Transmitiendo evento a MH');
    eventPhaseIndex.value = 3;
    eventProgress.value = 78;
    eventResult.value = await client.value.transmitMhEvent(signed.id);
    eventPhaseIndex.value = 4;
    eventProgress.value = 100;
    pushLog('Evento procesado por MH');
    await reverseInventoryForAcceptedInvalidation();
    await loadDocuments({ preserveEventResult: true });
  } catch (caught) {
    const recovered = await recoverEventResult(eventIdForRecovery);

    if (recovered && (eventAccepted.value || eventRejected.value)) {
      eventLog.value.push({ label: 'Respuesta MH recuperada', status: 'ok' });
      error.value = null;
      await reverseInventoryForAcceptedInvalidation();
      await loadDocuments({ preserveEventResult: true });
    } else {
      eventLog.value.push({ label: 'Proceso detenido', status: 'error' });
      error.value = friendlyErrorMessage(caught, 'No fue posible invalidar el documento.');
    }

    eventProgress.value = Math.max(eventProgress.value, 100);
  } finally {
    processing.value = false;
  }
}

async function reverseInventoryForAcceptedInvalidation(): Promise<void> {
  if (!eventAccepted.value || !selected.value || Number(form.tipoAnulacion) !== 2 || !platformTenantId.value) {
    return;
  }

  try {
    eventLog.value.push({ label: 'Revirtiendo inventario por invalidacion tipo 2', status: 'ok' });
    await platformClient.value.reverseInventorySaleBySource(platformTenantId.value, {
      source_type: 'dte',
      source_id: String(selected.value.id),
      event_id: eventResult.value?.id ? String(eventResult.value.id) : null,
      event_number: eventResult.value?.codigoGeneracion ?? eventResult.value?.numeroControl ?? null,
      notes: 'Invalidacion tipo 2 aceptada por MH',
    });
    eventLog.value.push({ label: 'Inventario revertido automaticamente', status: 'ok' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('stelfaro:inventory-changed', {
        detail: { action: 'mh_invalidation_reversal', tenant_id: platformTenantId.value, at: Date.now() }
      }));
    }
  } catch {
    eventLog.value.push({ label: 'MH acepto la invalidacion, pero no se pudo revertir inventario automaticamente', status: 'error' });
  }
}

async function reportContingency(): Promise<void> {
  if (!canReportContingency.value) return;

  const company = selectedContingencyCompany.value;
  const ambiente = selectedContingencyDocuments.value[0]?.ambiente as '00' | '01' | undefined;
  if (!company?.id || !ambiente) return;

  if (!contingencyEndTouched.value) {
    setContingencyEndToNow();
  }

  let eventIdForRecovery: number | null = null;
  processing.value = true;
  eventModalOpen.value = true;
  eventProgress.value = 5;
  eventPhaseIndex.value = 0;
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];

  try {
    pushLog('Creando evento de contingencia');
    const draft = await client.value.createMhEvent('contingencia', {
      empresa_id: Number(company.id),
      ambiente,
      payload: {
        motivo: {
          fInicio: form.contingenciaFInicio,
          fFin: form.contingenciaFFin,
          hInicio: normalizeTime(form.contingenciaHInicio),
          hFin: normalizeTime(form.contingenciaHFin),
          tipoContingencia: Number(form.tipoContingencia),
          motivoContingencia: requiresMotivoContingencia.value ? form.motivoContingencia.trim() : null
        }
      },
      relations: selectedContingencyDocuments.value.map((document) => ({
        relation_type: 'contains',
        dte_document_id: document.id
      }))
    });
    eventIdForRecovery = draft.id;

    pushLog('Validando datos del evento');
    eventPhaseIndex.value = 1;
    eventProgress.value = 30;
    const validation = await client.value.validateMhEvent(draft.id);
    if (!validation.validation.valid) {
      eventResult.value = draft;
      throw new Error(formatValidationErrors(validation.validation.errors));
    }

    pushLog('Firmando evento');
    eventPhaseIndex.value = 2;
    eventProgress.value = 55;
    const signed = await client.value.signMhEvent(draft.id);
    eventIdForRecovery = signed.id;

    pushLog('Transmitiendo evento a MH');
    eventPhaseIndex.value = 3;
    eventProgress.value = 78;
    eventResult.value = await client.value.transmitMhEvent(signed.id);
    eventPhaseIndex.value = 4;
    eventProgress.value = 100;
    pushLog('Evento procesado por MH');
    if (eventAccepted.value) {
      reportedContingencyDocuments.value = [...selectedContingencyDocuments.value];
      contingencyRetransmissionResults.value = [];
      contingencyRetransmissionError.value = null;
      selectedContingencyDocuments.value = [];
      await loadContingencyCandidates();
    }
  } catch (caught) {
    const recovered = await recoverEventResult(eventIdForRecovery);

    if (recovered && (eventAccepted.value || eventRejected.value)) {
      eventLog.value.push({ label: 'Respuesta MH recuperada', status: 'ok' });
      error.value = null;
      if (eventAccepted.value) {
        reportedContingencyDocuments.value = [...selectedContingencyDocuments.value];
        contingencyRetransmissionResults.value = [];
        contingencyRetransmissionError.value = null;
        selectedContingencyDocuments.value = [];
        await loadContingencyCandidates();
      }
    } else {
      eventLog.value.push({ label: 'Proceso detenido', status: 'error' });
      error.value = friendlyErrorMessage(caught, 'No fue posible reportar la contingencia.');
    }

    eventProgress.value = Math.max(eventProgress.value, 100);
  } finally {
    processing.value = false;
  }
}

async function reportSpecialOperations(): Promise<void> {
  if (!canReportOperacionesEspeciales.value || !selectedOperacionesEmpresa.value) return;

  let eventIdForRecovery: number | null = null;
  processing.value = true;
  eventModalOpen.value = true;
  eventProgress.value = 5;
  eventPhaseIndex.value = 0;
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];

  try {
    pushLog('Creando evento de operaciones especiales');
    const draft = await client.value.createMhEvent('operaciones_especiales', {
      empresa_id: Number(selectedOperacionesEmpresa.value.id),
      ambiente: selectedOperacionesEmpresa.value.ambiente,
      payload: {
        cuerpoDocumento: operacionesLineas.value.map(specialOperationLinePayload)
      },
    });
    eventIdForRecovery = draft.id;

    pushLog('Validando datos del evento');
    eventPhaseIndex.value = 1;
    eventProgress.value = 30;
    const validation = await client.value.validateMhEvent(draft.id);
    if (!validation.validation.valid) {
      eventResult.value = draft;
      throw new Error(formatValidationErrors(validation.validation.errors));
    }

    pushLog('Firmando evento');
    eventPhaseIndex.value = 2;
    eventProgress.value = 55;
    const signed = await client.value.signMhEvent(draft.id);
    eventIdForRecovery = signed.id;

    pushLog('Transmitiendo evento a MH');
    eventPhaseIndex.value = 3;
    eventProgress.value = 78;
    eventResult.value = await client.value.transmitMhEvent(signed.id);
    eventPhaseIndex.value = 4;
    eventProgress.value = 100;
    pushLog('Evento procesado por MH');
  } catch (caught) {
    const recovered = await recoverEventResult(eventIdForRecovery);

    if (recovered && (eventAccepted.value || eventRejected.value)) {
      eventLog.value.push({ label: 'Respuesta MH recuperada', status: 'ok' });
      error.value = null;
    } else {
      eventLog.value.push({ label: 'Proceso detenido', status: 'error' });
      error.value = friendlyErrorMessage(caught, 'No fue posible reportar las operaciones especiales.');
    }

    eventProgress.value = Math.max(eventProgress.value, 100);
  } finally {
    processing.value = false;
  }
}

async function reportReturnEvent(): Promise<void> {
  if (!canReportRetorno.value || !selectedRetornoEmpresa.value || !selectedReturnDocuments.value[0]) return;

  let eventIdForRecovery: number | null = null;
  processing.value = true;
  eventModalOpen.value = true;
  eventProgress.value = 5;
  eventPhaseIndex.value = 0;
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];

  try {
    pushLog('Creando evento de retorno');
    const draft = await client.value.createMhEvent('retorno', {
      empresa_id: Number(selectedRetornoEmpresa.value.id),
      ambiente: selectedReturnDocuments.value[0].ambiente as '00' | '01',
      payload: {
        cuerpoDocumento: retornoLineas.value.map(returnEventLinePayload),
      },
      relations: selectedReturnDocuments.value.map((document) => ({
        relation_type: 'returns',
        dte_document_id: document.id,
      })),
    });
    eventIdForRecovery = draft.id;

    pushLog('Validando datos del evento');
    eventPhaseIndex.value = 1;
    eventProgress.value = 30;
    const validation = await client.value.validateMhEvent(draft.id);
    if (!validation.validation.valid) {
      eventResult.value = draft;
      throw new Error(formatValidationErrors(validation.validation.errors));
    }

    pushLog('Firmando evento');
    eventPhaseIndex.value = 2;
    eventProgress.value = 55;
    const signed = await client.value.signMhEvent(draft.id);
    eventIdForRecovery = signed.id;

    pushLog('Transmitiendo evento a MH');
    eventPhaseIndex.value = 3;
    eventProgress.value = 78;
    eventResult.value = await client.value.transmitMhEvent(signed.id);
    eventPhaseIndex.value = 4;
    eventProgress.value = 100;
    pushLog('Evento procesado por MH');
  } catch (caught) {
    const recovered = await recoverEventResult(eventIdForRecovery);

    if (recovered && (eventAccepted.value || eventRejected.value)) {
      eventLog.value.push({ label: 'Respuesta MH recuperada', status: 'ok' });
      error.value = null;
    } else {
      eventLog.value.push({ label: 'Proceso detenido', status: 'error' });
      error.value = friendlyErrorMessage(caught, 'No fue posible reportar el retorno.');
    }

    eventProgress.value = Math.max(eventProgress.value, 100);
  } finally {
    processing.value = false;
  }
}

async function retransmitContingencyDocuments(): Promise<void> {
  if (!canRetransmitContingencyDocuments.value) return;

  contingencyRetransmissionLoading.value = true;
  contingencyRetransmissionError.value = null;
  contingencyRetransmissionResults.value = [];

  const updatedDocuments = [...reportedContingencyDocuments.value];

  const documentsToRetransmit = retransmittableContingencyDocuments.value;

  for (const document of documentsToRetransmit) {
    try {
      const sent = await client.value.sendDraft(document.id);
      const index = updatedDocuments.findIndex((item) => item.id === document.id);
      if (index >= 0) updatedDocuments[index] = sent;
      contingencyRetransmissionResults.value.push({
        id: document.id,
        numeroControl: document.numeroControl,
        status: sent.estado,
        source: sent.estado === 'rejected' ? 'mh' : undefined,
        message: sent.selloRecibido
          ? `Sello ${sent.selloRecibido}`
          : sent.transmission?.descripcion_msg ?? sent.errorMessage ?? undefined
      });
    } catch (caught) {
      contingencyRetransmissionResults.value.push({
        id: document.id,
        numeroControl: document.numeroControl,
        status: 'error',
        source: 'local',
        message: caught instanceof Error ? caught.message : 'No fue posible transmitir el DTE.'
      });
    }
  }

  reportedContingencyDocuments.value = updatedDocuments;
  contingencyRetransmissionLoading.value = false;
  const failed = contingencyRetransmissionResults.value.filter((result) => ['error', 'rejected'].includes(String(result.status).toLowerCase()));
  const simulationFailure = failed.some((result) => String(result.message ?? '').includes('simulacion local de indisponibilidad MH'));
  const mhRejected = failed.some((result) => result.source === 'mh' || String(result.status).toLowerCase() === 'rejected');
  contingencyRetransmissionError.value = failed.length > 0
    ? mhRejected
      ? 'Hacienda rechazo uno o mas DTE. Revisa el detalle; esos documentos no se reintentaran hasta corregirlos.'
      : simulationFailure
      ? 'Algunos DTE aun fueron rechazados por la simulacion local de indisponibilidad MH. Confirma que el simulador este apagado y reintenta solo los pendientes.'
      : 'Algunos DTE no pudieron transmitirse. Revisa el detalle y reintenta solo los pendientes.'
    : null;
  await loadContingencyCandidates();
}

async function recoverEventResult(eventId: number | null): Promise<boolean> {
  if (!eventId) return false;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const event = await client.value.mhEvent(eventId);
      eventResult.value = event;

      if (event.transmission || event.mh_response) {
        return true;
      }
    } catch {
      // Keep polling: the transmit request may still be finishing server-side.
    }

    await wait(1500);
  }

  return false;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function closeEventModal(): void {
  if (processing.value) return;

  const shouldResetAcceptedEvent = eventAccepted.value && !eventRejected.value && !eventStopped.value;
  eventModalOpen.value = false;

  if (shouldResetAcceptedEvent) {
    resetEventWorkspaceAfterSuccess();
  }
}

function resetEventWorkspaceAfterSuccess(): void {
  if (isContingencia.value) {
    selectedContingencyDocuments.value = [];
    reportedContingencyDocuments.value = [];
    contingencyRetransmissionResults.value = [];
    contingencyRetransmissionError.value = null;
    resetContingencyWindowAutomation();
    void loadContingencyCandidates();
  } else if (isOperacionesEspeciales.value) {
    operacionesLineas.value = [createSpecialOperationLine()];
    form.operacionesStatus = 'active';
    form.operacionesMode = 'range';
  } else if (isRetorno.value) {
    selectedReturnDocuments.value = [];
    retornoLineas.value = [createReturnEventLine()];
    form.retornoCodigoGeneracionRelacionado = '';
    returnCandidates.value = [];
    returnCandidatesLoaded.value = false;
  } else {
    clearSelectedDocument();
    form.tipoAnulacion = 2;
    form.motivoAnulacion = '';
    motivoDraft.value = '';
  }

  error.value = null;
  eventResult.value = null;
  eventLog.value = [];
  eventProgress.value = 0;
  eventPhaseIndex.value = 0;
}

function clearEventResult(): void {
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];
  eventProgress.value = 0;
  eventPhaseIndex.value = 0;
}

function pushLog(label: string): void {
  eventLog.value.push({ label, status: 'ok' });
}

function formatValidationErrors(errors: Array<{ field: string; message: string }>): string {
  const fieldLabels: Record<string, string> = {
    'emisor.codEstableMH': 'Codigo de establecimiento MH',
    'emisor.codPuntoVentaMH': 'Codigo de punto de venta MH',
    'emisor.telefono': 'Telefono del emisor',
    'emisor.correo': 'Correo del emisor',
    'documento.selloRecibido': 'Sello recibido del DTE',
    'motivo.motivoAnulacion': 'Motivo de invalidacion',
    'motivo.motivoContingencia': 'Motivo de contingencia',
    'motivo.tipoContingencia': 'Tipo de contingencia',
    'motivo.fInicio': 'Fecha inicio de contingencia',
    'motivo.fFin': 'Fecha fin de contingencia',
    'motivo.hInicio': 'Hora inicio de contingencia',
    'motivo.hFin': 'Hora fin de contingencia',
    'detalleDTE': 'DTE en contingencia',
    'relations': 'Documentos relacionados',
    'cuerpoDocumento': 'Detalle de operaciones',
    'identificacion.tipoEvento': 'Tipo de evento',
  };
  const readable = errors
    .filter((item) => item.field && !item.message.includes('Additional object properties'))
    .slice(0, 4)
    .map((item) => `${fieldLabels[item.field] ?? item.field}: ${item.message}`);

  if (readable.length === 0) {
    if (isContingencia.value) return 'El evento de contingencia esta incompleto. Revisa que los DTE esten firmados, sin sello MH y generados con modelo diferido.';
    if (isOperacionesEspeciales.value) return 'El evento de operaciones especiales esta incompleto. Revisa empresa, modalidad, lineas y montos.';

    return 'La solicitud de invalidacion esta incompleta. Revisa que el DTE origen tenga sello de recepcion y datos fiscales completos.';
  }

  return `${isContingencia.value ? 'El evento de contingencia' : isOperacionesEspeciales.value ? 'El evento de operaciones especiales' : 'La solicitud de invalidacion'} necesita correcciones:\n${readable.join('\n')}`;
}

function friendlyErrorMessage(caught: unknown, fallback: string): string {
  const raw = caught instanceof Error ? caught.message : String(caught ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const message = errorMessageFromPayload(parsed);
      if (message) return message;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function errorMessageFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    const messages = payload
      .map((item) => typeof item === 'string' ? item : errorMessageFromPayload(item))
      .filter((item): item is string => Boolean(item));

    return messages.length ? messages.join('\n') : null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }
  if (Array.isArray(record.errors)) {
    const messages = record.errors
      .map((item) => typeof item === 'string' ? item : errorMessageFromPayload(item))
      .filter((item): item is string => Boolean(item));

    return messages.length ? messages.join('\n') : null;
  }

  return null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function currentLocalDate(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function currentLocalTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

function setContingencyEndToNow(): void {
  form.contingenciaFFin = currentLocalDate();
  form.contingenciaHFin = currentLocalTime();
  clampAutomaticContingencyEnd();
}

function normalizeTime(value: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;

  return value;
}

function localDateTimeValue(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute, second = '0'] = timeMatch;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime();
}

function clampAutomaticContingencyEnd(): void {
  const start = localDateTimeValue(form.contingenciaFInicio, form.contingenciaHInicio);
  const end = localDateTimeValue(form.contingenciaFFin, form.contingenciaHFin);
  if (start === null || end === null || end >= start) return;

  form.contingenciaFFin = form.contingenciaFInicio;
  form.contingenciaHFin = form.contingenciaHInicio;
}

function syncContingencyWindowFromSelection(): void {
  if (selectedContingencyDocuments.value.length === 0) {
    if (!contingencyStartTouched.value) {
      form.contingenciaFInicio = currentLocalDate();
      form.contingenciaHInicio = currentLocalTime();
    }
    if (!contingencyEndTouched.value) {
      setContingencyEndToNow();
    }
    return;
  }

  const identificacion = selectedContingencyIdentificacion.value;
  const fecEmi = String(identificacion.fecEmi ?? '').trim();
  const horEmi = String(identificacion.horEmi ?? '').trim();

  if (!contingencyStartTouched.value) {
    if (fecEmi) form.contingenciaFInicio = fecEmi;
    if (horEmi) form.contingenciaHInicio = horEmi.slice(0, 5);
  }

  if (!contingencyEndTouched.value) {
    setContingencyEndToNow();
  }
}

function markContingencyStartTouched(): void {
  contingencyStartTouched.value = true;
}

function markContingencyEndTouched(): void {
  contingencyEndTouched.value = true;
}

function resetContingencyWindowAutomation(): void {
  contingencyStartTouched.value = false;
  contingencyEndTouched.value = false;
  form.contingenciaFInicio = currentLocalDate();
  form.contingenciaHInicio = currentLocalTime();
  setContingencyEndToNow();
}

function isGenericReceptor(document: DteDraftSummary | null): boolean {
  if (!document) return false;

  const receptor = recordValue((document.payload ?? document.dte_json ?? {}).receptor);

  return !String(receptor.tipoDocumento ?? '').trim()
    && !String(receptor.numDocumento ?? '').trim()
    && !String(receptor.nit ?? '').trim();
}

function isContingencyDocument(document: DteDraftSummary): boolean {
  const identificacion = recordValue((document.payload ?? document.dte_json ?? {}).identificacion);
  const contingencia = recordValue(document.contingencia);
  const validState = document.estado === 'signed' || document.estado === 'contingency';
  const validContingencyShape = Number(identificacion.tipoModelo) === 2
    && Number(identificacion.tipoOperacion) === 2
    && Number(identificacion.tipoContingencia) === Number(form.tipoContingencia);
  const alreadyReported = Boolean(contingencia.mh_fiscal_event_id || contingencia.sello_recibido);

  return contingencyAllowedTypes.has(document.tipoDte)
    && validState
    && !document.selloRecibido
    && !alreadyReported
    && validContingencyShape;
}

function canAddContingencyDocument(document: DteDraftSummary): boolean {
  if (selectedContingencyDocuments.value.some((selectedDocument) => selectedDocument.id === document.id)) return false;
  if (!selectedContingencyCompany.value) return true;

  return selectedContingencyCompany.value.id === document.empresa?.id
    && selectedContingencyDocuments.value[0]?.ambiente === document.ambiente;
}

function isReturnCandidateDocument(document: DteDraftSummary): boolean {
  if (!['01', '11', '14'].includes(document.tipoDte)) return false;
  if (document.tipoDte !== form.retornoDteType) return false;
  if (document.retorno && !document.retorno.eligible) return false;
  if (!['accepted', 'received_by_mh'].includes(String(document.estado).toLowerCase())) return false;
  if (!document.selloRecibido) return false;

  const deadline = returnDocumentDeadline(document);
  return deadline === null || deadline.getTime() >= Date.now();
}

function canAddReturnDocument(document: DteDraftSummary): boolean {
  if (!isReturnCandidateDocument(document)) return false;
  if (selectedReturnDocuments.value.some((selectedDocument) => selectedDocument.id === document.id)) return false;
  if (selectedReturnDocuments.value.length >= 50) return false;
  if (selectedReturnDocuments.value.length === 0) return true;

  const first = selectedReturnDocuments.value[0];
  return first.tipoDte === document.tipoDte
    && first.ambiente === document.ambiente
    && first.empresa?.id === document.empresa?.id;
}

function returnDocumentDeadline(document: DteDraftSummary): Date | null {
  if (document.retorno?.deadline) {
    const deadline = new Date(document.retorno.deadline);
    if (!Number.isNaN(deadline.getTime())) return deadline;
  }

  const source = document.processed_at ?? document.updated_at ?? document.created_at ?? null;
  if (!source) return null;

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;

  date.setMonth(date.getMonth() + 3);
  return date;
}

function returnDocumentTotal(document: DteDraftSummary): number {
  if (Number(document.retorno?.remainingAmount ?? 0) > 0) {
    return roundMoney(Number(document.retorno?.remainingAmount ?? 0));
  }

  const resumen = recordValue((document.payload ?? document.dte_json ?? {}).resumen);
  for (const key of ['totalPagar', 'montoTotalOperacion', 'totalCompra', 'subTotal', 'totalGravada']) {
    const value = Number(resumen[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return roundMoney(value);
  }

  return roundMoney(Number(document.totalPagar ?? 0));
}

function returnDocumentForLine(line: ReturnEventLine): DteDraftSummary | null {
  const code = line.codigoGeneracion.trim().toUpperCase();

  return selectedReturnDocuments.value.find((document) => document.codigoGeneracion.toUpperCase() === code) ?? null;
}

function returnLineMaxAmount(line: ReturnEventLine): number {
  const document = returnDocumentForLine(line);

  return document ? returnDocumentTotal(document) : Number.POSITIVE_INFINITY;
}

function isEmptyReturnLine(line: ReturnEventLine): boolean {
  return !line.codigoGeneracion.trim()
    && numberValue(line.montoRetorno) <= 0
    && returnEventLineBase(line) <= 0;
}

function applyReturnDocumentToLine(line: ReturnEventLine, document: DteDraftSummary): void {
  line.codigoGeneracion = document.codigoGeneracion;
  line.tipoMonto = defaultReturnAmountType();
  line.montoRetorno = returnDocumentTotal(document);
  syncReturnEventAmounts(line);
}

function prefillReturnLineFromDocument(document: DteDraftSummary): void {
  const reusableLine = retornoLineas.value.find(isEmptyReturnLine);

  if (reusableLine) {
    applyReturnDocumentToLine(reusableLine, document);
    return;
  }

  retornoLineas.value.push(createReturnEventLine(document));
}

function syncReturnLinesFromSelection(): void {
  const firstDocument = selectedReturnDocuments.value[0] ?? null;
  const firstCode = firstDocument?.codigoGeneracion ?? '';

  retornoLineas.value = retornoLineas.value.map((line) => {
    if (line.codigoGeneracion && selectedReturnCodes.value.has(line.codigoGeneracion)) {
      return line;
    }

    const updated = { ...line, codigoGeneracion: firstCode };
    if (firstDocument && isEmptyReturnLine(line)) {
      applyReturnDocumentToLine(updated, firstDocument);
    }

    return updated;
  });
}

function returnDocumentTypeLabel(value: string): string {
  return retornoDocumentoTipos.find((tipo) => tipo.value === value)?.label ?? value;
}

function returnDocumentParty(document: DteDraftSummary): string {
  const receptor = recordValue((document.payload ?? document.dte_json ?? {}).receptor);
  const sujeto = recordValue((document.payload ?? document.dte_json ?? {}).sujetoExcluido);
  const tercero = recordValue((document.payload ?? document.dte_json ?? {}).ventaTercero);

  return String(receptor.nombre ?? sujeto.nombre ?? tercero.nombre ?? 'Sin receptor');
}

function returnDocumentDeadlineLabel(document: DteDraftSummary): string {
  const deadline = returnDocumentDeadline(document);

  return deadline ? fiscalDateTime(deadline.toISOString()) : 'Sin fecha limite';
}

function isRetransmittableContingencyDocument(document: DteDraftSummary): boolean {
  return !['accepted', 'rejected'].includes(String(document.estado).toLowerCase());
}

function contingencyDocumentStatusLabel(document: DteDraftSummary): string {
  const status = String(document.estado).toLowerCase();
  if (status === 'accepted') return 'Aceptado';
  if (status === 'rejected') return 'Rechazado por MH';
  if (status === 'contingency') return 'Pendiente';

  return statusLabel(document);
}

function contingencyDocumentStatusClass(document: DteDraftSummary): string {
  const status = String(document.estado).toLowerCase();
  if (status === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'contingency') return 'bg-amber-100 text-amber-700';

  return 'bg-slate-100 text-slate-600';
}

function contingencyRetransmissionResultLabel(result: { status: string; source?: 'mh' | 'local' }): string {
  const status = String(result.status).toLowerCase();
  if (status === 'accepted') return 'Aceptado por MH';
  if (status === 'rejected') return result.source === 'mh' ? 'Rechazado por MH' : 'Rechazado';
  if (status === 'error') return 'Error local';

  return String(result.status);
}

function contingencyRetransmissionResultClass(result: { status: string; source?: 'mh' | 'local' }): string {
  const status = String(result.status).toLowerCase();
  if (status === 'accepted') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  if (status === 'error') return result.source === 'local' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

  return 'bg-slate-100 text-slate-700';
}

function createSpecialOperationLine(): SpecialOperationLine {
  specialLineSequence += 1;

  return {
    id: specialLineSequence,
    codigoGeneracionRef: '',
    tipoDocumento: form?.operacionesDocumentType ?? '02',
    numDocumento: '',
    fechaEmision: currentLocalDate(),
    cantidad: form?.operacionesMode === 'single' ? 1 : 1,
    descripcion: 'Operacion especial reportada',
    docDel: '',
    docAl: '',
    precioUni: 0,
    ventaNoSuj: 0,
    ventaExenta: 0,
    ventaGravada: 0,
  };
}

function addSpecialOperationLine(): void {
  operacionesLineas.value.push(createSpecialOperationLine());
  clearEventResult();
}

function removeSpecialOperationLine(id: number): void {
  operacionesLineas.value = operacionesLineas.value.filter((line) => line.id !== id);
  if (operacionesLineas.value.length === 0) {
    operacionesLineas.value = [createSpecialOperationLine()];
  }
  clearEventResult();
}

function isValidSpecialOperationLine(line: SpecialOperationLine): boolean {
  if (!line.descripcion.trim()) return false;
  if (!['02', '97'].includes(form.operacionesDocumentType)) return false;
  if (numberValue(line.cantidad) < 1) return false;
  if (specialOperationLineTotal(line) <= 0) return false;

  if (form.operacionesMode === 'range') {
    const rangeQuantity = specialOperationRangeQuantity(line);

    return Boolean(
      String(line.docDel).trim()
      && String(line.docAl).trim()
      && rangeQuantity !== 0
      && (rangeQuantity === null || Number(line.cantidad) === rangeQuantity)
    );
  }

  return Boolean(String(line.numDocumento).trim() && String(line.fechaEmision).trim() && Number(line.cantidad) === 1);
}

function specialOperationLinePayload(line: SpecialOperationLine): Record<string, unknown> {
  const isRange = form.operacionesMode === 'range';
  if (isRange) {
    syncSpecialOperationRange(line);
  }

  return {
    codigoGeneracionRef: form.operacionesStatus === 'annulled' ? nullableString(line.codigoGeneracionRef) : null,
    tipoDocumento: form.operacionesDocumentType,
    numDocumento: isRange ? null : nullableString(line.numDocumento),
    fechaEmision: isRange ? null : nullableString(line.fechaEmision),
    cantidad: Math.max(1, Number(line.cantidad) || 1),
    descripcion: line.descripcion.trim(),
    docDel: isRange ? nullableString(line.docDel) : null,
    docAl: isRange ? nullableString(line.docAl) : null,
    precioUni: roundMoney(line.precioUni),
    ventaNoSuj: roundMoney(line.ventaNoSuj),
    ventaExenta: roundMoney(line.ventaExenta),
    ventaGravada: roundMoney(line.ventaGravada),
    tributos: numberValue(line.ventaGravada) > 0 ? ['20'] : null,
  };
}

function unsignedIntegerText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;

  return text.replace(/^0+(?=\d)/, '');
}

function specialOperationRangeQuantity(line: SpecialOperationLine): number | null {
  const startText = unsignedIntegerText(line.docDel);
  const endText = unsignedIntegerText(line.docAl);
  if (startText === null || endText === null) return null;

  const start = BigInt(startText);
  const end = BigInt(endText);
  if (end < start) return 0;

  const quantity = end - start + 1n;
  if (quantity > BigInt(Number.MAX_SAFE_INTEGER)) return null;

  return Number(quantity);
}

function syncSpecialOperationRange(line: SpecialOperationLine): void {
  if (form.operacionesMode !== 'range') return;

  const quantity = specialOperationRangeQuantity(line);
  if (quantity === null || quantity < 1) return;

  line.cantidad = quantity;
  syncSpecialOperationPrice(line);
}

function specialOperationRangeHelp(line: SpecialOperationLine): string {
  if (form.operacionesMode !== 'range') return '';

  const quantity = specialOperationRangeQuantity(line);
  if (quantity === 0) return 'Doc. Al debe ser mayor o igual a Doc. Del.';
  if (quantity !== null) return `Cantidad calculada: ${quantity}.`;

  return 'Completa un rango numerico para calcular la cantidad.';
}

function syncSpecialOperationPrice(line: SpecialOperationLine): void {
  const quantity = Math.max(1, Number(line.cantidad) || 1);
  line.precioUni = roundMoney(specialOperationLineTotal(line) / quantity);
}

function specialOperationLineTotal(line: SpecialOperationLine): number {
  return roundMoney(numberValue(line.ventaNoSuj) + numberValue(line.ventaExenta) + numberValue(line.ventaGravada));
}

function specialOperationTypeLabel(value: string): string {
  return operacionesDocumentoTipos.find((tipo) => tipo.value === value)?.label ?? value;
}

function createReturnEventLine(document?: DteDraftSummary): ReturnEventLine {
  returnLineSequence += 1;

  const line: ReturnEventLine = {
    id: returnLineSequence,
    codigoGeneracion: '',
    descripcion: 'Retorno reportado',
    tipoMonto: defaultReturnAmountType(),
    montoRetorno: 0,
    cantidad: 1,
    precioUni: 0,
    ventaNoSuj: 0,
    ventaExenta: 0,
    ventaGravada: 0,
    compra: 0,
    noGravado: 0,
    seguro: 0,
    flete: 0,
    ivaRete: 0,
    reteRenta: 0,
  };

  if (document) {
    applyReturnDocumentToLine(line, document);
  }

  return line;
}

function addReturnEventLine(): void {
  retornoLineas.value.push(createReturnEventLine());
  clearEventResult();
}

function removeReturnEventLine(id: number): void {
  retornoLineas.value = retornoLineas.value.filter((line) => line.id !== id);
  if (retornoLineas.value.length === 0) {
    retornoLineas.value = [createReturnEventLine()];
  }
  clearEventResult();
}

function isValidReturnEventLine(line: ReturnEventLine): boolean {
  return Boolean(
    line.codigoGeneracion.trim()
    && selectedReturnCodes.value.has(line.codigoGeneracion.trim())
    && line.descripcion.trim()
    && numberValue(line.cantidad) > 0
    && returnEventLineBase(line) > 0
  );
}

function returnEventLinePayload(line: ReturnEventLine): Record<string, unknown> {
  syncReturnEventAmounts(line);

  return {
    codigoGeneracion: line.codigoGeneracion.trim().toUpperCase(),
    cantidad: Math.max(1, numberValue(line.cantidad)),
    precioUni: roundBodyAmount(line.precioUni),
    descripcion: line.descripcion.trim(),
    tipoMonto: line.tipoMonto,
    montoTotal: roundMoney(line.montoRetorno),
    ventaNoSuj: roundBodyAmount(line.ventaNoSuj),
    ventaExenta: roundBodyAmount(line.ventaExenta),
    ventaGravada: roundBodyAmount(line.ventaGravada),
    compra: roundBodyAmount(line.compra),
    noGravado: roundBodyAmount(line.noGravado),
    seguro: roundBodyAmount(line.seguro),
    flete: roundBodyAmount(line.flete),
    ivaRete: roundMoney(line.ivaRete),
    reteRenta: roundMoney(line.reteRenta),
  };
}

function defaultReturnAmountType(): ReturnEventLine['tipoMonto'] {
  if (form?.retornoDteType === '11') return 'exportacion';
  if (form?.retornoDteType === '14') return 'compra';

  return 'gravada';
}

function normalizeReturnAmountType(line: ReturnEventLine): ReturnEventLine['tipoMonto'] {
  if (form.retornoDteType === '11') return 'exportacion';
  if (form.retornoDteType === '14') return 'compra';
  if (['gravada', 'exenta', 'no_sujeta'].includes(line.tipoMonto)) return line.tipoMonto;

  return 'gravada';
}

function syncReturnEventAmounts(line: ReturnEventLine): void {
  const maxAmount = returnLineMaxAmount(line);
  const requestedAmount = roundMoney(line.montoRetorno);
  const amount = Number.isFinite(maxAmount) ? Math.min(requestedAmount, maxAmount) : requestedAmount;
  line.tipoMonto = normalizeReturnAmountType(line);
  line.montoRetorno = amount;
  line.ventaNoSuj = 0;
  line.ventaExenta = 0;
  line.ventaGravada = 0;
  line.compra = 0;

  if (form.retornoDteType === '01') {
    if (line.tipoMonto === 'no_sujeta') {
      line.ventaNoSuj = amount;
    } else if (line.tipoMonto === 'exenta') {
      line.ventaExenta = amount;
    } else {
      line.ventaGravada = amount;
    }
  } else if (form.retornoDteType === '14') {
    line.compra = amount;
  } else {
    line.ventaGravada = amount;
  }

  syncReturnEventPrice(line);
}

function syncReturnEventPrice(line: ReturnEventLine): void {
  const quantity = Math.max(1, numberValue(line.cantidad));
  line.precioUni = roundBodyAmount(returnEventLinePrimaryAmount(line) / quantity);
}

function returnEventLinePrimaryAmount(line: ReturnEventLine): number {
  if (form.retornoDteType === '14') return numberValue(line.compra);
  if (form.retornoDteType === '01' && line.tipoMonto === 'no_sujeta') return numberValue(line.ventaNoSuj);
  if (form.retornoDteType === '01' && line.tipoMonto === 'exenta') return numberValue(line.ventaExenta);

  return numberValue(line.ventaGravada);
}

function returnEventLineBase(line: ReturnEventLine): number {
  return roundMoney(
    numberValue(line.ventaNoSuj)
    + numberValue(line.ventaExenta)
    + numberValue(line.ventaGravada)
    + numberValue(line.compra)
    + numberValue(line.noGravado)
    + numberValue(line.seguro)
    + numberValue(line.flete)
  );
}

function returnEventLineIva(line: ReturnEventLine): number {
  if (form.retornoDteType !== '01' || line.tipoMonto !== 'gravada') return 0;

  return roundMoney((numberValue(line.ventaGravada) / 1.13) * 0.13);
}

function returnEventLineTotal(line: ReturnEventLine): number {
  return roundMoney(
    Math.max(0, returnEventLineBase(line) - numberValue(line.ivaRete) - numberValue(line.reteRenta))
  );
}

function nullableString(value: unknown): string | null {
  const string = String(value ?? '').trim();

  return string === '' ? null : string;
}

function numberValue(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundMoney(value: unknown): number {
  return Math.round(Math.max(0, numberValue(value)) * 100) / 100;
}

function roundBodyAmount(value: unknown): number {
  return Math.round(Math.max(0, numberValue(value)) * 100000000) / 100000000;
}

function returnAmountInputLabel(): string {
  if (form.retornoDteType === '14') return 'Compra a retornar';
  if (form.retornoDteType === '11') return 'Monto exportado';

  return 'Monto a retornar';
}

function returnBaseLabel(line: ReturnEventLine): string {
  if (form.retornoDteType === '14') return 'Compra';
  if (form.retornoDteType === '01' && line.tipoMonto === 'gravada') return 'Monto gravado';
  if (form.retornoDteType === '01' && line.tipoMonto === 'exenta') return 'Exento';
  if (form.retornoDteType === '01' && line.tipoMonto === 'no_sujeta') return 'No sujeto';

  return 'Base';
}

function formatDate(value?: string | null): string {
  return fiscalDateTime(value);
}

function statusLabel(document: DteDraftSummary): string {
  return String(document.transmission?.status ?? document.estado).toUpperCase();
}

function invalidacionLabel(document: DteDraftSummary | null): string {
  if (!document?.invalidacion) return 'Sin evaluar';
  if (document.invalidacion.eligible) return 'Habil para invalidar';

  const labels: Record<string, string> = {
    expired: 'Plazo vencido',
    invalidated: 'Ya invalidado',
    not_transmitted: 'No transmitido',
    missing_receipt_stamp: 'Sin sello MH',
    missing_transmission_date: 'Sin fecha MH',
  };

  return labels[document.invalidacion.status] ?? document.invalidacion.reason ?? 'No habil';
}

function invalidacionClass(document: DteDraftSummary | null): string {
  if (document?.invalidacion?.eligible) return 'bg-emerald-50 text-emerald-700';
  if (document?.invalidacion?.status === 'expired') return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

function invalidacionDeadline(document: DteDraftSummary | null): string {
  if (!document?.invalidacion?.deadline) return 'Sin fecha limite';

  return formatDate(document.invalidacion.deadline);
}
</script>

<template>
  <section class="space-y-6">
    <p v-if="error" class="whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>

    <BillingProcessToastOverlay
      :open="eventOverlayOpen"
      :variant="eventOverlayVariant"
      :title="eventOverlayTitle"
      :message="eventOverlayMessage"
      @close="closeEventModal"
    />

    <BillingModalShell
      :open="contingencyMomentModalOpen"
      eyebrow="Momento 3"
      title="Transmitir DTE reportados"
      description="Evento aceptado por MH. Continua con los DTE incluidos en la contingencia."
      max-width="max-w-2xl"
      z-index-class="z-[9999]"
      @close="closeEventModal"
    >
      <p v-if="contingencyRetransmissionError" class="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {{ contingencyRetransmissionError }}
      </p>

      <div class="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div
          v-for="document in reportedContingencyDocuments"
          :key="document.id"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <span class="min-w-0">
            <span class="block truncate font-semibold text-slate-950">{{ document.numeroControl }}</span>
            <span class="block truncate font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</span>
          </span>
          <span class="rounded px-2 py-1 text-xs font-semibold" :class="contingencyDocumentStatusClass(document)">
            {{ contingencyDocumentStatusLabel(document) }}
          </span>
        </div>
      </div>

      <div v-if="contingencyRetransmissionResults.length" class="mt-3 space-y-2">
        <p
          v-for="result in contingencyRetransmissionResults"
          :key="result.id"
          class="rounded-md px-3 py-2 text-xs"
          :class="contingencyRetransmissionResultClass(result)"
        >
          <span class="font-semibold">{{ result.numeroControl }} · {{ contingencyRetransmissionResultLabel(result) }}</span>
          <span v-if="result.message" class="ml-1">{{ result.message }}</span>
        </p>
      </div>

      <template #footer>
        <p class="mr-auto text-sm text-slate-600">
          <span v-if="retransmittableContingencyDocuments.length">
            {{ retransmittableContingencyDocuments.length }} DTE pendiente{{ retransmittableContingencyDocuments.length === 1 ? '' : 's' }} de retransmitir.
          </span>
          <span v-else>
            Sin DTE pendientes de retransmitir.
          </span>
        </p>
        <UiButton
          type="button"
          :disabled="!canRetransmitContingencyDocuments"
          @click="retransmitContingencyDocuments"
        >
          {{ contingencyRetransmissionLoading ? 'Transmitiendo...' : 'Retransmitir pendientes' }}
        </UiButton>
      </template>
    </BillingModalShell>

    <div v-if="isRetorno" class="grid gap-6 pb-24">
      <BillingProcessModal
        :open="eventDiagnosticModalOpen"
        eyebrow="Evento MH"
        :title="processing ? 'Reportando retorno' : eventRejected ? 'Evento rechazado por MH' : eventAccepted ? 'Evento procesado' : 'Retorno detenido'"
        :subtitle="`Ambiente ${selectedRetornoAmbiente} · ${selectedRetornoEmpresa?.nombre_comercial ?? selectedRetornoEmpresa?.razon_social ?? 'Empresa emisora'}`"
        :processing="processing"
        :accepted="eventAccepted"
        :rejected="eventRejected || eventStopped"
        :status-label="processing ? eventPhases[eventPhaseIndex].label : eventRejected ? 'MH rechazo el evento' : eventAccepted ? 'Evento aceptado por MH' : 'No fue posible reportar'"
        :status-detail="eventStatusDetail"
        :progress="eventProgress"
        progress-label="Retorno"
        :logs="eventLog"
        @close="closeEventModal"
      >
        <div v-if="eventResult" class="mt-5 rounded-md border p-4" :class="eventResultCardClass">
          <p class="text-sm font-semibold">{{ eventResultLabel }}</p>
          <p class="mt-1 break-all font-mono text-sm">{{ eventResult.codigoGeneracion }}</p>
          <p v-if="eventResult.transmission?.descripcion_msg" class="mt-2 text-sm">{{ eventResult.transmission.descripcion_msg }}</p>
          <p v-if="eventResult.transmission?.receipt_stamp" class="mt-3 break-all font-mono text-xs">{{ eventResult.transmission.receipt_stamp }}</p>
        </div>
      </BillingProcessModal>

      <UiCard>
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div class="min-w-0 space-y-5">
            <div class="rounded-md border border-slate-200 p-4 dark:border-line">
              <div class="mb-4">
                <div>
                  <p class="text-base font-semibold text-slate-950 dark:text-text">DTE origen</p>
                  <p class="mt-1 text-sm text-slate-600 dark:text-muted">Busca documentos aceptados con sello y vigencia disponible para retorno.</p>
                </div>
              </div>

              <div class="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-end">
                <label class="block">
                  <span class="text-sm font-semibold text-slate-900 dark:text-text">Tipo de DTE origen</span>
                  <select
                    v-model="form.retornoDteType"
                    class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-line dark:bg-surface-muted dark:text-text"
                    @change="clearEventResult"
                  >
                    <option v-for="tipo in retornoDocumentoTipos" :key="tipo.value" :value="tipo.value">{{ tipo.label }}</option>
                  </select>
                </label>
                <UiSearchInput
                  v-model="query"
                  label="Buscar DTE origen"
                  placeholder="Numero de control, codigo, sello, receptor o empresa"
                  @search="loadReturnCandidates"
                />
                <UiRefreshButton :loading="returnCandidatesLoading" @click="loadReturnCandidates" />
              </div>

              <div class="relative mt-3">
                <div
                  v-if="returnCandidatesLoading || returnCandidatesLoaded || returnCandidates.length"
                  class="absolute z-20 max-h-96 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-950/10 dark:border-line dark:bg-surface-raised dark:shadow-black/30"
                >
                  <UiLoadingMark v-if="returnCandidatesLoading" label="Buscando DTE aptos para retorno" />
                  <button
                    v-for="document in returnCandidates"
                    v-else
                    :key="document.id"
                    class="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-line dark:hover:bg-primary-soft/20"
                    type="button"
                    :disabled="!canAddReturnDocument(document)"
                    @click="selectReturnDocument(document)"
                  >
                    <span class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <span class="min-w-0">
                        <span class="block font-semibold text-slate-950 dark:text-text">{{ document.tipoDte }} · {{ document.numeroControl }}</span>
                        <span class="mt-1 block break-all font-mono text-xs text-slate-500 dark:text-soft">{{ document.codigoGeneracion }}</span>
                        <span class="mt-2 block truncate text-xs text-slate-600 dark:text-muted">{{ returnDocumentParty(document) }}</span>
                        <span class="mt-1 block truncate text-xs text-slate-500 dark:text-soft">{{ document.empresa?.razon_social ?? document.empresa?.nombre_comercial }}</span>
                      </span>
                      <span class="shrink-0 text-left md:text-right">
                        <span class="block text-sm font-bold text-slate-950 dark:text-text">{{ currency(returnDocumentTotal(document)) }}</span>
                        <span class="mt-1 block text-xs text-slate-500 dark:text-soft">Limite {{ returnDocumentDeadlineLabel(document) }}</span>
                        <span class="mt-1 inline-flex rounded bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 dark:bg-primary-soft/20 dark:text-primary">
                          {{ canAddReturnDocument(document) ? 'Agregar' : 'No disponible' }}
                        </span>
                      </span>
                    </span>
                  </button>

                  <p v-if="returnCandidatesLoaded && !returnCandidatesLoading && returnCandidates.length === 0" class="px-4 py-5 text-sm text-slate-500 dark:text-muted">
                    No hay DTE vigentes para retorno con esa busqueda.
                  </p>
                </div>
              </div>

              <p v-if="!returnCandidatesLoaded && query.trim().length < 2" class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-line dark:bg-surface-muted dark:text-muted">
                Escribe al menos 2 caracteres para buscar por numero de control, codigo, sello, receptor o empresa.
              </p>

              <div class="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-line">
                  <div class="flex items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50 px-4 py-3 dark:border-line dark:bg-emerald-500/10">
                    <p class="text-sm font-semibold text-emerald-950 dark:text-emerald-100">DTE relacionados</p>
                    <span class="rounded bg-white px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100">
                      {{ selectedReturnDocuments.length }} / 50
                    </span>
                  </div>

                  <div v-if="selectedReturnDocuments.length" class="divide-y divide-slate-100 dark:divide-line">
                    <div
                      v-for="document in selectedReturnDocuments"
                      :key="document.id"
                      class="px-4 py-3 text-sm"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="font-semibold text-slate-950 dark:text-text">{{ returnDocumentTypeLabel(document.tipoDte) }}</p>
                          <p class="mt-1 truncate font-mono text-xs text-slate-500 dark:text-soft">{{ document.codigoGeneracion }}</p>
                          <p class="mt-2 truncate text-xs text-slate-600 dark:text-muted">{{ returnDocumentParty(document) }}</p>
                        </div>
                        <button
                          type="button"
                          class="shrink-0 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-surface-muted dark:text-muted dark:hover:bg-line"
                          @click="removeReturnDocument(document.id)"
                        >
                          Quitar
                        </button>
                      </div>
                      <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt class="font-semibold uppercase text-slate-500 dark:text-soft">Disponible</dt>
                          <dd class="mt-1 font-bold text-slate-950 dark:text-text">{{ currency(returnDocumentTotal(document)) }}</dd>
                        </div>
                        <div>
                          <dt class="font-semibold uppercase text-slate-500 dark:text-soft">Sello MH</dt>
                          <dd class="mt-1 truncate font-mono text-slate-700 dark:text-muted">{{ document.selloRecibido }}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <p v-else class="px-4 py-5 text-sm text-slate-500 dark:text-muted">
                    Selecciona uno o mas DTE aceptados. Todos deben ser del mismo tipo, empresa y ambiente.
                  </p>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 p-4 dark:border-line">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-base font-semibold text-slate-950 dark:text-text">Detalle de retorno</p>
                  <p class="mt-1 text-sm text-slate-600 dark:text-muted">{{ retornoLineas.length }} de 2000 items permitidos.</p>
                </div>
                <UiButton type="button" variant="secondary" @click="addReturnEventLine">Agregar item</UiButton>
              </div>

              <div class="mt-4 space-y-3">
                <div v-for="(line, index) in retornoLineas" :key="line.id" class="rounded-md border border-slate-200 bg-white p-3 dark:border-line dark:bg-surface">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-bold text-slate-950 dark:text-text">Item {{ index + 1 }}</p>
                    <button class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-surface-muted dark:text-muted dark:hover:bg-line" type="button" @click="removeReturnEventLine(line.id)">Quitar</button>
                  </div>
                  <div class="mt-3 grid gap-3 lg:grid-cols-6">
                    <label class="block lg:col-span-3">
                      <span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">DTE origen</span>
                      <select
                        v-model="line.codigoGeneracion"
                        class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text"
                        :disabled="selectedReturnDocuments.length === 0"
                        @change="clearEventResult"
                      >
                        <option value="">Selecciona DTE</option>
                        <option
                          v-for="document in selectedReturnDocuments"
                          :key="document.id"
                          :value="document.codigoGeneracion"
                        >
                          {{ document.numeroControl }}
                        </option>
                      </select>
                    </label>
                    <label class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Cantidad</span>
                      <input v-model.number="line.cantidad" type="number" min="1" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="syncReturnEventAmounts(line); clearEventResult()">
                    </label>
                    <label class="block lg:col-span-2">
                      <span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Descripcion</span>
                      <input v-model="line.descripcion" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="clearEventResult">
                    </label>
                  </div>
                  <div class="mt-3 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                    <label v-if="form.retornoDteType === '01'" class="block xl:col-span-2">
                      <span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Tipo de monto</span>
                      <select
                        v-model="line.tipoMonto"
                        class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text"
                        @change="syncReturnEventAmounts(line); clearEventResult()"
                      >
                        <option v-for="tipo in retornoMontoTipos" :key="tipo.value" :value="tipo.value">{{ tipo.label }}</option>
                      </select>
                    </label>
                    <label class="block xl:col-span-2">
                      <span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">{{ returnAmountInputLabel() }}</span>
                      <input
                        v-model.number="line.montoRetorno"
                        type="number"
                        min="0"
                        :max="Number.isFinite(returnLineMaxAmount(line)) ? returnLineMaxAmount(line) : undefined"
                        step="0.01"
                        class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text"
                        :placeholder="form.retornoDteType === '01' ? 'Total cobrado' : 'Monto'"
                        @input="syncReturnEventAmounts(line); clearEventResult()"
                      >
                    </label>
                    <template v-if="form.retornoDteType === '01'">
                      <label class="block"><span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">IVA retenido</span><input v-model.number="line.ivaRete" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="clearEventResult"></label>
                    </template>
                    <template v-else-if="form.retornoDteType === '11'">
                      <label class="block"><span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Seguro</span><input v-model.number="line.seguro" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="syncReturnEventPrice(line); clearEventResult()"></label>
                      <label class="block"><span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Flete</span><input v-model.number="line.flete" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="syncReturnEventPrice(line); clearEventResult()"></label>
                      <label class="block"><span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">No gravado</span><input v-model.number="line.noGravado" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="syncReturnEventPrice(line); clearEventResult()"></label>
                    </template>
                    <template v-else>
                      <label class="block"><span class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Retencion renta</span><input v-model.number="line.reteRenta" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-line dark:bg-surface-muted dark:text-text" @input="clearEventResult"></label>
                    </template>
                    <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">{{ returnBaseLabel(line) }}</p><p class="mt-1 text-sm font-bold text-slate-950 dark:text-text">{{ currency(returnEventLinePrimaryAmount(line)) }}</p></div>
                    <div v-if="form.retornoDteType === '01'" class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">IVA informativo</p><p class="mt-1 text-sm font-bold text-slate-950 dark:text-text">{{ currency(returnEventLineIva(line)) }}</p></div>
                    <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Precio unitario</p><p class="mt-1 text-sm font-bold text-slate-950 dark:text-text">{{ currency(line.precioUni) }}</p></div>
                    <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Total</p><p class="mt-1 text-sm font-bold text-slate-950 dark:text-text">{{ currency(returnEventLineTotal(line)) }}</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside class="min-w-0 rounded-md border border-slate-200 p-4 dark:border-line">
            <p class="text-base font-semibold text-slate-950 dark:text-text">Resumen</p>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">DTE origen</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ selectedReturnDocuments.length }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">Tipo</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ returnDocumentTypeLabel(form.retornoDteType) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">Ventas</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ currency(retornoTotals.totalNoSuj + retornoTotals.totalExenta + retornoTotals.totalGravada) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">Compra</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ currency(retornoTotals.totalCompra) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">No gravado</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ currency(retornoTotals.totalNoGravado) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">Seguro/flete</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ currency(retornoTotals.totalSeguro + retornoTotals.totalFlete) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">IVA</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ currency(retornoTotals.totalIva) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="text-slate-500 dark:text-muted">Retenciones</dt><dd class="font-semibold text-slate-950 dark:text-text">{{ currency(retornoTotals.ivaRete + retornoTotals.reteRenta) }}</dd></div>
              <div class="flex items-center justify-between gap-3 rounded-md bg-sky-50 px-3 py-3 dark:bg-primary-soft/20"><dt class="font-semibold text-sky-900 dark:text-primary">Total</dt><dd class="text-lg font-bold text-sky-950 dark:text-text">{{ currency(retornoTotals.total) }}</dd></div>
            </dl>
          </aside>
        </div>
      </UiCard>

      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
        <section class="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-950/95 px-3 py-2 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <p class="min-w-0 max-w-[260px] truncate"><span class="text-slate-400">Empresa</span><span class="ml-2 font-bold text-white">{{ selectedRetornoEmpresa?.nombre_comercial ?? selectedRetornoEmpresa?.razon_social ?? 'Pendiente' }}</span></p>
            <p class="min-w-0 max-w-[220px] truncate"><span class="text-slate-400">DTE</span><span class="ml-2 font-semibold text-white">{{ selectedReturnDocuments.length }}</span></p>
            <p class="min-w-0 max-w-[220px] truncate"><span class="text-slate-400">Items</span><span class="ml-2 font-semibold text-white">{{ retornoLineas.length }}</span></p>
            <p class="min-w-0 max-w-[220px] truncate"><span class="text-slate-400">Total</span><span class="ml-2 font-semibold text-white">{{ currency(retornoTotals.total) }}</span></p>
          </div>
          <div class="flex shrink-0 items-center justify-end gap-2">
            <span class="rounded-md bg-sky-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-sky-950/30">{{ actionStatusLabel }}</span>
            <UiButton class="min-w-[170px]" :disabled="!canReportRetorno || processing" @click="reportReturnEvent">
              {{ processing ? 'Procesando...' : 'Reportar retorno' }}
            </UiButton>
          </div>
        </section>
      </div>
    </div>

    <div v-else-if="isOperacionesEspeciales" class="grid gap-6 pb-24">
      <BillingProcessModal
        :open="eventDiagnosticModalOpen"
        eyebrow="Evento MH"
        :title="processing ? 'Reportando operaciones' : eventRejected ? 'Evento rechazado por MH' : eventAccepted ? 'Evento procesado' : 'Operaciones detenidas'"
        :subtitle="`Ambiente ${selectedOperacionesEmpresa?.ambiente ?? '00'} · ${selectedOperacionesEmpresa?.nombre_comercial ?? selectedOperacionesEmpresa?.razon_social ?? 'Empresa emisora'}`"
        :processing="processing"
        :accepted="eventAccepted"
        :rejected="eventRejected || eventStopped"
        :status-label="processing ? eventPhases[eventPhaseIndex].label : eventRejected ? 'MH rechazo el evento' : eventAccepted ? 'Evento aceptado por MH' : 'No fue posible reportar'"
        :status-detail="eventStatusDetail"
        :progress="eventProgress"
        progress-label="Operaciones especiales"
        :logs="eventLog"
        @close="closeEventModal"
      >
        <div v-if="eventResult" class="mt-5 rounded-md border p-4" :class="eventResultCardClass">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ eventResultLabel }}</p>
              <p class="mt-1 break-all font-mono text-sm">{{ eventResult.codigoGeneracion }}</p>
            </div>
            <span class="rounded bg-white/75 px-2 py-1 text-xs font-semibold">
              HTTP {{ eventResult.transmission?.http_status ?? 'N/D' }}
            </span>
          </div>
          <p class="mt-2 text-sm">
            MH {{ eventResult.transmission?.mh_estado ?? eventResult.transmission?.status ?? 'sin estado' }}
          </p>
          <p v-if="eventResult.transmission?.descripcion_msg" class="mt-2 text-sm">
            {{ eventResult.transmission.descripcion_msg }}
          </p>
          <ul v-if="eventResult.transmission?.observaciones?.length" class="mt-2 list-disc pl-5 text-sm">
            <li v-for="observation in eventResult.transmission.observaciones" :key="observation">{{ observation }}</li>
          </ul>
          <p v-if="eventResult.transmission?.receipt_stamp" class="mt-3 break-all font-mono text-xs">
            {{ eventResult.transmission.receipt_stamp }}
          </p>
          <details v-if="Object.keys(eventMhResponse).length" class="mt-3">
            <summary class="cursor-pointer text-xs font-semibold">Ver detalle de respuesta</summary>
            <pre class="mt-2 max-h-56 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-50">{{ eventMhResponseJson }}</pre>
          </details>
        </div>

        <div v-else-if="error && !processing" class="mt-5 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {{ error }}
        </div>
      </BillingProcessModal>

      <UiCard>
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div class="min-w-0 space-y-5">
            <div class="grid gap-4 rounded-md border border-slate-200 p-4 lg:grid-cols-3">
              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Empresa</span>
                <select
                  v-model.number="form.operacionesEmpresaId"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  @change="clearEventResult"
                >
                  <option :value="null">Selecciona empresa</option>
                  <option v-for="empresa in billingCompanies" :key="empresa.id" :value="empresa.id">
                    {{ empresa.razon_social || empresa.nombre_comercial }}
                  </option>
                </select>
              </label>

              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Documento</span>
                <select
                  v-model="form.operacionesDocumentType"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option v-for="tipo in operacionesDocumentoTipos" :key="tipo.value" :value="tipo.value">{{ tipo.label }}</option>
                </select>
              </label>

              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Estado a reportar</span>
                <select
                  v-model="form.operacionesStatus"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="active">Documentos activos</option>
                  <option value="annulled">Documentos anulados</option>
                </select>
              </label>
            </div>

            <div class="rounded-md border border-slate-200 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-base font-semibold text-slate-950">Detalle de operaciones</p>
                  <p class="mt-1 text-sm text-slate-600">{{ specialOperationTypeLabel(form.operacionesDocumentType) }} · {{ form.operacionesStatus === 'annulled' ? 'Anulados' : 'Activos' }}</p>
                </div>
                <div class="inline-flex rounded-md bg-slate-100 p-1">
                  <button
                    class="rounded px-3 py-2 text-sm font-semibold"
                    :class="form.operacionesMode === 'range' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'"
                    type="button"
                    @click="form.operacionesMode = 'range'"
                  >
                    Por rangos
                  </button>
                  <button
                    class="rounded px-3 py-2 text-sm font-semibold"
                    :class="form.operacionesMode === 'single' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'"
                    type="button"
                    @click="form.operacionesMode = 'single'"
                  >
                    Uno a uno
                  </button>
                </div>
              </div>

              <UiLoadingMark v-if="billingContextLoading" class="mt-4" label="Cargando empresas" />

              <div class="mt-4 space-y-3">
                <div
                  v-for="(line, index) in operacionesLineas"
                  :key="line.id"
                  class="rounded-md border border-slate-200 bg-white p-3"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-bold text-slate-950">Item {{ index + 1 }}</p>
                    <button
                      class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      type="button"
                      @click="removeSpecialOperationLine(line.id)"
                    >
                      Quitar
                    </button>
                  </div>

                  <div class="mt-3 grid gap-3 lg:grid-cols-6">
                    <label v-if="form.operacionesStatus === 'annulled'" class="block lg:col-span-2">
                      <span class="text-xs font-semibold uppercase text-slate-500">EOE referencia</span>
                      <input
                        v-model="line.codigoGeneracionRef"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Codigo generacion"
                        @input="clearEventResult"
                      >
                    </label>

                    <label v-if="form.operacionesMode === 'single'" class="block lg:col-span-2">
                      <span class="text-xs font-semibold uppercase text-slate-500">Documento origen</span>
                      <input
                        v-model="line.numDocumento"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Numero documento"
                        @input="clearEventResult"
                      >
                    </label>
                    <label v-if="form.operacionesMode === 'single'" class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Fecha origen</span>
                      <input
                        v-model="line.fechaEmision"
                        type="date"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        @input="clearEventResult"
                      >
                    </label>

                    <label v-if="form.operacionesMode === 'range'" class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Doc. Del</span>
                      <input
                        v-model="line.docDel"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="1"
                        @input="syncSpecialOperationRange(line); clearEventResult()"
                      >
                    </label>
                    <label v-if="form.operacionesMode === 'range'" class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Doc. Al</span>
                      <input
                        v-model="line.docAl"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="25"
                        @input="syncSpecialOperationRange(line); clearEventResult()"
                      >
                    </label>

                    <label class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Cantidad</span>
                      <input
                        v-model.number="line.cantidad"
                        type="number"
                        min="1"
                        :readonly="form.operacionesMode === 'single' || (form.operacionesMode === 'range' && specialOperationRangeQuantity(line) !== null)"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 readonly:bg-slate-50"
                        @input="syncSpecialOperationPrice(line); clearEventResult()"
                      >
                      <span v-if="form.operacionesMode === 'range'" class="mt-1 block text-xs text-slate-500">{{ specialOperationRangeHelp(line) }}</span>
                    </label>
                    <label class="block lg:col-span-2">
                      <span class="text-xs font-semibold uppercase text-slate-500">Descripcion</span>
                      <input
                        v-model="line.descripcion"
                        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        @input="clearEventResult"
                      >
                    </label>
                  </div>

                  <div class="mt-3 grid gap-3 md:grid-cols-5">
                    <label class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">No sujetas</span>
                      <input v-model.number="line.ventaNoSuj" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" @input="syncSpecialOperationPrice(line); clearEventResult()">
                    </label>
                    <label class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Exentas</span>
                      <input v-model.number="line.ventaExenta" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" @input="syncSpecialOperationPrice(line); clearEventResult()">
                    </label>
                    <label class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Gravadas</span>
                      <input v-model.number="line.ventaGravada" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" @input="syncSpecialOperationPrice(line); clearEventResult()">
                    </label>
                    <label class="block">
                      <span class="text-xs font-semibold uppercase text-slate-500">Precio unitario</span>
                      <input v-model.number="line.precioUni" type="number" min="0" step="0.01" class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" @input="clearEventResult">
                    </label>
                    <div class="rounded-md bg-slate-50 px-3 py-2">
                      <p class="text-xs font-semibold uppercase text-slate-500">Total linea</p>
                      <p class="mt-1 text-sm font-bold text-slate-950">{{ currency(specialOperationLineTotal(line)) }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-slate-600">{{ operacionesLineas.length }} de 500 items permitidos.</p>
                <UiButton type="button" variant="secondary" @click="addSpecialOperationLine">
                  Agregar item
                </UiButton>
              </div>
            </div>
          </div>

          <aside class="min-w-0 rounded-md border border-slate-200 p-4">
            <p class="text-base font-semibold text-slate-950">Resumen</p>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-slate-500">No sujetas</dt>
                <dd class="font-semibold text-slate-950">{{ currency(operacionesTotals.totalNoSuj) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-slate-500">Exentas</dt>
                <dd class="font-semibold text-slate-950">{{ currency(operacionesTotals.totalExenta) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-slate-500">Gravadas</dt>
                <dd class="font-semibold text-slate-950">{{ currency(operacionesTotals.totalGravada) }}</dd>
              </div>
              <div class="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
                <dt class="text-slate-500">Subtotal</dt>
                <dd class="font-semibold text-slate-950">{{ currency(operacionesTotals.subTotal) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-slate-500">IVA 13%</dt>
                <dd class="font-semibold text-slate-950">{{ currency(operacionesTotals.iva) }}</dd>
              </div>
              <div class="rounded-md bg-sky-50 px-3 py-3 flex items-center justify-between gap-3">
                <dt class="font-semibold text-sky-900">Total</dt>
                <dd class="text-lg font-bold text-sky-950">{{ currency(operacionesTotals.total) }}</dd>
              </div>
            </dl>

            <div class="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p class="font-semibold text-slate-900">Reglas aplicadas</p>
              <p class="mt-2">Modelo previo, transmision normal, evento tipo 17 y precio sin IVA.</p>
              <p class="mt-2">Activos y anulados se reportan en eventos separados.</p>
            </div>
          </aside>
        </div>
      </UiCard>

      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
        <section class="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-950/95 px-3 py-2 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <p class="min-w-0 max-w-[260px] truncate">
              <span class="text-slate-400">Empresa</span>
              <span class="ml-2 font-bold text-white">{{ selectedOperacionesEmpresa?.nombre_comercial ?? selectedOperacionesEmpresa?.razon_social ?? 'Pendiente' }}</span>
            </p>
            <p class="min-w-0 max-w-[260px] truncate">
              <span class="text-slate-400">Detalle</span>
              <span class="ml-2 font-semibold text-white">{{ operacionesLineas.length }} item{{ operacionesLineas.length === 1 ? '' : 's' }}</span>
            </p>
            <p class="min-w-0 max-w-[220px] truncate">
              <span class="text-slate-400">Total</span>
              <span class="ml-2 font-semibold text-white">{{ currency(operacionesTotals.total) }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center justify-end gap-2">
            <span class="rounded-md bg-sky-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-sky-950/30">
              {{ actionStatusLabel }}
            </span>
            <UiButton
              class="min-w-[170px]"
              :disabled="!canReportOperacionesEspeciales || processing"
              @click="reportSpecialOperations"
            >
              {{ processing ? 'Procesando...' : 'Reportar evento' }}
            </UiButton>
          </div>
        </section>
      </div>
    </div>

    <div v-else-if="isContingencia" class="grid gap-6 pb-24">
      <BillingProcessModal
        :open="eventDiagnosticModalOpen"
        eyebrow="Evento MH"
        :title="processing ? 'Reportando contingencia' : eventRejected ? 'Evento rechazado por MH' : eventAccepted ? 'Evento procesado' : 'Contingencia detenida'"
        :subtitle="`Ambiente ${contingencyModalDocument?.ambiente ?? '00'} · ${selectedContingencyCompany?.nombre_comercial ?? selectedContingencyCompany?.razon_social ?? 'Empresa emisora'}`"
        :processing="processing"
        :accepted="eventAccepted"
        :rejected="eventRejected || eventStopped"
        :status-label="processing ? eventPhases[eventPhaseIndex].label : eventRejected ? 'MH rechazo el evento' : eventAccepted ? 'Evento aceptado por MH' : 'No fue posible reportar'"
        :status-detail="eventStatusDetail"
        :progress="eventProgress"
        progress-label="Contingencia"
        :logs="eventLog"
        @close="closeEventModal"
      >
        <div v-if="eventResult" class="mt-5 rounded-md border p-4" :class="eventResultCardClass">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ eventResultLabel }}</p>
              <p class="mt-1 break-all font-mono text-sm">{{ eventResult.codigoGeneracion }}</p>
            </div>
            <span class="rounded bg-white/75 px-2 py-1 text-xs font-semibold">
              HTTP {{ eventResult.transmission?.http_status ?? 'N/D' }}
            </span>
          </div>
          <p class="mt-2 text-sm">
            MH {{ eventResult.transmission?.mh_estado ?? eventResult.transmission?.status ?? 'sin estado' }}
          </p>
          <p v-if="eventResult.transmission?.descripcion_msg" class="mt-2 text-sm">
            {{ eventResult.transmission.descripcion_msg }}
          </p>
          <p v-if="eventResult.transmission?.receipt_stamp" class="mt-3 break-all font-mono text-xs">
            {{ eventResult.transmission.receipt_stamp }}
          </p>
          <details v-if="Object.keys(eventMhResponse).length" class="mt-3">
            <summary class="cursor-pointer text-xs font-semibold">Ver detalle de respuesta</summary>
            <pre class="mt-2 max-h-56 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-50">{{ eventMhResponseJson }}</pre>
          </details>
        </div>

        <div v-if="eventAccepted && reportedContingencyDocuments.length" class="mt-5 rounded-md border border-sky-200 bg-sky-50 p-4 text-slate-900">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Momento 3</p>
              <h3 class="mt-1 text-base font-bold text-slate-950">Transmitir DTE reportados</h3>
              <p class="mt-1 text-sm text-slate-600">
                Desactiva el simulador MH antes de transmitir los documentos reportados en el evento.
              </p>
            </div>
            <UiButton
              type="button"
              :disabled="!canRetransmitContingencyDocuments"
              @click="retransmitContingencyDocuments"
            >
              {{ contingencyRetransmissionLoading ? 'Transmitiendo...' : 'Transmitir DTE' }}
            </UiButton>
          </div>

          <p v-if="contingencyRetransmissionError" class="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800">
            {{ contingencyRetransmissionError }}
          </p>

          <div class="mt-3 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
            <div
              v-for="document in reportedContingencyDocuments"
              :key="document.id"
              class="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span class="min-w-0">
                <span class="block truncate font-semibold text-slate-950">{{ document.numeroControl }}</span>
                <span class="block truncate font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</span>
              </span>
              <span class="rounded px-2 py-1 text-xs font-semibold" :class="contingencyDocumentStatusClass(document)">
                {{ contingencyDocumentStatusLabel(document) }}
              </span>
            </div>
          </div>

          <div v-if="contingencyRetransmissionResults.length" class="mt-3 space-y-2">
            <p
              v-for="result in contingencyRetransmissionResults"
              :key="result.id"
              class="rounded-md px-3 py-2 text-xs"
              :class="contingencyRetransmissionResultClass(result)"
            >
              <span class="font-semibold">{{ result.numeroControl }} · {{ contingencyRetransmissionResultLabel(result) }}</span>
              <span v-if="result.message" class="ml-1">{{ result.message }}</span>
            </p>
          </div>
        </div>

        <div v-else-if="error && !processing" class="mt-5 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {{ error }}
        </div>
      </BillingProcessModal>

      <BillingModalShell
        :open="motivoModalOpen"
        eyebrow="Motivo de contingencia"
        :title="contingenciaTipos.find((tipo) => tipo.value === Number(form.tipoContingencia))?.label ?? 'Motivo'"
        description="Este detalle se enviara junto con el evento de contingencia."
        max-width="max-w-xl"
        z-index-class="z-40"
        @close="closeMotivoModal"
      >
        <UiTextarea
          v-model="motivoDraft"
          label="Detalle del motivo"
          :rows="5"
        />

        <template #footer>
          <UiButton type="button" variant="secondary" @click="closeMotivoModal">Cerrar</UiButton>
          <UiButton type="button" variant="success" :disabled="!motivoDraft.trim()" @click="saveMotivoModal">
            <UiSaveIcon class="mr-2 h-5 w-5" />
            <span>Guardar motivo</span>
          </UiButton>
        </template>
      </BillingModalShell>

      <UiCard>
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div class="min-w-0 rounded-md border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-base font-semibold text-slate-950">DTE en contingencia</p>
                <p class="mt-1 text-sm text-slate-600">Selecciona documentos firmados con modelo diferido y transmision por contingencia.</p>
              </div>
              <span class="rounded bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
                {{ selectedContingencyDocuments.length }} seleccionados
              </span>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
              <UiSearchInput
                v-model="query"
                label="Filtrar candidatos"
                placeholder="Numero de control, codigo, receptor o empresa"
              />
              <UiRefreshButton :loading="contingencyCandidatesLoading" @click="loadContingencyCandidates" />
              <UiButton
                type="button"
                :disabled="filteredContingencyCandidates.length === 0"
                @click="addVisibleContingencyCandidates"
              >
                Agregar visibles
              </UiButton>
            </div>

            <UiLoadingMark v-if="contingencyCandidatesLoading" class="mt-4" label="Cargando candidatos de contingencia" />

            <div v-else class="mt-4 overflow-hidden rounded-md border border-slate-200">
              <div class="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold text-slate-950">Candidatos disponibles</p>
                <span class="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {{ filteredContingencyCandidates.length }}
                </span>
              </div>

              <button
                v-for="document in filteredContingencyCandidates"
                :key="document.id"
                class="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-sky-50"
                type="button"
                @click="selectContingencyDocument(document)"
              >
                <span class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <span class="min-w-0">
                    <span class="block font-semibold text-slate-950">{{ document.tipoDte }} · {{ document.numeroControl }}</span>
                    <span class="mt-1 block truncate font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</span>
                    <span class="mt-2 block text-xs text-slate-600">{{ document.empresa?.razon_social ?? document.empresa?.nombre_comercial }}</span>
                  </span>
                  <span class="shrink-0 text-left md:text-right">
                    <span class="block text-sm font-bold text-slate-950">{{ currency(document.totalPagar ?? 0) }}</span>
                    <span class="mt-1 inline-flex rounded bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">Agregar</span>
                  </span>
                </span>
              </button>

              <p v-if="contingencyCandidatesLoaded && filteredContingencyCandidates.length === 0" class="px-4 py-5 text-sm text-slate-500">
                No hay DTE nuevos firmados con modelo diferido para este tipo. Activa el simulador, emite una factura nueva y vuelve a actualizar.
              </p>
            </div>

            <div v-if="selectedContingencyDocuments.length" class="mt-4 overflow-hidden rounded-md border border-slate-200">
              <div class="flex items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50 px-4 py-3">
                <p class="text-sm font-semibold text-emerald-950">Lote a reportar</p>
                <span class="rounded bg-white px-2 py-1 text-xs font-semibold text-emerald-700">
                  {{ selectedContingencyDocuments.length }}
                </span>
              </div>
              <div
                v-for="document in selectedContingencyDocuments"
                :key="document.id"
                class="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:flex-row md:items-start md:justify-between"
              >
                <div class="min-w-0">
                  <p class="font-semibold text-slate-950">{{ document.tipoDte }} · {{ document.numeroControl }}</p>
                  <p class="mt-1 break-all font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</p>
                  <p class="mt-2 text-xs text-slate-600">{{ document.empresa?.razon_social ?? document.empresa?.nombre_comercial }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    {{ currency(document.totalPagar ?? 0) }}
                  </span>
                  <button
                    type="button"
                    class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    @click="removeContingencyDocument(document.id)"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="min-w-0 rounded-md border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-base font-semibold text-slate-950">Motivo de contingencia</p>
              <UiButton v-if="requiresMotivoContingencia" type="button" variant="secondary" @click="openMotivoModal('contingencia')">
                {{ form.motivoContingencia.trim() ? 'Editar motivo' : 'Escribir motivo' }}
              </UiButton>
            </div>

            <label class="mt-4 block">
              <span class="text-sm font-semibold text-slate-900">Tipo de contingencia</span>
              <select
                v-model.number="form.tipoContingencia"
                class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option v-for="tipo in contingenciaTipos" :key="tipo.value" :value="tipo.value">{{ tipo.label }}</option>
              </select>
            </label>
            <p v-if="!requiresMotivoContingencia" class="mt-2 text-xs font-medium text-slate-500">
              Este tipo no requiere detalle adicional.
            </p>
            <p v-else-if="form.motivoContingencia.trim()" class="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {{ form.motivoContingencia }}
            </p>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Fecha inicio</span>
                <input
                  v-model="form.contingenciaFInicio"
                  type="date"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  @input="markContingencyStartTouched"
                >
              </label>
              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Hora inicio</span>
                <input
                  v-model="form.contingenciaHInicio"
                  type="time"
                  step="1"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  @input="markContingencyStartTouched"
                >
              </label>
              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Fecha fin</span>
                <input
                  v-model="form.contingenciaFFin"
                  type="date"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  @input="markContingencyEndTouched"
                >
              </label>
              <label class="block">
                <span class="text-sm font-semibold text-slate-900">Hora fin</span>
                <input
                  v-model="form.contingenciaHFin"
                  type="time"
                  step="1"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  @input="markContingencyEndTouched"
                >
              </label>
            </div>
            <p v-if="contingencyWindowError" class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
              {{ contingencyWindowError }}
            </p>

            <dl v-if="selectedContingencyDocuments.length" class="mt-4 grid gap-3 rounded-md border border-sky-100 bg-sky-50 p-3 text-sm">
              <div>
                <dt class="text-xs font-semibold uppercase text-slate-500">Empresa</dt>
                <dd class="mt-1 font-semibold text-slate-950">{{ selectedContingencyCompany?.razon_social ?? selectedContingencyCompany?.nombre_comercial }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase text-slate-500">Periodo reportado</dt>
                <dd class="mt-1 font-semibold text-slate-950">{{ contingencyWindowLabel }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase text-slate-500">Ventana posterior</dt>
                <dd class="mt-1 font-semibold text-slate-950">72 horas despues del sello del evento</dd>
              </div>
            </dl>
          </div>

        </div>
      </UiCard>

      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
        <section class="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-950/95 px-3 py-2 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <p class="min-w-0 max-w-[260px] truncate">
              <span class="text-slate-400">DTE</span>
              <span class="ml-2 font-bold text-white">{{ selectedContingencyDocuments.length }} seleccionados</span>
            </p>
            <p class="min-w-0 max-w-[340px] truncate">
              <span class="text-slate-400">Motivo</span>
              <span class="ml-2 font-semibold text-white">{{ contingenciaTipos.find((tipo) => tipo.value === Number(form.tipoContingencia))?.label ?? 'Sin motivo' }}</span>
              <span v-if="form.motivoContingencia.trim()" class="ml-2 text-xs text-slate-300">{{ form.motivoContingencia }}</span>
            </p>
            <p class="min-w-0 max-w-[340px] truncate">
              <span class="text-slate-400">Periodo</span>
              <span class="ml-2 font-semibold text-white">{{ contingencyWindowLabel }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center justify-end gap-2">
            <span class="rounded-md bg-sky-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-sky-950/30">
              {{ actionStatusLabel }}
            </span>
            <UiButton
              class="min-w-[160px]"
              :disabled="!canReportContingency || processing"
              @click="reportContingency"
            >
              {{ processing ? 'Procesando...' : 'Reportar contingencia' }}
            </UiButton>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="grid gap-6 pb-24">
      <BillingProcessModal
        :open="eventDiagnosticModalOpen"
        eyebrow="Evento MH"
        :title="processing ? 'Invalidando DTE' : eventRejected ? 'Evento rechazado por MH' : eventAccepted ? 'Evento procesado' : 'Invalidacion detenida'"
        :subtitle="`Ambiente ${selected?.ambiente ?? '00'} · ${selected?.empresa?.nombre_comercial ?? selected?.empresa?.razon_social ?? 'Empresa emisora'}`"
        :processing="processing"
        :accepted="eventAccepted"
        :rejected="eventRejected || eventStopped"
        :status-label="processing ? eventPhases[eventPhaseIndex].label : eventRejected ? 'MH rechazo el evento' : eventAccepted ? 'Evento aceptado por MH' : 'No fue posible invalidar'"
        :status-detail="eventStatusDetail"
        :progress="eventProgress"
        progress-label="Invalidacion"
        :logs="eventLog"
        @close="closeEventModal"
      >
            <div v-if="eventResult" class="mt-5 rounded-md border p-4" :class="eventResultCardClass">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">{{ eventResultLabel }}</p>
                  <p class="mt-1 break-all font-mono text-sm">{{ eventResult.codigoGeneracion }}</p>
                </div>
                <span class="rounded bg-white/75 px-2 py-1 text-xs font-semibold">
                  HTTP {{ eventResult.transmission?.http_status ?? 'N/D' }}
                </span>
              </div>
              <p class="mt-2 text-sm">
                MH {{ eventResult.transmission?.mh_estado ?? eventResult.transmission?.status ?? 'sin estado' }}
              </p>
              <div class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div class="rounded bg-white/70 px-3 py-2">
                  <p class="font-semibold uppercase opacity-70">Codigo mensaje</p>
                  <p class="mt-1 break-all font-mono">{{ eventMhCodigoMsg }}</p>
                </div>
                <div class="rounded bg-white/70 px-3 py-2">
                  <p class="font-semibold uppercase opacity-70">Procesado MH</p>
                  <p class="mt-1">{{ formatDate(eventMhProcessedAt) }}</p>
                </div>
              </div>
              <p v-if="eventStopped && error" class="mt-2 whitespace-pre-wrap text-sm">
                {{ error }}
              </p>
              <p v-if="eventResult.transmission?.descripcion_msg" class="mt-2 text-sm">
                {{ eventResult.transmission.descripcion_msg }}
              </p>
              <ul v-if="eventResult.transmission?.observaciones?.length" class="mt-2 list-disc pl-5 text-sm">
                <li v-for="observation in eventResult.transmission.observaciones" :key="observation">{{ observation }}</li>
              </ul>
              <p v-if="eventResult.transmission?.receipt_stamp" class="mt-3 break-all font-mono text-xs">
                {{ eventResult.transmission.receipt_stamp }}
              </p>
              <details v-if="Object.keys(eventMhResponse).length" class="mt-3">
                <summary class="cursor-pointer text-xs font-semibold">Ver detalle de respuesta</summary>
                <pre class="mt-2 max-h-56 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-50">{{ eventMhResponseJson }}</pre>
              </details>
            </div>

            <div v-else-if="error && !processing" class="mt-5 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {{ error }}
            </div>
      </BillingProcessModal>

      <BillingModalShell
        :open="motivoModalOpen"
        eyebrow="Motivo de invalidacion"
        :title="invalidacionTipos.find((tipo) => tipo.value === Number(form.tipoAnulacion))?.label ?? 'Motivo'"
        description="Este detalle se enviara junto con la solicitud."
        max-width="max-w-xl"
        z-index-class="z-40"
        @close="closeMotivoModal"
      >
        <UiTextarea
          v-model="motivoDraft"
          label="Detalle del motivo"
          :rows="5"
        />

        <template #footer>
          <UiButton type="button" variant="secondary" @click="closeMotivoModal">Cerrar</UiButton>
          <UiButton type="button" variant="success" :disabled="!motivoDraft.trim()" @click="saveMotivoModal">
            <UiSaveIcon class="mr-2 h-5 w-5" />
            <span>Guardar motivo</span>
          </UiButton>
        </template>
      </BillingModalShell>

      <UiCard>
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <div class="min-w-0 rounded-md border border-slate-200 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-base font-semibold text-slate-950">DTE a invalidar</p>
              <button
                v-if="selected"
                class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                type="button"
                @click="clearSelectedDocument"
              >
                Cambiar DTE
              </button>
            </div>

            <div class="relative mt-4">
              <UiSearchInput
                v-model="query"
                label="Buscar documento"
                placeholder="Numero de control, codigo, sello, receptor o empresa"
                @search="loadDocuments"
              />

              <div
                v-if="showSearchResults"
                class="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-950/10"
              >
                <UiLoadingMark v-if="loading" label="Buscando documentos aceptados" />

                <button
                  v-for="document in documents"
                  v-else
                  :key="document.id"
                  class="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-sky-50"
                  type="button"
                  @click="selectDocument(document)"
                >
                  <span class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <span class="min-w-0">
                      <span class="block font-semibold text-slate-950">{{ document.tipoDte }} · {{ document.numeroControl }}</span>
                      <span class="mt-1 block truncate font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</span>
                      <span class="mt-2 block text-xs text-slate-600">{{ document.empresa?.razon_social ?? document.empresa?.nombre_comercial }}</span>
                    </span>
                    <span class="shrink-0 text-left md:text-right">
                      <span class="block text-sm font-bold text-slate-950">{{ currency(document.totalPagar ?? 0) }}</span>
                      <span class="mt-1 inline-flex rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{{ statusLabel(document) }}</span>
                      <span class="mt-1 inline-flex rounded px-2 py-1 text-xs font-semibold" :class="invalidacionClass(document)">
                        {{ invalidacionLabel(document) }}
                      </span>
                    </span>
                  </span>
                </button>

                <p v-if="!loading && searched && documents.length === 0" class="px-4 py-5 text-sm text-slate-500">
                  No hay DTE aceptados con sello MH para esa busqueda.
                </p>
              </div>
            </div>

            <div v-if="selected" class="mt-3 rounded-md border border-sky-100 bg-sky-50 p-4 text-sm">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <p class="font-semibold text-slate-950">{{ selected.tipoDte }} · {{ selected.numeroControl }}</p>
                  <p class="mt-1 break-all font-mono text-xs text-slate-600">{{ selected.codigoGeneracion }}</p>
                </div>
                <span class="shrink-0 rounded px-2 py-1 text-xs font-semibold" :class="invalidacionClass(selected)">
                  {{ invalidacionLabel(selected) }}
                </span>
              </div>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Receptor</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ selectedReceptor.nombre ?? 'Sin receptor' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Fecha emision</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ fiscalDate(String(selectedIdentificacion.fecEmi ?? '')) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Sello MH</dt>
                  <dd class="mt-1 truncate font-mono text-xs text-slate-700">{{ selected.selloRecibido }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Total</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ currency(selected.totalPagar ?? 0) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Procesado</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ formatDate(selected.processed_at ?? selected.created_at) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Limite invalidacion</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ invalidacionDeadline(selected) }}</dd>
                </div>
              </dl>
              <p
                v-if="selected.invalidacion?.eligible === false"
                class="mt-4 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700"
              >
                {{ selected.invalidacion.reason }}
              </p>
            </div>
          </div>

          <div class="min-w-0 rounded-md border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-base font-semibold text-slate-950">Motivo de invalidacion</p>
              <UiButton
                v-if="requiresMotivoAnulacion"
                type="button"
                variant="secondary"
                @click="openMotivoModal"
              >
                {{ form.motivoAnulacion.trim() ? 'Editar motivo' : 'Escribir motivo' }}
              </UiButton>
            </div>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block sm:col-span-2">
                <span class="text-sm font-semibold text-slate-900">Tipo de invalidacion</span>
                <select
                  v-model.number="form.tipoAnulacion"
                  class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option v-for="tipo in invalidacionTipos" :key="tipo.value" :value="tipo.value">{{ tipo.label }}</option>
                </select>
              </label>
            </div>

            <div
              v-if="requiresMotivoAnulacion"
              class="mt-4 rounded-md border px-3 py-3 text-sm"
              :class="form.motivoAnulacion.trim() ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-800'"
            >
              <p class="font-semibold">{{ form.motivoAnulacion.trim() ? 'Motivo registrado' : 'Motivo pendiente' }}</p>
              <p v-if="form.motivoAnulacion.trim()" class="mt-2 whitespace-pre-wrap text-slate-700">{{ form.motivoAnulacion }}</p>
              <p v-else class="mt-1">Escribe el detalle del motivo para continuar.</p>
            </div>

            <div v-if="requiresReplacementDte" class="mt-4 border-t border-slate-200 pt-4">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">DTE sustituto</p>
                  <p class="mt-1 text-sm text-slate-600">
                    Selecciona el documento de reemplazo transmitido.
                  </p>
                </div>
                <button
                  v-if="selectedReplacement"
                  type="button"
                  class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  @click="clearReplacementDocument"
                >
                  Cambiar sustituto
                </button>
              </div>

              <div v-if="selectedReplacement" class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p class="font-semibold text-emerald-950">{{ selectedReplacement.tipoDte }} · {{ selectedReplacement.numeroControl }}</p>
                <p class="mt-1 break-all font-mono text-xs text-emerald-800">{{ selectedReplacement.codigoGeneracion }}</p>
                <p class="mt-1 text-xs text-emerald-700">Sello: {{ selectedReplacement.selloRecibido }}</p>
              </div>
              <p
                v-if="replacementIdentificationError"
                class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
              >
                {{ replacementIdentificationError }}
              </p>

              <div v-if="!selectedReplacement" class="mt-4">
                <UiSearchInput
                  v-model="replacementQuery"
                  label="Buscar DTE sustituto"
                  placeholder="Numero, codigo, sello o receptor"
                  @search="loadReplacementDocuments"
                />

                <div v-if="replacementDocuments.length" class="mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
                  <button
                    v-for="document in replacementDocuments"
                    :key="document.id"
                    type="button"
                    class="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-sky-50"
                    @click="selectReplacementDocument(document)"
                  >
                    <span class="flex flex-col gap-1">
                      <span class="font-semibold text-slate-950">{{ document.tipoDte }} · {{ document.numeroControl }}</span>
                      <span class="break-all font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</span>
                      <span class="text-xs text-slate-600">{{ recordValue((document.payload ?? document.dte_json ?? {}).receptor).nombre ?? 'Sin receptor' }}</span>
                    </span>
                  </button>
                </div>

                <p v-else-if="replacementSearched" class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No hay DTE sustitutos aceptados con sello MH para esa busqueda.
                </p>
              </div>
            </div>
          </div>

        </div>
      </UiCard>

      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
        <section class="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-950/95 px-3 py-2 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <p class="min-w-0 max-w-[300px] truncate">
              <span class="text-slate-400">DTE</span>
              <span class="ml-2 font-mono text-xs font-bold text-white">{{ selected?.numeroControl ?? 'Sin seleccionar' }}</span>
            </p>
            <p class="min-w-0 max-w-[340px] truncate">
              <span class="text-slate-400">Motivo</span>
              <span class="ml-2 font-semibold text-white">{{ invalidacionTipos.find((tipo) => tipo.value === Number(form.tipoAnulacion))?.label ?? 'Sin motivo' }}</span>
              <span v-if="form.motivoAnulacion.trim()" class="ml-2 text-xs text-slate-300">{{ form.motivoAnulacion }}</span>
            </p>
            <p v-if="requiresReplacementDte" class="min-w-0 max-w-[260px] truncate">
              <span class="text-slate-400">Sustituto</span>
              <span class="ml-2 font-mono text-xs font-bold text-white">{{ selectedReplacement?.numeroControl ?? 'Sin seleccionar' }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center justify-end gap-2">
            <span class="rounded-md bg-sky-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-sky-950/30">
              {{ actionStatusLabel }}
            </span>
            <UiButton
              class="min-w-[140px]"
              :disabled="!canInvalidate || processing"
              @click="invalidateSelected"
            >
              {{ processing ? 'Procesando...' : 'Invalidar ahora' }}
            </UiButton>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
