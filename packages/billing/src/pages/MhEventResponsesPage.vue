<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  CoreDteClient,
  type MhFiscalEventSummary,
  type PaginationMeta
} from '@stelfaro/api-client';
import { fiscalDateTime } from '@stelfaro/shared';
import { UiButton, UiCard, UiLoadingMark, UiSearchInput, UiSelect } from '@stelfaro/ui';
import BillingPaginationBar from '../components/BillingPaginationBar.vue';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

const pageSize = 20;
const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const detailLoading = ref(false);
const error = ref<string | null>(null);
const query = ref('');
const estado = ref('');
const eventType = ref('');
const page = ref(1);
const meta = ref<PaginationMeta | null>(null);
const events = ref<MhFiscalEventSummary[]>([]);
const selected = ref<MhFiscalEventSummary | null>(null);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
const eventTypeOptions = [
  { value: '', label: 'Todos' },
  { value: 'invalidacion', label: 'Invalidacion' },
  { value: 'contingencia', label: 'Contingencia' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'operaciones_especiales', label: 'Operaciones especiales' }
];
const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'accepted', label: 'Aceptados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'sent', label: 'Transmitidos' },
  { value: 'signed', label: 'Firmados' },
  { value: 'draft', label: 'Borradores' }
];

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
  estado: translateStatus(String(mhValue(['estado', 'status']) ?? selected.value?.transmission?.mh_estado ?? selected.value?.estado ?? 'Sin estado')),
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
  page.value = 1;
  searchTimer = window.setTimeout(() => void loadEvents(), 250);
});

watch([estado, eventType], () => {
  page.value = 1;
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
      limit: pageSize,
      page: page.value
    });
    events.value = response.data;
    meta.value = response.meta ?? fallbackMeta(events.value.length, page.value);

    if (!selected.value && events.value[0]) {
      await selectEvent(events.value[0]);
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar respuestas de eventos MH.';
  } finally {
    loading.value = false;
  }
}

function fallbackMeta(total: number, currentPage: number): PaginationMeta {
  return {
    current_page: currentPage,
    per_page: pageSize,
    last_page: 1,
    total,
    from: total === 0 ? 0 : 1,
    to: total,
    has_more_pages: false
  };
}

function goToPage(nextPage: number): void {
  if (nextPage === page.value) return;
  page.value = nextPage;
  void loadEvents();
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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  ready_to_sign: 'Listo para firmar',
  signed: 'Firmado',
  ready_to_send: 'Listo para enviar',
  sent: 'Transmitido',
  received_by_mh: 'Recibido por Hacienda',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  invalidated: 'Invalidado',
  contingency: 'Contingencia',
  recibido: 'Recibido',
  procesado: 'Procesado',
  rechazado: 'Rechazado',
};

function translateStatus(raw: string): string {
  return STATUS_LABELS[raw.trim().toLowerCase()] ?? raw;
}

function rawStatus(event: MhFiscalEventSummary | null): string {
  if (!event) return '';
  const mhStatus = event.transmission?.status ?? event.mh_response?.status;
  return String(mhStatus || event.estado).toLowerCase();
}

function statusLabel(event: MhFiscalEventSummary | null): string {
  if (!event) return 'Sin evento';
  return translateStatus(rawStatus(event));
}

function statusClass(event: MhFiscalEventSummary | null): string {
  const status = rawStatus(event);
  if (status.includes('accept') || status.includes('proces') || event?.estado === 'accepted') return 'bg-success-soft text-success';
  if (status.includes('reject') || status.includes('rech') || event?.estado === 'rejected') return 'bg-danger-soft text-danger';
  return 'bg-surface-muted text-muted';
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
  return fiscalDateTime(value);
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
      <h2 class="text-2xl font-bold text-text">Eventos transmitidos</h2>
    </div>

    <p v-if="error" class="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

    <UiCard>
      <div class="grid gap-4 p-1 md:grid-cols-[minmax(0,1fr)_220px_220px_120px] md:items-end">
        <UiSearchInput
          v-model="query"
          label="Buscar evento"
          placeholder="Codigo, sello, empresa o DTE relacionado"
          @search="loadEvents"
        />

        <UiSelect v-model="eventType" label="Tipo evento" :options="eventTypeOptions" />

        <UiSelect v-model="estado" label="Estado" :options="statusOptions" />

        <div class="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted">
          <p class="text-xs font-semibold uppercase text-muted">Resultados</p>
          <p class="mt-1 text-lg font-bold text-text">{{ meta?.total ?? events.length }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard>
      <div v-if="meta && meta.last_page > 1" class="border-b border-line pb-3">
        <BillingPaginationBar :meta="meta" :loading="loading" @page="goToPage" />
      </div>

      <div class="overflow-hidden rounded-md border border-line">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-line text-sm">
            <thead class="bg-surface-muted">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Fecha</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Empresa</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Evento</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Estado MH</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Sello</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Mensaje</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase text-muted">Intentos</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-muted">Accion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line bg-surface">
              <template v-for="event in events" :key="event.id">
                <tr class="sf-interactive-row" :class="selected?.id === event.id ? 'bg-primary-soft' : ''">
                  <td class="whitespace-nowrap px-4 py-4 text-muted">
                    <p>{{ formatDate(event.processed_at ?? event.transmitted_at ?? event.created_at) }}</p>
                    <p class="mt-1 text-xs text-soft">ID #{{ event.id }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="font-semibold text-text">{{ event.empresa?.nombre_comercial ?? 'Empresa' }}</p>
                    <p class="mt-1 text-xs text-muted">{{ event.empresa?.nit ?? 'Sin NIT' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="font-semibold text-text">{{ eventTypeLabel(event.eventType) }}</p>
                    <p class="mt-1 max-w-xs truncate text-xs text-muted">{{ event.codigoGeneracion ?? event.numeroControl ?? 'Sin codigo' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <span class="inline-flex rounded px-2 py-1 text-xs font-semibold" :class="statusClass(event)">
                      {{ statusLabel(event) }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <p class="max-w-[220px] truncate text-xs font-medium text-muted">{{ event.selloRecibido ?? event.transmission?.receipt_stamp ?? 'Sin sello' }}</p>
                  </td>
                  <td class="px-4 py-4">
                    <p class="max-w-[280px] truncate text-xs text-muted">
                      {{ event.transmission?.descripcion_msg ?? event.errorMessage ?? 'Sin mensaje MH' }}
                    </p>
                  </td>
                  <td class="px-4 py-4 text-center text-muted">
                    {{ event.transmission_attempts?.length ?? 0 }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right">
                    <UiButton type="button" variant="secondary" :disabled="detailLoading && selected?.id === event.id" @click="selectEvent(event)">
                      {{ selected?.id === event.id ? 'Auditoria abierta' : 'Ver auditoria' }}
                    </UiButton>
                  </td>
                </tr>

                <tr v-if="selected?.id === event.id">
                  <td colspan="8" class="bg-surface-muted px-4 py-5">
                    <div class="space-y-5">
                      <div class="flex flex-col gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-lg font-bold text-text">{{ eventTypeLabel(selected.eventType) }}</h3>
                          <span class="rounded px-2 py-1 text-xs font-semibold" :class="statusClass(selected)">{{ selectedMhSummary.estado }}</span>
                        </div>
                        <p class="text-sm text-muted">{{ selected.empresa?.razon_social ?? selected.empresa?.nombre_comercial }}</p>
                        <p class="break-all font-mono text-xs font-semibold text-text">{{ selected.numeroControl ?? 'Sin numero de control' }}</p>
                        <p class="break-all font-mono text-xs text-muted">{{ selected.codigoGeneracion ?? 'Sin codigo de generacion' }}</p>
                      </div>

                      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <div class="rounded-md border border-line bg-surface p-3">
                          <p class="text-[11px] font-semibold uppercase text-muted">Estado MH</p>
                          <p class="mt-2 break-all text-sm font-bold text-text">{{ selectedMhSummary.estado }}</p>
                        </div>
                        <div class="rounded-md border border-line bg-surface p-3">
                          <p class="text-[11px] font-semibold uppercase text-muted">Codigo mensaje</p>
                          <p class="mt-2 break-all text-sm font-bold text-text">{{ selectedMhSummary.codigoMsg }}</p>
                        </div>
                        <div class="rounded-md border border-line bg-surface p-3">
                          <p class="text-[11px] font-semibold uppercase text-muted">Procesado</p>
                          <p class="mt-2 text-sm font-bold text-text">{{ formatDate(selectedMhSummary.fecProcesamiento) }}</p>
                        </div>
                        <div class="rounded-md border border-line bg-surface p-3">
                          <p class="text-[11px] font-semibold uppercase text-muted">Ambiente</p>
                          <p class="mt-2 text-sm font-bold text-text">{{ selected.ambiente }}</p>
                        </div>
                        <div class="rounded-md border border-line bg-surface p-3">
                          <p class="text-[11px] font-semibold uppercase text-muted">Version</p>
                          <p class="mt-2 text-sm font-bold text-text">{{ selected.schemaVersion }}</p>
                        </div>
                      </div>

                      <div class="rounded-md border border-line bg-surface p-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p class="text-sm font-semibold text-text">Respuesta resumida de Hacienda</p>
                            <p class="mt-1 text-sm text-muted">{{ selectedMhSummary.descripcionMsg }}</p>
                          </div>
                          <button class="rounded-md bg-surface-muted px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedMhSummary.sello)">
                            Copiar sello
                          </button>
                        </div>
                        <p class="mt-3 break-all font-mono text-xs text-muted">{{ selectedMhSummary.sello }}</p>
                        <ul v-if="selectedObservations.length" class="mt-3 list-disc space-y-1 pl-5 text-sm text-danger">
                          <li v-for="observation in selectedObservations" :key="observation">{{ observation }}</li>
                        </ul>
                      </div>

                      <div class="rounded-md border border-line bg-surface">
                        <div class="flex items-center justify-between border-b border-line px-4 py-3">
                          <h4 class="text-sm font-semibold text-text">Intentos de transmision del evento</h4>
                          <span class="text-xs text-muted">{{ selectedAttempts.length }} intento{{ selectedAttempts.length === 1 ? '' : 's' }}</span>
                        </div>
                        <div class="divide-y divide-line">
                          <div v-for="attempt in selectedAttempts" :key="attempt.id" class="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[80px_1fr_90px_120px_100px]">
                            <p class="font-semibold text-text">#{{ attempt.attempt_number }}</p>
                            <p class="min-w-0 break-all text-muted">{{ attempt.endpoint ?? 'Sin endpoint' }}</p>
                            <p class="text-muted">HTTP {{ attempt.http_status ?? '-' }}</p>
                            <p class="font-semibold text-text">{{ attempt.result_status ?? '-' }}</p>
                            <p class="text-muted">{{ attempt.duration_ms ?? 0 }} ms</p>
                          </div>
                          <p v-if="selectedAttempts.length === 0" class="px-4 py-4 text-sm text-muted">Sin intentos registrados.</p>
                        </div>
                      </div>

                      <div class="grid gap-4 xl:grid-cols-3">
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-text">Evento enviado</h4>
                            <button class="rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedEventJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedEventJson }}</pre>
                        </div>
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-text">Evento firmado + sello</h4>
                            <button class="rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedSignedJson)">Copiar</button>
                          </div>
                          <pre class="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedSignedJson }}</pre>
                        </div>
                        <div>
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <h4 class="text-sm font-semibold text-text">Respuesta MH evento</h4>
                            <button class="rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedMhJson)">Copiar</button>
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

        <div v-if="loading" class="border-t border-line bg-surface-muted">
          <UiLoadingMark label="Cargando respuesta de eventos" />
        </div>
        <p v-if="emptyState" class="border-t border-line bg-surface-muted px-4 py-5 text-sm text-muted">No hay eventos MH para los filtros actuales.</p>
      </div>

      <div v-if="meta && meta.last_page > 1" class="border-t border-line pt-3">
        <BillingPaginationBar :meta="meta" :loading="loading" @page="goToPage" />
      </div>
    </UiCard>
  </section>
</template>
