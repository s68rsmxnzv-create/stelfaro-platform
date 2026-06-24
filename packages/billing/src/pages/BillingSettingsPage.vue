<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  CoreDteClient,
  PlatformClient,
  type BillingCatalogs,
  type BillingContext,
  type BillingCertificate,
  type BillingCorrelativoAdmin,
  type BillingEmpresa,
  type BillingPuntoVenta,
  type BillingSucursal,
  type BillingCompanyUpdatePayload,
  type BillingSettingsPayload,
  type BillingSignerVerification,
  type DteDashboardSummary,
  type MhBearerVerification
} from '@stelfaro/api-client';
import { UiButton, UiCard, UiEmailInput, UiFileUpload, UiFiscalDocumentInput, UiInput, UiLogoUpload, UiPasswordInput, UiPhoneInput, UiRefreshButton, UiSaveIcon, UiSearchInput, UiSearchSelect, UiStatusBadge, UiToggle, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingModalShell from '../components/BillingModalShell.vue';
import BillingProcessToastOverlay from '../components/BillingProcessToastOverlay.vue';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  platformBaseUrl?: string | null;
  authToken?: string | null;
  requestCredentials?: RequestCredentials;
  detailMode?: boolean;
  alwaysShowCompanySearch?: boolean;
  companyAction?: { action: 'summary' | 'edit' | 'edit-data' | 'edit-fiscal' | 'edit-sucursales' | 'edit-correlativos' | 'toggle-status' | 'delete'; nonce: number } | null;
}>(), {
  coreBaseUrl: '/api/v1',
  platformBaseUrl: null,
  authToken: null,
  requestCredentials: undefined,
  detailMode: false,
  alwaysShowCompanySearch: false,
  companyAction: null
});

const emit = defineEmits<{
  companySelected: [company: { id: number; coreEmpresaId: number; name: string; tradeName: string; documentLabel: string; lifecycleStatus: string; ambiente: '00' | '01' }];
  companyCleared: [];
  companyViewChanged: [view: 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos'];
}>();

const client = computed(() => new CoreDteClient(props.coreBaseUrl, {
  authToken: props.authToken,
  credentials: props.requestCredentials
}));
const platformClient = computed(() => props.platformBaseUrl
  ? new PlatformClient(props.platformBaseUrl, {
    authToken: props.authToken,
    credentials: props.requestCredentials
  })
  : null);
const loading = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);
const deleteOverlayOpen = ref(false);
const deleteOverlayVariant = ref<'loading' | 'success' | 'warning' | 'error'>('loading');
const deleteOverlayTitle = ref('Eliminando empresa');
const deleteOverlayMessage = ref('Preparando borrado definitivo.');
const searchQuery = ref('');
const signerStatus = ref<BillingSignerVerification | null>(null);
const bearerStatus = ref<MhBearerVerification | null>(null);
const companySummary = ref<DteDashboardSummary | null>(null);
const correlativos = ref<BillingCorrelativoAdmin[]>([]);
const correlativoDrafts = ref<Record<number, string>>({});
const correlativosLoading = ref(false);
const savingCorrelativoId = ref<number | null>(null);
const healthOpen = ref(false);
const context = ref<BillingContext | null>(null);
const certificateFile = ref<File | null>(null);
const companyLogoFile = ref<File | null>(null);
const companyLogoPreview = ref<string | null>(null);
const editingCredentials = ref(false);
const editingCompany = ref(false);
const editingFiscal = ref(false);
const editingSucursales = ref(false);
const editingCorrelativos = ref(false);
const selectedSucursalId = ref<number | null>(null);
const selectedPuntoVentaId = ref<number | null>(null);
const creatingSucursal = ref(false);
const creatingPuntoVenta = ref(false);
const brokenLogoIds = ref<Set<number>>(new Set());
const companyActivities = ref<string[]>(['']);
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
  signer_activo: true,
  simulate_unavailable: false
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

const sucursalForm = reactive({
  nombre: '',
  codigo: '',
  direccion: '',
  departamento: '',
  municipio: '',
  distrito: '',
  telefono: '',
  email: ''
});

const newSucursalForm = reactive({
  nombre: '',
  codigo: '',
  direccion: '',
  departamento: '',
  municipio: '',
  distrito: '',
  telefono: '',
  email: '',
  punto_venta_codigo: 'P001',
  punto_venta_nombre: 'Caja principal'
});

const puntoVentaForm = reactive({
  codigo: '',
  nombre: '',
  tipo: 'terminal'
});

const newPuntoVentaForm = reactive({
  codigo: '',
  nombre: '',
  tipo: 'terminal'
});

const empresas = computed(() => context.value?.empresas ?? []);
const singleCompanyScope = computed(() => empresas.value.length === 1);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => empresa.id === form.empresa_id) ?? null);
const showCompanySearch = computed(() => {
  if (props.alwaysShowCompanySearch && !props.detailMode) {
    return true;
  }

  return !singleCompanyScope.value && !(props.detailMode && selectedEmpresa.value);
});
const sucursales = computed(() => selectedEmpresa.value?.sucursales ?? []);
const selectedSucursal = computed<BillingSucursal | null>(() => {
  const byId = sucursales.value.find((sucursal) => sucursal.id === selectedSucursalId.value);
  return byId ?? sucursales.value[0] ?? null;
});
const puntosVenta = computed(() => selectedSucursal.value?.puntosVenta ?? []);
const selectedPuntoVenta = computed<BillingPuntoVenta | null>(() => {
  const byId = puntosVenta.value.find((punto) => punto.id === selectedPuntoVentaId.value);
  return byId ?? puntosVenta.value[0] ?? null;
});
const selectedMhConfig = computed(() => selectedEmpresa.value?.mh_configs.find((config) => config.ambiente === form.ambiente) ?? null);
const selectedAuthStatus = computed(() => selectedMhConfig.value?.last_auth ?? null);
const selectedSignerSync = computed(() => selectedMhConfig.value?.signer_sync ?? null);
const certificados = computed(() => selectedEmpresa.value?.certificados.filter((cert) => cert.ambiente === form.ambiente) ?? []);
const selectedCertificate = computed(() => certificados.value.find((cert) => cert.id === form.certificado_id) ?? null);
const activeCertificate = computed(() => selectedCertificate.value ?? certificados.value.find((cert) => cert.activo) ?? null);
const activeCertificatesByEnvironment = computed(() => certificateEnvironmentRows(selectedEmpresa.value));
const activeCertificatesForEnvironment = computed(() => certificados.value.filter((cert) => cert.activo));
const hasCertificateConflict = computed(() => activeCertificatesForEnvironment.value.length > 1);
const correlativoRows = computed(() => correlativos.value.filter((correlativo) => (
  correlativo.activo
  && (!selectedSucursal.value || correlativo.sucursal_id === selectedSucursal.value.id)
  && (!selectedPuntoVenta.value || correlativo.punto_venta_id === selectedPuntoVenta.value.id)
)));
const selectedDocumentLabel = computed(() => documentLabel(selectedEmpresa.value));
const environmentLabel = computed(() => form.ambiente === '01' ? 'Produccion' : 'Pruebas');
const isInactive = computed(() => selectedEmpresa.value?.lifecycle_status === 'inactive');
const fiscalHealth = computed(() => {
  const authReady = selectedAuthStatus.value?.status === 'ok' || Boolean(selectedMhConfig.value?.credentials_configured && !selectedAuthStatus.value);
  const signerReady = selectedSignerSync.value?.available === true;

  if (isInactive.value) {
    return {
      label: 'Inactiva',
      detail: 'La empresa no esta disponible para operar.',
      tone: 'slate',
      authReady,
      signerReady
    };
  }

  if (authReady && signerReady) {
    return {
      label: 'Salud OK',
      detail: 'Autorizacion MH y firmador listos.',
      tone: 'success',
      authReady,
      signerReady
    };
  }

  if (authReady || signerReady) {
    return {
      label: 'Parcial',
      detail: 'Uno de los servicios fiscales necesita atencion.',
      tone: 'warning',
      authReady,
      signerReady
    };
  }

  return {
    label: 'Revisar',
    detail: 'Autorizacion MH y firmador pendientes.',
    tone: 'danger',
    authReady,
    signerReady
  };
});
const departamentos = computed(() => catalogs.value?.departamentos ?? []);
const municipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(companyForm.departamento)));
const distritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(companyForm.departamento)
  && String(item.municipio) === String(companyForm.municipio)
)));
const actividadesEconomicas = computed(() => catalogs.value?.actividadesEconomicas ?? []);
const authStatusLabel = computed(() => {
  if (selectedAuthStatus.value?.status === 'ok') {
    return 'Autorizacion verificada';
  }

  return selectedMhConfig.value?.credentials_configured ? 'Usuario API configurado' : 'Pendiente de credenciales MH';
});
const authStatusClass = computed(() => selectedAuthStatus.value?.status === 'ok' || (selectedMhConfig.value?.credentials_configured && !selectedAuthStatus.value)
  ? 'text-emerald-700'
  : 'text-slate-500');
const signerStatusLabel = computed(() => {
  if (selectedSignerSync.value?.available === true) {
    return 'Firmador verificado';
  }

  if (selectedSignerSync.value?.status === 'error') {
    return 'Firmador no disponible';
  }

  return selectedMhConfig.value?.signer_credentials_configured ? 'Password privado configurado' : 'Pendiente de firmador';
});
const signerStatusClass = computed(() => {
  if (selectedSignerSync.value?.available === true) {
    return 'text-emerald-700';
  }

  return selectedSignerSync.value?.status === 'error' ? 'text-red-700' : 'text-slate-500';
});
const departamentoOptions = computed(() => departamentos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const municipioOptions = computed(() => municipios.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const distritoOptions = computed(() => distritos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const sucursalMunicipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(sucursalForm.departamento)));
const sucursalDistritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(sucursalForm.departamento)
  && String(item.municipio) === String(sucursalForm.municipio)
)));
const newSucursalMunicipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(newSucursalForm.departamento)));
const newSucursalDistritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(newSucursalForm.departamento)
  && String(item.municipio) === String(newSucursalForm.municipio)
)));
const sucursalMunicipioOptions = computed(() => sucursalMunicipios.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const sucursalDistritoOptions = computed(() => sucursalDistritos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const newSucursalMunicipioOptions = computed(() => newSucursalMunicipios.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const newSucursalDistritoOptions = computed(() => newSucursalDistritos.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const actividadOptions = computed(() => actividadesEconomicas.value.map((item) => ({ value: item.code, label: item.label, hint: item.code })));
const canSaveCompany = computed(() => Boolean(
  selectedEmpresa.value
  && companyForm.nombre_comercial.trim()
  && companyForm.razon_social.trim()
  && fiscalDocument.value.valid
  && companyActivities.value[0]?.trim()
  && companyForm.direccion.trim()
  && companyForm.departamento.trim()
  && companyForm.municipio.trim()
  && companyForm.distrito.trim()
));
const canSaveSucursal = computed(() => Boolean(
  selectedEmpresa.value
  && selectedSucursal.value
  && sucursalForm.nombre.trim()
  && sucursalForm.codigo.trim()
  && sucursalForm.direccion.trim()
  && sucursalForm.departamento.trim()
  && sucursalForm.municipio.trim()
));
const maxSucursalesPerCompany = 3;
const isBackofficeUser = computed(() => Boolean(context.value?.user?.is_backoffice));
const reachedSucursalLimit = computed(() => !isBackofficeUser.value && (selectedEmpresa.value?.sucursales.length ?? 0) >= maxSucursalesPerCompany);
const canCreateSucursal = computed(() => Boolean(
  selectedEmpresa.value
  && !reachedSucursalLimit.value
  && newSucursalForm.nombre.trim()
  && newSucursalForm.codigo.trim()
  && newSucursalForm.direccion.trim()
  && newSucursalForm.departamento.trim()
  && newSucursalForm.municipio.trim()
  && newSucursalForm.punto_venta_codigo.trim()
  && newSucursalForm.punto_venta_nombre.trim()
));
const canSavePuntoVenta = computed(() => Boolean(selectedPuntoVenta.value && puntoVentaForm.codigo.trim() && puntoVentaForm.nombre.trim()));
const canCreatePuntoVenta = computed(() => Boolean(selectedSucursal.value && newPuntoVentaForm.codigo.trim() && newPuntoVentaForm.nombre.trim()));
const filteredEmpresas = computed(() => {
  const query = normalizeSearchText(searchQuery.value.trim());

  if (!query) {
    return props.alwaysShowCompanySearch ? empresas.value : [];
  }

  return empresas.value.filter((empresa) => matchesCompany(empresa, query));
});
const resultLabel = computed(() => {
  if (!searchQuery.value.trim()) {
    return '';
  }

  return `${filteredEmpresas.value.length} resultado${filteredEmpresas.value.length === 1 ? '' : 's'}`;
});

onMounted(() => {
  void loadInitialData();
});

watch(selectedEmpresa, (empresa) => {
  syncCompanyForm(empresa);
  ensureSelectedSucursal();
  syncSucursalForm(selectedSucursal.value);
  syncPuntoVentaForm(selectedPuntoVenta.value);
  healthOpen.value = false;
  if (props.detailMode && empresa) {
    emitSelectedCompany(empresa);
    void loadCompanySummary(empresa.id);
    return;
  }

  companySummary.value = null;
}, { immediate: true });

watch([editingCompany, editingFiscal, editingSucursales, editingCorrelativos], () => {
  if (editingCompany.value) {
    emit('companyViewChanged', 'data');
    return;
  }

  if (editingFiscal.value) {
    emit('companyViewChanged', 'fiscal');
    return;
  }

  if (editingSucursales.value) {
    emit('companyViewChanged', 'sucursales');
    return;
  }

  if (editingCorrelativos.value) {
    emit('companyViewChanged', 'correlativos');
    return;
  }

  emit('companyViewChanged', 'summary');
}, { immediate: true });

watch(() => props.companyAction?.nonce, () => {
  if (!props.companyAction || !selectedEmpresa.value) {
    return;
  }

  if (props.companyAction.action === 'summary') {
    editingCompany.value = false;
    editingFiscal.value = false;
    editingSucursales.value = false;
    editingCorrelativos.value = false;
    requestAnimationFrame(() => document.getElementById('settings-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }

  if (props.companyAction.action === 'edit' || props.companyAction.action === 'edit-data') {
    editingCompany.value = true;
    editingFiscal.value = false;
    editingSucursales.value = false;
    editingCorrelativos.value = false;
    requestAnimationFrame(() => document.getElementById('empresa-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }

  if (props.companyAction.action === 'edit-fiscal') {
    editingCompany.value = false;
    editingFiscal.value = true;
    editingSucursales.value = false;
    editingCorrelativos.value = false;
    requestAnimationFrame(() => document.getElementById('certificados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }

  if (props.companyAction.action === 'edit-sucursales') {
    editingCompany.value = false;
    editingFiscal.value = false;
    editingSucursales.value = true;
    editingCorrelativos.value = false;
    requestAnimationFrame(() => document.getElementById('sucursales')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }

  if (props.companyAction.action === 'edit-correlativos') {
    editingCompany.value = false;
    editingFiscal.value = false;
    editingSucursales.value = false;
    editingCorrelativos.value = true;
    requestAnimationFrame(() => document.getElementById('correlativos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return;
  }

  if (props.companyAction.action === 'toggle-status') {
    void updateCompanyStatus(isInactive.value ? 'active' : 'inactive');
    return;
  }

  if (props.companyAction.action === 'delete') {
    void deleteCompany();
  }
});

watch(() => props.detailMode, (detailMode) => {
  if (props.alwaysShowCompanySearch && !detailMode) {
    form.empresa_id = 0;
    companySummary.value = null;
    healthOpen.value = false;
  }
});

watch(() => [form.empresa_id, form.ambiente] as const, () => {
  signerStatus.value = null;
  bearerStatus.value = null;
  saved.value = null;

  if (form.empresa_id) {
    void loadSettings();
    void loadCorrelativos();
  } else {
    correlativos.value = [];
    correlativoDrafts.value = {};
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

watch(() => selectedSucursal.value?.id ?? null, () => {
  syncSucursalForm(selectedSucursal.value);
  ensureSelectedPuntoVenta();
});

watch(() => selectedPuntoVenta.value?.id ?? null, () => {
  syncPuntoVentaForm(selectedPuntoVenta.value);
});

watch(() => sucursalForm.departamento, (value, oldValue) => {
  if (!syncingCompany.value && value !== oldValue && oldValue !== undefined) {
    sucursalForm.municipio = '';
    sucursalForm.distrito = '';
  }
});

watch(() => sucursalForm.municipio, (value, oldValue) => {
  if (!syncingCompany.value && value !== oldValue && oldValue !== undefined) {
    sucursalForm.distrito = '';
  }
});

watch(() => newSucursalForm.departamento, (value, oldValue) => {
  if (value !== oldValue && oldValue !== undefined) {
    newSucursalForm.municipio = '';
    newSucursalForm.distrito = '';
  }
});

watch(() => newSucursalForm.municipio, (value, oldValue) => {
  if (value !== oldValue && oldValue !== undefined) {
    newSucursalForm.distrito = '';
  }
});

watch(companyActivities, () => {
  syncPrimaryActivity();
}, { deep: true });

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
    ensureSelectedEmpresa();
    if (form.empresa_id) {
      await loadSettings();
      await loadCorrelativos();
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
    ensureSelectedEmpresa();
    if (form.empresa_id) {
      await loadSettings();
      await loadCorrelativos();
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar las empresas.';
  } finally {
    loading.value = false;
  }
}

function ensureSelectedEmpresa(): void {
  if (props.alwaysShowCompanySearch && !props.detailMode) {
    form.empresa_id = 0;
    return;
  }

  if (empresas.value.some((empresa) => empresa.id === form.empresa_id)) {
    return;
  }

  const defaultEmpresa = singleCompanyScope.value ? empresas.value[0] : null;
  form.empresa_id = defaultEmpresa?.id ?? 0;
  form.ambiente = defaultEmpresa?.ambiente ?? '00';
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
      signer_url: response.config.signer_url ?? null,
      simulate_unavailable: response.config.simulate_unavailable ?? false
    });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar la configuracion fiscal.';
  }
}

async function loadCorrelativos(): Promise<void> {
  if (!form.empresa_id) {
    correlativos.value = [];
    correlativoDrafts.value = {};
    return;
  }

  correlativosLoading.value = true;

  try {
    const response = await client.value.correlativos({
      empresa_id: form.empresa_id,
      ambiente: form.ambiente
    });
    correlativos.value = response.data;
    correlativoDrafts.value = Object.fromEntries(response.data.map((row) => [row.id, String(row.actual)]));
  } catch (caught) {
    correlativos.value = [];
    correlativoDrafts.value = {};
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar los correlativos.';
  } finally {
    correlativosLoading.value = false;
  }
}

async function saveCorrelativo(row: BillingCorrelativoAdmin): Promise<void> {
  const value = Number(correlativoDrafts.value[row.id] ?? row.actual);
  if (!Number.isInteger(value) || value < 0) {
    error.value = 'Ingresa un ultimo correlativo valido.';
    return;
  }

  savingCorrelativoId.value = row.id;
  error.value = null;
  saved.value = null;

  try {
    const response = await client.value.updateCorrelativo(row.id, { actual: value });
    correlativos.value = correlativos.value.map((item) => item.id === row.id ? response.data : item);
    correlativoDrafts.value = {
      ...correlativoDrafts.value,
      [row.id]: String(response.data.actual)
    };
    saved.value = `Correlativo ${dteShortLabel(row.tipo_dte)} actualizado. Proximo: ${response.data.next_correlativo ?? 'sin disponible'}.`;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible actualizar el correlativo.';
  } finally {
    savingCorrelativoId.value = null;
  }
}

async function loadCompanySummary(empresaId: number): Promise<void> {
  companySummary.value = null;

  try {
    companySummary.value = await client.value.dashboardSummary({ empresa_id: empresaId });
  } catch {
    companySummary.value = null;
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
    signer_activo: true,
    simulate_unavailable: false
  });
}

function selectEmpresa(empresa: BillingEmpresa): void {
  form.empresa_id = empresa.id;
  form.ambiente = empresa.ambiente;
  editingCredentials.value = false;
  editingCompany.value = false;
  editingFiscal.value = false;
  editingSucursales.value = false;
  editingCorrelativos.value = false;
  emitSelectedCompany(empresa);
  emit('companyViewChanged', 'summary');
}

function emitSelectedCompany(empresa: BillingEmpresa): void {
  emit('companySelected', {
    id: empresa.id,
    coreEmpresaId: empresa.id,
    name: empresa.razon_social,
    tradeName: empresa.nombre_comercial,
    documentLabel: documentLabel(empresa),
    lifecycleStatus: empresa.lifecycle_status,
    ambiente: empresa.ambiente
  });
}

function syncCompanyForm(empresa: BillingEmpresa | null): void {
  const sucursal = empresa?.sucursales[0] ?? null;
  const activities = empresa?.actividades_economicas?.length
    ? empresa.actividades_economicas.map((activity) => activity.codigo).slice(0, 3)
    : [empresa?.codigo_actividad ?? ''];
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
  companyActivities.value = activities.length ? activities : [''];
  syncPrimaryActivity();
  queueMicrotask(() => {
    syncingCompany.value = false;
  });
  companyLogoFile.value = null;
  companyLogoPreview.value = null;
}

function ensureSelectedSucursal(): void {
  const current = sucursales.value.find((sucursal) => sucursal.id === selectedSucursalId.value);
  selectedSucursalId.value = current?.id ?? sucursales.value[0]?.id ?? null;
  ensureSelectedPuntoVenta();
}

function ensureSelectedPuntoVenta(): void {
  const current = puntosVenta.value.find((punto) => punto.id === selectedPuntoVentaId.value);
  selectedPuntoVentaId.value = current?.id ?? puntosVenta.value[0]?.id ?? null;
}

function syncSucursalForm(sucursal: BillingSucursal | null): void {
  syncingCompany.value = true;
  Object.assign(sucursalForm, {
    nombre: sucursal?.nombre ?? '',
    codigo: sucursal?.codigo ?? '',
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
}

function syncPuntoVentaForm(puntoVenta: BillingPuntoVenta | null): void {
  Object.assign(puntoVentaForm, {
    codigo: puntoVenta?.codigo ?? '',
    nombre: puntoVenta?.nombre ?? '',
    tipo: puntoVenta?.tipo ?? 'terminal'
  });
}

function resetNewSucursalForm(): void {
  Object.assign(newSucursalForm, {
    nombre: '',
    codigo: nextSucursalCode(),
    direccion: '',
    departamento: '',
    municipio: '',
    distrito: '',
    telefono: '',
    email: '',
    punto_venta_codigo: 'P001',
    punto_venta_nombre: 'Caja principal'
  });
}

function resetNewPuntoVentaForm(): void {
  Object.assign(newPuntoVentaForm, {
    codigo: nextPuntoVentaCode(),
    nombre: 'Caja nueva',
    tipo: 'terminal'
  });
}

function nextSucursalCode(): string {
  const next = sucursales.value
    .map((sucursal) => /^S(\d+)$/i.exec(sucursal.codigo.trim())?.[1] ?? null)
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `S${String(next).padStart(3, '0')}`;
}

function nextPuntoVentaCode(): string {
  const next = puntosVenta.value.length + 1;
  return `P${String(next).padStart(3, '0')}`;
}

function mergeEmpresa(empresa: BillingEmpresa): void {
  if (!context.value) {
    return;
  }

  context.value = {
    ...context.value,
    empresas: context.value.empresas.map((item) => item.id === empresa.id ? empresa : item)
  };
  form.empresa_id = empresa.id;
  selectedSucursalId.value = empresa.sucursales.find((sucursal) => sucursal.id === selectedSucursalId.value)?.id ?? empresa.sucursales[0]?.id ?? null;
  ensureSelectedPuntoVenta();
}

async function saveSucursal(): Promise<void> {
  if (!selectedSucursal.value || !canSaveSucursal.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    const response = await client.value.updateBillingSucursal(selectedSucursal.value.id, {
      nombre: sucursalForm.nombre,
      codigo: sucursalForm.codigo,
      direccion: sucursalForm.direccion,
      departamento: sucursalForm.departamento,
      municipio: sucursalForm.municipio,
      distrito: blankToNull(sucursalForm.distrito),
      telefono: blankToNull(sucursalForm.telefono),
      email: blankToNull(sucursalForm.email)
    });
    mergeEmpresa(response.empresa);
    saved.value = 'Sucursal guardada.';
    await loadCorrelativos();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar la sucursal.';
  } finally {
    loading.value = false;
  }
}

async function createSucursal(): Promise<void> {
  if (!selectedEmpresa.value || !canCreateSucursal.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    const response = await client.value.createBillingSucursal(selectedEmpresa.value.id, {
      nombre: newSucursalForm.nombre,
      codigo: newSucursalForm.codigo,
      direccion: newSucursalForm.direccion,
      departamento: newSucursalForm.departamento,
      municipio: newSucursalForm.municipio,
      distrito: blankToNull(newSucursalForm.distrito),
      telefono: blankToNull(newSucursalForm.telefono),
      email: blankToNull(newSucursalForm.email),
      punto_venta_codigo: newSucursalForm.punto_venta_codigo,
      punto_venta_nombre: newSucursalForm.punto_venta_nombre,
      punto_venta_tipo: 'terminal'
    });
    mergeEmpresa(response.empresa);
    selectedSucursalId.value = response.empresa.sucursales.at(-1)?.id ?? selectedSucursalId.value;
    resetNewSucursalForm();
    creatingSucursal.value = false;
    saved.value = 'Sucursal creada con correlativos iniciales.';
    await loadCorrelativos();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible crear la sucursal.';
  } finally {
    loading.value = false;
  }
}

async function savePuntoVenta(): Promise<void> {
  if (!selectedPuntoVenta.value || !canSavePuntoVenta.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    const response = await client.value.updateBillingPuntoVenta(selectedPuntoVenta.value.id, {
      codigo: puntoVentaForm.codigo,
      nombre: puntoVentaForm.nombre,
      tipo: puntoVentaForm.tipo
    });
    mergeEmpresa(response.empresa);
    saved.value = 'Punto de venta guardado.';
    await loadCorrelativos();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar el punto de venta.';
  } finally {
    loading.value = false;
  }
}

async function createPuntoVenta(): Promise<void> {
  if (!selectedSucursal.value || !canCreatePuntoVenta.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    const response = await client.value.createBillingPuntoVenta(selectedSucursal.value.id, {
      codigo: newPuntoVentaForm.codigo,
      nombre: newPuntoVentaForm.nombre,
      tipo: newPuntoVentaForm.tipo
    });
    mergeEmpresa(response.empresa);
    const refreshedSucursal = response.empresa.sucursales.find((sucursal) => sucursal.id === selectedSucursal.value?.id) ?? null;
    selectedPuntoVentaId.value = refreshedSucursal?.puntosVenta.at(-1)?.id ?? selectedPuntoVentaId.value;
    resetNewPuntoVentaForm();
    creatingPuntoVenta.value = false;
    saved.value = 'Punto de venta creado con correlativos iniciales.';
    await loadCorrelativos();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible crear el punto de venta.';
  } finally {
    loading.value = false;
  }
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

    const response = await client.value.saveBillingSettings({
      ...form,
      verify: true
    });
    saved.value = response.verification?.message ?? 'Configuracion fiscal guardada.';
    editingCredentials.value = false;
    await loadContext();
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, 'No fue posible guardar la configuracion fiscal.');
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
    actividades_economicas: normalizedEconomicActivities(),
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
    editingFiscal.value = false;
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar los datos de la empresa.';
  } finally {
    loading.value = false;
  }
}

function addCompanyActivity(): void {
  if (companyActivities.value.length >= 3 || !companyActivities.value[0]?.trim()) {
    return;
  }

  companyActivities.value = [...companyActivities.value, ''];
}

function removeCompanyActivity(index: number): void {
  if (index === 0) {
    return;
  }

  companyActivities.value = companyActivities.value.filter((_, activityIndex) => activityIndex !== index);
  syncPrimaryActivity();
}

function syncPrimaryActivity(): void {
  const primary = companyActivities.value[0] ?? '';
  const activity = actividadesEconomicas.value.find((item) => item.code === primary) ?? null;
  companyForm.codigo_actividad = primary;
  companyForm.desc_actividad = activity?.label ?? '';
}

function normalizedEconomicActivities(): Array<{ codigo: string; descripcion: string }> {
  return companyActivities.value
    .map((code) => {
      const activity = actividadesEconomicas.value.find((item) => item.code === code) ?? null;

      return {
        codigo: code,
        descripcion: activity?.label ?? ''
      };
    })
    .filter((activity) => activity.codigo.trim() !== '' && activity.descripcion.trim() !== '')
    .slice(0, 3);
}

async function errorMessageFromResponse(caught: unknown, fallback: string): Promise<string> {
  if (caught && typeof caught === 'object' && 'response' in caught) {
    const response = (caught as { response?: { json?: () => Promise<unknown> } }).response;
    const payload = await response?.json?.().catch(() => null);

    if (payload && typeof payload === 'object') {
      const record = payload as { message?: unknown; verification?: { message?: unknown } };
      if (typeof record.verification?.message === 'string' && record.verification.message.trim()) {
        return record.verification.message;
      }

      if (typeof record.message === 'string' && record.message.trim()) {
        return record.message;
      }
    }
  }

  return caught instanceof Error ? caught.message : fallback;
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
    error.value = caught instanceof Error ? caught.message : 'No fue posible verificar la autorizacion MH.';
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
  if (!selectedEmpresa.value || !window.confirm('Confirma que deseas borrar esta empresa definitivamente. Se eliminaran configuracion fiscal, accesos SaaS, archivos y relaciones asociadas.')) {
    return;
  }

  const empresaId = selectedEmpresa.value.id;
  loading.value = true;
  error.value = null;
  saved.value = null;
  deleteOverlayOpen.value = true;
  deleteOverlayVariant.value = 'loading';
  deleteOverlayTitle.value = 'Eliminando empresa fiscal';
  deleteOverlayMessage.value = 'Borrando configuracion fiscal, documentos, certificados, logo, sucursales y puntos de venta.';

  try {
    await client.value.deleteBillingCompany(empresaId);

    if (platformClient.value) {
      deleteOverlayTitle.value = 'Limpiando acceso SaaS';
      deleteOverlayMessage.value = 'Eliminando tenant, membresias, asignaciones fiscales e invitaciones vinculadas.';
      await platformClient.value.purgeTenantByCoreEmpresa(empresaId);
    }

    deleteOverlayTitle.value = 'Actualizando empresas';
    deleteOverlayMessage.value = 'Preparando el buscador para seleccionar otra empresa.';
    form.empresa_id = 0;
    emit('companyCleared');
    emit('companyViewChanged', 'summary');
    await loadContext();
    saved.value = 'Empresa borrada.';
    deleteOverlayVariant.value = 'success';
    deleteOverlayTitle.value = 'Empresa eliminada';
    deleteOverlayMessage.value = 'La limpieza termino correctamente. Ya puedes buscar otra empresa.';
    window.setTimeout(() => {
      deleteOverlayOpen.value = false;
    }, 900);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible borrar la empresa.';
    deleteOverlayVariant.value = 'error';
    deleteOverlayTitle.value = 'No fue posible completar el borrado';
    deleteOverlayMessage.value = error.value;
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

function dteShortLabel(tipoDte: string): string {
  return ({
    '01': 'FCF',
    '03': 'CCF',
    '05': 'NC',
    '06': 'ND',
    '14': 'FSE'
  } as Record<string, string>)[tipoDte] ?? tipoDte;
}

function dteLongLabel(tipoDte: string): string {
  return ({
    '01': 'Factura consumidor final',
    '03': 'Comprobante credito fiscal',
    '05': 'Nota de credito',
    '06': 'Nota de debito',
    '14': 'Sujeto excluido'
  } as Record<string, string>)[tipoDte] ?? `DTE ${tipoDte}`;
}

function economicActivitiesFor(empresa: BillingEmpresa): Array<{ codigo: string; descripcion: string }> {
  return empresa.actividades_economicas?.length
    ? empresa.actividades_economicas
    : [{ codigo: empresa.codigo_actividad, descripcion: empresa.desc_actividad }];
}

function certificateEnvironmentRows(empresa: BillingEmpresa | null): Array<{
  ambiente: '00' | '01';
  label: string;
  activeCertificate: BillingCertificate | null;
  activeCount: number;
}> {
  return [
    { ambiente: '00' as const, label: 'Pruebas' },
    { ambiente: '01' as const, label: 'Produccion' }
  ].map((environment) => {
    const activeCertificates = empresa?.certificados.filter((cert) => cert.ambiente === environment.ambiente && cert.activo) ?? [];

    return {
      ...environment,
      activeCertificate: activeCertificates[0] ?? null,
      activeCount: activeCertificates.length
    };
  });
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function branchLocationLabel(sucursal: BillingSucursal | null | undefined): string {
  if (!sucursal) {
    return 'Ubicacion pendiente';
  }

  const department = displayText(departamentos.value.find((item) => item.code === departmentCode(sucursal.departamento))?.label ?? sucursal.departamento);
  const municipality = displayText((catalogs.value?.municipios ?? []).find((item) => (
    departmentCode(item.departamento) === departmentCode(sucursal.departamento)
    && String(item.code) === String(sucursal.municipio)
  ))?.label ?? sucursal.municipio);
  const district = displayText((catalogs.value?.distritos ?? []).find((item) => (
    departmentCode(item.departamento) === departmentCode(sucursal.departamento)
    && String(item.municipio) === String(sucursal.municipio)
    && String(item.code) === String(sucursal.distrito ?? '')
  ))?.label ?? sucursal.distrito ?? 'Distrito pendiente');

  return [department, municipality, district].filter(Boolean).join(' / ');
}

function displayText(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('es-SV')
    .replace(/(^|[\s/.,;:()_-])([\p{L}\p{N}])/gu, (_, separator: string, char: string) => `${separator}${char.toLocaleUpperCase('es-SV')}`)
    .replace(/\b(Nit|Nrc|Dui|Mh|Dte|FcF|Ccf)\b/g, (match) => match.toLocaleUpperCase('es-SV'));
}

function formatDate(value: string | null | undefined, includeTime = false): string {
  if (!value) {
    return 'No registrado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    } : {})
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'No registrado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours24 >= 12 ? 'pm' : 'am';

  return `${day}/${month}/${year} ${String(hours12).padStart(2, '0')}:${minutes} ${period}`;
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

function companyEnvironmentLabel(empresa: BillingEmpresa): string {
  return empresa.ambiente === '01' ? 'Produccion' : 'Pruebas';
}

function companyEnvironmentTone(empresa: BillingEmpresa): 'success' | 'warning' {
  return empresa.ambiente === '01' ? 'success' : 'warning';
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
    <UiCard :variant="props.detailMode && selectedEmpresa ? 'bare' : 'default'">
      <div v-if="!empresas.length && !loading" class="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Aun no hay empresas registradas.
      </div>

      <div v-else class="space-y-8">
        <aside v-if="showCompanySearch" class="mx-auto w-full max-w-5xl">
          <div class="mx-auto w-full max-w-3xl">
            <UiSearchInput
              v-model="searchQuery"
              label="Buscar empresa"
              placeholder="DUI, NIT, nombre fiscal o comercial"
            />
          </div>

          <div v-if="searchQuery.trim()" class="mx-auto mt-6 w-full max-w-3xl">
            <div class="mb-4 flex items-center justify-center gap-3 text-center">
              <p v-if="resultLabel" class="text-sm font-semibold text-slate-950">{{ resultLabel }}</p>
              <p class="text-sm text-slate-500">{{ empresas.length }} registrada{{ empresas.length === 1 ? '' : 's' }}</p>
            </div>

            <div class="grid gap-3">
              <button
                v-for="empresa in filteredEmpresas"
                :key="empresa.id"
                type="button"
                class="w-full rounded-md border px-6 py-5 text-left transition hover:border-sky-300 hover:bg-slate-50"
                :class="empresa.id === form.empresa_id ? 'border-sky-500 bg-sky-50' : 'border-blue-100/80 bg-white/85'"
                @click="selectEmpresa(empresa)"
              >
                <div class="flex items-center gap-4">
                  <img v-if="hasLogo(empresa)" :src="empresa.logo_url ?? ''" class="h-14 w-14 rounded-md border border-slate-200 object-contain" alt="" @error="markLogoBroken(empresa)">
                  <div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
                    {{ initials(empresa) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <p class="truncate text-sm font-semibold text-slate-950">{{ empresa.nombre_comercial }}</p>
                      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <UiStatusBadge :tone="companyEnvironmentTone(empresa)">{{ companyEnvironmentLabel(empresa) }}</UiStatusBadge>
                        <UiStatusBadge :tone="empresa.lifecycle_status === 'active' ? 'success' : 'neutral'">
                          {{ empresa.lifecycle_status === 'active' ? 'Activa' : 'Inactiva' }}
                        </UiStatusBadge>
                      </div>
                    </div>
                    <p class="mt-1 truncate text-xs text-slate-500">{{ empresa.razon_social }}</p>
                    <p class="mt-2 text-xs font-medium text-slate-700">{{ documentLabel(empresa) }}</p>
                  </div>
                </div>
              </button>

              <div v-if="searchQuery.trim() && !filteredEmpresas.length" class="rounded-md border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No se encontro ninguna empresa con ese criterio.
              </div>
            </div>
          </div>
        </aside>

        <section
          v-if="selectedEmpresa"
          class="min-w-0"
          :class="props.detailMode ? 'flex flex-col' : 'space-y-5'"
          :style="props.detailMode ? { rowGap: '28px' } : undefined"
        >
          <div v-if="!props.detailMode" id="datos-empresa" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-5 shadow-sm shadow-blue-950/5 backdrop-blur">
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

              <div v-if="!props.detailMode" class="flex flex-wrap gap-2">
                <UiButton variant="secondary" :disabled="loading" @click="editingCompany = !editingCompany">
                  {{ editingCompany ? 'Ocultar datos' : 'Editar datos' }}
                </UiButton>
                <template v-if="!singleCompanyScope">
                  <UiButton v-if="isInactive" variant="secondary" :disabled="loading" @click="updateCompanyStatus('active')">Activar</UiButton>
                  <UiButton v-else variant="secondary" :disabled="loading" @click="updateCompanyStatus('inactive')">Desactivar</UiButton>
                  <UiButton variant="ghost" :disabled="loading" @click="deleteCompany">Borrar</UiButton>
                </template>
              </div>
            </div>
          </div>

          <div v-if="editingCompany" id="empresa-editor" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-5 shadow-sm shadow-blue-950/5 backdrop-blur">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Datos generales de la empresa</p>
                  <p class="mt-1 text-xs text-slate-500">Nombres, documento fiscal, actividad, direccion, contacto y logo.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                <UiButton v-if="props.detailMode" variant="secondary" :disabled="loading" @click="editingCompany = false">Volver al resumen</UiButton>
                <UiButton variant="success" :disabled="loading || !canSaveCompany || isInactive" @click="saveCompanyData">
                  <UiSaveIcon class="mr-2 h-5 w-5" />
                  <span>Guardar datos</span>
                </UiButton>
              </div>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div class="grid gap-4 md:col-span-2 xl:col-span-3" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <UiInput v-model="companyForm.razon_social" label="Nombre del contribuyente" />
                <UiInput v-model="companyForm.nombre_comercial" label="Nombre comercial" />
              </div>
              <div class="grid gap-4 md:col-span-2 xl:col-span-3" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <UiFiscalDocumentInput v-model="companyForm.documento_fiscal" label="NIT" allowed-types="nit" :show-message="false" @detected="fiscalDocument = $event" />
                <UiInput v-model="companyForm.nrc" label="NRC" />
              </div>
              <div class="md:col-span-2 xl:col-span-3">
                <div class="mt-2 grid gap-3" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
                  <div v-for="(_, activityIndex) in companyActivities" :key="activityIndex" class="grid gap-2">
                    <div
                      class="grid gap-2"
                      :style="activityIndex === companyActivities.length - 1 && companyActivities.length < 3 ? 'grid-template-columns: minmax(0, 1fr) 42px;' : 'grid-template-columns: minmax(0, 1fr);'"
                    >
                      <UiSearchSelect
                        v-model="companyActivities[activityIndex]"
                        :label="activityIndex === 0 ? 'Actividad principal' : `Actividad adicional ${activityIndex + 1}`"
                        :options="actividadOptions"
                        placeholder="Buscar por codigo o descripcion"
                        @update:model-value="activityIndex === 0 ? syncPrimaryActivity() : undefined"
                      />
                      <button
                        v-if="activityIndex === companyActivities.length - 1 && companyActivities.length < 3"
                        type="button"
                        class="mt-6 grid h-10 w-10 place-items-center rounded-md border border-blue-100 bg-white text-slate-700 shadow-sm shadow-blue-950/5 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="!companyActivities[0]?.trim()"
                        aria-label="Agregar actividad economica"
                        @click="addCompanyActivity"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                      </button>
                    </div>
                    <UiButton v-if="activityIndex > 0" variant="ghost" class="justify-self-start" :disabled="loading" @click="removeCompanyActivity(activityIndex)">Quitar</UiButton>
                  </div>
                </div>
              </div>
              <div class="md:col-span-2 xl:col-span-3">
                <UiLogoUpload
                  id="company-logo-upload"
                  label="Logo comercial"
                  title="Agregar logo"
                  variant="compact"
                  :preview-src="companyLogoPreview ?? (hasLogo(selectedEmpresa) ? selectedEmpresa.logo_url : null)"
                  :selected-label="companyLogoFile?.name"
                  @change="setCompanyLogo"
                  @image-error="markLogoBroken(selectedEmpresa)"
                />
              </div>
            </div>

            <div class="mt-6 grid gap-4">
              <UiInput v-model="companyForm.direccion" label="Direccion" />
              <div class="grid gap-4" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
                <UiSearchSelect v-model="companyForm.departamento" label="Departamento" :options="departamentoOptions" placeholder="Seleccionar departamento" />
                <UiSearchSelect v-model="companyForm.municipio" label="Municipio" :options="municipioOptions" :disabled="!companyForm.departamento" placeholder="Seleccionar municipio" />
                <UiSearchSelect v-model="companyForm.distrito" label="Distrito" :options="distritoOptions" :disabled="!companyForm.municipio" placeholder="Seleccionar distrito" />
              </div>
              <div class="grid gap-4" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <UiPhoneInput v-model="companyForm.telefono" label="Telefono" />
                <UiEmailInput v-model="companyForm.email" label="Correo" />
              </div>
            </div>

          </div>

          <template v-if="props.detailMode && !editingCompany && !editingFiscal && !editingSucursales && !editingCorrelativos">
            <div id="settings-summary" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/90 p-5 shadow-sm shadow-blue-950/5 backdrop-blur">
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
                    <div class="relative">
                      <button
                        type="button"
                        class="rounded px-2 py-1 text-xs font-semibold transition hover:brightness-95"
                        :class="{
                          'bg-emerald-50 text-emerald-700': fiscalHealth.tone === 'success',
                          'bg-amber-50 text-amber-700': fiscalHealth.tone === 'warning',
                          'bg-red-50 text-red-700': fiscalHealth.tone === 'danger',
                          'bg-slate-100 text-slate-600': fiscalHealth.tone === 'slate'
                        }"
                        @click="healthOpen = !healthOpen"
                      >
                        {{ fiscalHealth.label }}
                      </button>
                      <div v-if="healthOpen" class="absolute left-0 z-20 mt-2 w-72 rounded-md border border-slate-200 bg-white p-4 text-sm shadow-lg">
                        <p class="font-semibold text-slate-950">Salud fiscal</p>
                        <p class="mt-1 text-xs text-slate-500">{{ fiscalHealth.detail }}</p>
                        <div class="mt-4 space-y-3">
                          <div class="flex items-center justify-between gap-3">
                            <span class="text-slate-600">Autorizacion MH</span>
                            <span class="rounded px-2 py-1 text-xs font-semibold" :class="fiscalHealth.authReady ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
                              {{ fiscalHealth.authReady ? 'OK' : 'Pendiente' }}
                            </span>
                          </div>
                          <div class="flex items-center justify-between gap-3">
                            <span class="text-slate-600">Firmador</span>
                            <span class="rounded px-2 py-1 text-xs font-semibold" :class="fiscalHealth.signerReady ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
                              {{ fiscalHealth.signerReady ? 'OK' : 'Error' }}
                            </span>
                          </div>
                        </div>
                        <p v-if="selectedSignerSync?.message" class="mt-3 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{{ selectedSignerSync.message }}</p>
                        <p class="mt-4 text-xs text-slate-500">{{ selectedMhConfig?.last_verified_at ? `Ultima verificacion: ${formatDateTime(selectedMhConfig.last_verified_at)}` : 'Sin verificacion registrada' }}</p>
                      </div>
                    </div>
                  </div>
                  <p class="mt-1 text-sm text-slate-600">{{ selectedEmpresa.nombre_comercial }}</p>
                  <p class="mt-2 text-sm font-medium text-slate-800">{{ selectedDocumentLabel }}</p>
                  <p class="mt-1 text-sm text-slate-500">{{ selectedEmpresa.codigo_actividad }} · {{ selectedEmpresa.desc_actividad }}</p>
                </div>
              </div>
            </div>

            <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
              <div class="min-w-0 rounded-md border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-950/5">
                <p class="truncate text-[11px] font-bold uppercase text-slate-500">DTE emitidos</p>
                <p class="mt-2 text-2xl font-bold text-slate-950">{{ companySummary?.totals.emitted ?? 0 }}</p>
              </div>
              <div class="min-w-0 rounded-md border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-950/5">
                <p class="truncate text-[11px] font-bold uppercase text-slate-500">Bien</p>
                <p class="mt-2 text-2xl font-bold text-emerald-700">{{ companySummary?.totals.accepted ?? 0 }}</p>
              </div>
              <div class="min-w-0 rounded-md border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-950/5">
                <p class="truncate text-[11px] font-bold uppercase text-slate-500">Rechazos</p>
                <p class="mt-2 text-2xl font-bold text-red-700">{{ companySummary?.totals.rejected ?? 0 }}</p>
              </div>
              <div class="min-w-0 rounded-md border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-950/5">
                <p class="truncate text-[11px] font-bold uppercase text-slate-500">Activo desde</p>
                <p class="mt-2 text-sm font-semibold text-slate-950">{{ formatDate(selectedEmpresa.created_at) }}</p>
              </div>
              <div class="min-w-0 rounded-md border border-blue-100/80 bg-white/90 p-4 shadow-sm shadow-blue-950/5">
                <p class="truncate text-[11px] font-bold uppercase text-slate-500">Suscripcion hasta</p>
                <p class="mt-1 text-sm font-semibold text-slate-950">No registrada</p>
              </div>
            </div>

            <div class="rounded-md border border-blue-100/80 bg-white/90 p-5 shadow-sm shadow-blue-950/5">
              <p class="text-sm font-semibold text-slate-950">Resumen informativo</p>
              <div class="mt-4 grid gap-8" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <div class="space-y-4">
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Contribuyente</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedEmpresa.razon_social }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Direccion</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedSucursal?.direccion ? displayText(selectedSucursal.direccion) : 'Direccion pendiente' }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ branchLocationLabel(selectedSucursal) }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Telefono</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedSucursal?.telefono ?? 'No registrado' }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Correo</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedSucursal?.email ?? 'No registrado' }}</p>
                  </div>
                </div>

                <div class="space-y-4">
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Nombre comercial</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedEmpresa.nombre_comercial }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Ambiente</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ form.ambiente }} · {{ environmentLabel }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">NIT</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedEmpresa.fiscal_document_number ?? selectedEmpresa.nit }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">NRC</p>
                    <p class="mt-1 text-sm font-semibold text-slate-950">{{ selectedEmpresa.nrc ?? 'No registrado' }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase text-slate-500">Actividades economicas</p>
                    <div class="mt-1 space-y-1">
                      <p
                        v-for="activity in economicActivitiesFor(selectedEmpresa)"
                        :key="activity.codigo"
                        class="text-sm font-semibold text-slate-950"
                      >
                        {{ activity.codigo }} · {{ activity.descripcion }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-if="editingSucursales">
            <div id="sucursales" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-5 shadow-sm shadow-blue-950/5 backdrop-blur">
              <div class="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Sucursales y puntos de venta</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UiButton
                    variant="secondary"
                    :disabled="loading || isInactive || reachedSucursalLimit"
                    @click="resetNewSucursalForm(); creatingSucursal = true"
                  >
                    Nueva sucursal
                  </UiButton>
                  <UiButton v-if="props.detailMode" variant="secondary" :disabled="loading" @click="editingSucursales = false">Volver al resumen</UiButton>
                </div>
              </div>

              <div class="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div class="space-y-3">
                  <p v-if="reachedSucursalLimit" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Limite alcanzado: casa matriz y 2 sucursales adicionales.
                  </p>

                  <div class="rounded-md border border-slate-200 bg-white">
                    <button
                      v-for="sucursal in sucursales"
                      :key="sucursal.id"
                      type="button"
                      class="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0"
                      :class="sucursal.id === selectedSucursal?.id ? 'bg-sky-50' : 'hover:bg-slate-50'"
                      @click="selectedSucursalId = sucursal.id"
                    >
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-bold text-slate-950">{{ sucursal.nombre }}</span>
                        <span class="mt-1 block truncate text-xs text-slate-500">{{ sucursal.codigo }} · {{ sucursal.puntosVenta.length }} punto{{ sucursal.puntosVenta.length === 1 ? '' : 's' }}</span>
                      </span>
                      <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{{ sucursal.codigo }}</span>
                    </button>
                  </div>

                </div>

                <div v-if="selectedSucursal" class="min-w-0">
                  <div class="grid gap-4 md:grid-cols-2">
                    <UiInput v-model="sucursalForm.nombre" label="Nombre sucursal" />
                    <UiInput v-model="sucursalForm.codigo" label="Codigo establecimiento" />
                  </div>
                  <div class="mt-4 grid gap-4">
                    <UiInput v-model="sucursalForm.direccion" label="Direccion" />
                    <div class="grid gap-4 md:grid-cols-3">
                      <UiSearchSelect v-model="sucursalForm.departamento" label="Departamento" :options="departamentoOptions" placeholder="Seleccionar departamento" />
                      <UiSearchSelect v-model="sucursalForm.municipio" label="Municipio" :options="sucursalMunicipioOptions" :disabled="!sucursalForm.departamento" placeholder="Seleccionar municipio" />
                      <UiSearchSelect v-model="sucursalForm.distrito" label="Distrito" :options="sucursalDistritoOptions" :disabled="!sucursalForm.municipio" placeholder="Seleccionar distrito" />
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                      <UiPhoneInput v-model="sucursalForm.telefono" label="Telefono" />
                      <UiEmailInput v-model="sucursalForm.email" label="Correo" />
                    </div>
                  </div>
                  <div class="mt-4 flex justify-end">
                    <UiButton variant="success" :disabled="loading || !canSaveSucursal || isInactive" @click="saveSucursal">
                      <UiSaveIcon class="mr-2 h-4 w-4" />
                      Guardar sucursal
                    </UiButton>
                  </div>

                  <div class="mt-6 border-t border-slate-200 pt-5">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-slate-950">Puntos de venta</p>
                        <p class="mt-1 text-xs text-slate-500">Cada punto abre su propia serie {{ selectedSucursal.codigo }} + codigo punto venta.</p>
                      </div>
                      <UiButton
                        variant="secondary"
                        :disabled="loading || isInactive"
                        @click="resetNewPuntoVentaForm(); creatingPuntoVenta = true"
                      >
                        Nuevo punto
                      </UiButton>
                    </div>

                    <div class="mt-4 overflow-hidden rounded-md border border-slate-200">
                      <button
                        v-for="punto in puntosVenta"
                        :key="punto.id"
                        type="button"
                        class="grid w-full grid-cols-[110px_minmax(0,1fr)_110px] items-center gap-3 border-b border-slate-100 px-3 py-3 text-left text-sm last:border-b-0"
                        :class="punto.id === selectedPuntoVenta?.id ? 'bg-sky-50' : 'hover:bg-slate-50'"
                        @click="selectedPuntoVentaId = punto.id"
                      >
                        <span class="font-bold text-slate-950">{{ punto.codigo }}</span>
                        <span class="truncate text-slate-700">{{ punto.nombre }}</span>
                        <span class="rounded bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-600">{{ punto.tipo }}</span>
                      </button>
                    </div>

                    <div v-if="selectedPuntoVenta" class="mt-4 grid gap-4 rounded-md border border-blue-100 bg-white p-4 md:grid-cols-[130px_minmax(0,1fr)_130px_auto] md:items-end">
                      <UiInput v-model="puntoVentaForm.codigo" label="Codigo" />
                      <UiInput v-model="puntoVentaForm.nombre" label="Nombre" />
                      <UiInput v-model="puntoVentaForm.tipo" label="Tipo" />
                      <UiButton variant="success" :disabled="loading || !canSavePuntoVenta || isInactive" @click="savePuntoVenta">
                        <UiSaveIcon class="mr-2 h-4 w-4" />
                        Guardar
                      </UiButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-if="editingCorrelativos">
            <div id="correlativos" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-5 shadow-sm shadow-blue-950/5 backdrop-blur">
              <div class="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Correlativos</p>
                  <p class="mt-1 text-xs text-slate-500">Selecciona sucursal y punto de venta para ajustar el ultimo correlativo emitido por cada DTE.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <select v-model.number="selectedSucursalId" class="h-9 rounded-md border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700">
                    <option v-for="sucursal in sucursales" :key="sucursal.id" :value="sucursal.id">
                      {{ sucursal.codigo }} · {{ sucursal.nombre }}
                    </option>
                  </select>
                  <select v-model.number="selectedPuntoVentaId" class="h-9 rounded-md border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700">
                    <option v-for="punto in puntosVenta" :key="punto.id" :value="punto.id">
                      {{ punto.codigo }} · {{ punto.nombre }}
                    </option>
                  </select>
                  <select v-model="form.ambiente" class="h-9 rounded-md border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700">
                    <option value="00">Pruebas</option>
                    <option value="01">Produccion</option>
                  </select>
                  <UiRefreshButton :loading="correlativosLoading" :disabled="!form.empresa_id" @click="loadCorrelativos" />
                </div>
              </div>

              <UiLoadingMark v-if="correlativosLoading" class="mt-4" label="Cargando correlativos" />
              <div v-else-if="correlativoRows.length === 0" class="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No hay correlativos activos para esta sucursal, punto de venta y ambiente.
              </div>
              <div v-else class="mt-4 overflow-hidden rounded-md border border-slate-200">
                <div class="grid grid-cols-[minmax(180px,1fr)_150px_170px_150px] bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-500">
                  <span>DTE</span>
                  <span>Ultimo emitido</span>
                  <span>Proximo a usar</span>
                  <span class="text-right">Accion</span>
                </div>
                <div
                  v-for="row in correlativoRows"
                  :key="row.id"
                  class="grid grid-cols-[minmax(180px,1fr)_150px_170px_150px] items-center gap-3 border-t border-slate-100 px-3 py-3 text-sm"
                >
                  <div class="min-w-0">
                    <p class="font-bold text-slate-950">{{ dteShortLabel(row.tipo_dte) }}</p>
                    <p class="truncate text-xs text-slate-500">{{ dteLongLabel(row.tipo_dte) }} · {{ row.sucursal_codigo }}{{ row.punto_venta_codigo }}</p>
                  </div>
                  <input
                    :value="correlativoDrafts[row.id] ?? String(row.actual)"
                    class="h-10 w-full rounded-md border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm shadow-blue-950/5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    inputmode="numeric"
                    type="number"
                    min="0"
                    :max="row.hasta"
                    @input="correlativoDrafts = { ...correlativoDrafts, [row.id]: ($event.target as HTMLInputElement).value.replace(/\\D/g, '') }"
                  >
                  <div class="min-w-0">
                    <p class="font-semibold text-slate-950">{{ row.next_correlativo ?? 'Sin disponible' }}</p>
                    <p class="truncate font-mono text-[11px] text-slate-500">{{ row.next_numero_control ?? 'Rango agotado' }}</p>
                  </div>
                  <div class="flex justify-end">
                    <UiButton
                      variant="success"
                      :disabled="savingCorrelativoId === row.id || Number(correlativoDrafts[row.id] ?? row.actual) === row.actual"
                      @click="saveCorrelativo(row)"
                    >
                      <UiSaveIcon class="mr-2 h-4 w-4" />
                      {{ savingCorrelativoId === row.id ? 'Guardando' : 'Guardar' }}
                    </UiButton>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-if="!props.detailMode || editingFiscal">
            <div v-if="!props.detailMode" class="grid gap-4 lg:grid-cols-3">
              <div class="rounded-md border border-blue-100/80 bg-white/85 p-4 shadow-sm shadow-blue-950/5 backdrop-blur text-sm">
                <p class="font-semibold text-slate-950">Casa matriz</p>
                <p class="mt-2 text-slate-600">{{ selectedSucursal?.direccion ? displayText(selectedSucursal.direccion) : 'Direccion pendiente' }}</p>
                <p class="mt-1 text-slate-600">{{ branchLocationLabel(selectedSucursal) }}</p>
              </div>
              <div id="credenciales-mh" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-4 shadow-sm shadow-blue-950/5 backdrop-blur text-sm">
                <p class="font-semibold text-slate-950">Credenciales MH</p>
                <p class="mt-2" :class="authStatusClass">
                  {{ authStatusLabel }}
                </p>
                <p class="mt-1 text-slate-500">Ambiente {{ environmentLabel }}</p>
              </div>
              <div id="firmador" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-4 shadow-sm shadow-blue-950/5 backdrop-blur text-sm">
                <p class="font-semibold text-slate-950">Firmador</p>
                <p class="mt-2" :class="signerStatusClass">
                  {{ signerStatusLabel }}
                </p>
                <p class="mt-1 text-slate-500">{{ selectedMhConfig?.last_verified_at ? `Ultima verificacion: ${formatDateTime(selectedMhConfig.last_verified_at)}` : 'Sin verificacion registrada' }}</p>
                <p v-if="selectedSignerSync?.message" class="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{{ selectedSignerSync.message }}</p>
              </div>
            </div>

            <div id="certificados" class="scroll-mt-6 rounded-md border border-blue-100/80 bg-white/85 p-5 shadow-sm shadow-blue-950/5 backdrop-blur">
              <div class="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Datos fiscales</p>
                  <p class="mt-1 text-xs text-slate-500">Ambiente, certificado activo, credenciales MH, firmador y simulacion por empresa.</p>
                </div>
                <UiButton v-if="props.detailMode" variant="secondary" :disabled="loading" @click="editingFiscal = false">Volver al resumen</UiButton>
              </div>

              <div class="mt-5 grid gap-3 md:grid-cols-2">
                <div
                  v-for="row in activeCertificatesByEnvironment"
                  :key="row.ambiente"
                  class="rounded-md border p-4"
                  :class="row.ambiente === form.ambiente ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-slate-50/70'"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-xs font-bold uppercase text-slate-500">{{ row.ambiente }} · {{ row.label }}</p>
                      <p class="mt-2 text-sm font-semibold text-slate-950">
                        {{ row.activeCertificate?.filename ?? 'Sin certificado activo' }}
                      </p>
                      <p class="mt-1 text-xs text-slate-500">
                        {{ row.activeCertificate?.vence_at ? `Vence: ${formatDate(row.activeCertificate.vence_at)}` : 'Carga un certificado para operar en este ambiente.' }}
                      </p>
                    </div>
                    <span
                      class="rounded px-2 py-1 text-xs font-semibold"
                      :class="{
                        'bg-emerald-50 text-emerald-700': row.activeCount === 1,
                        'bg-amber-50 text-amber-700': row.activeCount > 1,
                        'bg-slate-100 text-slate-600': row.activeCount === 0
                      }"
                    >
                      {{ row.activeCount === 1 ? 'Activo' : row.activeCount > 1 ? 'Revisar' : 'Pendiente' }}
                    </span>
                  </div>
                  <p v-if="row.activeCount > 1" class="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">
                    Hay mas de un certificado activo para este ambiente. Deja solo uno activo desde soporte fiscal.
                  </p>
                </div>
              </div>

              <p v-if="hasCertificateConflict" class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Este ambiente tiene mas de un certificado activo. Guardar una nueva configuracion no debe ocultar esa revision.
              </p>

              <div class="mt-5 grid gap-4 md:grid-cols-2">
                <label class="block">
                  <span class="text-sm font-medium text-slate-700">Ambiente</span>
                  <select v-model="form.ambiente" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="00">00 · Pruebas</option>
                    <option value="01">01 · Produccion</option>
                  </select>
                </label>

                <div class="block">
                  <span class="text-sm font-medium text-slate-700">Certificado activo</span>
                  <div class="mt-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    <p v-if="activeCertificate" class="font-medium">
                      {{ activeCertificate.filename }}
                    </p>
                    <p v-else class="text-slate-500">
                      Sin certificado cargado para este ambiente.
                    </p>
                  </div>
                  <p v-if="activeCertificate?.vence_at" class="mt-1 text-xs text-slate-500">Vence: {{ formatDate(activeCertificate.vence_at) }}</p>
                </div>

                <label class="block md:col-span-2">
                  <span class="text-sm font-medium text-slate-700">Reemplazar certificado .p12/.crt</span>
                  <UiFileUpload
                    id="certificate-upload"
                    class="mt-1"
                    label="Subir certificado"
                    :selected-label="certificateFile?.name"
                    @change="setCertificate"
                  />
                </label>
              </div>

              <div class="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
                <div class="rounded-md border border-slate-200 bg-slate-50/70 p-4">
                  <p class="text-sm font-semibold text-slate-950">Autorizacion MH</p>
                  <p class="mt-2 text-sm" :class="authStatusClass">
                    {{ authStatusLabel }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">Ambiente {{ form.ambiente }} · {{ environmentLabel }}</p>
                </div>
                <div class="rounded-md border border-slate-200 bg-slate-50/70 p-4">
                  <p class="text-sm font-semibold text-slate-950">Firmador</p>
                  <p class="mt-2 text-sm" :class="signerStatusClass">
                    {{ signerStatusLabel }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">{{ selectedMhConfig?.last_verified_at ? `Ultima verificacion: ${formatDateTime(selectedMhConfig.last_verified_at)}` : 'Sin verificacion registrada' }}</p>
                  <p v-if="selectedSignerSync?.message" class="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{{ selectedSignerSync.message }}</p>
                </div>
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
                  <UiPasswordInput v-model="form.mh_password" label="MH Password API" placeholder="Dejar vacio para conservar" />
                  <UiPasswordInput v-model="form.signer_password_pri" label="Password privado certificado" placeholder="Dejar vacio para conservar" />
                </div>
              </div>

              <div class="mt-6 flex flex-wrap items-center gap-3">
                <UiButton variant="success" :disabled="loading || !form.empresa_id || isInactive" @click="props.detailMode ? saveSettings() : saveVisibleChanges()">
                  <UiSaveIcon class="mr-2 h-5 w-5" />
                  {{ props.detailMode ? 'Guardar fiscalidad' : (editingCompany ? 'Guardar datos de empresa' : 'Guardar configuracion fiscal') }}
                </UiButton>
                <UiButton variant="secondary" :disabled="loading || !form.empresa_id || isInactive" @click="verifySigner">Verificar firma</UiButton>
                <UiButton variant="secondary" :disabled="loading || !form.empresa_id || isInactive" @click="requestBearer">Verificar autorizacion MH</UiButton>
                <p v-if="saved" class="text-sm text-emerald-700">{{ saved }}</p>
              </div>

              <div class="mt-5 rounded-md border p-4" :class="form.simulate_unavailable ? 'border-amber-300 bg-amber-50' : 'border-blue-100/80 bg-slate-50/80'">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-semibold text-slate-950">Simular MH sin respuesta</p>
                    <p class="mt-1 text-xs text-slate-600">Usalo solo para pruebas de contingencia en este ambiente.</p>
                  </div>
                  <label class="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                    <span>{{ form.simulate_unavailable ? 'Activo' : 'Inactivo' }}</span>
                    <UiToggle
                      v-model="form.simulate_unavailable"
                      aria-label="Simular MH sin respuesta"
                      :disabled="loading || isInactive"
                      off-variant="success"
                      variant="warning"
                    />
                  </label>
                </div>
                <p v-if="form.simulate_unavailable" class="mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">
                  Recepcion y consulta de DTE fallaran localmente; los eventos MH siguen usando el servicio configurado.
                </p>
              </div>
            </div>
          </template>

          <div v-if="!props.detailMode && signerStatus" class="rounded-md border p-3 text-sm" :class="signerStatus.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
            <p class="font-semibold">Firmador {{ signerStatus.available ? 'disponible' : 'no disponible' }}</p>
            <p v-if="signerStatus.status_code">HTTP {{ signerStatus.status_code }}</p>
            <p v-if="signerStatus.last_verified_at">Verificado: {{ formatDateTime(signerStatus.last_verified_at) }}</p>
            <p v-if="signerStatus.message">Detalle: {{ signerStatus.message }}</p>
          </div>

          <div v-if="!props.detailMode && bearerStatus" class="rounded-md border p-3 text-sm" :class="bearerStatus.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
            <p class="font-semibold">Autorizacion MH {{ bearerStatus.available ? 'verificada' : 'no disponible' }}</p>
            <p v-if="bearerStatus.http_status" class="mt-1">HTTP {{ bearerStatus.http_status }}</p>
            <p v-if="bearerStatus.auth_url">Servicio: {{ bearerStatus.auth_url }}</p>
            <p v-if="bearerStatus.token_preview">Token: {{ bearerStatus.token_preview }}</p>
            <p v-if="bearerStatus.cache_status">Origen: {{ bearerStatus.cache_status === 'cached' ? 'cache vigente' : 'renovado en MH' }}</p>
            <p v-if="bearerStatus.expires_at">Expira: {{ bearerStatus.expires_at }}</p>
            <p v-if="bearerStatus.received_at">Recibido: {{ bearerStatus.received_at }}</p>
            <p v-if="bearerStatus.message">Detalle: {{ bearerStatus.message }}</p>
          </div>
        </section>

      </div>

      <BillingModalShell
        :open="creatingSucursal"
        title="Nueva sucursal"
        description="Registra la sucursal y su primer punto de venta."
        max-width="max-w-4xl"
        @close="creatingSucursal = false"
      >
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div class="grid gap-4">
            <div class="grid gap-4 md:grid-cols-2">
              <UiInput v-model="newSucursalForm.nombre" label="Nombre sucursal" />
              <UiInput v-model="newSucursalForm.codigo" label="Codigo establecimiento" />
            </div>
            <UiInput v-model="newSucursalForm.direccion" label="Direccion" />
            <div class="grid gap-4 md:grid-cols-3">
              <UiSearchSelect v-model="newSucursalForm.departamento" label="Departamento" :options="departamentoOptions" placeholder="Seleccionar departamento" />
              <UiSearchSelect v-model="newSucursalForm.municipio" label="Municipio" :options="newSucursalMunicipioOptions" :disabled="!newSucursalForm.departamento" placeholder="Seleccionar municipio" />
              <UiSearchSelect v-model="newSucursalForm.distrito" label="Distrito" :options="newSucursalDistritoOptions" :disabled="!newSucursalForm.municipio" placeholder="Seleccionar distrito" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <UiPhoneInput v-model="newSucursalForm.telefono" label="Telefono" />
              <UiEmailInput v-model="newSucursalForm.email" label="Correo" />
            </div>
          </div>

          <div class="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-semibold text-slate-950">Punto inicial</p>
            <div class="mt-4 grid gap-4">
              <UiInput v-model="newSucursalForm.punto_venta_codigo" label="Codigo" />
              <UiInput v-model="newSucursalForm.punto_venta_nombre" label="Nombre" />
            </div>
          </div>
        </div>

        <template #footer>
          <UiButton variant="secondary" :disabled="loading" @click="creatingSucursal = false">Cancelar</UiButton>
          <UiButton variant="success" :disabled="loading || !canCreateSucursal" @click="createSucursal">
            <UiSaveIcon class="mr-2 h-4 w-4" />
            Crear sucursal
          </UiButton>
        </template>
      </BillingModalShell>

      <BillingModalShell
        :open="creatingPuntoVenta"
        title="Nuevo punto de venta"
        :description="selectedSucursal ? `Crea una caja o terminal para ${selectedSucursal.codigo} · ${selectedSucursal.nombre}.` : 'Crea una caja o terminal para la sucursal seleccionada.'"
        max-width="max-w-2xl"
        @close="creatingPuntoVenta = false"
      >
        <div class="grid gap-4 md:grid-cols-[130px_minmax(0,1fr)_140px]">
          <UiInput v-model="newPuntoVentaForm.codigo" label="Codigo" />
          <UiInput v-model="newPuntoVentaForm.nombre" label="Nombre" />
          <UiInput v-model="newPuntoVentaForm.tipo" label="Tipo" />
        </div>

        <template #footer>
          <UiButton variant="secondary" :disabled="loading" @click="creatingPuntoVenta = false">Cancelar</UiButton>
          <UiButton variant="success" :disabled="loading || !canCreatePuntoVenta" @click="createPuntoVenta">
            <UiSaveIcon class="mr-2 h-4 w-4" />
            Crear punto
          </UiButton>
        </template>
      </BillingModalShell>

      <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>

    <BillingProcessToastOverlay
      :open="deleteOverlayOpen"
      :variant="deleteOverlayVariant"
      :title="deleteOverlayTitle"
      :message="deleteOverlayMessage"
      @close="deleteOverlayOpen = false"
    />
  </div>
</template>
