<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, type BillingCatalogs, type BillingContext, type BillingCustomer, type DteDraftSummary, type PaginationMeta } from '@stelfaro/api-client';
import { currency, fiscalDateTime } from '@stelfaro/shared';
import { UiActionDropdown, UiActionMenuItem, UiButton, UiCard, UiDataTable, UiLoadingMark, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { BadgeCheck, CircleAlert, FileJson, FileText, History, Pencil, RefreshCw, Trash2, UserPlus } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingModalShell from '../components/BillingModalShell.vue';
import { getBillingCatalogs, getBillingContext, peekBillingCatalogs, peekBillingContext } from '../support/billingDataCache';

type SelectOption = {
  value: string | number;
  label: string;
  hint?: string;
};

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
const context = ref<BillingContext | null>(peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope));
const catalogs = ref<BillingCatalogs | null>(peekBillingCatalogs(props.coreBaseUrl, props.billingContextCacheScope));
const customers = ref<BillingCustomer[]>([]);
const loading = ref(false);
const contextLoading = ref(false);
const saving = ref(false);
const selectedEmpresaId = ref<number | null>(null);
const filters = ref({
  q: '',
  tipoDte: ''
});
const customerModalOpen = ref(false);
const customerModalMode = ref<'new' | 'edit'>('new');
const editingCustomer = ref<BillingCustomer | null>(null);
const historyModalOpen = ref(false);
const historyCustomer = ref<BillingCustomer | null>(null);
const historyDocuments = ref<DteDraftSummary[]>([]);
const historyMeta = ref<PaginationMeta | null>(null);
const historyPage = ref(1);
const historyLoading = ref(false);
const openingPdfId = ref<number | null>(null);
const openingJsonId = ref<number | null>(null);
const modalDepartamento = ref('');
const modalMunicipio = ref('');
const toasts = ref([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
const historyPageSize = 8;

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => Number(empresa.id) === Number(selectedEmpresaId.value)) ?? empresas.value[0] ?? null);
const empresaOptions = computed<SelectOption[]>(() => empresas.value.map((empresa) => ({
  value: empresa.id,
  label: empresa.nombre_comercial || empresa.razon_social || `Empresa ${empresa.id}`
})));
const tipoOptions = [
  { value: '', label: 'Todos' },
  { value: '01', label: 'Consumidor final' },
  { value: '03', label: 'Crédito fiscal' }
];
const departamentos = computed(() => catalogs.value?.departamentos ?? []);
const municipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(modalDepartamento.value)));
const distritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(modalDepartamento.value)
  && String(item.municipio) === String(modalMunicipio.value)
)));
const actividadesEconomicas = computed(() => catalogs.value?.actividadesEconomicas ?? []);
const departamentoOptions = computed(() => departamentos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const municipioOptions = computed(() => municipios.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const distritoOptions = computed(() => distritos.value.map((item) => ({
  value: item.code,
  label: item.label.replace(/^Distrito\s+/i, ''),
  hint: item.code
})));
const actividadOptions = computed(() => actividadesEconomicas.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
watch(() => props.authToken, () => {
  initialize();
}, { immediate: true });

watch(selectedEmpresaId, () => {
  loadCustomers();
});

watch(() => filters.value.q, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const query = filters.value.q.trim();
    if (query.length === 0 || query.length >= 2) {
      void loadCustomers();
    }
  }, 250);
});

watch(() => filters.value.tipoDte, () => {
  void loadCustomers();
});

onMounted(() => {
  initialize();
});

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
});

async function initialize(): Promise<void> {
  if (!props.authToken) return;

  contextLoading.value = true;
  try {
    const [contextResponse, catalogsResponse] = await Promise.all([
      getBillingContext(client.value, props.coreBaseUrl, props.billingContextCacheScope),
      getBillingCatalogs(client.value, props.coreBaseUrl, props.billingContextCacheScope)
    ]);
    context.value = contextResponse;
    catalogs.value = catalogsResponse;
    selectedEmpresaId.value = selectedEmpresaId.value || contextResponse.empresas[0]?.id || null;
    await loadCustomers();
  } catch (error) {
    notify('No se pudieron cargar los clientes', messageFromError(error), 'error');
  } finally {
    contextLoading.value = false;
  }
}

async function loadCustomers(): Promise<void> {
  if (!props.authToken || !selectedEmpresa.value) {
    customers.value = [];
    return;
  }

  loading.value = true;
  try {
    const response = await client.value.customers({
      empresa_id: selectedEmpresa.value.id,
      tipo_dte: filters.value.tipoDte || undefined,
      q: filters.value.q.trim() || undefined
    });
    customers.value = response.data;
  } catch (error) {
    customers.value = [];
    notify('No se pudo actualizar la lista', messageFromError(error), 'error');
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editingCustomer.value = null;
  customerModalMode.value = 'new';
  modalDepartamento.value = '';
  modalMunicipio.value = '';
  customerModalOpen.value = true;
}

function openEdit(customer: BillingCustomer): void {
  editingCustomer.value = customer;
  customerModalMode.value = 'edit';
  modalDepartamento.value = customer.departamento ?? '';
  modalMunicipio.value = customer.municipio ?? '';
  customerModalOpen.value = true;
}

function openHistory(customer: BillingCustomer): void {
  const document = customerHistoryDocument(customer);
  if (!document) {
    notify('Sin documento', 'Agrega DUI o NIT para buscar el historial de facturacion.', 'error');
    return;
  }

  historyCustomer.value = customer;
  historyDocuments.value = [];
  historyMeta.value = null;
  historyPage.value = 1;
  historyModalOpen.value = true;
  void loadCustomerHistory();
}

async function loadCustomerHistory(): Promise<void> {
  if (!selectedEmpresa.value || !historyCustomer.value) return;

  const document = customerHistoryDocument(historyCustomer.value);
  if (!document) return;

  historyLoading.value = true;
  try {
    const response = await client.value.documents({
      empresa_id: selectedEmpresa.value.id,
      receptor_document: document,
      estado: 'accepted',
      limit: historyPageSize,
      page: historyPage.value
    });
    historyDocuments.value = response.data;
    historyMeta.value = response.meta ?? null;
  } catch (error) {
    historyDocuments.value = [];
    notify('No se pudo cargar el historial', messageFromError(error), 'error');
  } finally {
    historyLoading.value = false;
  }
}

function goToHistoryPage(page: number): void {
  const lastPage = historyMeta.value?.last_page ?? 1;
  const nextPage = Math.min(Math.max(page, 1), lastPage);
  if (nextPage === historyPage.value) return;

  historyPage.value = nextPage;
  void loadCustomerHistory();
}

async function openHistoryPdf(document: DteDraftSummary): Promise<void> {
  const target = window.open('about:blank', '_blank');
  openingPdfId.value = document.id;
  try {
    const pdf = await client.value.graphicRepresentationPdf(document.id);
    openBlob(target, pdf, 'PDF');
  } catch (error) {
    if (target) target.close();
    notify('No se pudo abrir el PDF', messageFromError(error), 'error');
  } finally {
    openingPdfId.value = null;
  }
}

async function openHistoryJson(document: DteDraftSummary): Promise<void> {
  const target = window.open('about:blank', '_blank');
  openingJsonId.value = document.id;
  try {
    const detail = await client.value.document(document.id);
    const payload = detail.payload ?? detail.dte_json;
    if (!payload) {
      if (target) target.close();
      notify('JSON no disponible', 'Este comprobante no tiene JSON para mostrar.', 'error');
      return;
    }

    openJsonBlob(target, clientDteJson(detail, payload));
  } catch (error) {
    if (target) target.close();
    notify('No se pudo abrir el JSON', messageFromError(error), 'error');
  } finally {
    openingJsonId.value = null;
  }
}

async function saveCustomer(payload: BillingCustomerModalPayload): Promise<void> {
  if (!selectedEmpresa.value) return;

  saving.value = true;
  try {
    if (editingCustomer.value) {
      await client.value.updateCustomer(editingCustomer.value.id, {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        document_type: payload.document_type,
        document_number: payload.document_number,
        nit: payload.nit,
        nrc: payload.nrc,
        cod_actividad: payload.cod_actividad,
        desc_actividad: payload.desc_actividad,
        nombre_comercial: payload.nombre_comercial,
        departamento: payload.departamento,
        municipio: payload.municipio,
        distrito: payload.distrito,
        direccion_complemento: payload.direccion_complemento,
        allowed_dte_codes: payload.allowed_dte_codes
      });
      notify('Cliente actualizado', 'Los cambios quedaron guardados.', 'success');
    } else {
      await client.value.saveCustomer({
        empresa_id: selectedEmpresa.value.id,
        ...payload,
        allowed_dte_codes: ['01']
      });
      notify('Cliente creado', 'Ya está disponible para facturar.', 'success');
    }
    customerModalOpen.value = false;
    editingCustomer.value = null;
    await loadCustomers();
  } catch (error) {
    notify('No se pudo guardar el cliente', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function deactivateCustomer(customer: BillingCustomer): Promise<void> {
  if (!window.confirm(`¿Desactivar a ${customer.name}? No aparecerá como cliente activo.`)) return;

  saving.value = true;
  try {
    await client.value.deleteCustomer(customer.id);
    notify('Cliente desactivado', 'Se ocultó de las búsquedas activas.', 'success');
    await loadCustomers();
  } catch (error) {
    notify('No se pudo desactivar', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function customerInitialValue(customer: BillingCustomer | null): Partial<BillingCustomerModalPayload> | null {
  if (!customer) return null;

  return {
    name: customer.name,
    document_type: customer.document_type,
    document_number: formatFiscalDocument(customer.document_number ?? customer.nit ?? ''),
    email: customer.email,
    phone: customer.phone,
    nit: customer.nit,
    nrc: customer.nrc,
    cod_actividad: customer.cod_actividad,
    desc_actividad: customer.desc_actividad,
    nombre_comercial: customer.nombre_comercial,
    departamento: customer.departamento,
    municipio: customer.municipio,
    distrito: customer.distrito,
    direccion_complemento: customer.direccion_complemento,
    allowed_dte_codes: customer.allowed_dte_codes
  };
}

function isAllowed(customer: BillingCustomer, code: string): boolean {
  return (customer.allowed_dte_codes ?? []).includes(code);
}

function isFiscalReady(customer: BillingCustomer): boolean {
  return Boolean(
    (customer.nit || customer.document_number)
    && customer.nrc
    && customer.cod_actividad
    && customer.desc_actividad
    && customer.departamento
    && customer.municipio
    && customer.distrito
    && customer.direccion_complemento
    && customer.email
  );
}

function customerDocumentLabel(customer: BillingCustomer): string {
  const value = customer.document_number ?? customer.nit ?? '';
  if (!value) return 'Sin documento';

  return `${customer.document_type === '36' || value.length === 14 ? 'NIT' : 'DUI'} ${formatFiscalDocument(value)}`;
}

function customerContactLabel(customer: BillingCustomer): string {
  return [customer.email, customer.phone].filter(Boolean).join(' · ') || 'Sin contacto';
}

function customerHistoryDocument(customer: BillingCustomer): string {
  return String(customer.document_number ?? customer.nit ?? '').replace(/\D+/g, '');
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

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['accepted', 'received_by_mh'].includes(normalized)) return 'success';
  if (['rejected', 'failed'].includes(normalized)) return 'danger';
  if (['draft', 'ready_to_sign', 'signed', 'sent'].includes(normalized)) return 'warning';

  return 'neutral';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    accepted: 'Aceptado',
    received_by_mh: 'Aceptado',
    rejected: 'Rechazado',
    draft: 'Borrador',
    ready_to_sign: 'Listo',
    signed: 'Firmado',
    sent: 'Enviado'
  };

  return labels[status] ?? status;
}

function historyTotal(): number {
  return historyDocuments.value.reduce((total, document) => total + Number(document.totalPagar ?? 0), 0);
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
  notify(`No se pudo abrir ${label}`, 'El navegador bloqueo la nueva pestana.', 'error');
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function formatFiscalDocument(value: string): string {
  const digits = String(value || '').replace(/\D+/g, '').slice(0, 14);
  if (digits.length <= 8) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 8)}-${digits.slice(8)}`;

  return [
    digits.slice(0, 4),
    digits.slice(4, 10),
    digits.slice(10, 13),
    digits.slice(13, 14)
  ].filter(Boolean).join('-');
}

function departmentCode(value: string | number | null | undefined): string {
  const digits = String(value ?? '').replace(/\D+/g, '');
  return digits.padStart(2, '0');
}

function notify(title: string, message?: string | null, variant = 'info'): void {
  const id = `${Date.now()}-${Math.random()}`;
  toasts.value.push({ id, title, message, variant });
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }, 4300);
}

function messageFromError(error): string {
  return error?.message || 'Revisá los datos e intentá nuevamente.';
}
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />

    <UiCard>
      <div class="grid gap-3 lg:grid-cols-[220px_1fr_180px_auto_auto]">
        <UiSelect
          v-model.number="selectedEmpresaId"
          label="Empresa"
          :options="empresaOptions"
          :disabled="empresaOptions.length <= 1"
        />
        <UiSearchInput
          v-model="filters.q"
          label="Buscar cliente"
          placeholder="Nombre, documento, NRC, correo o teléfono"
          @search="loadCustomers"
        />
        <UiSelect v-model="filters.tipoDte" label="Uso" :options="tipoOptions" />
        <div class="flex items-end">
          <UiButton variant="secondary" :disabled="loading" @click="loadCustomers">
            <RefreshCw class="mr-2 h-5 w-5" aria-hidden="true" />
            Actualizar
          </UiButton>
        </div>
        <div class="flex items-end">
          <UiButton :disabled="contextLoading || !selectedEmpresa" @click="openCreate">
            <UserPlus class="mr-2 h-5 w-5" aria-hidden="true" />
            Nuevo cliente
          </UiButton>
        </div>
      </div>
    </UiCard>

    <UiCard>
      <UiDataTable overflow="auto" min-width="min-w-[980px]">
        <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
          <tr>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Documento</th>
            <th class="px-4 py-3">Contacto</th>
            <th class="px-4 py-3">Uso</th>
            <th class="px-4 py-3">Fiscal</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-line">
          <tr v-if="loading || contextLoading">
            <td class="px-4 py-8" colspan="6">
              <UiLoadingMark label="Cargando clientes" />
            </td>
          </tr>
          <tr v-else-if="customers.length === 0">
            <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="6">Aún no hay clientes con estos filtros.</td>
          </tr>
          <tr v-for="customer in customers" v-else :key="customer.id" class="text-sm">
            <td class="px-4 py-3">
              <p class="font-semibold text-slate-950 dark:text-text">{{ customer.name }}</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-soft">{{ customer.nombre_comercial || 'Sin nombre comercial' }}</p>
            </td>
            <td class="px-4 py-3 text-slate-700 dark:text-muted">{{ customerDocumentLabel(customer) }}</td>
            <td class="px-4 py-3 text-slate-700 dark:text-muted">{{ customerContactLabel(customer) }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <UiStatusBadge v-if="isAllowed(customer, '01')" tone="info">
                  <FileText class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  FE
                </UiStatusBadge>
                <UiStatusBadge v-if="isAllowed(customer, '03')" tone="success">
                  <FileText class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  CCF
                </UiStatusBadge>
                <UiStatusBadge v-if="!isAllowed(customer, '01') && !isAllowed(customer, '03')" tone="neutral">Sin uso</UiStatusBadge>
              </div>
            </td>
            <td class="px-4 py-3">
              <UiStatusBadge :tone="isFiscalReady(customer) ? 'success' : 'warning'">
                <BadgeCheck v-if="isFiscalReady(customer)" class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                <CircleAlert v-else class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {{ isFiscalReady(customer) ? 'Completo' : 'Pendiente' }}
              </UiStatusBadge>
            </td>
            <td class="px-4 py-3">
              <UiActionDropdown :label="`Abrir acciones de ${customer.name}`" menu-width="w-48">
                <UiActionMenuItem @select="openEdit(customer)">
                  <template #icon><Pencil class="h-5 w-5 text-sky-600" aria-hidden="true" /></template>
                  Editar
                </UiActionMenuItem>
                <UiActionMenuItem @select="openHistory(customer)">
                  <template #icon><History class="h-5 w-5 text-sky-600" aria-hidden="true" /></template>
                  Historial de facturación
                </UiActionMenuItem>
                <UiActionMenuItem separated tone="danger" :disabled="saving" @select="deactivateCustomer(customer)">
                  <template #icon><Trash2 class="h-5 w-5" aria-hidden="true" /></template>
                  Desactivar
                </UiActionMenuItem>
              </UiActionDropdown>
            </td>
          </tr>
        </tbody>
      </UiDataTable>
    </UiCard>

    <BillingCustomerModal
      :open="customerModalOpen"
      :mode="customerModalMode"
      :loading="saving"
      :initial-value="customerInitialValue(editingCustomer)"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="customerModalOpen = false"
      @save="saveCustomer"
      @update:departamento="modalDepartamento = $event"
      @update:municipio="modalMunicipio = $event"
    />

    <BillingModalShell
      :open="historyModalOpen"
      eyebrow="CLIENTE"
      title="Historial de facturación"
      :description="historyCustomer ? `${historyCustomer.name} · ${customerDocumentLabel(historyCustomer)}` : null"
      max-width="max-w-5xl"
      body-class="space-y-4 px-5 py-5"
      @close="historyModalOpen = false"
    >
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted">
          <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Comprobantes</p>
          <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ historyMeta?.total ?? historyDocuments.length }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted">
          <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Total visible</p>
          <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ currency(historyTotal()) }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted">
          <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Documento</p>
          <p class="mt-2 truncate text-lg font-bold text-slate-950 dark:text-text">{{ historyCustomer ? customerDocumentLabel(historyCustomer) : 'Sin documento' }}</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-md border border-slate-200 dark:border-line">
        <UiDataTable overflow="auto" min-width="min-w-[780px]">
          <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
            <tr>
              <th class="px-4 py-3">Comprobante</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3 text-right">Total</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-line">
            <tr v-if="historyLoading">
              <td class="px-4 py-8" colspan="6">
                <UiLoadingMark label="Cargando historial" />
              </td>
            </tr>
            <tr v-else-if="historyDocuments.length === 0">
              <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="6">No hay comprobantes aceptados para este cliente.</td>
            </tr>
            <tr v-for="document in historyDocuments" v-else :key="document.id" class="text-sm">
              <td class="min-w-0 px-4 py-3">
                <p class="truncate font-semibold text-slate-950 dark:text-text">{{ document.numeroControl }}</p>
                <p class="mt-1 truncate font-mono text-xs text-slate-500 dark:text-soft">{{ document.codigoGeneracion }}</p>
              </td>
              <td class="px-4 py-3 text-slate-700 dark:text-muted">{{ typeLabel(document.tipoDte) }}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-muted">{{ fiscalDateTime(document.processed_at ?? document.created_at) }}</td>
              <td class="px-4 py-3 text-right font-semibold text-slate-950 dark:text-text">{{ currency(document.totalPagar ?? 0) }}</td>
              <td class="px-4 py-3">
                <UiStatusBadge :tone="statusTone(document.estado)">{{ statusLabel(document.estado) }}</UiStatusBadge>
              </td>
              <td class="px-4 py-3">
                <UiActionDropdown label="Abrir acciones del comprobante" menu-width="w-52">
                  <UiActionMenuItem :disabled="openingPdfId === document.id" @select="openHistoryPdf(document)">
                    <template #icon><FileText class="h-5 w-5 text-sky-600" aria-hidden="true" /></template>
                    {{ openingPdfId === document.id ? 'Abriendo PDF...' : 'Abrir PDF' }}
                  </UiActionMenuItem>
                  <UiActionMenuItem @select="openHistoryJson(document)">
                    <template #icon><FileJson class="h-5 w-5 text-sky-600" aria-hidden="true" /></template>
                    {{ openingJsonId === document.id ? 'Abriendo JSON...' : 'Abrir JSON' }}
                  </UiActionMenuItem>
                </UiActionDropdown>
              </td>
            </tr>
          </tbody>
        </UiDataTable>
      </div>

      <template v-if="historyMeta && historyMeta.last_page > 1" #footer>
        <UiButton variant="secondary" :disabled="historyLoading || historyPage <= 1" @click="goToHistoryPage(historyPage - 1)">Anterior</UiButton>
        <span class="self-center text-sm font-semibold text-slate-600 dark:text-muted">
          Página {{ historyMeta.current_page }} de {{ historyMeta.last_page }}
        </span>
        <UiButton variant="secondary" :disabled="historyLoading || historyPage >= historyMeta.last_page" @click="goToHistoryPage(historyPage + 1)">Siguiente</UiButton>
      </template>
    </BillingModalShell>
  </section>
</template>
