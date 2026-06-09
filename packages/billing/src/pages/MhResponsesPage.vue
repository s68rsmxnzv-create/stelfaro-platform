<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  CoreDteClient,
  type DteDraftSummary,
  type DteHistoryEntry
} from '@stelfaro/api-client';
import { currency } from '@stelfaro/shared';
import { UiButton, UiCard, UiLoadingMark, UiSearchInput } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const detailLoading = ref(false);
const querying = ref(false);
const error = ref<string | null>(null);
const query = ref('');
const estado = ref('');
const documents = ref<DteDraftSummary[]>([]);
const selected = ref<DteDraftSummary | null>(null);
const history = ref<DteHistoryEntry[]>([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const selectedAttempts = computed(() => selected.value?.transmission_attempts ?? []);
const selectedRawMh = computed(() => selected.value?.mh_response
  ?? selected.value?.transmission?.raw_response
  ?? selected.value?.transmission
  ?? {});
const selectedMhJson = computed(() => JSON.stringify(
  selectedRawMh.value,
  null,
  2
));
const selectedPayloadJson = computed(() => JSON.stringify(selected.value?.dte_json ?? selected.value?.payload ?? {}, null, 2));
const selectedSignedBundleJson = computed(() => JSON.stringify(
  selected.value?.signed_bundle ?? {
    payload: selected.value?.dte_json ?? selected.value?.payload ?? {},
    firma: selected.value?.signedDocument ?? null,
    selloRecibido: selected.value?.selloRecibido ?? selected.value?.transmission?.receipt_stamp ?? null,
    estadoMH: mhValue(['estado', 'status']) ?? selected.value?.transmission?.mh_estado ?? null,
  },
  null,
  2
));
const selectedObservations = computed(() => normalizeStringList(
  mhValue(['observaciones']) ?? selected.value?.transmission?.observaciones ?? []
));
const selectedMhSummary = computed(() => ({
  estado: String(mhValue(['estado', 'status']) ?? selected.value?.transmission?.mh_estado ?? selected.value?.estado ?? 'Sin estado'),
  sello: String(mhValue(['selloRecibido', 'receipt_stamp']) ?? selected.value?.selloRecibido ?? selected.value?.transmission?.receipt_stamp ?? 'Sin sello'),
  codigoMsg: String(mhValue(['codigoMsg', 'codigo_msg']) ?? selected.value?.transmission?.codigo_msg ?? 'Sin codigo'),
  clasificaMsg: String(mhValue(['clasificaMsg', 'clasifica_msg']) ?? 'Sin clasificacion'),
  descripcionMsg: String(mhValue(['descripcionMsg', 'descripcion_msg', 'message']) ?? selected.value?.transmission?.descripcion_msg ?? selected.value?.errorMessage ?? 'Sin mensaje'),
  fecProcesamiento: String(mhValue(['fecProcesamiento', 'processed_at']) ?? selected.value?.processed_at ?? selected.value?.created_at ?? ''),
}));
const emptyState = computed(() => !loading.value && documents.value.length === 0);

onMounted(() => {
  void loadDocuments();
});

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadDocuments(), 250);
});

watch(estado, () => {
  void loadDocuments();
});

async function loadDocuments(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.documents({
      q: query.value.trim(),
      estado: estado.value,
      limit: 40
    });
    documents.value = response.data;

    if (!selected.value && documents.value[0]) {
      await selectDocument(documents.value[0]);
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar respuestas MH.';
  } finally {
    loading.value = false;
  }
}

async function selectDocument(document: DteDraftSummary): Promise<void> {
  detailLoading.value = true;
  error.value = null;

  try {
    selected.value = await client.value.document(document.id);
    history.value = await client.value.history(document.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el detalle del DTE.';
  } finally {
    detailLoading.value = false;
  }
}

async function queryMh(): Promise<void> {
  if (!selected.value) return;

  querying.value = true;
  error.value = null;

  try {
    const response = await client.value.queryMh(selected.value.id);
    selected.value = response.document;
    await loadDocuments();
    history.value = await client.value.history(response.document.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible consultar MH.';
  } finally {
    querying.value = false;
  }
}

function statusLabel(document: DteDraftSummary | null): string {
  if (!document) return 'Sin DTE';
  const mhStatus = document.transmission?.status ?? document.mh_response?.status;
  return String(mhStatus || document.estado).toUpperCase();
}

function statusClass(document: DteDraftSummary | null): string {
  const status = statusLabel(document);
  if (status.includes('ACCEPTED') || status.includes('ACEPT') || document?.estado === 'accepted') return 'bg-emerald-50 text-emerald-700';
  if (status.includes('REJECTED') || status.includes('RECH') || document?.estado === 'rejected') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function invalidacionLabel(document: DteDraftSummary | null): string {
  if (!document?.invalidacion) return 'Sin evaluar';
  if (document.invalidacion.eligible) return 'Habil';

  const labels: Record<string, string> = {
    expired: 'Plazo vencido',
    invalidated: 'Invalidado',
    not_transmitted: 'No transmitido',
    missing_receipt_stamp: 'Sin sello',
    missing_transmission_date: 'Sin fecha',
  };

  return labels[document.invalidacion.status] ?? 'No habil';
}

function invalidacionClass(document: DteDraftSummary | null): string {
  if (document?.invalidacion?.eligible) return 'bg-emerald-50 text-emerald-700';
  if (document?.invalidacion?.status === 'expired') return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

function invalidacionDeadline(document: DteDraftSummary | null): string {
  if (!document?.invalidacion?.deadline) return 'Sin limite';

  return formatDate(document.invalidacion.deadline);
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function attemptsCount(document: DteDraftSummary): number {
  return document.transmission_attempts_count ?? document.transmission_attempts?.length ?? 0;
}

function mhValue(keys: string[]): unknown {
  const source = selectedRawMh.value as Record<string, unknown>;

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()];
  }

  return [];
}

function copyText(value: string): void {
  void navigator.clipboard?.writeText(value);
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Respuestas MH</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-950">Documentos transmitidos</h2>
        <p class="mt-2 text-sm text-slate-600">
          Consulta sello, estado, intentos de transmision y respuesta de Hacienda.
        </p>
      </div>

      <RouterLink to="/billing/fe" class="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
        Nueva factura
      </RouterLink>
    </div>

    <p v-if="error" class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>

    <UiCard>
      <div class="grid gap-4 p-1 md:grid-cols-[minmax(0,1fr)_240px_120px] md:items-end">
        <UiSearchInput
          v-model="query"
          label="Buscar DTE"
          placeholder="Numero, codigo, sello, empresa o NIT"
          @search="loadDocuments"
        />

        <div>
          <label class="text-sm font-semibold text-slate-900" for="mh-status">Estado</label>
          <select
            id="mh-status"
            v-model="estado"
            class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            <option value="accepted">Aceptados</option>
            <option value="rejected">Rechazados</option>
            <option value="sent">Transmitidos</option>
            <option value="signed">Firmados</option>
          </select>
        </div>

        <div class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <p class="text-xs font-semibold uppercase text-slate-500">Resultados</p>
          <p class="mt-1 text-lg font-bold text-slate-950">{{ documents.length }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard>
      <div class="overflow-hidden rounded-md border border-slate-200">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Fecha</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Empresa</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Documento</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Estado MH</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Invalidacion</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Sello</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Mensaje</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">Intentos</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Accion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <template v-for="document in documents" :key="document.id">
                <tr
                  class="transition hover:bg-sky-50/60"
                  :class="selected?.id === document.id ? 'bg-sky-50' : ''"
                >
                  <td class="whitespace-nowrap px-4 py-4 text-slate-600">
                    <p>{{ formatDate(document.processed_at ?? document.created_at) }}</p>
                    <p class="mt-1 text-xs text-slate-400">ID #{{ document.id }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="font-semibold text-slate-950">{{ document.empresa?.nombre_comercial ?? 'Empresa' }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ document.empresa?.nit ?? 'Sin NIT' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="font-semibold text-slate-950">{{ document.tipoDte }} · {{ document.numeroControl }}</p>
                    <p class="mt-1 max-w-xs truncate text-xs text-slate-500">{{ document.codigoGeneracion }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <span class="inline-flex rounded px-2 py-1 text-xs font-semibold" :class="statusClass(document)">
                      {{ statusLabel(document) }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <span class="inline-flex rounded px-2 py-1 text-xs font-semibold" :class="invalidacionClass(document)">
                      {{ invalidacionLabel(document) }}
                    </span>
                    <p class="mt-1 text-xs text-slate-500">{{ invalidacionDeadline(document) }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="max-w-[220px] truncate text-xs font-medium text-slate-700">{{ document.selloRecibido ?? 'Sin sello' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="max-w-[260px] truncate text-xs text-slate-600">
                      {{ document.transmission?.descripcion_msg ?? document.errorMessage ?? 'Sin mensaje MH' }}
                    </p>
                    <p class="mt-1 text-xs font-semibold text-slate-900">{{ currency(document.totalPagar ?? 0) }}</p>
                  </td>
                  <td class="px-4 py-4 text-center text-slate-700">
                    {{ attemptsCount(document) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right">
                    <UiButton type="button" variant="secondary" :disabled="detailLoading && selected?.id === document.id" @click="selectDocument(document)">
                      {{ selected?.id === document.id ? 'Auditoria abierta' : 'Ver auditoria' }}
                    </UiButton>
                  </td>
                </tr>

                <tr v-if="selected?.id === document.id">
                  <td colspan="9" class="bg-slate-50 px-4 py-5">
                    <div class="space-y-5">
                      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <h3 class="truncate text-lg font-bold text-slate-950">{{ selected.empresa?.nombre_comercial ?? 'DTE' }}</h3>
                            <span class="rounded px-2 py-1 text-xs font-semibold" :class="statusClass(selected)">{{ selectedMhSummary.estado }}</span>
                          </div>
                          <p class="mt-1 text-sm text-slate-600">{{ selected.empresa?.razon_social }}</p>
                          <p class="mt-2 break-all font-mono text-xs font-semibold text-slate-900">{{ selected.numeroControl }}</p>
                          <p class="mt-1 break-all font-mono text-xs text-slate-500">{{ selected.codigoGeneracion }}</p>
                        </div>

                        <UiButton type="button" :disabled="querying || detailLoading" @click="queryMh">
                          {{ querying ? 'Consultando...' : 'Consultar MH' }}
                        </UiButton>
                      </div>

                      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Estado MH</p>
                          <p class="mt-2 break-all text-sm font-bold text-slate-950">{{ selectedMhSummary.estado }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Codigo mensaje</p>
                          <p class="mt-2 break-all text-sm font-bold text-slate-950">{{ selectedMhSummary.codigoMsg }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Clasificacion</p>
                          <p class="mt-2 break-all text-sm font-bold text-slate-950">{{ selectedMhSummary.clasificaMsg }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Procesado</p>
                          <p class="mt-2 text-sm font-bold text-slate-950">{{ formatDate(selectedMhSummary.fecProcesamiento) }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Total</p>
                          <p class="mt-2 text-sm font-bold text-slate-950">{{ currency(selected.totalPagar ?? 0) }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Invalidacion</p>
                          <p class="mt-2 text-sm font-bold text-slate-950">{{ invalidacionLabel(selected) }}</p>
                          <p class="mt-1 text-xs text-slate-500">{{ invalidacionDeadline(selected) }}</p>
                        </div>
                      </div>

                      <div class="rounded-md border border-slate-200 bg-white p-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p class="text-sm font-semibold text-slate-950">Respuesta resumida de Hacienda</p>
                            <p class="mt-1 text-sm text-slate-600">{{ selectedMhSummary.descripcionMsg }}</p>
                          </div>
                          <button
                            class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            type="button"
                            @click="copyText(selectedMhSummary.sello)"
                          >
                            Copiar sello
                          </button>
                        </div>
                        <p class="mt-3 break-all font-mono text-xs text-slate-600">{{ selectedMhSummary.sello }}</p>
                        <ul v-if="selectedObservations.length" class="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-700">
                          <li v-for="observation in selectedObservations" :key="observation">{{ observation }}</li>
                        </ul>
                      </div>

                      <div class="rounded-md border border-slate-200 bg-white">
                        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                          <h4 class="text-sm font-semibold text-slate-950">Intentos de transmision</h4>
                          <span class="text-xs text-slate-500">{{ selectedAttempts.length }} intento{{ selectedAttempts.length === 1 ? '' : 's' }}</span>
                        </div>
                        <div class="divide-y divide-slate-100">
                          <div v-for="attempt in selectedAttempts" :key="attempt.id" class="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[80px_1fr_90px_120px_100px]">
                            <p class="font-semibold text-slate-950">#{{ attempt.attempt_number }}</p>
                            <p class="min-w-0 break-all text-slate-600">{{ attempt.endpoint ?? 'Sin endpoint' }}</p>
                            <p class="text-slate-700">HTTP {{ attempt.http_status ?? '-' }}</p>
                            <p class="font-semibold text-slate-900">{{ attempt.result_status ?? '-' }}</p>
                            <p class="text-slate-500">{{ attempt.duration_ms ?? 0 }} ms</p>
                          </div>
                          <p v-if="selectedAttempts.length === 0" class="px-4 py-4 text-sm text-slate-500">Sin intentos registrados.</p>
                        </div>
                      </div>

                      <div class="grid gap-4 xl:grid-cols-3">
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-slate-950">Documento enviado</h4>
                            <button class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200" type="button" @click="copyText(selectedPayloadJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedPayloadJson }}</pre>
                        </div>
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-slate-950">Documento procesado</h4>
                            <button class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200" type="button" @click="copyText(selectedSignedBundleJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedSignedBundleJson }}</pre>
                        </div>
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-slate-950">Respuesta MH</h4>
                            <button class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200" type="button" @click="copyText(selectedMhJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedMhJson }}</pre>
                        </div>
                      </div>

                      <div class="rounded-md border border-slate-200 bg-white">
                        <div class="border-b border-slate-100 px-4 py-3">
                          <h4 class="text-sm font-semibold text-slate-950">Historial interno</h4>
                        </div>
                        <div class="divide-y divide-slate-100">
                          <div v-for="entry in history" :key="`${entry.event}-${entry.created_at}`" class="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <p class="font-semibold text-slate-900">{{ entry.event }}</p>
                            <p class="text-slate-500">{{ formatDate(entry.created_at) }}</p>
                          </div>
                          <p v-if="history.length === 0" class="px-4 py-4 text-sm text-slate-500">Sin eventos internos registrados.</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="loading" class="border-t border-slate-100 bg-slate-50">
          <UiLoadingMark label="Cargando respuesta de los DTE emitidos" />
        </div>
        <p v-if="emptyState" class="border-t border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-500">No hay DTE para los filtros actuales.</p>
      </div>
    </UiCard>
  </section>
</template>
