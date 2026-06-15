<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CoreDteClient, type DteDraftSummary } from '@stelfaro/api-client';
import { currency } from '@stelfaro/shared';
import { UiButton, UiCard, UiDocumentIcon, UiLoadingMark, UiSearchInput } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

const supportedTypes = new Set(['01', '03', '05', '06', '14']);
const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const openingId = ref<number | null>(null);
const openingPdfId = ref<number | null>(null);
const error = ref<string | null>(null);
const query = ref('');
const tipoDte = ref('');
const documents = ref<DteDraftSummary[]>([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const emptyState = computed(() => !loading.value && documents.value.length === 0);

onMounted(() => {
  void loadDocuments();
});

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadDocuments(), 250);
});

watch(tipoDte, () => {
  void loadDocuments();
});

async function loadDocuments(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await client.value.documents({
      q: query.value.trim(),
      estado: 'accepted',
      tipo_dte: tipoDte.value,
      limit: 40
    });

    documents.value = response.data.filter((document) => supportedTypes.has(document.tipoDte));
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar comprobantes.';
  } finally {
    loading.value = false;
  }
}

async function openGraphic(document: DteDraftSummary): Promise<void> {
  if (!supportedTypes.has(document.tipoDte)) return;

  const target = window.open('about:blank', '_blank');
  openingId.value = document.id;
  error.value = null;

  try {
    const html = await client.value.graphicRepresentationHtml(document.id);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));

    if (target) {
      target.location.href = url;
      target.focus();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      URL.revokeObjectURL(url);
      error.value = 'El navegador bloqueo la nueva pestana del comprobante.';
    }
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el comprobante.';
  } finally {
    openingId.value = null;
  }
}

async function openPdf(document: DteDraftSummary): Promise<void> {
  if (!supportedTypes.has(document.tipoDte)) return;

  const target = window.open('about:blank', '_blank');
  openingPdfId.value = document.id;
  error.value = null;

  try {
    const pdf = await client.value.graphicRepresentationPdf(document.id);
    const url = URL.createObjectURL(pdf);

    if (target) {
      target.location.href = url;
      target.focus();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      URL.revokeObjectURL(url);
      error.value = 'El navegador bloqueo la nueva pestana del PDF.';
    }
  } catch (caught) {
    if (target) target.close();
    error.value = caught instanceof Error ? caught.message : 'No fue posible abrir el PDF.';
  } finally {
    openingPdfId.value = null;
  }
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

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-700">
          <UiDocumentIcon class="h-7 w-7" />
        </span>
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Comprobantes</p>
          <h2 class="mt-1 text-2xl font-bold text-slate-950">Representacion grafica</h2>
          <p class="mt-2 text-sm text-slate-600">
            Abre la version imprimible de los DTE aceptados por Hacienda.
          </p>
        </div>
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
          label="Buscar comprobante"
          placeholder="Numero, codigo, sello, empresa o NIT"
          @search="loadDocuments"
        />

        <div>
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

        <div class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <p class="text-xs font-semibold uppercase text-slate-500">Resultados</p>
          <p class="mt-1 text-lg font-bold text-slate-950">{{ documents.length }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard>
      <div class="overflow-hidden rounded-md border border-slate-200">
        <div class="hidden grid-cols-[minmax(0,1.5fr)_160px_160px_240px] gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
          <span>Documento</span>
          <span>Fecha</span>
          <span>Total</span>
          <span class="text-right">Accion</span>
        </div>

        <div v-if="loading" class="flex justify-center px-4 py-10">
          <UiLoadingMark label="Cargando comprobantes" />
        </div>

        <div v-else-if="emptyState" class="px-4 py-10 text-sm text-slate-600">
          No hay comprobantes aceptados para mostrar.
        </div>

        <div v-else class="divide-y divide-slate-100">
          <article
            v-for="document in documents"
            :key="document.id"
            class="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.5fr)_160px_160px_240px] md:items-center"
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
                {{ openingPdfId === document.id ? 'Abriendo...' : 'PDF' }}
              </UiButton>

              <UiButton
                :disabled="openingId === document.id"
                @click="openGraphic(document)"
              >
                {{ openingId === document.id ? 'Abriendo...' : 'HTML' }}
              </UiButton>
            </div>
          </article>
        </div>
      </div>
    </UiCard>
  </section>
</template>
