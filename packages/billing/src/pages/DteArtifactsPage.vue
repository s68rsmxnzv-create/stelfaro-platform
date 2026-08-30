<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CoreDteClient, type DteDraftSummary, type MhFiscalEventSummary, type PaginationMeta } from '@stelfaro/api-client';
import { currency, fiscalDateTime } from '@stelfaro/shared';
import { UiActionDropdown, UiActionMenuItem, UiCodeBracketIcon, UiDocumentIcon, UiLoadingMark, UiMailIcon, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { Printer, SlidersHorizontal } from 'lucide-vue-next';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';
import BillingPaginationBar from '../components/BillingPaginationBar.vue';
import SucursalScopeFilter from '../components/SucursalScopeFilter.vue';
import { canScopeBySucursal } from '../support/sucursalScope';
import { dteFiscalTicketFromArtifact } from '../printing/dteFiscalTicket';
import { sendSilentPrint } from '../printing/printJob';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  initialArtifactType?: ArtifactTab;
  platformSession?: Record<string, unknown> | null;
  platformBaseUrl?: string;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  initialArtifactType: 'dte',
  platformSession: null,
  platformBaseUrl: '/api/v1'
});

type ArtifactTab = 'dte' | 'events';

const tenantId = computed(() => Number((props.platformSession as any)?.tenant?.id || 0));
const showSucursalFilter = computed(
  () => canScopeBySucursal(String((props.platformSession as any)?.tenant?.role || '')),
);
const sucursalId = ref<number | null>(null);

const supportedTypes = new Set(['01', '03', '05', '06', '14']);
const supportedEventTypes = new Set(['invalidacion', 'retorno', 'operaciones_especiales']);
const dteTypeOptions = [
  { value: '', label: 'Todos' },
  { value: '01', label: 'Factura electronica' },
  { value: '03', label: 'Credito fiscal' },
  { value: '05', label: 'Nota de credito' },
  { value: '06', label: 'Nota de debito' },
  { value: '14', label: 'Sujeto excluido' }
];
const artifactEventTypeOptions = [
  { value: '', label: 'Todos' },
  { value: 'invalidacion', label: 'Invalidacion' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'operaciones_especiales', label: 'Operaciones especiales' }
];
const pageSize = 10;
const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const activeTab = ref<ArtifactTab>(props.initialArtifactType === 'events' ? 'events' : 'dte');
const loading = ref(false);
const openingPdfId = ref<number | null>(null);
const openingJsonId = ref<number | null>(null);
const openingEventPdfId = ref<number | null>(null);
const openingEventJsonId = ref<number | null>(null);
const resendingEmailId = ref<number | null>(null);
const printingId = ref<number | null>(null);
const error = ref<string | null>(null);
const query = ref('');
const filtersOpen = ref(false);
const tipoDte = ref('');
const eventType = ref('');
const documents = ref<DteDraftSummary[]>([]);
const events = ref<MhFiscalEventSummary[]>([]);
const dtePage = ref(1);
const eventPage = ref(1);
const dteMeta = ref<PaginationMeta | null>(null);
const eventMeta = ref<PaginationMeta | null>(null);
const floatingToasts = ref<BillingFloatingToast[]>([]);
let floatingToastId = 0;
const floatingToastTimers: ReturnType<typeof window.setTimeout>[] = [];
const deliveryPollTimers: ReturnType<typeof window.setTimeout>[] = [];
let unmounted = false;
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const emptyState = computed(() => {
  if (loading.value) return false;

  return activeTab.value === 'dte' ? documents.value.length === 0 : events.value.length === 0;
});

const currentMeta = computed(() => activeTab.value === 'dte' ? dteMeta.value : eventMeta.value);
const resultCount = computed(() => currentMeta.value?.total ?? (activeTab.value === 'dte' ? documents.value.length : events.value.length));
const activeFilterLabel = computed(() => {
  const value = activeTab.value === 'dte' ? tipoDte.value : eventType.value;
  const options = activeTab.value === 'dte' ? dteTypeOptions : artifactEventTypeOptions;

  return options.find((option) => option.value === value)?.label ?? 'Todos';
});

onMounted(() => {
  void loadActiveTab();
});

onBeforeUnmount(() => {
  unmounted = true;
  floatingToastTimers.forEach((timer) => window.clearTimeout(timer));
  deliveryPollTimers.forEach((timer) => window.clearTimeout(timer));
  if (searchTimer) window.clearTimeout(searchTimer);
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

watch(sucursalId, () => {
  dtePage.value = 1;
  if (activeTab.value === 'dte') void loadDocuments();
});

watch(eventType, () => {
  eventPage.value = 1;
  if (activeTab.value === 'events') void loadEvents();
});

watch(activeTab, () => {
  error.value = null;
  void loadActiveTab();
});

watch(() => props.initialArtifactType, (value) => {
  const next = value === 'events' ? 'events' : 'dte';
  if (activeTab.value !== next) {
    activeTab.value = next;
  }
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
      estado: 'accepted,invalidated',
      tipo_dte: tipoDte.value,
      sucursal_id: sucursalId.value ?? undefined,
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
      event_type: eventType.value,
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
    const json = await client.value.clientJsonArtifact(document.id);
    openBlob(target, json, 'JSON');
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
    const json = await client.value.mhEventClientJsonArtifact(event.id);
    openBlob(target, json, 'JSON');
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el JSON del evento.';
  } finally {
    openingEventJsonId.value = null;
  }
}

async function resendEmail(document: DteDraftSummary): Promise<void> {
  resendingEmailId.value = document.id;
  error.value = null;

  try {
    const response = await client.value.resendDteEmail(document.id);
    documents.value = documents.value.map((item) => item.id === document.id ? response.document : item);
    await waitForEmailSent(document.id, response.notification.recipient_email ?? null);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible reencolar el correo.';
  } finally {
    resendingEmailId.value = null;
  }
}

async function printDocument(document: DteDraftSummary): Promise<void> {
  printingId.value = document.id;
  error.value = null;

  try {
    const artifact = await client.value.thermalArtifact(document.id);
    const result = await sendSilentPrint(dteFiscalTicketFromArtifact(artifact));
    pushFloatingToast(result === 'printed'
      ? { title: 'DTE impreso', message: `${document.numeroControl} fue enviado a la impresora.`, variant: 'success' }
      : { title: 'DTE listo', message: 'Activa la impresión silenciosa y selecciona una impresora para imprimirlo.', variant: 'info' });
  } catch (caught) {
    pushFloatingToast({
      title: 'No se pudo imprimir el DTE',
      message: caught instanceof Error ? caught.message : 'Revisa la conexión con la impresora.',
      variant: 'error'
    });
  } finally {
    printingId.value = null;
  }
}

async function waitForEmailSent(documentId: number, fallbackRecipient?: string | null): Promise<void> {
  const sentStatuses = new Set(['sent', 'delivered']);
  const failedStatuses = new Set(['failed']);

  for (let attempt = 0; attempt < 14 && !unmounted; attempt += 1) {
    if (attempt > 0) {
      await wait(1500);
    }

    const response = await client.value.dteEmailDelivery(documentId);
    documents.value = documents.value.map((item) => item.id === documentId ? response.document : item);

    const status = String(response.notification?.status ?? '').toLowerCase();
    if (sentStatuses.has(status)) {
      const recipient = response.notification?.recipient_email ?? fallbackRecipient;
      const recipientLabel = recipient ? ` a ${recipient}` : ' al correo del cliente';
      pushFloatingToast({
        title: 'Correo enviado',
        message: `El comprobante fue reenviado${recipientLabel}.`,
        variant: 'success'
      });
      return;
    }

    if (failedStatuses.has(status)) {
      throw new Error(response.notification?.error ?? response.notification?.last_error ?? 'No fue posible enviar el correo.');
    }
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, milliseconds);
    deliveryPollTimers.push(timer);
  });
}

function pushFloatingToast(toast: Omit<BillingFloatingToast, 'id'>): void {
  const id = ++floatingToastId;
  floatingToasts.value = [...floatingToasts.value, { id, ...toast }];
  const timer = window.setTimeout(() => {
    floatingToasts.value = floatingToasts.value.filter((item) => item.id !== id);
  }, toast.variant === 'success' || !toast.variant ? 4000 : 4300);
  floatingToastTimers.push(timer);
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

function documentStatusLabel(status: string): string {
  return status === 'invalidated' ? 'Invalidado' : 'Aceptado';
}

function documentStatusTone(status: string): 'success' | 'danger' {
  return status === 'invalidated' ? 'danger' : 'success';
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    invalidacion: 'Evento de invalidacion',
    retorno: 'Evento de retorno',
    operaciones_especiales: 'Evento de operaciones especiales'
  };

  return labels[type] ?? type;
}

function eventEmptyMessage(): string {
  if (eventType.value === 'invalidacion') return 'No hay eventos de invalidacion aceptados para mostrar.';
  if (eventType.value === 'retorno') return 'No hay eventos de retorno aceptados para mostrar.';
  if (eventType.value === 'operaciones_especiales') return 'No hay eventos de operaciones especiales aceptados para mostrar.';

  return 'No hay eventos aceptados para mostrar.';
}

function formatDate(value?: string | null): string {
  return fiscalDateTime(value);
}
</script>

<template>
  <section class="space-y-6">
    <p v-if="error" class="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>
    <BillingFloatingToastStack :toasts="floatingToasts" />

    <div class="rounded-2xl border border-line bg-surface p-3 shadow-sm md:rounded-lg md:p-5">
      <div class="space-y-3">
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex items-end gap-2">
            <UiSearchInput
              v-model="query"
              class="min-w-0 flex-1"
              :label="activeTab === 'dte' ? 'Buscar comprobante' : 'Buscar evento'"
              placeholder="Numero, codigo, sello, empresa o NIT"
              @search="loadActiveTab"
            />

            <button
              type="button"
              class="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-raised text-muted md:hidden"
              :class="filtersOpen ? 'border-primary bg-primary-soft text-primary' : ''"
              :aria-expanded="filtersOpen"
              aria-label="Mostrar filtros"
              @click="filtersOpen = !filtersOpen"
            >
              <SlidersHorizontal class="h-5 w-5" />
              <span
                v-if="activeFilterLabel !== 'Todos'"
                class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary"
              ></span>
            </button>
          </div>

          <div
            class="gap-3 md:flex md:shrink-0 md:items-end"
            :class="filtersOpen ? 'grid' : 'hidden'"
          >
            <UiSelect
              v-if="activeTab === 'dte'"
              v-model="tipoDte"
              label="Tipo DTE"
              class="md:w-56"
              :options="dteTypeOptions"
            />

            <UiSelect
              v-else
              v-model="eventType"
              label="Tipo de evento"
              class="md:w-56"
              :options="artifactEventTypeOptions"
            />

            <SucursalScopeFilter
              v-if="activeTab === 'dte' && showSucursalFilter"
              v-model="sucursalId"
              :tenant-id="tenantId"
              :platform-base-url="platformBaseUrl"
              class="md:w-56"
            />

            <div class="flex items-center justify-between rounded-xl bg-surface-raised px-3 py-2 text-sm text-muted md:block md:w-28 md:shrink-0 md:rounded-md">
              <p class="text-xs font-semibold uppercase">Resultados</p>
              <p class="text-base font-bold text-text md:mt-1 md:text-lg">{{ resultCount }}</p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between px-1 text-xs text-muted md:hidden">
          <span>{{ activeFilterLabel }}</span>
          <strong>{{ resultCount }} {{ resultCount === 1 ? 'resultado' : 'resultados' }}</strong>
        </div>
      </div>
    </div>

    <div class="md:rounded-lg md:border md:border-line md:bg-surface md:p-5 md:shadow-sm">
      <div v-if="currentMeta && currentMeta.last_page > 1" class="mb-3 border-b border-line pb-3">
        <BillingPaginationBar :meta="currentMeta" :loading="loading" @page="goToPage" />
      </div>

      <div class="overflow-visible md:rounded-md md:border md:border-line">
        <div
          v-if="activeTab === 'dte'"
          class="hidden grid-cols-[minmax(0,1.5fr)_160px_150px_96px] gap-4 rounded-t-md bg-surface-muted px-4 py-3 text-xs font-semibold uppercase text-soft md:grid"
        >
          <span>Documento</span>
          <span>Fecha</span>
          <span>Estado</span>
          <span class="text-right">Acciones</span>
        </div>

        <div
          v-else
          class="hidden grid-cols-[minmax(0,1.5fr)_160px_96px] gap-4 rounded-t-md bg-surface-muted px-4 py-3 text-xs font-semibold uppercase text-soft md:grid"
        >
          <span>Evento</span>
          <span>Fecha</span>
          <span class="text-right">Acciones</span>
        </div>

        <div v-if="loading" class="flex justify-center px-4 py-10">
          <UiLoadingMark :label="activeTab === 'dte' ? 'Cargando comprobantes' : 'Cargando eventos'" />
        </div>

        <div v-else-if="emptyState" class="px-4 py-10 text-sm text-muted">
          {{ activeTab === 'dte' ? 'No hay comprobantes para mostrar.' : eventEmptyMessage() }}
        </div>

        <div v-else-if="activeTab === 'dte'" class="space-y-3 md:divide-y md:divide-line md:space-y-0">
          <article
            v-for="document in documents"
            :key="document.id"
            class="sf-interactive-row relative grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm md:grid-cols-[minmax(0,1.5fr)_160px_150px_96px] md:items-center md:rounded-none md:border-0 md:bg-transparent md:shadow-none"
          >
            <div class="min-w-0 pr-12 md:pr-0">
              <p class="flex min-w-0 items-center gap-2 font-semibold text-text">
                <UiDocumentIcon class="h-5 w-5 shrink-0 text-primary" />
                <span class="truncate">{{ document.numeroControl }}</span>
              </p>
              <p class="mt-1 truncate font-mono text-xs text-soft">{{ document.codigoGeneracion }}</p>
              <p class="mt-2 text-xs font-semibold uppercase text-primary">{{ typeLabel(document.tipoDte) }}</p>
            </div>

            <div class="flex items-end justify-between gap-3 md:block">
              <div>
                <p class="text-xs text-muted md:text-sm">{{ formatDate(document.processed_at ?? document.created_at) }}</p>
                <p class="mt-1 text-lg font-bold text-text md:text-sm md:font-semibold">{{ currency(document.totalPagar ?? 0) }}</p>
              </div>
              <UiStatusBadge class="md:hidden" :tone="documentStatusTone(document.estado)">
                {{ documentStatusLabel(document.estado) }}
              </UiStatusBadge>
            </div>

            <div class="hidden md:block">
              <UiStatusBadge :tone="documentStatusTone(document.estado)">
                {{ documentStatusLabel(document.estado) }}
              </UiStatusBadge>
            </div>

            <UiActionDropdown class="absolute right-3 top-3 md:static" label="Abrir acciones del comprobante" menu-width="w-52">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="openingPdfId === document.id"
                @click="openPdf(document)"
              >
                <UiDocumentIcon class="h-5 w-5 text-primary" />
                <span>{{ openingPdfId === document.id ? 'Abriendo PDF...' : 'Abrir PDF' }}</span>
              </button>

              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="openingJsonId === document.id"
                @click="openJson(document)"
              >
                <UiCodeBracketIcon class="h-5 w-5 text-primary" />
                <span>{{ openingJsonId === document.id ? 'Abriendo JSON...' : 'Abrir JSON' }}</span>
              </button>

              <UiActionMenuItem :disabled="printingId === document.id" @select="printDocument(document)">
                <template #icon><Printer class="h-5 w-5 text-primary" /></template>
                {{ printingId === document.id ? 'Enviando...' : 'Reimprimir comprobante' }}
              </UiActionMenuItem>

              <div v-if="document.estado !== 'invalidated'" class="my-1 border-t border-line"></div>

              <button
                v-if="document.estado !== 'invalidated'"
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="resendingEmailId === document.id"
                @click="resendEmail(document)"
              >
                  <UiMailIcon class="h-5 w-5 text-primary" />
                  <span>{{ resendingEmailId === document.id ? 'Esperando envio...' : 'Reenviar correo' }}</span>
                </button>
            </UiActionDropdown>
          </article>
        </div>

        <div v-else class="space-y-3 md:divide-y md:divide-line md:space-y-0">
          <article
            v-for="event in events"
            :key="event.id"
            class="sf-interactive-row relative grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm md:grid-cols-[minmax(0,1.5fr)_160px_96px] md:items-center md:rounded-none md:border-0 md:bg-transparent md:shadow-none"
          >
            <div class="min-w-0 pr-12 md:pr-0">
              <p class="flex min-w-0 items-center gap-2 font-semibold text-text">
                <UiDocumentIcon class="h-5 w-5 shrink-0 text-primary" />
                <span class="truncate">{{ event.numeroControl ?? event.codigoGeneracion ?? `Evento ${event.id}` }}</span>
              </p>
              <p class="mt-1 truncate font-mono text-xs text-soft">{{ event.codigoGeneracion }}</p>
              <p class="mt-2 text-xs font-semibold uppercase text-primary">{{ eventLabel(event.eventType) }}</p>
            </div>

            <p class="text-sm text-muted">{{ formatDate(event.processed_at ?? event.created_at) }}</p>

            <UiActionDropdown class="absolute right-3 top-3 md:static" label="Abrir acciones del evento" menu-width="w-48">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="openingEventPdfId === event.id"
                @click="openEventPdf(event)"
              >
                <UiDocumentIcon class="h-5 w-5 text-primary" />
                <span>{{ openingEventPdfId === event.id ? 'Abriendo PDF...' : 'Abrir PDF' }}</span>
              </button>

              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="openingEventJsonId === event.id"
                @click="openEventJson(event)"
              >
                <UiCodeBracketIcon class="h-5 w-5 text-primary" />
                <span>{{ openingEventJsonId === event.id ? 'Abriendo JSON...' : 'Abrir JSON' }}</span>
              </button>
            </UiActionDropdown>
          </article>
        </div>

        <div
          v-if="currentMeta && currentMeta.last_page > 1"
          class="mt-3 rounded-2xl border border-line bg-surface px-3 py-3 md:mt-0 md:rounded-none md:border-x-0 md:border-b-0 md:bg-surface-raised md:px-4 md:py-4"
        >
          <BillingPaginationBar :meta="currentMeta" :loading="loading" @page="goToPage" />
        </div>
      </div>
    </div>
  </section>
</template>
