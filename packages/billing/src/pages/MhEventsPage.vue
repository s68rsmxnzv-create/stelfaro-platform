<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  CoreDteClient,
  type DteDraftSummary,
  type MhFiscalEventSummary
} from '@stelfaro/api-client';
import { currency } from '@stelfaro/shared';
import { UiButton, UiCard, UiSearchInput, UiLoadingMark, UiTextarea } from '@stelfaro/ui';
import BillingProcessModal from '../components/BillingProcessModal.vue';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  initialEventType?: string;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  initialEventType: 'invalidacion'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const processing = ref(false);
const eventModalOpen = ref(false);
const eventProgress = ref(0);
const eventPhaseIndex = ref(0);
const error = ref<string | null>(null);
const query = ref('');
const searchLocked = ref(false);
const searched = ref(false);
const documents = ref<DteDraftSummary[]>([]);
const selected = ref<DteDraftSummary | null>(null);
const eventResult = ref<MhFiscalEventSummary | null>(null);
const eventLog = ref<Array<{ label: string; status: 'ok' | 'error' }>>([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const eventTypes = [
  {
    key: 'invalidacion',
    label: 'Invalidacion',
    title: 'Invalidacion de DTE',
    description: 'Genera, valida, firma y transmite eventos de invalidacion usando el schema v3 de la normativa vigente.',
    ready: true,
  },
  {
    key: 'contingencia',
    label: 'Contingencia',
    title: 'Evento de Contingencia',
    description: 'Base para reportar documentos emitidos bajo contingencia con schema v4.',
    ready: false,
  },
  {
    key: 'retorno',
    label: 'Retorno',
    title: 'Evento de Retorno',
    description: 'Base para retorno de documentos relacionados a operaciones especiales.',
    ready: false,
  },
  {
    key: 'operaciones_especiales',
    label: 'Operaciones especiales',
    title: 'Evento de Operaciones Especiales',
    description: 'Base para operaciones especiales segun catalogos y schema v1.',
    ready: false,
  },
];
const selectedEvent = computed(() => eventTypes.find((event) => event.key === props.initialEventType) ?? eventTypes[0]);
const isInvalidacion = computed(() => selectedEvent.value.key === 'invalidacion');
const showSearchResults = computed(() => query.value.trim().length >= 2 && !selected.value);

const form = reactive({
  tipoAnulacion: 2,
  motivoAnulacion: '',
  nombreResponsable: '',
  tipDocResponsable: '36',
  numDocResponsable: '',
  nombreSolicita: '',
  tipDocSolicita: '13',
  numDocSolicita: ''
});

const invalidacionTipos = [
  { value: 1, label: 'Error en la informacion del DTE' },
  { value: 2, label: 'Rescindir la operacion realizada' },
  { value: 3, label: 'Otro motivo' },
];
const requiresMotivoAnulacion = computed(() => [1, 3].includes(Number(form.tipoAnulacion)));
const canInvalidate = computed(() => Boolean(
  selected.value
  && form.tipoAnulacion
  && (!requiresMotivoAnulacion.value || form.motivoAnulacion.trim())
  && form.nombreResponsable.trim()
  && form.numDocResponsable.trim()
  && form.nombreSolicita.trim()
  && form.numDocSolicita.trim()
));
const selectedPayload = computed(() => selected.value?.payload ?? selected.value?.dte_json ?? {});
const selectedReceptor = computed(() => recordValue(selectedPayload.value.receptor));
const selectedIdentificacion = computed(() => recordValue(selectedPayload.value.identificacion));
const resultStatusClass = computed(() => {
  const status = String(eventResult.value?.transmission?.status ?? eventResult.value?.estado ?? '').toUpperCase();
  if (status.includes('ACCEPTED') || eventResult.value?.estado === 'accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status.includes('REJECTED') || eventResult.value?.estado === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-900';
  return 'border-sky-200 bg-sky-50 text-sky-900';
});
const eventPhases = [
  { label: 'Preparando evento', detail: 'Tomando el DTE origen, responsable, solicitante y motivo.' },
  { label: 'Validando schema', detail: 'Revisando el JSON contra invalidacion v3 de MH.' },
  { label: 'Firmando evento', detail: 'Enviando el evento al firmador configurado.' },
  { label: 'Transmitiendo a MH', detail: 'Usando bearer activo y recepcion de eventos del ambiente.' },
  { label: 'Registrando respuesta', detail: 'Guardando sello, estado y resultado final del evento.' }
];
const eventRejected = computed(() => {
  const status = String(eventResult.value?.transmission?.status ?? eventResult.value?.estado ?? '').toUpperCase();
  return status.includes('REJECTED') || eventResult.value?.estado === 'rejected';
});
const eventAccepted = computed(() => {
  const status = String(eventResult.value?.transmission?.status ?? eventResult.value?.estado ?? '').toUpperCase();
  return status.includes('ACCEPTED') || eventResult.value?.estado === 'accepted';
});
const eventStopped = computed(() => Boolean(error.value && !processing.value && !eventAccepted.value && !eventRejected.value));
const eventStatusDetail = computed(() => {
  if (processing.value) return eventPhases[eventPhaseIndex.value].detail;
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

onMounted(() => {
  hydratePeopleFromSelected();
});

watch(query, () => {
  if (!isInvalidacion.value) return;
  if (searchLocked.value) {
    searchLocked.value = false;
    return;
  }
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadDocuments(), 250);
});

watch(() => props.initialEventType, () => {
  error.value = null;
  eventResult.value = null;
  eventLog.value = [];
  selected.value = null;
  documents.value = [];
  query.value = '';
  searched.value = false;
});

async function loadDocuments(): Promise<void> {
  const search = query.value.trim();
  selected.value = null;
  eventResult.value = null;
  eventLog.value = [];

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
      estado: 'accepted',
      limit: 12,
      include_payload: true
    });
    documents.value = response.data.filter((document) => document.selloRecibido);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar documentos aceptados.';
  } finally {
    loading.value = false;
  }
}

function selectDocument(document: DteDraftSummary): void {
  selected.value = document;
  eventResult.value = null;
  eventLog.value = [];
  documents.value = [];
  searched.value = false;
  searchLocked.value = true;
  query.value = `${document.numeroControl} · ${String(recordValue((document.payload ?? document.dte_json ?? {}).receptor).nombre ?? 'DTE aceptado')}`;

  hydratePeopleFromSelected();
}

function clearSelectedDocument(): void {
  selected.value = null;
  eventResult.value = null;
  eventLog.value = [];
  query.value = '';
  documents.value = [];
  searched.value = false;
  form.nombreResponsable = '';
  form.numDocResponsable = '';
  form.nombreSolicita = '';
  form.numDocSolicita = '';
}

async function invalidateSelected(): Promise<void> {
  if (!selected.value || !canInvalidate.value) return;

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
        motivo: {
          tipoAnulacion: Number(form.tipoAnulacion),
          motivoAnulacion: requiresMotivoAnulacion.value ? form.motivoAnulacion.trim() : null,
          nombreResponsable: form.nombreResponsable.trim(),
          tipDocResponsable: form.tipDocResponsable,
          numDocResponsable: cleanDocument(form.numDocResponsable),
          nombreSolicita: form.nombreSolicita.trim(),
          tipDocSolicita: form.tipDocSolicita,
          numDocSolicita: cleanDocument(form.numDocSolicita)
        }
      },
      relations: [{
        relation_type: 'invalidates',
        dte_document_id: selected.value.id
      }]
    });

    pushLog('Validando contra schema MH v3');
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

    pushLog('Transmitiendo evento a MH');
    eventPhaseIndex.value = 3;
    eventProgress.value = 78;
    eventResult.value = await client.value.transmitMhEvent(signed.id);
    eventPhaseIndex.value = 4;
    eventProgress.value = 100;
    pushLog('Evento procesado por MH');
    await loadDocuments();
  } catch (caught) {
    eventLog.value.push({ label: 'Proceso detenido', status: 'error' });
    error.value = caught instanceof Error ? caught.message : 'No fue posible invalidar el documento.';
    eventProgress.value = Math.max(eventProgress.value, 100);
  } finally {
    processing.value = false;
  }
}

function closeEventModal(): void {
  if (processing.value) return;
  eventModalOpen.value = false;
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
    'motivo.motivoAnulacion': 'Motivo de invalidacion'
  };
  const readable = errors
    .filter((item) => item.field && !item.message.includes('Additional object properties'))
    .slice(0, 4)
    .map((item) => `${fieldLabels[item.field] ?? item.field}: ${item.message}`);

  if (readable.length === 0) {
    return 'El evento no cumple el schema MH v3. Revisa que el DTE origen tenga sello MH, emisor, receptor y codigos de establecimiento/punto de venta completos.';
  }

  return `El evento no cumple el schema MH v3:\n${readable.join('\n')}`;
}

function hydratePeopleFromSelected(): void {
  if (!selected.value) return;

  const payload = selected.value.payload ?? selected.value.dte_json ?? {};
  const emisor = recordValue(payload.emisor);
  const receptor = recordValue(payload.receptor);

  form.nombreResponsable = String(emisor.nombre ?? selected.value.empresa?.razon_social ?? selected.value.empresa?.nombre_comercial ?? '');
  form.tipDocResponsable = '36';
  form.numDocResponsable = String(emisor.nit ?? selected.value.empresa?.nit ?? '');
  form.nombreSolicita = String(receptor.nombre ?? '');
  form.tipDocSolicita = String(receptor.tipoDocumento ?? (receptor.nit ? '36' : '13'));
  form.numDocSolicita = String(receptor.numDocumento ?? receptor.nit ?? '');
}

function cleanDocument(value: string): string {
  const digits = value.replace(/\D+/g, '');
  return digits || value.trim();
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function statusLabel(document: DteDraftSummary): string {
  return String(document.transmission?.status ?? document.estado).toUpperCase();
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Eventos MH</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-950">{{ selectedEvent.title }}</h2>
        <p class="mt-2 text-sm text-slate-600">
          {{ selectedEvent.description }}
        </p>
      </div>

      <div class="rounded-md border border-sky-100 bg-white px-4 py-3 text-sm shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Schema activo</p>
        <p class="mt-1 font-bold text-slate-950">{{ selectedEvent.key === 'invalidacion' ? 'Invalidacion v3' : 'Pendiente de aterrizar' }}</p>
      </div>
    </div>

    <p v-if="error" class="whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>

    <UiCard v-if="!isInvalidacion">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <p class="text-base font-semibold text-slate-950">{{ selectedEvent.label }}</p>
          <p class="mt-2 max-w-2xl text-sm text-slate-600">
            Esta pantalla queda separada desde ya para mantener el mismo estilo que los DTE. Cuando aterricemos este evento, aqui quedara su flujo propio sin mezclar reglas con invalidacion.
          </p>
        </div>
        <div class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Flujo en preparacion. La ruta y la navegacion ya estan listas.
        </div>
      </div>
    </UiCard>

    <div v-else class="grid gap-6 pb-24">
      <BillingProcessModal
        :open="eventModalOpen"
        eyebrow="Evento MH"
        :title="processing ? 'Invalidando DTE' : eventRejected ? 'Evento rechazado por MH' : eventAccepted ? 'Evento procesado' : 'Invalidacion detenida'"
        :subtitle="`Ambiente ${selected?.ambiente ?? '00'} · ${selected?.empresa?.nombre_comercial ?? selected?.empresa?.razon_social ?? 'Empresa emisora'}`"
        :processing="processing"
        :accepted="eventAccepted"
        :rejected="eventRejected || eventStopped"
        :status-label="processing ? eventPhases[eventPhaseIndex].label : eventRejected ? 'MH rechazo el evento' : eventAccepted ? 'Evento aceptado por MH' : 'No fue posible invalidar'"
        :status-detail="eventStatusDetail"
        :progress="eventProgress"
        progress-label="Recepcion de eventos MH"
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
            </div>

            <div v-else-if="error && !processing" class="mt-5 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {{ error }}
            </div>
      </BillingProcessModal>

      <UiCard>
        <div class="flex flex-col gap-4">
          <div>
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-base font-semibold text-slate-950">Buscar documento a invalidar</p>
                <p class="mt-1 text-sm text-slate-500">Busca por numero de control, codigo de generacion, sello, receptor o empresa.</p>
              </div>
              <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">DTE aceptados</span>
            </div>

            <div class="relative mt-4">
              <UiSearchInput
                v-model="query"
                label="DTE a invalidar"
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
                    </span>
                  </span>
                </button>

                <p v-if="!loading && searched && documents.length === 0" class="px-4 py-5 text-sm text-slate-500">
                  No hay DTE aceptados con sello MH para esa busqueda.
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-md border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700">
            Solo se puede invalidar un DTE aceptado con sello de recepcion MH. Al aceptarse el evento, el documento cambia a invalidado.
          </div>
        </div>
      </UiCard>

      <UiCard>
        <div class="flex flex-col gap-5">
          <div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-base font-semibold text-slate-950">Documento a invalidar</p>
              <button
                v-if="selected"
                class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                type="button"
                @click="clearSelectedDocument"
              >
                Cambiar DTE
              </button>
            </div>
            <div v-if="selected" class="mt-3 rounded-md border border-sky-100 bg-sky-50 p-4 text-sm">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <p class="font-semibold text-slate-950">{{ selected.tipoDte }} · {{ selected.numeroControl }}</p>
                  <p class="mt-1 break-all font-mono text-xs text-slate-600">{{ selected.codigoGeneracion }}</p>
                </div>
                <span class="shrink-0 rounded bg-white px-2 py-1 text-xs font-semibold text-sky-700">Evento 15</span>
              </div>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Receptor</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ selectedReceptor.nombre ?? 'Sin receptor' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase text-slate-500">Fecha emision</dt>
                  <dd class="mt-1 font-semibold text-slate-950">{{ selectedIdentificacion.fecEmi ?? 'Sin fecha' }}</dd>
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
              </dl>
            </div>
            <p v-else class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Busca y selecciona un DTE aceptado para preparar la invalidacion.</p>
          </div>

          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-semibold text-slate-950">Motivo de invalidacion</p>
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
          </div>

          <UiTextarea
            v-if="requiresMotivoAnulacion"
            v-model="form.motivoAnulacion"
            label="Detalle del motivo"
            :rows="3"
          />

          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-semibold text-slate-950">Responsable y solicitante</p>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div class="rounded-md bg-slate-50 p-3">
                <p class="text-xs font-semibold uppercase text-slate-500">Responsable</p>
                <p class="mt-2 font-semibold text-slate-950">{{ form.nombreResponsable || 'Se tomara del emisor' }}</p>
                <p class="mt-1 font-mono text-xs text-slate-600">{{ form.tipDocResponsable }} · {{ form.numDocResponsable || 'Sin documento' }}</p>
              </div>
              <div class="rounded-md bg-slate-50 p-3">
                <p class="text-xs font-semibold uppercase text-slate-500">Solicitante</p>
                <p class="mt-2 font-semibold text-slate-950">{{ form.nombreSolicita || 'Se tomara del receptor' }}</p>
                <p class="mt-1 font-mono text-xs text-slate-600">{{ form.tipDocSolicita }} · {{ form.numDocSolicita || 'Sin documento' }}</p>
              </div>
            </div>
          </div>

          <div v-if="eventResult" class="rounded-md border p-4" :class="resultStatusClass">
            <p class="text-sm font-semibold">Evento {{ eventResult.estado }}</p>
            <p class="mt-1 break-all font-mono text-xs">{{ eventResult.codigoGeneracion }}</p>
            <p class="mt-3 text-sm">{{ eventResult.transmission?.descripcion_msg ?? eventResult.transmission?.mh_estado ?? 'Evento creado.' }}</p>
            <p v-if="eventResult.transmission?.receipt_stamp" class="mt-2 break-all font-mono text-xs">{{ eventResult.transmission.receipt_stamp }}</p>
          </div>
        </div>
      </UiCard>

      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
        <section class="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-950/95 px-4 py-3 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Evento</p>
              <p class="font-bold text-white">Invalidacion</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Schema</p>
              <p class="font-bold text-white">v3</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">DTE</p>
              <p class="max-w-[260px] truncate font-mono text-xs font-bold text-white">{{ selected?.numeroControl ?? 'Sin seleccionar' }}</p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Motivo</p>
              <p class="font-bold text-white">{{ invalidacionTipos.find((tipo) => tipo.value === Number(form.tipoAnulacion))?.label ?? 'Sin motivo' }}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <div class="min-w-[150px] rounded-md bg-sky-600 px-4 py-2 text-right text-white shadow-sm shadow-sky-950/30">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-sky-100">Estado</p>
              <p class="text-lg font-bold">{{ selected ? 'Listo' : 'Pendiente' }}</p>
            </div>
            <UiButton
              class="min-w-[150px]"
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
