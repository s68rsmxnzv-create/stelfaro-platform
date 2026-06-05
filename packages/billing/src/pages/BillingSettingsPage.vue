<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  CoreDteClient,
  type BillingCatalogs,
  type BillingContext,
  type BillingEmpresa,
  type BillingCompanyUpdatePayload,
  type BillingSettingsPayload,
  type BillingSignerVerification,
  type MhBearerVerification
} from '@stelfaro/api-client';
import { UiButton, UiCard, UiFiscalDocumentInput, UiInput, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const loading = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);
const searchQuery = ref('');
const signerStatus = ref<BillingSignerVerification | null>(null);
const bearerStatus = ref<MhBearerVerification | null>(null);
const context = ref<BillingContext | null>(null);
const certificateFile = ref<File | null>(null);
const companyLogoFile = ref<File | null>(null);
const companyLogoPreview = ref<string | null>(null);
const editingCredentials = ref(false);
const editingCompany = ref(false);
const brokenLogoIds = ref<Set<number>>(new Set());
const catalogs = ref<BillingCatalogs | null>(null);
const syncingCompany = ref(false);
const fiscalDocument = ref<FiscalDocumentDetection>({
  valid: false,
  type: '',
  typeLabel: '',
  number: '',
  message: 'Ingresa NIT largo de 14 digitos.'
});

const form = reactive<BillingSettingsPayload>({
  empresa_id: 0,
  ambiente: '00',
  certificado_id: null,
  active: true,
  transmission_provider: 'mh',
  signing_provider: 'jar',
  base_url: null,
  auth_url: null,
  reception_url: null,
  event_reception_url: null,
  query_url: null,
  signer_url: null,
  mh_nit: '',
  mh_user: '',
  mh_password: '',
  auth_payload_mode: 'form',
  auth_token_path: 'body.token',
  signer_nit: '',
  signer_password_pri: '',
  signer_activo: true
});

const companyForm = reactive({
  nombre_comercial: '',
  razon_social: '',
  documento_fiscal: '',
  nrc: '',
  codigo_actividad: '',
  desc_actividad: '',
  ambiente: '00' as '00' | '01',
  direccion: '',
  departamento: '',
  municipio: '',
  distrito: '',
  telefono: '',
  email: ''
});

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => empresa.id === form.empresa_id) ?? null);
const selectedSucursal = computed(() => selectedEmpresa.value?.sucursales[0] ?? null);
const selectedMhConfig = computed(() => selectedEmpresa.value?.mh_configs.find((config) => config.ambiente === form.ambiente) ?? null);
const certificados = computed(() => selectedEmpresa.value?.certificados.filter((cert) => cert.ambiente === form.ambiente) ?? []);
const selectedCertificate = computed(() => certificados.value.find((cert) => cert.id === form.certificado_id) ?? null);
const selectedDocumentLabel = computed(() => documentLabel(selectedEmpresa.value));
const environmentLabel = computed(() => form.ambiente === '01' ? 'Produccion' : 'Pruebas');
const isInactive = computed(() => selectedEmpresa.value?.lifecycle_status === 'inactive');
const departamentos = computed(() => catalogs.value?.departamentos ?? []);
const municipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(companyForm.departamento)));
const distritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(companyForm.departamento)
  && String(item.municipio) === String(companyForm.municipio)
)));
const actividadesEconomicas = computed(() => catalogs.value?.actividadesEconomicas ?? []);
const departamentoOptions = computed(() => departamentos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const municipioOptions = computed(() => municipios.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const distritoOptions = computed(() => distritos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const actividadOptions = computed(() => actividadesEconomicas.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const selectedActividad = computed(() => actividadesEconomicas.value.find((item) => item.code === companyForm.codigo_actividad) ?? null);
const canSaveCompany = computed(() => Boolean(
  selectedEmpresa.value
  && companyForm.nombre_comercial.trim()
  && companyForm.razon_social.trim()
  && fiscalDocument.value.valid
  && companyForm.codigo_actividad.trim()
  && companyForm.direccion.trim()
  && companyForm.departamento.trim()
  && companyForm.municipio.trim()
  && companyForm.distrito.trim()
));
const filteredEmpresas = computed(() => {
  const query = normalizeSearchText(searchQuery.value.trim());

  if (!query) {
    return [];
  }

  return empresas.value.filter((empresa) => matchesCompany(empresa, query));
});
const resultLabel = computed(() => {
  if (!searchQuery.value.trim()) {
    return 'Escribe para buscar';
  }

  return `${filteredEmpresas.value.length} resultado${filteredEmpresas.value.length === 1 ? '' : 's'}`;
});

onMounted(() => {
  void loadInitialData();
});

watch(selectedEmpresa, (empresa) => {
  syncCompanyForm(empresa);
}, { immediate: true });

watch(() => [form.empresa_id, form.ambiente] as const, () => {
  signerStatus.value = null;
  bearerStatus.value = null;
  saved.value = null;

  if (form.empresa_id) {
    void loadSettings();
  }
});

watch(() => companyForm.departamento, (value, oldValue) => {
  if (!syncingCompany.value && value !== oldValue && oldValue !== undefined) {
    companyForm.municipio = '';
    companyForm.distrito = '';
  }
});

watch(() => companyForm.municipio, (value, oldValue) => {
  if (!syncingCompany.value && value !== oldValue && oldValue !== undefined) {
    companyForm.distrito = '';
  }
});

watch(selectedActividad, (item) => {
  companyForm.desc_actividad = item?.label ?? companyForm.desc_actividad;
});

async function loadInitialData(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const [contextResult, catalogsResult] = await Promise.all([
      client.value.billingContext(),
      client.value.billingCatalogs()
    ]);

    context.value = contextResult;
    catalogs.value = catalogsResult;
    if (!empresas.value.some((empresa) => empresa.id === form.empresa_id)) {
      form.empresa_id = 0;
      form.ambiente = '00';
    }
    if (form.empresa_id) {
      await loadSettings();
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar las empresas.';
  } finally {
    loading.value = false;
  }
}

async function loadContext(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    context.value = await client.value.billingContext();
    if (!empresas.value.some((empresa) => empresa.id === form.empresa_id)) {
      form.empresa_id = 0;
      form.ambiente = '00';
    }
    if (form.empresa_id) {
      await loadSettings();
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar las empresas.';
  } finally {
    loading.value = false;
  }
}

async function loadSettings(): Promise<void> {
  if (!form.empresa_id) {
    resetSettings();
    return;
  }

  try {
    const response = await client.value.billingSettings(form.empresa_id, form.ambiente);

    if (!response.config) {
      resetSettings();
      return;
    }

    Object.assign(form, {
      certificado_id: response.config.certificado_id ?? null,
      active: response.config.active,
      transmission_provider: response.config.transmission_provider,
      signing_provider: response.config.signing_provider,
      base_url: response.config.base_url ?? null,
      auth_url: response.config.auth_url ?? null,
      reception_url: response.config.reception_url ?? null,
      event_reception_url: response.config.event_reception_url ?? null,
      query_url: response.config.query_url ?? null,
      signer_url: response.config.signer_url ?? null
    });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar la configuracion fiscal.';
  }
}

function resetSettings(): void {
  Object.assign(form, {
    certificado_id: null,
    active: true,
    transmission_provider: 'mh',
    signing_provider: 'jar',
    base_url: null,
    auth_url: null,
    reception_url: null,
    event_reception_url: null,
    query_url: null,
    signer_url: null,
    mh_nit: '',
    mh_user: '',
    mh_password: '',
    auth_payload_mode: 'form',
    auth_token_path: 'body.token',
    signer_nit: '',
    signer_password_pri: '',
    signer_activo: true
  });
}

function selectEmpresa(empresa: BillingEmpresa): void {
  form.empresa_id = empresa.id;
  form.ambiente = empresa.ambiente;
  editingCredentials.value = false;
  editingCompany.value = false;
}

function syncCompanyForm(empresa: BillingEmpresa | null): void {
  const sucursal = empresa?.sucursales[0] ?? null;
  syncingCompany.value = true;
  Object.assign(companyForm, {
    nombre_comercial: empresa?.nombre_comercial ?? '',
    razon_social: empresa?.razon_social ?? '',
    documento_fiscal: empresa?.fiscal_document_number ?? empresa?.nit ?? '',
    nrc: empresa?.nrc ?? '',
    codigo_actividad: empresa?.codigo_actividad ?? '',
    desc_actividad: empresa?.desc_actividad ?? '',
    ambiente: empresa?.ambiente ?? '00',
    direccion: sucursal?.direccion ?? '',
    departamento: sucursal?.departamento ?? '',
    municipio: sucursal?.municipio ?? '',
    distrito: sucursal?.distrito ?? '',
    telefono: sucursal?.telefono ?? '',
    email: sucursal?.email ?? ''
  });
  queueMicrotask(() => {
    syncingCompany.value = false;
  });
  companyLogoFile.value = null;
  companyLogoPreview.value = null;
}

async function saveSettings(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;
  signerStatus.value = null;
  bearerStatus.value = null;

  try {
    if (certificateFile.value) {
      const upload = await client.value.uploadCertificate({
        empresa_id: form.empresa_id,
        ambiente: form.ambiente,
        certificate: certificateFile.value
      });
      form.certificado_id = upload.certificate.id;
      certificateFile.value = null;
    }

    await client.value.saveBillingSettings(form);
    saved.value = 'Configuracion fiscal guardada.';
    editingCredentials.value = false;
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar la configuracion fiscal.';
  } finally {
    loading.value = false;
  }
}

async function saveCompanyData(): Promise<void> {
  if (!selectedEmpresa.value || !canSaveCompany.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;
  signerStatus.value = null;
  bearerStatus.value = null;

  const payload: BillingCompanyUpdatePayload = {
    tenant_nombre: companyForm.nombre_comercial,
    nombre_comercial: companyForm.nombre_comercial,
    razon_social: companyForm.razon_social,
    documento_fiscal: companyForm.documento_fiscal,
    nrc: blankToNull(companyForm.nrc),
    codigo_actividad: companyForm.codigo_actividad,
    desc_actividad: companyForm.desc_actividad,
    ambiente: companyForm.ambiente,
    direccion: companyForm.direccion,
    departamento: companyForm.departamento,
    municipio: companyForm.municipio,
    distrito: companyForm.distrito,
    telefono: blankToNull(companyForm.telefono),
    email: blankToNull(companyForm.email),
    logo: companyLogoFile.value
  };

  try {
    const response = await client.value.updateBillingCompany(selectedEmpresa.value.id, payload);
    form.ambiente = response.empresa.ambiente;
    saved.value = 'Datos de empresa guardados.';
    editingCompany.value = false;
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar los datos de la empresa.';
  } finally {
    loading.value = false;
  }
}

async function saveVisibleChanges(): Promise<void> {
  if (editingCompany.value) {
    await saveCompanyData();
    return;
  }

  await saveSettings();
}

async function verifySigner(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;
  signerStatus.value = null;
  bearerStatus.value = null;

  try {
    const response = await client.value.verifyBillingSigner({
      empresa_id: form.empresa_id,
      ambiente: form.ambiente
    });
    signerStatus.value = response.signer;
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible verificar la firma.';
  } finally {
    loading.value = false;
  }
}

async function requestBearer(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;
  signerStatus.value = null;
  bearerStatus.value = null;

  try {
    const response = await client.value.requestMhBearer({
      empresa_id: form.empresa_id,
      ambiente: form.ambiente,
      include_token: true
    });
    bearerStatus.value = response.auth;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible obtener bearer.';
  } finally {
    loading.value = false;
  }
}

async function updateCompanyStatus(status: 'active' | 'inactive'): Promise<void> {
  if (!selectedEmpresa.value) {
    return;
  }

  const action = status === 'active' ? 'activar' : 'desactivar';
  if (!window.confirm(`Confirma que deseas ${action} esta empresa.`)) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    await client.value.updateBillingCompanyStatus(selectedEmpresa.value.id, status);
    saved.value = status === 'active' ? 'Empresa activada.' : 'Empresa desactivada.';
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : `No fue posible ${action} la empresa.`;
  } finally {
    loading.value = false;
  }
}

async function deleteCompany(): Promise<void> {
  if (!selectedEmpresa.value || !window.confirm('Confirma que deseas borrar esta empresa. Se ocultara del modulo, pero quedara como borrado logico en el core.')) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    await client.value.deleteBillingCompany(selectedEmpresa.value.id);
    form.empresa_id = 0;
    saved.value = 'Empresa borrada.';
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible borrar la empresa.';
  } finally {
    loading.value = false;
  }
}

function setCertificate(event: Event): void {
  certificateFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function setCompanyLogo(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  companyLogoFile.value = file;
  companyLogoPreview.value = file ? URL.createObjectURL(file) : null;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function initials(empresa: BillingEmpresa): string {
  return empresa.nombre_comercial
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SF';
}

function documentLabel(empresa: BillingEmpresa | null): string {
  if (!empresa) {
    return 'Documento pendiente';
  }

  const type = empresa.fiscal_document_type === 'nit' ? 'NIT' : 'DUI/NIT';
  return `${type}: ${empresa.fiscal_document_number ?? empresa.nit}`;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function departmentCode(value: string | number | null | undefined): string {
  return String(value ?? '').padStart(2, '0');
}

function matchesCompany(empresa: BillingEmpresa, query: string): boolean {
  const normalizedText = normalizeSearchText([
    empresa.razon_social,
    empresa.nombre_comercial,
    empresa.nit,
    empresa.fiscal_document_number,
    empresa.nrc ?? ''
  ].join(' '));
  const normalizedDigits = [
    empresa.nit,
    empresa.fiscal_document_number,
    empresa.nrc ?? ''
  ].join('').replace(/\D/g, '');
  const queryDigits = query.replace(/\D/g, '');

  return normalizedText.includes(query) || (queryDigits.length > 0 && normalizedDigits.includes(queryDigits));
}

function hasLogo(empresa: BillingEmpresa): boolean {
  return Boolean(empresa.logo_url) && !brokenLogoIds.value.has(empresa.id);
}

function markLogoBroken(empresa: BillingEmpresa): void {
  brokenLogoIds.value = new Set([...brokenLogoIds.value, empresa.id]);
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Empresas</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950">Gestion de empresas</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-500">
          Busca contribuyentes, revisa su estado fiscal y valida firma o bearer con la configuracion guardada.
        </p>
      </div>
      <RouterLink to="/onboarding" class="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        Registrar empresa
      </RouterLink>
    </div>

    <UiCard>
      <div v-if="!empresas.length && !loading" class="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Aun no hay empresas registradas.
      </div>

      <div v-else class="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside class="space-y-5">
          <label class="block">
            <span class="text-sm font-semibold text-slate-800">Buscar empresa</span>
            <input
              v-model="searchQuery"
              class="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              placeholder="DUI, NIT, nombre fiscal o comercial"
              type="search"
            >
          </label>

          <div>
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-950">{{ resultLabel }}</p>
              <p class="text-xs text-slate-500">{{ empresas.length }} registradas</p>
            </div>

            <div class="space-y-2">
              <button
                v-for="empresa in filteredEmpresas"
                :key="empresa.id"
                type="button"
                class="w-full rounded-md border p-4 text-left transition hover:border-sky-300 hover:bg-slate-50"
                :class="empresa.id === form.empresa_id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'"
                @click="selectEmpresa(empresa)"
              >
                <div class="flex gap-3">
                  <img v-if="hasLogo(empresa)" :src="empresa.logo_url ?? ''" class="h-11 w-11 rounded-md border border-slate-200 object-contain" alt="" @error="markLogoBroken(empresa)">
                  <div v-else class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
                    {{ initials(empresa) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <p class="truncate text-sm font-semibold text-slate-950">{{ empresa.nombre_comercial }}</p>
                      <span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600" :class="empresa.lifecycle_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                        {{ empresa.lifecycle_status === 'active' ? 'Activa' : 'Inactiva' }}
                      </span>
                    </div>
                    <p class="mt-1 truncate text-xs text-slate-500">{{ empresa.razon_social }}</p>
                    <p class="mt-2 text-xs font-medium text-slate-700">{{ documentLabel(empresa) }}</p>
                  </div>
                </div>
              </button>

              <div v-if="!searchQuery.trim()" class="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                Escribe el DUI, NIT, nombre fiscal o nombre comercial para buscar una empresa.
              </div>

              <div v-else-if="!filteredEmpresas.length" class="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                No se encontro ninguna empresa con ese criterio.
              </div>
            </div>
          </div>
        </aside>

        <section v-if="selectedEmpresa" class="min-w-0 space-y-5">
          <div class="rounded-md border border-slate-200 bg-white p-5">
            <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex min-w-0 gap-4">
                <img v-if="hasLogo(selectedEmpresa)" :src="selectedEmpresa.logo_url ?? ''" class="h-16 w-16 rounded-md border border-slate-200 object-contain" alt="" @error="markLogoBroken(selectedEmpresa)">
                <div v-else class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-slate-900 text-lg font-bold text-white">
                  {{ initials(selectedEmpresa) }}
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="truncate text-xl font-bold text-slate-950">{{ selectedEmpresa.razon_social }}</h2>
                    <span class="rounded px-2 py-1 text-xs font-semibold" :class="isInactive ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'">
                      {{ isInactive ? 'Inactiva' : 'Activa' }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-slate-600">{{ selectedEmpresa.nombre_comercial }}</p>
                  <p class="mt-2 text-sm font-medium text-slate-800">{{ selectedDocumentLabel }}</p>
                  <p class="mt-1 text-sm text-slate-500">{{ selectedEmpresa.codigo_actividad }} · {{ selectedEmpresa.desc_actividad }}</p>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <UiButton variant="secondary" :disabled="loading" @click="editingCompany = !editingCompany">
                  {{ editingCompany ? 'Ocultar datos' : 'Editar datos' }}
                </UiButton>
                <UiButton v-if="isInactive" variant="secondary" :disabled="loading" @click="updateCompanyStatus('active')">Activar</UiButton>
                <UiButton v-else variant="secondary" :disabled="loading" @click="updateCompanyStatus('inactive')">Desactivar</UiButton>
                <UiButton variant="ghost" :disabled="loading" @click="deleteCompany">Borrar</UiButton>
              </div>
            </div>
          </div>

          <div v-if="editingCompany" class="rounded-md border border-slate-200 bg-white p-5">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-950">Datos de empresa</p>
                <p class="mt-1 text-xs text-slate-500">El documento fiscal para certificado y firmador debe ser NIT largo.</p>
              </div>
              <UiButton :disabled="loading || !canSaveCompany || isInactive" @click="saveCompanyData">Guardar datos</UiButton>
            </div>

            <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <UiInput v-model="companyForm.razon_social" label="Nombre del contribuyente" />
              <UiInput v-model="companyForm.nombre_comercial" label="Nombre comercial" />
              <UiFiscalDocumentInput v-model="companyForm.documento_fiscal" label="NIT" allowed-types="nit" @detected="fiscalDocument = $event" />
              <UiInput v-model="companyForm.nrc" label="NRC" />
              <UiSearchSelect v-model="companyForm.codigo_actividad" label="Actividad economica" :options="actividadOptions" placeholder="Buscar por codigo o descripcion" />
              <label class="block">
                <span class="text-sm font-medium text-slate-700">Logo</span>
                <span class="mt-1 flex items-center gap-3 rounded-md border border-slate-300 px-3 py-2">
                  <img v-if="companyLogoPreview" :src="companyLogoPreview" class="h-10 w-10 rounded object-contain" alt="">
                  <img v-else-if="hasLogo(selectedEmpresa)" :src="selectedEmpresa.logo_url ?? ''" class="h-10 w-10 rounded object-contain" alt="" @error="markLogoBroken(selectedEmpresa)">
                  <span v-else class="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-500">Logo</span>
                  <input class="min-w-0 flex-1 text-sm" type="file" accept="image/*" @change="setCompanyLogo">
                </span>
              </label>
              <UiInput v-model="companyForm.direccion" label="Direccion" />
              <UiSearchSelect v-model="companyForm.departamento" label="Departamento" :options="departamentoOptions" placeholder="Seleccionar departamento" />
              <UiSearchSelect v-model="companyForm.municipio" label="Municipio" :options="municipioOptions" :disabled="!companyForm.departamento" placeholder="Seleccionar municipio" />
              <UiSearchSelect v-model="companyForm.distrito" label="Distrito" :options="distritoOptions" :disabled="!companyForm.municipio" placeholder="Seleccionar distrito" />
              <UiInput v-model="companyForm.telefono" label="Telefono" />
              <UiInput v-model="companyForm.email" label="Correo" type="email" />
              <label class="block">
                <span class="text-sm font-medium text-slate-700">Ambiente base</span>
                <select v-model="companyForm.ambiente" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="00">00 · Pruebas</option>
                  <option value="01">01 · Produccion</option>
                </select>
              </label>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
              <UiButton :disabled="loading || !canSaveCompany || isInactive" @click="saveCompanyData">Guardar datos de empresa</UiButton>
              <p class="text-xs text-slate-500">Este guardado actualiza NIT, nombre, actividad, direccion y logo.</p>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3">
            <div class="rounded-md border border-slate-200 bg-white p-4 text-sm">
              <p class="font-semibold text-slate-950">Casa matriz</p>
              <p class="mt-2 text-slate-600">{{ selectedSucursal?.direccion ?? 'Direccion pendiente' }}</p>
              <p class="mt-1 text-slate-600">{{ selectedSucursal?.departamento }} / {{ selectedSucursal?.municipio }} / {{ selectedSucursal?.distrito ?? 'Distrito pendiente' }}</p>
            </div>
            <div class="rounded-md border border-slate-200 bg-white p-4 text-sm">
              <p class="font-semibold text-slate-950">Credenciales MH</p>
              <p class="mt-2" :class="selectedMhConfig?.credentials_configured ? 'text-emerald-700' : 'text-slate-500'">
                {{ selectedMhConfig?.credentials_configured ? 'Usuario API configurado' : 'Pendiente de configurar' }}
              </p>
              <p class="mt-1 text-slate-500">Ambiente {{ environmentLabel }}</p>
            </div>
            <div class="rounded-md border border-slate-200 bg-white p-4 text-sm">
              <p class="font-semibold text-slate-950">Firmador</p>
              <p class="mt-2" :class="selectedMhConfig?.signer_credentials_configured ? 'text-emerald-700' : 'text-slate-500'">
                {{ selectedMhConfig?.signer_credentials_configured ? 'Password privado configurado' : 'Pendiente de configurar' }}
              </p>
              <p class="mt-1 text-slate-500">{{ selectedMhConfig?.last_verified_at ? `Ultima verificacion: ${selectedMhConfig.last_verified_at}` : 'Sin verificacion registrada' }}</p>
            </div>
          </div>

          <div class="rounded-md border border-slate-200 bg-white p-5">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="block">
                <span class="text-sm font-medium text-slate-700">Ambiente</span>
                <select v-model="form.ambiente" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="00">00 · Pruebas</option>
                  <option value="01">01 · Produccion</option>
                </select>
              </label>

              <label class="block">
                <span class="text-sm font-medium text-slate-700">Certificado activo</span>
                <select v-model.number="form.certificado_id" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option :value="null">Sin certificado seleccionado</option>
                  <option v-for="cert in certificados" :key="cert.id" :value="cert.id">
                    #{{ cert.id }} · {{ cert.filename }} {{ cert.activo ? '(activo)' : '' }}
                  </option>
                </select>
                <p v-if="selectedCertificate?.vence_at" class="mt-1 text-xs text-slate-500">Vence: {{ selectedCertificate.vence_at }}</p>
              </label>

              <label class="block md:col-span-2">
                <span class="text-sm font-medium text-slate-700">Reemplazar certificado .p12/.crt</span>
                <input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="file" @change="setCertificate">
                <p v-if="certificateFile" class="mt-1 text-xs text-slate-500">{{ certificateFile.name }}</p>
              </label>
            </div>

            <div class="mt-5 border-t border-slate-200 pt-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Credenciales sensibles</p>
                  <p class="mt-1 text-xs text-slate-500">Se conservan las existentes si dejas los campos vacios.</p>
                </div>
                <UiButton variant="secondary" @click="editingCredentials = !editingCredentials">
                  {{ editingCredentials ? 'Ocultar' : 'Editar credenciales' }}
                </UiButton>
              </div>

              <div v-if="editingCredentials" class="mt-4 grid gap-4 md:grid-cols-2">
                <UiInput v-model="form.mh_user" label="MH Usuario API" placeholder="Dejar vacio para conservar" />
                <UiInput v-model="form.mh_password" label="MH Password API" type="password" placeholder="Dejar vacio para conservar" revealable />
                <UiInput v-model="form.signer_password_pri" label="Password privado certificado" type="password" placeholder="Dejar vacio para conservar" revealable />
              </div>
            </div>

            <div class="mt-6 flex flex-wrap items-center gap-3">
              <UiButton :disabled="loading || !form.empresa_id || isInactive || (editingCompany && !canSaveCompany)" @click="saveVisibleChanges">
                {{ editingCompany ? 'Guardar datos de empresa' : 'Guardar configuracion fiscal' }}
              </UiButton>
              <UiButton variant="secondary" :disabled="loading || !form.empresa_id || isInactive" @click="verifySigner">Verificar firma</UiButton>
              <UiButton variant="secondary" :disabled="loading || !form.empresa_id || isInactive" @click="requestBearer">Obtener bearer</UiButton>
              <p v-if="saved" class="text-sm text-emerald-700">{{ saved }}</p>
            </div>
          </div>

          <div v-if="signerStatus" class="rounded-md border p-3 text-sm" :class="signerStatus.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
            <p class="font-semibold">Firmador {{ signerStatus.available ? 'disponible' : 'no disponible' }}</p>
            <p v-if="signerStatus.status_code">HTTP {{ signerStatus.status_code }}</p>
            <p v-if="signerStatus.last_verified_at">Verificado: {{ signerStatus.last_verified_at }}</p>
            <p v-if="signerStatus.message">Detalle: {{ signerStatus.message }}</p>
          </div>

          <div v-if="bearerStatus" class="rounded-md border p-3 text-sm" :class="bearerStatus.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
            <p class="font-semibold">Bearer {{ bearerStatus.available ? 'obtenido' : 'no disponible' }}</p>
            <p v-if="bearerStatus.http_status" class="mt-1">HTTP {{ bearerStatus.http_status }}</p>
            <p v-if="bearerStatus.auth_url">Auth URL: {{ bearerStatus.auth_url }}</p>
            <p v-if="bearerStatus.token_preview">Token: {{ bearerStatus.token_preview }}</p>
            <p v-if="bearerStatus.cache_status">Origen: {{ bearerStatus.cache_status === 'cached' ? 'cache vigente' : 'renovado en MH' }}</p>
            <p v-if="bearerStatus.expires_at">Expira: {{ bearerStatus.expires_at }}</p>
            <p v-if="bearerStatus.received_at">Recibido: {{ bearerStatus.received_at }}</p>
            <p v-if="bearerStatus.message">Detalle: {{ bearerStatus.message }}</p>
          </div>
        </section>

        <section v-else class="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div>
            <p class="text-base font-semibold text-slate-900">Selecciona una empresa</p>
            <p class="mt-2 max-w-md text-sm text-slate-500">
              Busca por documento o nombre y elige un resultado para cargar su informacion fiscal, certificado, firma y bearer.
            </p>
          </div>
        </section>
      </div>

      <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>
  </div>
</template>
