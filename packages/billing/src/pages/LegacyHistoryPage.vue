<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient } from '@stelfaro/api-client';
import { fiscalDateTime } from '@stelfaro/shared';
import { UiButton, UiCodeBracketIcon, UiDocumentIcon, UiInput, UiLoadingMark, UiPanel, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BillingPaginationBar from '../components/BillingPaginationBar.vue';
import { getBillingContext, peekBillingContext } from '../support/billingDataCache';

const props = withDefaults(defineProps<{
  authToken?: string | null;
  coreBaseUrl?: string;
  billingContextCacheScope?: string;
}>(), {
  authToken: null,
  coreBaseUrl: '/api/v1',
  billingContextCacheScope: 'default'
});

type LegacyHistoryItem = {
  id: string;
  documento_codigo: string;
  numero_control: string | null;
  codigo_generacion: string | null;
  fecha_emision: string | null;
  imported_at: string | null;
  pdf_source: string | null;
  has_pdf: boolean;
  has_json: boolean;
};

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const context = ref(peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope));
const selectedEmpresaId = ref<number | null>(null);
const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(
  () => empresas.value.find((empresa) => Number(empresa.id) === Number(selectedEmpresaId.value)) ?? empresas.value[0] ?? null
);

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<LegacyHistoryItem[]>([]);
const meta = ref<{ current_page: number; last_page: number; total: number } | null>(null);
const page = ref(1);
const openingPdfId = ref<string | null>(null);
const openingJsonId = ref<string | null>(null);

const documentoLabels: Record<string, string> = {
  fcf: 'Factura consumidor final',
  ccf: 'Crédito fiscal',
  fex: 'Factura de exportación',
  nc: 'Nota de crédito',
  nd: 'Nota de débito',
  invalidacion: 'Evento de invalidación',
  contingencia: 'Evento de contingencia'
};

const documentoFilterOptions = [
  { value: '', label: 'Todos' },
  { value: 'fcf', label: 'Factura consumidor final' },
  { value: 'ccf', label: 'Crédito fiscal' },
  { value: 'nc', label: 'Nota de crédito' },
  { value: 'nd', label: 'Nota de débito' },
  { value: 'invalidacion', label: 'Invalidación' },
  { value: 'contingencia', label: 'Contingencia' }
];

const filters = reactive({
  documento_codigo: '',
  from: '',
  to: ''
});

function documentoLabel(codigo: string): string {
  return documentoLabels[codigo?.toLowerCase?.() ?? ''] ?? (codigo ? codigo.toUpperCase() : 'DTE');
}

onMounted(async () => {
  if (!context.value) {
    context.value = await getBillingContext(client.value, props.coreBaseUrl, props.billingContextCacheScope);
  }
  void load();
});

watch(selectedEmpresaId, () => {
  page.value = 1;
  void load();
});

watch(filters, () => {
  page.value = 1;
  void load();
});

async function load(): Promise<void> {
  if (!selectedEmpresa.value) return;

  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.legacyHistory({
      empresa_id: Number(selectedEmpresa.value.id),
      category: 'dte',
      documento_codigo: filters.documento_codigo || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: page.value,
      per_page: 20
    });
    items.value = response.data;
    meta.value = response.meta;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el historial legado.';
  } finally {
    loading.value = false;
  }
}

function goToPage(next: number): void {
  page.value = next;
  void load();
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

async function openPdf(item: LegacyHistoryItem): Promise<void> {
  const target = window.open('about:blank', '_blank');
  openingPdfId.value = item.id;
  error.value = null;

  try {
    const pdf = await client.value.legacyHistoryPdf(item.id);
    openBlob(target, pdf, 'PDF');
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el PDF.';
  } finally {
    openingPdfId.value = null;
  }
}

async function openJson(item: LegacyHistoryItem): Promise<void> {
  const target = window.open('about:blank', '_blank');
  openingJsonId.value = item.id;
  error.value = null;

  try {
    const json = await client.value.legacyHistoryJson(item.id);
    openBlob(target, json, 'JSON');
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el JSON.';
  } finally {
    openingJsonId.value = null;
  }
}
</script>

<template>
  <section class="space-y-5">
    <UiPanel variant="raised">
      <div class="border-b border-line px-5 py-4">
        <h2 class="text-lg font-semibold text-text">Historial anterior (Legacy)</h2>
        <p class="mt-1 text-sm text-muted">
          DTE (facturas, créditos fiscales, notas e invalidaciones) emitidos desde la plataforma anterior, migrados
          como referencia de solo lectura.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-3 border-b border-line px-5 py-4 sm:grid-cols-3">
        <UiSelect v-model="filters.documento_codigo" label="Tipo" :options="documentoFilterOptions" />
        <UiInput v-model="filters.from" label="Desde" type="date" />
        <UiInput v-model="filters.to" label="Hasta" type="date" />
      </div>

      <div v-if="loading" class="flex items-center justify-center px-4 py-10">
        <UiLoadingMark />
      </div>

      <div v-else-if="error" class="px-4 py-6 text-sm text-danger">{{ error }}</div>

      <div v-else-if="items.length === 0" class="px-4 py-10 text-sm text-muted">
        No hay documentos migrados del historial anterior para esta empresa.
      </div>

      <div v-else class="space-y-3 md:divide-y md:divide-line md:space-y-0">
        <article
          v-for="item in items"
          :key="item.id"
          class="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface px-4 py-4 shadow-sm md:grid-cols-[minmax(0,1.5fr)_160px_140px_220px] md:items-center md:rounded-none md:border-0 md:bg-transparent md:shadow-none"
        >
          <div class="min-w-0">
            <p class="flex min-w-0 items-center gap-2 font-semibold text-text">
              <UiDocumentIcon class="h-5 w-5 shrink-0 text-primary" />
              <span class="truncate">{{ item.numero_control ?? item.codigo_generacion }}</span>
            </p>
            <p class="mt-1 truncate font-mono text-xs text-soft">{{ item.codigo_generacion }}</p>
            <p class="mt-2 text-xs font-semibold uppercase text-primary">{{ documentoLabel(item.documento_codigo) }}</p>
          </div>

          <div>
            <p class="text-xs text-muted md:text-sm">{{ item.fecha_emision ? fiscalDateTime(item.fecha_emision) : '—' }}</p>
          </div>

          <div>
            <UiStatusBadge v-if="!item.has_pdf" tone="neutral">Solo JSON</UiStatusBadge>
            <UiStatusBadge v-else :tone="item.pdf_source === 'reconstructed' ? 'warning' : 'success'">
              {{ item.pdf_source === 'reconstructed' ? 'PDF reconstruido' : 'PDF original' }}
            </UiStatusBadge>
          </div>

          <div class="flex flex-wrap gap-2">
            <UiButton
              v-if="item.has_pdf"
              size="sm"
              variant="secondary"
              :disabled="openingPdfId === item.id"
              @click="openPdf(item)"
            >
              <UiDocumentIcon class="h-4 w-4" />
              {{ openingPdfId === item.id ? 'Abriendo...' : 'Ver PDF' }}
            </UiButton>
            <UiButton v-if="item.has_json" size="sm" variant="ghost" :disabled="openingJsonId === item.id" @click="openJson(item)">
              <UiCodeBracketIcon class="h-4 w-4" />
              {{ openingJsonId === item.id ? 'Abriendo...' : 'Ver JSON' }}
            </UiButton>
          </div>
        </article>
      </div>

      <BillingPaginationBar
        :meta="meta ? { current_page: meta.current_page, last_page: meta.last_page, total: meta.total } : null"
        class="border-t border-line px-4 py-3"
        @page="goToPage"
      />
    </UiPanel>
  </section>
</template>
