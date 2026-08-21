<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, PlatformClient, type DteInvalidatedAnnexResponse, type DteSalesAnnexBookKey, type DteSalesAnnexResponse, type PlatformPurchaseAnnexResponse } from '@stelfaro/api-client';
import { UiButton, UiEmailInput, UiInput, UiMetricCard, UiModalShell, UiPanel, UiPhoneInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { CircleCheck, Clock, Download, FileSpreadsheet, Link2, Mail, MessageCircle, Share2, TriangleAlert } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { annexWhatsAppUrl } from '../annexWhatsApp';
import { getBillingContext, peekBillingContext } from '../support/billingDataCache';

const props = withDefaults(defineProps<{
  authToken?: string | null;
  coreBaseUrl?: string;
  platformBaseUrl?: string;
  platformSession?: Record<string, any> | null;
  billingContextCacheScope?: string;
}>(), {
  authToken: null,
  coreBaseUrl: '/api/v1',
  platformBaseUrl: '/api/v1',
  platformSession: null,
  billingContextCacheScope: 'default'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const platformClient = computed(() => new PlatformClient(props.platformBaseUrl, { authToken: props.authToken }));
const context = ref(peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope));
const selectedEmpresaId = ref<number | null>(null);
const loading = ref(false);
const downloading = ref<string | null>(null);
const error = ref<string | null>(null);
const annex = ref<DteSalesAnnexResponse | null>(null);
const invalidatedAnnex = ref<DteInvalidatedAnnexResponse | null>(null);
const purchaseAnnex = ref<PlatformPurchaseAnnexResponse | null>(null);
const activeBook = ref<string>('ventas_contribuyente');
const shareableBooks = ['ventas_contribuyente', 'ventas_consumidor_final', 'documentos_invalidados'];
const accountantContacts = ref<Array<{ id: number; name: string; email: string; phone: string | null }>>([]);
const shareModalOpen = ref(false);
const shareRecipientEmail = ref('');
const shareRecipientName = ref('');
const sharePhone = ref('');
const sharing = ref<'email' | 'link' | null>(null);
const shareMessage = ref<string | null>(null);
const shareError = ref<string | null>(null);
const lastShareLink = ref<{ url: string; expiresAt: number } | null>(null);

const filters = reactive({
  from: firstDayOfMonth(),
  to: today()
});

const bookLabels: Record<string, string> = {
  ventas_contribuyente: 'Ventas a contribuyente',
  ventas_consumidor_final: 'Ventas consumidor final',
  compras: 'Compras',
  documentos_invalidados: 'Invalidados'
};

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => Number(empresa.id) === Number(selectedEmpresaId.value)) ?? empresas.value[0] ?? null);
const requestParams = computed(() => ({
  empresa_id: selectedEmpresa.value?.id,
  from: filters.from || undefined,
  to: filters.to || undefined
}));
const purchaseRequestParams = computed(() => ({
  from: filters.from || undefined,
  to: filters.to || undefined
}));
const tenantId = computed(() => Number(props.platformSession?.tenant?.id ?? props.platformSession?.active_membership?.tenant_id ?? 0) || null);
const currentDataset = computed(() => {
  if (activeBook.value === 'compras') {
    return purchaseAnnex.value?.data?.compras ?? { official_rows: [], preview: [], issues: [] };
  }
  if (activeBook.value === 'documentos_invalidados') {
    return invalidatedAnnex.value?.data?.documentos_invalidados ?? { official_rows: [], preview: [], issues: [] };
  }

  return annex.value?.data?.[activeBook.value] ?? { official_rows: [], preview: [], issues: [] };
});
const currentHeaders = computed(() => {
  if (activeBook.value === 'compras') return purchaseAnnex.value?.headers?.compras ?? [];
  if (activeBook.value === 'documentos_invalidados') return invalidatedAnnex.value?.headers?.documentos_invalidados ?? [];
  return annex.value?.headers?.[activeBook.value] ?? [];
});
const counts = computed(() => ({
  ventas_contribuyente: annex.value?.meta?.counts?.ventas_contribuyente ?? 0,
  ventas_consumidor_final: annex.value?.meta?.counts?.ventas_consumidor_final ?? 0,
  compras: purchaseAnnex.value?.meta?.counts?.compras ?? 0,
  documentos_invalidados: invalidatedAnnex.value?.meta?.counts?.documentos_invalidados ?? 0
}));
const documentCounts = computed(() => ({
  ventas_contribuyente: counts.value.ventas_contribuyente,
  ventas_consumidor_final: sumDocumentCount(annex.value?.data?.ventas_consumidor_final?.preview, counts.value.ventas_consumidor_final),
  compras: counts.value.compras,
  documentos_invalidados: counts.value.documentos_invalidados
}));
const shareContactOptions = computed(() => accountantContacts.value.map((contact) => ({ value: contact.id, label: `${contact.name} · ${contact.email}` })));
const sharePeriodLabel = computed(() => {
  if (!filters.from && !filters.to) return '';
  return `${filters.from || 'inicio'} al ${filters.to || 'hoy'}`;
});
const totalIssues = computed(() => {
  const salesIssues = Object.values(annex.value?.data ?? {}).reduce((sum, dataset) => sum + (dataset.issues?.length ?? 0), 0);
  return salesIssues
    + (purchaseAnnex.value?.data?.compras?.issues?.length ?? 0)
    + (invalidatedAnnex.value?.data?.documentos_invalidados?.issues?.length ?? 0);
});

watch(() => props.authToken, () => {
  void initialize();
}, { immediate: true });

watch(selectedEmpresaId, () => {
  void load();
});

watch(tenantId, () => {
  void loadAccountantContacts();
}, { immediate: true });

watch(activeBook, () => {
  lastShareLink.value = null;
  shareMessage.value = null;
  shareError.value = null;
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
    const [sales, purchases, invalidated] = await Promise.all([
      client.value.salesAnnex(requestParams.value),
      tenantId.value ? platformClient.value.inventoryPurchaseAnnexOfficial(tenantId.value, purchaseRequestParams.value) : Promise.resolve(null),
      client.value.invalidatedAnnex(requestParams.value)
    ]);
    annex.value = sales;
    purchaseAnnex.value = purchases;
    invalidatedAnnex.value = invalidated;
  } catch (caught) {
    annex.value = null;
    purchaseAnnex.value = null;
    invalidatedAnnex.value = null;
    error.value = messageFromError(caught);
  } finally {
    loading.value = false;
  }
}

async function downloadCsv(book: string): Promise<void> {
  if (!props.authToken || !selectedEmpresa.value) return;
  if (book === 'compras' && !tenantId.value) return;

  downloading.value = book;
  error.value = null;

  try {
    const blob = book === 'compras'
      ? await platformClient.value.inventoryPurchaseAnnexCsv(tenantId.value, purchaseRequestParams.value)
      : book === 'documentos_invalidados'
        ? await client.value.invalidatedAnnexCsv(requestParams.value)
        : await client.value.salesAnnexCsv(book as DteSalesAnnexBookKey, requestParams.value);
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

async function loadAccountantContacts(): Promise<void> {
  if (!tenantId.value) return;
  try {
    const response = await platformClient.value.accountantContacts(tenantId.value);
    accountantContacts.value = response.contacts ?? [];
  } catch {
    accountantContacts.value = [];
  }
}

function selectAccountantContact(contactId: string): void {
  const contact = accountantContacts.value.find((item) => String(item.id) === contactId);
  if (!contact) return;
  shareRecipientEmail.value = contact.email;
  shareRecipientName.value = contact.name;
  sharePhone.value = contact.phone ?? '';
}

function openShareModal(): void {
  shareMessage.value = null;
  shareError.value = null;
  shareModalOpen.value = true;
}

function closeShareModal(): void {
  shareModalOpen.value = false;
}

async function emailAnnex(book: string): Promise<void> {
  if (!shareRecipientEmail.value || !selectedEmpresa.value) return;

  sharing.value = 'email';
  shareMessage.value = null;
  shareError.value = null;

  try {
    const recipient = { email: shareRecipientEmail.value, name: shareRecipientName.value || undefined };
    if (book === 'documentos_invalidados') {
      await client.value.invalidatedAnnexEmail(recipient, requestParams.value);
    } else {
      await client.value.salesAnnexEmail(book as DteSalesAnnexBookKey, recipient, requestParams.value);
    }
    shareMessage.value = `Anexo enviado a ${shareRecipientEmail.value}.`;
  } catch (caught) {
    shareError.value = messageFromError(caught);
  } finally {
    sharing.value = null;
  }
}

async function generateShareLink(book: string): Promise<void> {
  if (!selectedEmpresa.value) return;

  sharing.value = 'link';
  shareMessage.value = null;
  shareError.value = null;

  try {
    const link = book === 'documentos_invalidados'
      ? await client.value.invalidatedAnnexShareLink(requestParams.value)
      : await client.value.salesAnnexShareLink(book as DteSalesAnnexBookKey, requestParams.value);
    lastShareLink.value = { url: link.url, expiresAt: link.expires_at };
    try {
      await navigator.clipboard.writeText(link.url);
      shareMessage.value = 'Enlace copiado al portapapeles.';
    } catch {
      shareMessage.value = 'Enlace generado.';
    }
  } catch (caught) {
    shareError.value = messageFromError(caught);
  } finally {
    sharing.value = null;
  }
}

async function sendAnnexWhatsApp(book: string): Promise<void> {
  if (!selectedEmpresa.value) return;

  if (!lastShareLink.value) {
    await generateShareLink(book);
  }
  if (!lastShareLink.value || !sharePhone.value) return;

  const url = annexWhatsAppUrl(sharePhone.value, bookLabels[book] || book, lastShareLink.value.url, lastShareLink.value.expiresAt);
  if (url) window.open(url, '_blank', 'noopener');
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

function totalLabel(row: Record<string, unknown>): string {
  return row.total_pagar === undefined || row.total_pagar === null ? '-' : money(row.total_pagar);
}

function sumDocumentCount(preview: Array<Record<string, unknown>> | undefined, fallback: number): number {
  if (!preview?.length) return fallback;

  return preview.reduce((sum, row) => sum + Number(row.document_count || 1), 0);
}

function messageFromError(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'No fue posible cargar anexos.';
}
</script>

<template>
  <section class="space-y-5">
    <UiPanel variant="raised">
      <div class="grid gap-4 lg:grid-cols-[160px_160px_auto] lg:items-end">
        <UiInput v-model="filters.from" label="Desde" type="date" />
        <UiInput v-model="filters.to" label="Hasta" type="date" />
        <UiButton variant="primary" :disabled="loading" @click="load">Generar</UiButton>
      </div>
    </UiPanel>

    <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      {{ error }}
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <UiMetricCard label="Ventas contribuyente" :value="documentCounts.ventas_contribuyente" />
      <UiMetricCard label="DTE consumidor final" :value="documentCounts.ventas_consumidor_final" />
      <UiMetricCard label="Compras" :value="counts.compras" />
      <UiMetricCard label="Invalidados" :value="counts.documentos_invalidados" />
      <UiMetricCard label="Observaciones" :value="totalIssues" :tone="totalIssues ? 'warning' : 'success'" />
    </div>

    <UiPanel variant="raised">
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
        <div class="flex flex-wrap items-center gap-2">
          <UiButton
            v-if="shareableBooks.includes(activeBook)"
            variant="secondary"
            :disabled="currentDataset.official_rows.length === 0"
            @click="openShareModal"
          >
            <Share2 class="h-4 w-4" aria-hidden="true" />
            Compartir
          </UiButton>
          <UiButton variant="primary" :disabled="downloading === activeBook || currentDataset.official_rows.length === 0" @click="downloadCsv(activeBook)">
            <Download class="h-4 w-4" aria-hidden="true" />
            Descargar CSV
          </UiButton>
        </div>
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
            <tr v-for="row in currentDataset.preview" :key="`${row.tipo_dte}-${row.numero_control || row.numero_documento}-${row.codigo_generacion || row.purchase_id || row.event_id}`">
              <td class="px-4 py-4">
                <div class="flex items-center gap-2 font-bold text-slate-950 dark:text-text">
                  <FileSpreadsheet class="h-4 w-4 text-sky-600 dark:text-primary" aria-hidden="true" />
                  {{ row.tipo_dte }} · {{ row.numero_control || row.numero_documento }}
                  <UiStatusBadge v-if="row.is_combustible" tone="warning">Combustible</UiStatusBadge>
                  <UiStatusBadge v-if="Number(row.document_count || 0) > 1" tone="info">{{ row.document_count }} DTE</UiStatusBadge>
                </div>
              </td>
              <td class="px-4 py-4 text-slate-700 dark:text-muted">{{ row.receptor_nombre || row.proveedor_nombre || row.detalle }}</td>
              <td class="px-4 py-4 text-slate-700 dark:text-muted">{{ row.fecha_emision || row.fecha_evento }}</td>
              <td class="px-4 py-4 text-right font-bold text-slate-950 dark:text-text">{{ totalLabel(row) }}</td>
            </tr>
            <tr v-if="!loading && currentDataset.preview.length === 0">
              <td class="px-4 py-8 text-center text-slate-500 dark:text-muted" colspan="4">Sin documentos para este periodo.</td>
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

    <UiModalShell
      :open="shareModalOpen"
      title="Compartir anexo"
      :description="`${bookLabels[activeBook]}${sharePeriodLabel ? ` · ${sharePeriodLabel}` : ''}`"
      max-width="max-w-lg"
      @close="closeShareModal"
    >
      <div class="space-y-5">
        <div class="space-y-3">
          <UiSelect
            v-if="shareContactOptions.length"
            label="Contacto guardado"
            :model-value="null"
            :options="shareContactOptions"
            placeholder="Elegir un contacto del contador..."
            @update:model-value="selectAccountantContact(String($event))"
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <UiEmailInput v-model="shareRecipientEmail" label="Correo del contador" placeholder="contador@empresa.com" />
            <UiInput v-model="shareRecipientName" label="Nombre (opcional)" placeholder="Nombre del contador" />
          </div>
          <UiPhoneInput v-model="sharePhone" label="Teléfono (opcional, para WhatsApp)" />
        </div>

        <div class="overflow-hidden rounded-md border border-slate-200 dark:border-line">
          <div class="flex items-center justify-between gap-4 p-4">
            <div class="flex min-w-0 items-start gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-700 dark:bg-primary-soft dark:text-primary"><Mail class="h-4 w-4" aria-hidden="true" /></span>
              <div class="min-w-0">
                <p class="font-bold text-slate-950 dark:text-text">Enviar por correo</p>
                <p class="text-xs text-slate-500 dark:text-soft">El CSV se adjunta al correo indicado.</p>
              </div>
            </div>
            <UiButton size="sm" :disabled="sharing !== null || !shareRecipientEmail" @click="emailAnnex(activeBook)">Enviar</UiButton>
          </div>
          <div class="flex items-center justify-between gap-4 border-t border-slate-200 p-4 dark:border-line">
            <div class="flex min-w-0 items-start gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-700 dark:bg-primary-soft dark:text-primary"><Link2 class="h-4 w-4" aria-hidden="true" /></span>
              <div class="min-w-0">
                <p class="font-bold text-slate-950 dark:text-text">Generar enlace</p>
                <p class="text-xs text-slate-500 dark:text-soft">Vence en 7 días. Se copia al portapapeles.</p>
              </div>
            </div>
            <UiButton size="sm" variant="secondary" :disabled="sharing !== null" @click="generateShareLink(activeBook)">Generar</UiButton>
          </div>
          <div class="flex items-center justify-between gap-4 border-t border-slate-200 p-4 dark:border-line">
            <div class="flex min-w-0 items-start gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-success/10 dark:text-success"><MessageCircle class="h-4 w-4" aria-hidden="true" /></span>
              <div class="min-w-0">
                <p class="font-bold text-slate-950 dark:text-text">Enviar por WhatsApp</p>
                <p class="text-xs text-slate-500 dark:text-soft">Abre WhatsApp con el enlace listo para enviar.</p>
              </div>
            </div>
            <UiButton size="sm" variant="success" :disabled="sharing !== null || !sharePhone" @click="sendAnnexWhatsApp(activeBook)">Enviar</UiButton>
          </div>
        </div>

        <p v-if="shareError" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {{ shareError }}
        </p>
        <p v-if="shareMessage" class="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CircleCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ shareMessage }}
        </p>
        <p v-if="lastShareLink" class="flex items-center gap-2 text-xs text-slate-500 dark:text-soft">
          <Clock class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Enlace vence el {{ new Date(lastShareLink.expiresAt * 1000).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' }) }}
        </p>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="closeShareModal">Listo</UiButton>
      </template>
    </UiModalShell>
  </section>
</template>
