<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CoreDteClient, type DteDraftSummary, type MhFiscalEventSummary, type PaginationMeta } from '@stelfaro/api-client';
import { currency, fiscalDateTime } from '@stelfaro/shared';
import { UiButton, UiCard, UiCodeBracketIcon, UiDocumentIcon, UiLoadingMark, UiSearchInput } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

type ArtifactTab = 'dte' | 'events';
type PageItem = number | 'ellipsis';

const supportedTypes = new Set(['01', '03', '05', '06', '14']);
const supportedEventTypes = new Set(['invalidacion']);
const pageSize = 10;
const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const activeTab = ref<ArtifactTab>('dte');
const loading = ref(false);
const openingPdfId = ref<number | null>(null);
const openingJsonId = ref<number | null>(null);
const openingEventPdfId = ref<number | null>(null);
const openingEventJsonId = ref<number | null>(null);
const error = ref<string | null>(null);
const query = ref('');
const tipoDte = ref('');
const documents = ref<DteDraftSummary[]>([]);
const events = ref<MhFiscalEventSummary[]>([]);
const dtePage = ref(1);
const eventPage = ref(1);
const dteMeta = ref<PaginationMeta | null>(null);
const eventMeta = ref<PaginationMeta | null>(null);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const emptyState = computed(() => {
  if (loading.value) return false;

  return activeTab.value === 'dte' ? documents.value.length === 0 : events.value.length === 0;
});

const currentMeta = computed(() => activeTab.value === 'dte' ? dteMeta.value : eventMeta.value);
const currentPage = computed(() => activeTab.value === 'dte' ? dtePage.value : eventPage.value);
const resultCount = computed(() => currentMeta.value?.total ?? (activeTab.value === 'dte' ? documents.value.length : events.value.length));
const paginationItems = computed<PageItem[]>(() => pageItems(currentMeta.value?.last_page ?? 1, currentPage.value));

onMounted(() => {
  void loadActiveTab();
});

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  resetPages();
  searchTimer = window.setTimeout(() => void loadActiveTab(), 250);
});

watch(tipoDte, () => {
  dtePage.value = 1;
  if (activeTab.value === 'dte') void loadDocuments();
});

watch(activeTab, () => {
  error.value = null;
  void loadActiveTab();
});

async function loadActiveTab(): Promise<void> {
  if (activeTab.value === 'events') {
    await loadEvents();
    return;
  }

  await loadDocuments();
}

async function loadDocuments(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.documents({
      q: query.value.trim(),
      estado: 'accepted',
      tipo_dte: tipoDte.value,
      limit: pageSize,
      page: dtePage.value
    });

    documents.value = response.data.filter((document) => supportedTypes.has(document.tipoDte));
    dteMeta.value = response.meta ?? fallbackMeta(documents.value.length, dtePage.value);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar comprobantes.';
  } finally {
    loading.value = false;
  }
}

async function loadEvents(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.mhEvents({
      q: query.value.trim(),
      estado: 'accepted',
      event_type: 'invalidacion',
      limit: pageSize,
      page: eventPage.value
    });

    events.value = response.data.filter((event) => supportedEventTypes.has(event.eventType));
    eventMeta.value = response.meta ?? fallbackMeta(events.value.length, eventPage.value);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar eventos.';
  } finally {
    loading.value = false;
  }
}

function resetPages(): void {
  dtePage.value = 1;
  eventPage.value = 1;
}

function goToPage(page: number): void {
  const lastPage = currentMeta.value?.last_page ?? 1;
  const nextPage = Math.min(Math.max(page, 1), lastPage);

  if (activeTab.value === 'dte') {
    if (nextPage === dtePage.value) return;
    dtePage.value = nextPage;
    void loadDocuments();
    return;
  }

  if (nextPage === eventPage.value) return;
  eventPage.value = nextPage;
  void loadEvents();
}

function pageItems(lastPage: number, page: number): PageItem[] {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages = new Set([1, 2, lastPage - 1, lastPage, page - 1, page, page + 1]);
  const visible = [...pages]
    .filter((item) => item >= 1 && item <= lastPage)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];

  for (const item of visible) {
    const previous = items[items.length - 1];
    if (typeof previous === 'number' && item - previous > 1) {
      items.push('ellipsis');
    }
    items.push(item);
  }

  return items;
}

function fallbackMeta(total: number, page: number): PaginationMeta {
  return {
    current_page: page,
    per_page: pageSize,
    last_page: 1,
    total,
    from: total === 0 ? 0 : 1,
    to: total,
    has_more_pages: false
  };
}

async function openPdf(document: DteDraftSummary): Promise<void> {
  if (!supportedTypes.has(document.tipoDte)) return;

  const target = window.open('about:blank', '_blank');
  openingPdfId.value = document.id;
  error.value = null;

  try {
    const pdf = await client.value.graphicRepresentationPdf(document.id);
    openBlob(target, pdf, 'PDF');
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el PDF.';
  } finally {
    openingPdfId.value = null;
  }
}

async function openEventPdf(event: MhFiscalEventSummary): Promise<void> {
  if (!supportedEventTypes.has(event.eventType)) return;

  const target = window.open('about:blank', '_blank');
  openingEventPdfId.value = event.id;
  error.value = null;

  try {
    const pdf = await client.value.mhEventGraphicRepresentationPdf(event.id);
    openBlob(target, pdf, 'PDF');
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el PDF del evento.';
  } finally {
    openingEventPdfId.value = null;
  }
}

async function openJson(document: DteDraftSummary): Promise<void> {
  if (!supportedTypes.has(document.tipoDte)) return;

  const target = window.open('about:blank', '_blank');
  openingJsonId.value = document.id;
  error.value = null;

  try {
    const detail = await client.value.document(document.id);
    const payload = detail.payload ?? detail.dte_json;

    if (!payload) {
      error.value = 'El documento no tiene JSON disponible.';
      if (target) target.close();
      return;
    }

    openJsonBlob(target, clientDteJson(detail, payload));
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el JSON.';
  } finally {
    openingJsonId.value = null;
  }
}

async function openEventJson(event: MhFiscalEventSummary): Promise<void> {
  if (!supportedEventTypes.has(event.eventType)) return;

  const target = window.open('about:blank', '_blank');
  openingEventJsonId.value = event.id;
  error.value = null;

  try {
    const detail = await client.value.mhEvent(event.id);

    if (!detail.payload) {
      error.value = 'El evento no tiene JSON disponible.';
      if (target) target.close();
      return;
    }

    openJsonBlob(target, clientEventJson(detail));
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el JSON del evento.';
  } finally {
    openingEventJsonId.value = null;
  }
}

function openBlob(target: Window | null, blob: Blob, label: string): void {
  const url = URL.createObjectURL(blob);

  if (target) {
    target.location.href = url;
    target.focus();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }

  URL.revokeObjectURL(url);
  error.value = `El navegador bloqueo la nueva pestana del ${label}.`;
}

function openJsonBlob(target: Window | null, payload: Record<string, unknown>): void {
  const json = JSON.stringify(payload, null, 2);
  openBlob(target, new Blob([json], { type: 'application/json;charset=utf-8' }), 'JSON');
}

function clientDteJson(detail: DteDraftSummary, payload: Record<string, unknown>): Record<string, unknown> {
  const bundle = asRecord(detail.signed_bundle);
  const bundlePayload = asRecord(bundle.payload);
  const dte = Object.keys(bundlePayload).length > 0 ? bundlePayload : payload;

  return {
    ...dte,
    firmaElectronica: stringValue(detail.signedDocument ?? bundle.firmaElectronica ?? bundle.firma),
    selloRecibido: stringValue(detail.selloRecibido ?? bundle.selloRecibido),
  };
}

function clientEventJson(detail: MhFiscalEventSummary): Record<string, unknown> {
  const bundle = asRecord(detail.signed_bundle);
  const bundlePayload = asRecord(bundle.payload);
  const event = Object.keys(bundlePayload).length > 0 ? bundlePayload : detail.payload;

  return {
    ...event,
    firmaElectronica: stringValue(detail.signedDocument ?? bundle.firmaElectronica ?? bundle.firma),
    selloRecibido: stringValue(detail.selloRecibido ?? bundle.selloRecibido),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function typeLabel(code: string): string {
  const labels: Record<string, string> = {
    '01': 'Factura electronica',
    '03': 'Credito fiscal',
    '05': 'Nota de credito',
    '06': 'Nota de debito',
    '14': 'Sujeto excluido'
  };

  return labels[code] ?? code;
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    invalidacion: 'Evento de invalidacion'
  };

  return labels[type] ?? type;
}

function formatDate(value?: string | null): string {
  return fiscalDateTime(value);
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Comprobantes</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-950">Representacion grafica</h2>
        <p class="mt-2 text-sm text-slate-600">
          Abre la version imprimible y el JSON final de documentos aceptados por Hacienda.
        </p>
      </div>
    </div>

    <p v-if="error" class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ error }}</p>

    <UiCard>
      <div class="space-y-4 p-1">
        <div class="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            class="rounded px-4 py-2 text-sm font-semibold transition"
            :class="activeTab === 'dte' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="activeTab = 'dte'"
          >
            DTE
          </button>
          <button
            type="button"
            class="rounded px-4 py-2 text-sm font-semibold transition"
            :class="activeTab === 'events' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'"
            @click="activeTab = 'events'"
          >
            Eventos
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px_120px] md:items-end">
          <UiSearchInput
            v-model="query"
            :label="activeTab === 'dte' ? 'Buscar comprobante' : 'Buscar evento'"
            placeholder="Numero, codigo, sello, empresa o NIT"
            @search="loadActiveTab"
          />

          <div v-if="activeTab === 'dte'">
            <label class="text-sm font-semibold text-slate-900" for="artifact-type">Tipo DTE</label>
            <select
              id="artifact-type"
              v-model="tipoDte"
              class="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Todos</option>
              <option value="01">Factura electronica</option>
              <option value="03">Credito fiscal</option>
              <option value="05">Nota de credito</option>
              <option value="06">Nota de debito</option>
              <option value="14">Sujeto excluido</option>
            </select>
          </div>

          <div v-else>
            <label class="text-sm font-semibold text-slate-900" for="event-type">Tipo de evento</label>
            <select
              id="event-type"
              value="invalidacion"
              disabled
              class="mt-2 block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm"
            >
              <option value="invalidacion">Invalidacion</option>
            </select>
          </div>

          <div class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <p class="text-xs font-semibold uppercase text-slate-500">Resultados</p>
            <p class="mt-1 text-lg font-bold text-slate-950">{{ resultCount }}</p>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard>
      <div class="overflow-hidden rounded-md border border-slate-200">
        <div
          v-if="activeTab === 'dte'"
          class="hidden grid-cols-[minmax(0,1.5fr)_160px_160px_160px] gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"
        >
          <span>Documento</span>
          <span>Fecha</span>
          <span>Total</span>
          <span class="text-right">Accion</span>
        </div>

        <div
          v-else
          class="hidden grid-cols-[minmax(0,1.5fr)_160px_160px] gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"
        >
          <span>Evento</span>
          <span>Fecha</span>
          <span class="text-right">Accion</span>
        </div>

        <div v-if="loading" class="flex justify-center px-4 py-10">
          <UiLoadingMark :label="activeTab === 'dte' ? 'Cargando comprobantes' : 'Cargando eventos'" />
        </div>

        <div v-else-if="emptyState" class="px-4 py-10 text-sm text-slate-600">
          {{ activeTab === 'dte' ? 'No hay comprobantes aceptados para mostrar.' : 'No hay eventos de invalidacion aceptados para mostrar.' }}
        </div>

        <div v-else-if="activeTab === 'dte'" class="divide-y divide-slate-100">
          <article
            v-for="document in documents"
            :key="document.id"
            class="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.5fr)_160px_160px_160px] md:items-center"
          >
            <div class="min-w-0">
              <p class="flex min-w-0 items-center gap-2 font-semibold text-slate-950">
                <UiDocumentIcon class="h-5 w-5 shrink-0 text-sky-600" />
                <span class="truncate">{{ document.numeroControl }}</span>
              </p>
              <p class="mt-1 truncate font-mono text-xs text-slate-500">{{ document.codigoGeneracion }}</p>
              <p class="mt-2 text-xs font-semibold uppercase text-sky-700">{{ typeLabel(document.tipoDte) }}</p>
            </div>

            <p class="text-sm text-slate-600">{{ formatDate(document.processed_at ?? document.created_at) }}</p>
            <p class="text-sm font-semibold text-slate-900">{{ currency(document.totalPagar ?? 0) }}</p>

            <div class="flex flex-wrap justify-start gap-2 md:justify-end">
              <UiButton
                variant="secondary"
                :disabled="openingPdfId === document.id"
                @click="openPdf(document)"
              >
                <span class="inline-flex items-center gap-2">
                  <UiDocumentIcon class="h-5 w-5" />
                  {{ openingPdfId === document.id ? 'Abriendo...' : 'PDF' }}
                </span>
              </UiButton>

              <UiButton
                variant="secondary"
                :disabled="openingJsonId === document.id"
                @click="openJson(document)"
              >
                <span class="inline-flex items-center gap-2">
                  <UiCodeBracketIcon class="h-5 w-5" />
                  {{ openingJsonId === document.id ? 'Abriendo...' : 'JSON' }}
                </span>
              </UiButton>
            </div>
          </article>
        </div>

        <div v-else class="divide-y divide-slate-100">
          <article
            v-for="event in events"
            :key="event.id"
            class="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.5fr)_160px_160px] md:items-center"
          >
            <div class="min-w-0">
              <p class="flex min-w-0 items-center gap-2 font-semibold text-slate-950">
                <UiDocumentIcon class="h-5 w-5 shrink-0 text-sky-600" />
                <span class="truncate">{{ event.numeroControl ?? event.codigoGeneracion ?? `Evento ${event.id}` }}</span>
              </p>
              <p class="mt-1 truncate font-mono text-xs text-slate-500">{{ event.codigoGeneracion }}</p>
              <p class="mt-2 text-xs font-semibold uppercase text-sky-700">{{ eventLabel(event.eventType) }}</p>
            </div>

            <p class="text-sm text-slate-600">{{ formatDate(event.processed_at ?? event.created_at) }}</p>

            <div class="flex flex-wrap justify-start gap-2 md:justify-end">
              <UiButton
                variant="secondary"
                :disabled="openingEventPdfId === event.id"
                @click="openEventPdf(event)"
              >
                <span class="inline-flex items-center gap-2">
                  <UiDocumentIcon class="h-5 w-5" />
                  {{ openingEventPdfId === event.id ? 'Abriendo...' : 'PDF' }}
                </span>
              </UiButton>

              <UiButton
                variant="secondary"
                :disabled="openingEventJsonId === event.id"
                @click="openEventJson(event)"
              >
                <span class="inline-flex items-center gap-2">
                  <UiCodeBracketIcon class="h-5 w-5" />
                  {{ openingEventJsonId === event.id ? 'Abriendo...' : 'JSON' }}
                </span>
              </UiButton>
            </div>
          </article>
        </div>

        <div
          v-if="currentMeta && currentMeta.total > 0"
          class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-600">
            {{ currentMeta.from }}-{{ currentMeta.to }} de {{ currentMeta.total }}
          </p>

          <nav class="flex items-center" aria-label="Paginacion">
            <button
              type="button"
              class="mx-1 flex h-10 min-w-10 items-center justify-center rounded-md bg-white px-3 py-2 text-slate-500 transition-colors duration-300 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white disabled:hover:text-slate-300 hover:bg-sky-600 hover:text-white"
              :disabled="currentPage <= 1 || loading"
              aria-label="Pagina anterior"
              @click="goToPage(currentPage - 1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>

            <template v-for="(item, index) in paginationItems" :key="`${item}-${index}`">
              <span
                v-if="item === 'ellipsis'"
                class="mx-1 hidden h-10 min-w-10 items-center justify-center rounded-md bg-white px-4 py-2 text-slate-500 sm:inline-flex"
              >
                ...
              </span>

              <button
                v-else
                type="button"
                class="mx-1 hidden h-10 min-w-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-300 sm:inline-flex"
                :class="item === currentPage ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-sky-600 hover:text-white'"
                :aria-current="item === currentPage ? 'page' : undefined"
                :disabled="loading"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
            </template>

            <button
              type="button"
              class="mx-1 flex h-10 min-w-10 items-center justify-center rounded-md bg-white px-3 py-2 text-slate-700 transition-colors duration-300 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white disabled:hover:text-slate-300 hover:bg-sky-600 hover:text-white"
              :disabled="currentPage >= currentMeta.last_page || loading"
              aria-label="Pagina siguiente"
              @click="goToPage(currentPage + 1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </UiCard>
  </section>
</template>
