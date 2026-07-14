<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, type DteSalesAnnexBookKey, type DteSalesAnnexResponse } from '@stelfaro/api-client';
import { UiButton, UiInput, UiPanel, UiRefreshButton, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { Download, FileSpreadsheet, TriangleAlert } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
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

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const context = ref(peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope));
const selectedEmpresaId = ref<number | null>(null);
const loading = ref(false);
const downloading = ref<DteSalesAnnexBookKey | null>(null);
const error = ref<string | null>(null);
const annex = ref<DteSalesAnnexResponse | null>(null);
const activeBook = ref<DteSalesAnnexBookKey>('ventas_contribuyente');

const filters = reactive({
  from: firstDayOfMonth(),
  to: today(),
  ventasTipoOperacion: '1',
  ventasTipoIngreso: '10'
});

const bookLabels: Record<DteSalesAnnexBookKey, string> = {
  ventas_contribuyente: 'Ventas a contribuyente',
  ventas_consumidor_final: 'Ventas consumidor final'
};

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => Number(empresa.id) === Number(selectedEmpresaId.value)) ?? empresas.value[0] ?? null);
const empresaOptions = computed(() => empresas.value.map((empresa) => ({
  value: empresa.id,
  label: empresa.nombre_comercial || empresa.razon_social || `Empresa ${empresa.id}`
})));
const requestParams = computed(() => ({
  empresa_id: selectedEmpresa.value?.id,
  from: filters.from || undefined,
  to: filters.to || undefined,
  ventas_tipo_operacion_renta: filters.ventasTipoOperacion || undefined,
  ventas_tipo_ingreso_renta: filters.ventasTipoIngreso || undefined
}));
const currentDataset = computed(() => annex.value?.data?.[activeBook.value] ?? { official_rows: [], preview: [], issues: [] });
const currentHeaders = computed(() => annex.value?.headers?.[activeBook.value] ?? []);
const counts = computed(() => annex.value?.meta?.counts ?? { ventas_contribuyente: 0, ventas_consumidor_final: 0 });
const totalIssues = computed(() => Object.values(annex.value?.data ?? {}).reduce((sum, dataset) => sum + (dataset.issues?.length ?? 0), 0));

watch(() => props.authToken, () => {
  void initialize();
}, { immediate: true });

watch(selectedEmpresaId, () => {
  void load();
});

async function initialize(): Promise<void> {
  if (!props.authToken) return;

  try {
    context.value = await getBillingContext(client.value, props.coreBaseUrl, props.billingContextCacheScope);
    selectedEmpresaId.value = selectedEmpresaId.value || context.value.empresas[0]?.id || null;
    await load();
  } catch (caught) {
    error.value = messageFromError(caught);
  }
}

async function load(): Promise<void> {
  if (!props.authToken || !selectedEmpresa.value) return;

  loading.value = true;
  error.value = null;

  try {
    annex.value = await client.value.salesAnnex(requestParams.value);
  } catch (caught) {
    annex.value = null;
    error.value = messageFromError(caught);
  } finally {
    loading.value = false;
  }
}

async function downloadCsv(book: DteSalesAnnexBookKey): Promise<void> {
  if (!props.authToken || !selectedEmpresa.value) return;

  downloading.value = book;
  error.value = null;

  try {
    const blob = await client.value.salesAnnexCsv(book, requestParams.value);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${book}_${filters.from || 'periodo'}_${filters.to || 'actual'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (caught) {
    error.value = messageFromError(caught);
  } finally {
    downloading.value = null;
  }
}

function firstDayOfMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(value: unknown): string {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(Number.isFinite(number) ? number : 0);
}

function messageFromError(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'No fue posible cargar anexos.';
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-6 dark:border-line dark:bg-surface sm:px-8">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-wide text-sky-700 dark:text-primary">Anexos</p>
          <h1 class="mt-1 text-3xl font-black text-slate-950 dark:text-text">Anexos fiscales</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-muted">
            Genera los anexos de ventas desde documentos aceptados por Hacienda.
          </p>
        </div>
        <UiRefreshButton :loading="loading" @click="load">Actualizar</UiRefreshButton>
      </div>
    </div>

    <div class="px-4 pb-8 sm:px-6 lg:px-8">
      <UiPanel class="mb-5">
        <div class="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_160px_160px_160px_160px_auto] lg:items-end">
          <UiSelect v-model="selectedEmpresaId" label="Empresa" :options="empresaOptions" />
          <UiInput v-model="filters.from" label="Desde" type="date" />
          <UiInput v-model="filters.to" label="Hasta" type="date" />
          <UiSelect
            v-model="filters.ventasTipoOperacion"
            label="Operación renta"
            :options="[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' }
            ]"
          />
          <UiSelect
            v-model="filters.ventasTipoIngreso"
            label="Ingreso renta"
            :options="[
              { value: '10', label: '10' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' }
            ]"
          />
          <UiButton variant="primary" :disabled="loading" @click="load">Generar</UiButton>
        </div>
      </UiPanel>

      <div v-if="error" class="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        {{ error }}
      </div>

      <div class="mb-5 grid gap-4 md:grid-cols-3">
        <UiPanel>
          <p class="text-xs font-black uppercase text-slate-500 dark:text-soft">Ventas contribuyente</p>
          <p class="mt-3 text-3xl font-black text-slate-950 dark:text-text">{{ counts.ventas_contribuyente }}</p>
        </UiPanel>
        <UiPanel>
          <p class="text-xs font-black uppercase text-slate-500 dark:text-soft">Consumidor final</p>
          <p class="mt-3 text-3xl font-black text-slate-950 dark:text-text">{{ counts.ventas_consumidor_final }}</p>
        </UiPanel>
        <UiPanel>
          <p class="text-xs font-black uppercase text-slate-500 dark:text-soft">Observaciones</p>
          <p class="mt-3 text-3xl font-black" :class="totalIssues ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'">{{ totalIssues }}</p>
        </UiPanel>
      </div>

      <UiPanel>
        <div class="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-line md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(_, key) in bookLabels"
              :key="key"
              type="button"
              class="rounded-md px-4 py-2 text-sm font-bold transition"
              :class="activeBook === key ? 'bg-sky-600 text-white dark:bg-primary' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-surface-muted dark:text-muted dark:hover:text-text'"
              @click="activeBook = key"
            >
              {{ bookLabels[key] }}
            </button>
          </div>
          <UiButton variant="secondary" :disabled="downloading === activeBook || currentDataset.official_rows.length === 0" @click="downloadCsv(activeBook)">
            <Download class="h-4 w-4" aria-hidden="true" />
            Descargar CSV
          </UiButton>
        </div>

        <div v-if="currentDataset.issues.length" class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <div class="flex items-center gap-2 font-bold">
            <TriangleAlert class="h-4 w-4" aria-hidden="true" />
            Revisar antes de presentar
          </div>
          <ul class="mt-2 space-y-1">
            <li v-for="issue in currentDataset.issues" :key="issue">{{ issue }}</li>
          </ul>
        </div>

        <div class="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-line">
          <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-line">
            <thead class="bg-slate-50 dark:bg-surface-muted">
              <tr>
                <th class="px-4 py-3 text-left font-black uppercase text-slate-500 dark:text-soft">Documento</th>
                <th class="px-4 py-3 text-left font-black uppercase text-slate-500 dark:text-soft">Receptor</th>
                <th class="px-4 py-3 text-left font-black uppercase text-slate-500 dark:text-soft">Fecha</th>
                <th class="px-4 py-3 text-right font-black uppercase text-slate-500 dark:text-soft">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-line">
              <tr v-for="row in currentDataset.preview" :key="`${row.tipo_dte}-${row.numero_control}-${row.codigo_generacion}`">
                <td class="px-4 py-4">
                  <div class="flex items-center gap-2 font-bold text-slate-950 dark:text-text">
                    <FileSpreadsheet class="h-4 w-4 text-sky-600 dark:text-primary" aria-hidden="true" />
                    {{ row.tipo_dte }} · {{ row.numero_control }}
                  </div>
                </td>
                <td class="px-4 py-4 text-slate-700 dark:text-muted">{{ row.receptor_nombre }}</td>
                <td class="px-4 py-4 text-slate-700 dark:text-muted">{{ row.fecha_emision }}</td>
                <td class="px-4 py-4 text-right font-bold text-slate-950 dark:text-text">{{ money(row.total_pagar) }}</td>
              </tr>
              <tr v-if="!loading && currentDataset.preview.length === 0">
                <td class="px-4 py-8 text-center text-slate-500 dark:text-muted" colspan="4">Sin documentos aceptados para este periodo.</td>
              </tr>
              <tr v-if="loading">
                <td class="px-4 py-8 text-center text-slate-500 dark:text-muted" colspan="4">Cargando anexos...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UiStatusBadge tone="info">{{ currentHeaders.length }} columnas oficiales</UiStatusBadge>
          <UiStatusBadge tone="success">{{ currentDataset.official_rows.length }} filas listas</UiStatusBadge>
        </div>
      </UiPanel>
    </div>
  </div>
</template>
