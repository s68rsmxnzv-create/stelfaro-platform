<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CoreDteClient,
  type DteDraftSummary,
  type DteHistoryEntry,
  type PaginationMeta
} from '@stelfaro/api-client';
import { currency, fiscalDateTime } from '@stelfaro/shared';
import { ChevronDown } from 'lucide-vue-next';
import { UiButton, UiCard, UiLoadingMark, UiModalShell, UiSearchInput, UiSelect } from '@stelfaro/ui';
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
const page = ref(1);
const meta = ref<PaginationMeta | null>(null);
const documents = ref<DteDraftSummary[]>([]);
const selected = ref<DteDraftSummary | null>(null);
const history = ref<DteHistoryEntry[]>([]);
const showDetailModal = ref(false);
const showTechnical = ref(false);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'accepted', label: 'Aceptados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'sent', label: 'Transmitidos' },
  { value: 'signed', label: 'Firmados' }
];

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
  estado: translateStatus(String(mhValue(['estado', 'status']) ?? selected.value?.transmission?.mh_estado ?? selected.value?.estado ?? 'Sin estado')),
  sello: String(mhValue(['selloRecibido', 'receipt_stamp']) ?? selected.value?.selloRecibido ?? selected.value?.transmission?.receipt_stamp ?? 'Sin sello'),
  codigoMsg: String(mhValue(['codigoMsg', 'codigo_msg']) ?? selected.value?.transmission?.codigo_msg ?? 'Sin codigo'),
  clasificaMsg: String(mhValue(['clasificaMsg', 'clasifica_msg']) ?? 'Sin clasificacion'),
  descripcionMsg: String(mhValue(['descripcionMsg', 'descripcion_msg', 'message']) ?? selected.value?.transmission?.descripcion_msg ?? selected.value?.errorMessage ?? 'Sin mensaje'),
  fecProcesamiento: String(mhValue(['fecProcesamiento', 'processed_at']) ?? selected.value?.processed_at ?? selected.value?.created_at ?? ''),
}));
const emptyState = computed(() => !loading.value && documents.value.length === 0);

void loadDocuments();

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  page.value = 1;
  searchTimer = window.setTimeout(() => void loadDocuments(), 250);
});

watch(estado, () => {
  page.value = 1;
  void loadDocuments();
});

watch(showDetailModal, (open) => {
  if (!open) showTechnical.value = false;
});

async function loadDocuments(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.documents({
      q: query.value.trim(),
      estado: estado.value,
      limit: pageSize,
      page: page.value
    });
    documents.value = response.data;
    meta.value = response.meta ?? fallbackMeta(documents.value.length, page.value);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar respuestas MH.';
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
  void loadDocuments();
}

async function openDetail(document: DteDraftSummary): Promise<void> {
  showDetailModal.value = true;
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

function rawStatus(document: DteDraftSummary | null): string {
  if (!document) return '';
  const mhStatus = document.transmission?.status ?? document.mh_response?.status;
  return String(mhStatus || document.estado).toLowerCase();
}

function statusLabel(document: DteDraftSummary | null): string {
  if (!document) return 'Sin DTE';
  return translateStatus(rawStatus(document));
}

function statusClass(document: DteDraftSummary | null): string {
  const status = rawStatus(document);
  if (status.includes('accept') || status.includes('acept') || document?.estado === 'accepted') return 'bg-success-soft text-success';
  if (status.includes('reject') || status.includes('rech') || document?.estado === 'rejected') return 'bg-danger-soft text-danger';
  return 'bg-surface-muted text-muted';
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
  if (document?.invalidacion?.eligible) return 'bg-success-soft text-success';
  if (document?.invalidacion?.status === 'expired') return 'bg-danger-soft text-danger';
  return 'bg-warning-soft text-warning';
}

function invalidacionDeadline(document: DteDraftSummary | null): string {
  if (!document?.invalidacion?.deadline) return 'Sin limite';

  return formatDate(document.invalidacion.deadline);
}

const HISTORY_EVENT_LABELS: Record<string, string> = {
  draft_created: 'Borrador creado',
  ready_to_sign: 'Listo para firmar',
  signed: 'Documento firmado',
  DocumentSigned: 'Documento firmado',
  ready_to_send: 'Listo para transmitir',
  sent: 'Transmitido a Hacienda',
  received_by_mh: 'Recibido por Hacienda',
  accepted: 'Aceptado por Hacienda',
  rejected: 'Rechazado por Hacienda',
  mh_rejected: 'Rechazado por Hacienda',
  invalidated: 'Invalidado',
  contingency: 'Marcado en contingencia',
  correlativo_conflict: 'Conflicto de correlativo',
};

function historyEventLabel(event: string): string {
  return HISTORY_EVENT_LABELS[event] ?? event.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function formatDate(value?: string | null): string {
  return fiscalDateTime(value);
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
    <div>
      <h2 class="text-2xl font-bold text-text">Documentos transmitidos</h2>
    </div>

    <p v-if="error" class="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

    <UiCard>
      <div class="grid gap-4 p-1 md:grid-cols-[minmax(0,1fr)_240px_120px] md:items-end">
        <UiSearchInput
          v-model="query"
          label="Buscar DTE"
          placeholder="Numero, codigo, sello, empresa o NIT"
          @search="loadDocuments"
        />

        <UiSelect v-model="estado" label="Estado" :options="statusOptions" />

        <div class="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted">
          <p class="text-xs font-semibold uppercase text-muted">Resultados</p>
          <p class="mt-1 text-lg font-bold text-text">{{ meta?.total ?? documents.length }}</p>
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
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Documento</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Estado MH</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">Invalidacion</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-muted">Total</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-muted">Accion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line bg-surface">
              <tr
                v-for="document in documents"
                :key="document.id"
                class="sf-interactive-row"
                @click="openDetail(document)"
              >
                <td class="whitespace-nowrap px-4 py-4 text-muted">
                  <p>{{ formatDate(document.processed_at ?? document.created_at) }}</p>
                  <p class="mt-1 text-xs text-soft">ID #{{ document.id }}</p>
                </td>
                <td class="px-4 py-4">
                  <p class="font-semibold text-text">{{ document.empresa?.nombre_comercial ?? 'Empresa' }}</p>
                  <p class="mt-1 text-xs text-muted">{{ document.empresa?.nit ?? 'Sin NIT' }}</p>
                </td>
                <td class="px-4 py-4">
                  <p class="font-semibold text-text">{{ document.tipoDte }} · {{ document.numeroControl }}</p>
                  <p class="mt-1 text-xs text-muted">{{ attemptsCount(document) }} intento{{ attemptsCount(document) === 1 ? '' : 's' }} de transmision</p>
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
                </td>
                <td class="whitespace-nowrap px-4 py-4 text-right font-semibold text-text">{{ currency(document.totalPagar ?? 0) }}</td>
                <td class="whitespace-nowrap px-4 py-4 text-right">
                  <UiButton type="button" variant="secondary" @click.stop="openDetail(document)">Ver detalle</UiButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="loading" class="border-t border-line bg-surface-muted">
          <UiLoadingMark label="Cargando respuesta de los DTE emitidos" />
        </div>
        <p v-if="emptyState" class="border-t border-line bg-surface-muted px-4 py-5 text-sm text-muted">No hay DTE para los filtros actuales.</p>
      </div>

      <div v-if="meta && meta.last_page > 1" class="border-t border-line pt-3">
        <BillingPaginationBar :meta="meta" :loading="loading" @page="goToPage" />
      </div>
    </UiCard>

    <UiModalShell
      :open="showDetailModal"
      :title="selected?.empresa?.nombre_comercial ?? 'Detalle del DTE'"
      :description="selected ? `${selected.tipoDte} · ${selected.numeroControl}` : null"
      max-width="max-w-4xl"
      mobile-fullscreen
      @close="showDetailModal = false"
    >
      <template #header-actions>
        <a
          v-if="selected?.consultaPublicaUrl"
          :href="selected.consultaPublicaUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold tracking-wide text-primary-contrast transition-colors duration-200 hover:bg-primary-hover focus:outline-none focus:ring focus:ring-primary"
        >
          Consultar en Hacienda
        </a>
      </template>

      <div v-if="detailLoading && !selected" class="py-10">
        <UiLoadingMark label="Cargando detalle del DTE" />
      </div>

      <div v-else-if="selected" class="space-y-5">
        <p class="break-all font-mono text-xs text-muted">{{ selected.codigoGeneracion }}</p>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-md border border-line bg-surface p-3">
            <p class="text-[11px] font-semibold uppercase text-muted">Estado MH</p>
            <span class="mt-2 inline-flex rounded px-2 py-1 text-sm font-bold" :class="statusClass(selected)">{{ selectedMhSummary.estado }}</span>
          </div>
          <div class="rounded-md border border-line bg-surface p-3">
            <p class="text-[11px] font-semibold uppercase text-muted">Invalidacion</p>
            <p class="mt-2 text-sm font-bold text-text">{{ invalidacionLabel(selected) }}</p>
            <p class="mt-1 text-xs text-muted">{{ invalidacionDeadline(selected) }}</p>
          </div>
          <div class="rounded-md border border-line bg-surface p-3">
            <p class="text-[11px] font-semibold uppercase text-muted">Total</p>
            <p class="mt-2 text-sm font-bold text-text">{{ currency(selected.totalPagar ?? 0) }}</p>
          </div>
          <div class="rounded-md border border-line bg-surface p-3">
            <p class="text-[11px] font-semibold uppercase text-muted">Procesado</p>
            <p class="mt-2 text-sm font-bold text-text">{{ formatDate(selectedMhSummary.fecProcesamiento) }}</p>
          </div>
          <div class="rounded-md border border-line bg-surface p-3">
            <p class="text-[11px] font-semibold uppercase text-muted">Codigo mensaje</p>
            <p class="mt-2 text-sm font-bold text-text">{{ selectedMhSummary.codigoMsg }}</p>
          </div>
          <div class="rounded-md border border-line bg-surface p-3">
            <p class="text-[11px] font-semibold uppercase text-muted">Clasificacion</p>
            <p class="mt-2 text-sm font-bold text-text">{{ selectedMhSummary.clasificaMsg }}</p>
          </div>
        </div>

        <div class="rounded-md border border-line bg-surface p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-text">Respuesta resumida de Hacienda</p>
              <p class="mt-1 text-sm text-muted">{{ selectedMhSummary.descripcionMsg }}</p>
            </div>
            <button
              class="rounded-md bg-surface-muted px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-strong"
              type="button"
              @click="copyText(selectedMhSummary.sello)"
            >
              Copiar sello
            </button>
          </div>
          <p class="mt-3 break-all font-mono text-xs text-muted">{{ selectedMhSummary.sello }}</p>
          <ul v-if="selectedObservations.length" class="mt-3 list-disc space-y-1 pl-5 text-sm text-danger">
            <li v-for="observation in selectedObservations" :key="observation">{{ observation }}</li>
          </ul>
        </div>

        <div class="border-t border-line pt-3">
          <button
            type="button"
            class="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-soft hover:text-muted"
            @click="showTechnical = !showTechnical"
          >
            Detalles técnicos
            <ChevronDown class="h-4 w-4 transition-transform" :class="showTechnical ? 'rotate-180' : ''" />
          </button>

          <div v-if="showTechnical" class="mt-4 space-y-5">
            <div class="rounded-md border border-line bg-surface">
              <div class="flex items-center justify-between border-b border-line px-4 py-3">
                <h4 class="text-sm font-semibold text-text">Intentos de transmision</h4>
                <span class="text-xs text-muted">{{ selectedAttempts.length }} intento{{ selectedAttempts.length === 1 ? '' : 's' }}</span>
              </div>
              <div class="divide-y divide-line">
                <div v-for="attempt in selectedAttempts" :key="attempt.id" class="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[70px_1fr_80px_100px_80px]">
                  <p class="font-semibold text-text">#{{ attempt.attempt_number }}</p>
                  <p class="min-w-0 break-all text-muted">{{ attempt.endpoint ?? 'Sin endpoint' }}</p>
                  <p class="text-muted">HTTP {{ attempt.http_status ?? '-' }}</p>
                  <p class="font-semibold text-text">{{ attempt.result_status ?? '-' }}</p>
                  <p class="text-muted">{{ attempt.duration_ms ?? 0 }} ms</p>
                </div>
                <p v-if="selectedAttempts.length === 0" class="px-4 py-4 text-sm text-muted">Sin intentos registrados.</p>
              </div>
            </div>

            <div class="rounded-md border border-line bg-surface">
              <div class="border-b border-line px-4 py-3">
                <h4 class="text-sm font-semibold text-text">Historial interno</h4>
              </div>
              <div class="divide-y divide-line">
                <div v-for="entry in history" :key="`${entry.event}-${entry.created_at}`" class="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p class="font-semibold text-text">{{ historyEventLabel(entry.event) }}</p>
                  <p class="text-muted">{{ formatDate(entry.created_at) }}</p>
                </div>
                <p v-if="history.length === 0" class="px-4 py-4 text-sm text-muted">Sin eventos internos registrados.</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h4 class="text-sm font-semibold text-text">Documento enviado</h4>
                  <button class="rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedPayloadJson)">Copiar</button>
                </div>
                <pre class="max-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedPayloadJson }}</pre>
              </div>
              <div>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h4 class="text-sm font-semibold text-text">Documento procesado</h4>
                  <button class="rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedSignedBundleJson)">Copiar</button>
                </div>
                <pre class="max-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedSignedBundleJson }}</pre>
              </div>
              <div>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h4 class="text-sm font-semibold text-text">Respuesta MH</h4>
                  <button class="rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-strong" type="button" @click="copyText(selectedMhJson)">Copiar</button>
                </div>
                <pre class="max-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">{{ selectedMhJson }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UiModalShell>
  </section>
</template>
