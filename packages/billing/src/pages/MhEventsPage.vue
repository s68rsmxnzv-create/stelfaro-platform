<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  CoreDteClient,
  type DteDraftSummary,
  type MhFiscalEventSummary
} from '@stelfaro/api-client';
import { currency } from '@stelfaro/shared';
import { UiButton, UiCard, UiInput, UiTextarea } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const processing = ref(false);
const error = ref<string | null>(null);
const query = ref('');
const documents = ref<DteDraftSummary[]>([]);
const selected = ref<DteDraftSummary | null>(null);
const eventResult = ref<MhFiscalEventSummary | null>(null);
const eventLog = ref<Array<{ label: string; status: 'ok' | 'error' }>>([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const form = reactive({
  tipoAnulacion: 2,
  motivoAnulacion: 'Correccion de datos del documento',
  nombreResponsable: '',
  tipDocResponsable: '13',
  numDocResponsable: '',
  nombreSolicita: '',
  tipDocSolicita: '13',
  numDocSolicita: ''
});

const canInvalidate = computed(() => Boolean(
  selected.value
  && form.tipoAnulacion
  && form.motivoAnulacion.trim()
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

onMounted(() => {
  void loadDocuments();
});

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadDocuments(), 250);
});

async function loadDocuments(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.documents({
      q: query.value.trim(),
      estado: 'accepted',
      limit: 50,
      include_payload: true
    });
    documents.value = response.data.filter((document) => document.selloRecibido);

    if (!selected.value && documents.value[0]) {
      selectDocument(documents.value[0]);
    }
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

  if (!form.nombreSolicita.trim()) {
    form.nombreSolicita = String(document.empresa?.razon_social ?? document.empresa?.nombre_comercial ?? '');
  }
}

async function invalidateSelected(): Promise<void> {
  if (!selected.value || !canInvalidate.value) return;

  processing.value = true;
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
          motivoAnulacion: form.motivoAnulacion.trim(),
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
    const validation = await client.value.validateMhEvent(draft.id);
    if (!validation.validation.valid) {
      eventResult.value = draft;
      throw new Error(validation.validation.errors.map((item) => `${item.field}: ${item.message}`).join('\n'));
    }

    pushLog('Firmando evento');
    const signed = await client.value.signMhEvent(draft.id);

    pushLog('Transmitiendo evento a MH');
    eventResult.value = await client.value.transmitMhEvent(signed.id);
    pushLog('Evento procesado por MH');
    await loadDocuments();
  } catch (caught) {
    eventLog.value.push({ label: 'Proceso detenido', status: 'error' });
    error.value = caught instanceof Error ? caught.message : 'No fue posible invalidar el documento.';
  } finally {
    processing.value = false;
  }
}

function pushLog(label: string): void {
  eventLog.value.push({ label, status: 'ok' });
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
        <h2 class="mt-1 text-2xl font-bold text-slate-950">Invalidacion de DTE</h2>
        <p class="mt-2 text-sm text-slate-600">
          Genera, valida, firma y transmite eventos de invalidacion usando el schema v3 de la normativa vigente.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <span class="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white">Invalidacion</span>
        <span class="rounded-md bg-white/70 px-3 py-2 text-sm font-semibold text-slate-500">Contingencia</span>
        <span class="rounded-md bg-white/70 px-3 py-2 text-sm font-semibold text-slate-500">Retorno</span>
        <span class="rounded-md bg-white/70 px-3 py-2 text-sm font-semibold text-slate-500">Operaciones especiales</span>
      </div>
    </div>

    <p v-if="error" class="whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <UiCard>
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <UiInput v-model="query" class="md:max-w-lg" label="Buscar DTE aceptado" placeholder="Numero, codigo, sello, cliente o empresa" />
          <div class="rounded-md bg-sky-50 px-3 py-2 text-sm text-slate-600">
            <p class="text-xs font-semibold uppercase text-slate-500">Disponibles</p>
            <p class="mt-1 text-lg font-bold text-slate-950">{{ documents.length }}</p>
          </div>
        </div>

        <div class="mt-5 overflow-hidden rounded-md border border-slate-200">
          <div class="max-h-[620px] divide-y divide-slate-100 overflow-y-auto bg-white">
            <button
              v-for="document in documents"
              :key="document.id"
              class="block w-full px-4 py-4 text-left transition hover:bg-sky-50"
              :class="selected?.id === document.id ? 'bg-sky-50' : ''"
              type="button"
              @click="selectDocument(document)"
            >
              <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0">
                  <p class="font-semibold text-slate-950">{{ document.tipoDte }} · {{ document.numeroControl }}</p>
                  <p class="mt-1 truncate font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</p>
                  <p class="mt-2 text-sm text-slate-600">{{ document.empresa?.razon_social ?? document.empresa?.nombre_comercial }}</p>
                </div>
                <div class="shrink-0 text-left lg:text-right">
                  <span class="inline-flex rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{{ statusLabel(document) }}</span>
                  <p class="mt-2 text-sm font-bold text-slate-950">{{ currency(document.totalPagar ?? 0) }}</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-slate-500">{{ formatDate(document.processed_at ?? document.created_at) }}</p>
            </button>

            <p v-if="loading" class="px-4 py-5 text-sm text-slate-500">Cargando documentos aceptados...</p>
            <p v-else-if="documents.length === 0" class="px-4 py-5 text-sm text-slate-500">No hay DTE aceptados disponibles para invalidar.</p>
          </div>
        </div>
      </UiCard>

      <UiCard>
        <div class="flex flex-col gap-4">
          <div>
            <p class="text-sm font-semibold text-slate-950">Documento seleccionado</p>
            <div v-if="selected" class="mt-3 rounded-md border border-sky-100 bg-sky-50 p-4 text-sm">
              <p class="font-semibold text-slate-950">{{ selected.numeroControl }}</p>
              <p class="mt-1 break-all font-mono text-xs text-slate-600">{{ selected.codigoGeneracion }}</p>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2">
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
              </dl>
            </div>
            <p v-else class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Selecciona un DTE aceptado para preparar la invalidacion.</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm font-semibold text-slate-900">Tipo de invalidacion</span>
              <select
                v-model.number="form.tipoAnulacion"
                class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option :value="1">Tipo 1</option>
                <option :value="2">Tipo 2</option>
                <option :value="3">Tipo 3</option>
              </select>
            </label>
            <UiInput v-model="form.nombreResponsable" label="Responsable" placeholder="Nombre de quien realiza el evento" />
            <label class="block">
              <span class="text-sm font-semibold text-slate-900">Doc. responsable</span>
              <select
                v-model="form.tipDocResponsable"
                class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="13">DUI</option>
                <option value="36">NIT</option>
              </select>
            </label>
            <UiInput v-model="form.numDocResponsable" label="Numero responsable" placeholder="DUI o NIT" />
            <UiInput v-model="form.nombreSolicita" label="Solicitante" placeholder="Nombre de quien solicita" />
            <label class="block">
              <span class="text-sm font-semibold text-slate-900">Doc. solicitante</span>
              <select
                v-model="form.tipDocSolicita"
                class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="13">DUI</option>
                <option value="36">NIT</option>
              </select>
            </label>
            <UiInput v-model="form.numDocSolicita" label="Numero solicitante" placeholder="DUI o NIT" />
          </div>

          <UiTextarea v-model="form.motivoAnulacion" label="Motivo de invalidacion" :rows="3" />

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p class="text-xs text-slate-500">El evento se validara contra schema v3 antes de firmar y transmitir.</p>
            <UiButton :disabled="!canInvalidate || processing" @click="invalidateSelected">
              {{ processing ? 'Procesando...' : 'Invalidar ahora' }}
            </UiButton>
          </div>

          <div v-if="eventLog.length" class="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs font-semibold uppercase text-slate-500">Proceso</p>
            <ul class="mt-2 space-y-1 text-sm">
              <li v-for="entry in eventLog" :key="entry.label" class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full" :class="entry.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                <span class="text-slate-700">{{ entry.label }}</span>
              </li>
            </ul>
          </div>

          <div v-if="eventResult" class="rounded-md border p-4" :class="resultStatusClass">
            <p class="text-sm font-semibold">Evento {{ eventResult.estado }}</p>
            <p class="mt-1 break-all font-mono text-xs">{{ eventResult.codigoGeneracion }}</p>
            <p class="mt-3 text-sm">{{ eventResult.transmission?.descripcion_msg ?? eventResult.transmission?.mh_estado ?? 'Evento creado.' }}</p>
            <p v-if="eventResult.transmission?.receipt_stamp" class="mt-2 break-all font-mono text-xs">{{ eventResult.transmission.receipt_stamp }}</p>
          </div>
        </div>
      </UiCard>
    </div>
  </section>
</template>
