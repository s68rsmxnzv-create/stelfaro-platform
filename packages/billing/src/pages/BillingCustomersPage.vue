<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, type BillingCatalogs, type BillingContext, type BillingCustomer } from '@stelfaro/api-client';
import { UiActionDropdown, UiActionMenuItem, UiButton, UiCard, UiDataTable, UiLoadingMark, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { BadgeCheck, CircleAlert, FileText, Pencil, RefreshCw, Trash2, UserCog, UserPlus } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BillingCustomerModal, { type BillingCustomerModalPayload } from '../components/BillingCustomerModal.vue';
import BillingFiscalCustomerModal, { type BillingFiscalCustomerModalPayload } from '../components/BillingFiscalCustomerModal.vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
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
const fiscalCustomerModalOpen = ref(false);
const fiscalCustomerTarget = ref<BillingCustomer | null>(null);
const modalDepartamento = ref('');
const modalMunicipio = ref('');
const toasts = ref([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

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

function openFiscal(customer: BillingCustomer): void {
  fiscalCustomerTarget.value = customer;
  modalDepartamento.value = customer.departamento ?? '';
  modalMunicipio.value = customer.municipio ?? '';
  fiscalCustomerModalOpen.value = true;
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
        departamento: payload.departamento,
        municipio: payload.municipio,
        distrito: payload.distrito,
        direccion_complemento: payload.direccion_complemento
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

async function saveFiscalCustomer(payload: BillingFiscalCustomerModalPayload): Promise<void> {
  if (!selectedEmpresa.value || !fiscalCustomerTarget.value) return;

  saving.value = true;
  try {
    await client.value.updateCustomer(fiscalCustomerTarget.value.id, payload);
    notify('Datos fiscales guardados', 'El cliente ya puede usarse para Crédito Fiscal.', 'success');
    fiscalCustomerModalOpen.value = false;
    fiscalCustomerTarget.value = null;
    await loadCustomers();
  } catch (error) {
    notify('No se pudieron guardar los datos fiscales', messageFromError(error), 'error');
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
    departamento: customer.departamento,
    municipio: customer.municipio,
    distrito: customer.distrito,
    direccion_complemento: customer.direccion_complemento
  };
}

function fiscalInitialValue(customer: BillingCustomer | null): Partial<BillingFiscalCustomerModalPayload> | null {
  if (!customer) return null;

  return {
    name: customer.name,
    document_type: '36',
    document_number: customer.nit ?? customer.document_number ?? '',
    nit: customer.nit ?? customer.document_number ?? '',
    nrc: customer.nrc ?? '',
    cod_actividad: customer.cod_actividad ?? '',
    desc_actividad: customer.desc_actividad ?? '',
    nombre_comercial: customer.nombre_comercial ?? customer.name,
    departamento: customer.departamento ?? '',
    municipio: customer.municipio ?? '',
    distrito: customer.distrito ?? '',
    direccion_complemento: customer.direccion_complemento ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? ''
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
                <UiActionMenuItem @select="openFiscal(customer)">
                  <template #icon><UserCog class="h-5 w-5 text-sky-600" aria-hidden="true" /></template>
                  Datos fiscales
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
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="customerModalOpen = false"
      @save="saveCustomer"
      @update:departamento="modalDepartamento = $event"
      @update:municipio="modalMunicipio = $event"
    />

    <BillingFiscalCustomerModal
      :open="fiscalCustomerModalOpen"
      :loading="saving"
      :initial-value="fiscalInitialValue(fiscalCustomerTarget)"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="fiscalCustomerModalOpen = false"
      @save="saveFiscalCustomer"
      @update:departamento="modalDepartamento = $event"
      @update:municipio="modalMunicipio = $event"
    />
  </section>
</template>
