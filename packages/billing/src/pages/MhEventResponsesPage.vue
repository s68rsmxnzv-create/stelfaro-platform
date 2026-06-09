<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  CoreDteClient,
  type MhFiscalEventSummary
} from '@stelfaro/api-client';
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
const error = ref<string | null>(null);
const query = ref('');
const estado = ref('');
const eventType = ref('');
const events = ref<MhFiscalEventSummary[]>([]);
const selected = ref<MhFiscalEventSummary | null>(null);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const selectedAttempts = computed(() => selected.value?.transmission_attempts ?? []);
const selectedRawMh = computed(() => selected.value?.mh_response
  ?? selected.value?.transmission?.raw_response
  ?? selected.value?.transmission
  ?? {});
const selectedMhJson = computed(() => JSON.stringify(selectedRawMh.value, null, 2));
const selectedEventJson = computed(() => JSON.stringify(selected.value?.payload ?? {}, null, 2));
const selectedSignedJson = computed(() => JSON.stringify({
  evento: selected.value?.payload ?? {},
  firma: selected.value?.signature ?? null,
  selloRecibido: selected.value?.selloRecibido ?? selected.value?.transmission?.receipt_stamp ?? null,
  estadoMH: mhValue(['estado', 'status']) ?? selected.value?.transmission?.mh_estado ?? null,
}, null, 2));
const selectedObservations = computed(() => normalizeStringList(
  mhValue(['observaciones']) ?? selected.value?.transmission?.observaciones ?? []
));
const selectedMhSummary = computed(() => ({
  estado: String(mhValue(['estado', 'status']) ?? selected.value?.transmission?.mh_estado ?? selected.value?.estado ?? 'Sin estado'),
  sello: String(mhValue(['selloRecibido', 'receipt_stamp']) ?? selected.value?.selloRecibido ?? selected.value?.transmission?.receipt_stamp ?? 'Sin sello'),
  codigoMsg: String(mhValue(['codigoMsg', 'codigo_msg']) ?? selected.value?.transmission?.codigo_msg ?? 'Sin codigo'),
  descripcionMsg: String(mhValue(['descripcionMsg', 'descripcion_msg', 'message']) ?? selected.value?.transmission?.descripcion_msg ?? selected.value?.errorMessage ?? 'Sin mensaje'),
  fecProcesamiento: String(mhValue(['fhProcesamiento', 'fecProcesamiento', 'processed_at']) ?? selected.value?.processed_at ?? selected.value?.transmitted_at ?? selected.value?.created_at ?? ''),
}));
const emptyState = computed(() => !loading.value && events.value.length === 0);

onMounted(() => {
  void loadEvents();
});

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadEvents(), 250);
});

watch([estado, eventType], () => {
  void loadEvents();
});

async function loadEvents(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.mhEvents({
      q: query.value.trim(),
      estado: estado.value,
      event_type: eventType.value,
      limit: 40
    });
    events.value = response.data;

    if (!selected.value && events.value[0]) {
      await selectEvent(events.value[0]);
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar respuestas de eventos MH.';
  } finally {
    loading.value = false;
  }
}

async function selectEvent(event: MhFiscalEventSummary): Promise<void> {
  detailLoading.value = true;
  error.value = null;

  try {
    selected.value = await client.value.mhEvent(event.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el detalle del evento MH.';
  } finally {
    detailLoading.value = false;
  }
}

function statusLabel(event: MhFiscalEventSummary | null): string {
  if (!event) return 'Sin evento';
  const mhStatus = event.transmission?.status ?? event.mh_response?.status;
  return String(mhStatus || event.estado).toUpperCase();
}

function statusClass(event: MhFiscalEventSummary | null): string {
  const status = statusLabel(event);
  if (status.includes('ACCEPTED') || status.includes('PROCES') || event?.estado === 'accepted') return 'bg-emerald-50 text-emerald-700';
  if (status.includes('REJECTED') || status.includes('RECH') || event?.estado === 'rejected') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function eventTypeLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    invalidacion: 'Invalidacion',
    contingencia: 'Contingencia',
    retorno: 'Retorno',
    operaciones_especiales: 'Operaciones especiales',
  };

  return labels[String(value ?? '')] ?? String(value ?? 'Evento');
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
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
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}

function copyText(value: string): void {
  void navigator.clipboard?.writeText(value);
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Respuestas eventos MH</p>
      <h2 class="mt-1 text-2xl font-bold text-slate-950">Eventos transmitidos</h2>
      <p class="mt-2 text-sm text-slate-600">
        Consulta estado, sello, intentos y respuesta de Hacienda para eventos fiscales.
      </p>
    </div>

    <p v-if="error" class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>

    <UiCard>
      <div class="grid gap-4 p-1 md:grid-cols-[minmax(0,1fr)_220px_220px_120px] md:items-end">
        <UiSearchInput
          v-model="query"
          label="Buscar evento"
          placeholder="Codigo, sello, empresa o DTE relacionado"
          @search="loadEvents"
        />

        <div>
          <label class="text-sm font-semibold text-slate-900" for="event-type">Tipo evento</label>
          <select
            id="event-type"
            v-model="eventType"
            class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            <option value="invalidacion">Invalidacion</option>
            <option value="contingencia">Contingencia</option>
            <option value="retorno">Retorno</option>
            <option value="operaciones_especiales">Operaciones especiales</option>
          </select>
        </div>

        <div>
          <label class="text-sm font-semibold text-slate-900" for="event-status">Estado</label>
          <select
            id="event-status"
            v-model="estado"
            class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">Todos</option>
            <option value="accepted">Aceptados</option>
            <option value="rejected">Rechazados</option>
            <option value="sent">Transmitidos</option>
            <option value="signed">Firmados</option>
            <option value="draft">Borradores</option>
          </select>
        </div>

        <div class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <p class="text-xs font-semibold uppercase text-slate-500">Resultados</p>
          <p class="mt-1 text-lg font-bold text-slate-950">{{ events.length }}</p>
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
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Evento</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Estado MH</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Sello</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Mensaje</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">Intentos</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Accion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <template v-for="event in events" :key="event.id">
                <tr class="transition hover:bg-sky-50/60" :class="selected?.id === event.id ? 'bg-sky-50' : ''">
                  <td class="whitespace-nowrap px-4 py-4 text-slate-600">
                    <p>{{ formatDate(event.processed_at ?? event.transmitted_at ?? event.created_at) }}</p>
                    <p class="mt-1 text-xs text-slate-400">ID #{{ event.id }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="font-semibold text-slate-950">{{ event.empresa?.nombre_comercial ?? 'Empresa' }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ event.empresa?.nit ?? 'Sin NIT' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="font-semibold text-slate-950">{{ eventTypeLabel(event.eventType) }}</p>
                    <p class="mt-1 max-w-xs truncate text-xs text-slate-500">{{ event.codigoGeneracion ?? event.numeroControl ?? 'Sin codigo' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <span class="inline-flex rounded px-2 py-1 text-xs font-semibold" :class="statusClass(event)">
                      {{ statusLabel(event) }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <p class="max-w-[220px] truncate text-xs font-medium text-slate-700">{{ event.selloRecibido ?? event.transmission?.receipt_stamp ?? 'Sin sello' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="max-w-[280px] truncate text-xs text-slate-600">
                      {{ event.transmission?.descripcion_msg ?? event.errorMessage ?? 'Sin mensaje MH' }}
                    </p>
                  </td>
                  <td class="px-4 py-4 text-center text-slate-700">
                    {{ event.transmission_attempts?.length ?? 0 }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right">
                    <UiButton type="button" variant="secondary" :disabled="detailLoading && selected?.id === event.id" @click="selectEvent(event)">
                      {{ selected?.id === event.id ? 'Auditoria abierta' : 'Ver auditoria' }}
                    </UiButton>
                  </td>
                </tr>

                <tr v-if="selected?.id === event.id">
                  <td colspan="8" class="bg-slate-50 px-4 py-5">
                    <div class="space-y-5">
                      <div class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-lg font-bold text-slate-950">{{ eventTypeLabel(selected.eventType) }}</h3>
                          <span class="rounded px-2 py-1 text-xs font-semibold" :class="statusClass(selected)">{{ selectedMhSummary.estado }}</span>
                        </div>
                        <p class="text-sm text-slate-600">{{ selected.empresa?.razon_social ?? selected.empresa?.nombre_comercial }}</p>
                        <p class="break-all font-mono text-xs font-semibold text-slate-900">{{ selected.numeroControl ?? 'Sin numero de control' }}</p>
                        <p class="break-all font-mono text-xs text-slate-500">{{ selected.codigoGeneracion ?? 'Sin codigo de generacion' }}</p>
                      </div>

                      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Estado MH</p>
                          <p class="mt-2 break-all text-sm font-bold text-slate-950">{{ selectedMhSummary.estado }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Codigo mensaje</p>
                          <p class="mt-2 break-all text-sm font-bold text-slate-950">{{ selectedMhSummary.codigoMsg }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Procesado</p>
                          <p class="mt-2 text-sm font-bold text-slate-950">{{ formatDate(selectedMhSummary.fecProcesamiento) }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Ambiente</p>
                          <p class="mt-2 text-sm font-bold text-slate-950">{{ selected.ambiente }}</p>
                        </div>
                        <div class="rounded-md border border-slate-200 bg-white p-3">
                          <p class="text-[11px] font-semibold uppercase text-slate-500">Version</p>
                          <p class="mt-2 text-sm font-bold text-slate-950">{{ selected.schemaVersion }}</p>
                        </div>
                      </div>

                      <div class="rounded-md border border-slate-200 bg-white p-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p class="text-sm font-semibold text-slate-950">Respuesta resumida de Hacienda</p>
                            <p class="mt-1 text-sm text-slate-600">{{ selectedMhSummary.descripcionMsg }}</p>
                          </div>
                          <button class="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200" type="button" @click="copyText(selectedMhSummary.sello)">
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
                          <h4 class="text-sm font-semibold text-slate-950">Intentos de transmision del evento</h4>
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
                            <h4 class="text-sm font-semibold text-slate-950">Evento enviado</h4>
                            <button class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200" type="button" @click="copyText(selectedEventJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedEventJson }}</pre>
                        </div>
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-slate-950">Evento firmado + sello</h4>
                            <button class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200" type="button" @click="copyText(selectedSignedJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedSignedJson }}</pre>
                        </div>
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-slate-950">Respuesta MH evento</h4>
                            <button class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200" type="button" @click="copyText(selectedMhJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedMhJson }}</pre>
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
          <UiLoadingMark label="Cargando respuesta de eventos" />
        </div>
        <p v-if="emptyState" class="border-t border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-500">No hay eventos MH para los filtros actuales.</p>
      </div>
    </UiCard>
  </section>
</template>
