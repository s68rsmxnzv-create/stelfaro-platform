<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useSlots, watch } from 'vue';
import {
  CoreDteClient,
  type BillingCatalogs,
  type BillingCompanyPayload,
  type BillingCompanyResponse,
  type BillingSettingsPayload
} from '@stelfaro/api-client';
import { UiButton, UiCard, UiEmailInput, UiFileUpload, UiFiscalDocumentInput, UiInput, UiLoadingMark, UiLogoUpload, UiNextIcon, UiPasswordInput, UiPhoneInput, UiPreviousIcon, UiSaveIcon, UiSearchSelect, UiSelect, type FiscalDocumentDetection } from '@stelfaro/ui';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';
import BillingProcessToastOverlay from '../components/BillingProcessToastOverlay.vue';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  requestCredentials?: RequestCredentials;
  enabledDocumentTypes?: string[];
  enabledEventTypes?: string[];
  showToasts?: boolean;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  requestCredentials: undefined,
  enabledDocumentTypes: () => ['01', '03', '05', '06', '14'],
  enabledEventTypes: () => ['invalidacion', 'contingencia', 'operaciones_especiales'],
  showToasts: true
});

const emit = defineEmits<{
  companyRegistered: [response: BillingCompanyResponse];
  fiscalConfigured: [];
}>();
const slots = useSlots();

const client = computed(() => new CoreDteClient(props.coreBaseUrl, {
  authToken: props.authToken,
  credentials: props.requestCredentials
}));
const loading = ref(false);
const error = ref<string | null>(null);
const company = ref<BillingCompanyResponse | null>(null);
const certificateFile = ref<File | null>(null);
const logoFile = ref<File | null>(null);
const logoPreview = ref<string | null>(null);
const companyActivities = ref<string[]>(['']);
const catalogs = ref<BillingCatalogs | null>(null);
const step = ref(0);
const fiscalDocument = ref<FiscalDocumentDetection>({
  valid: false,
  type: '',
  typeLabel: '',
  number: '',
  message: 'Ingresa NIT largo de 14 digitos.'
});

const companyForm = reactive<BillingCompanyPayload>({
  nombre_comercial: '',
  razon_social: '',
  documento_fiscal: '',
  nrc: '',
  codigo_actividad: '',
  desc_actividad: '',
  ambiente: '00',
  direccion: '',
  departamento: '',
  municipio: '',
  distrito: '',
  telefono: '',
  email: ''
});

const fiscalForm = reactive<Omit<BillingSettingsPayload, 'empresa_id' | 'ambiente' | 'certificado_id'>>({
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

const empresaId = computed(() => company.value?.empresa.id ?? null);
const ambiente = computed(() => company.value?.empresa.ambiente ?? companyForm.ambiente);
const departamentos = computed(() => catalogs.value?.departamentos ?? []);
const municipios = computed(() => (catalogs.value?.municipios ?? []).filter((item) => departmentCode(item.departamento) === departmentCode(companyForm.departamento)));
const distritos = computed(() => (catalogs.value?.distritos ?? []).filter((item) => (
  departmentCode(item.departamento) === departmentCode(companyForm.departamento)
  && String(item.municipio) === String(companyForm.municipio)
)));
const actividadesEconomicas = computed(() => catalogs.value?.actividadesEconomicas ?? []);
const departamentoOptions = computed(() => departamentos.value.map((item) => ({
  value: item.code,
  label: item.label,
  hint: item.code
})));
const municipioOptions = computed(() => municipios.value.map((item) => ({
  value: item.code,
  label: item.label,
  hint: item.code
})));
const distritoOptions = computed(() => distritos.value.map((item) => ({
  value: item.code,
  label: item.label,
  hint: item.code
})));
const actividadOptions = computed(() => actividadesEconomicas.value.map((item) => ({
  value: item.code,
  label: item.label,
  hint: item.code
})));
const environmentOptions = [
  { value: '00', label: '00 · Pruebas' },
  { value: '01', label: '01 · Produccion' }
];
const hasAccessStep = computed(() => Boolean(slots.access));
const steps = computed(() => [
  'Empresa',
  'Ubicacion',
  ...(hasAccessStep.value ? ['Accesos'] : []),
  'Credenciales'
]);
const credentialsStepIndex = computed(() => hasAccessStep.value ? 3 : 2);
const stepProgressWidth = computed(() => `${((step.value + 1) / steps.value.length) * 100}%`);
const verificationOverlayOpen = ref(false);
const verificationOverlayVariant = ref<'loading' | 'success' | 'warning' | 'error'>('loading');
const verificationOverlayTitle = ref('Verificando credenciales');
const verificationOverlayMessage = ref<string | null>('Guardando configuracion fiscal y validando servicios MH.');
const processOverlayOpen = ref(false);
const processOverlayTitle = ref('Procesando registro fiscal');
const processOverlayMessage = ref('Guardando informacion de la empresa.');
const floatingToasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;
const toastTimers: ReturnType<typeof window.setTimeout>[] = [];

onBeforeUnmount(() => {
  toastTimers.forEach((timer) => window.clearTimeout(timer));
});

function stepItemClass(index: number): string {
  if (index <= step.value) {
    return 'text-sky-600';
  }

  return 'text-slate-500';
}

function stepStatusLabel(index: number): string {
  if (index < step.value) {
    return 'Completado';
  }

  if (index === step.value) {
    return 'En curso';
  }

  return 'Pendiente';
}
const canCompanyStep = computed(() => Boolean(
  companyForm.nombre_comercial.trim()
  && companyForm.razon_social.trim()
  && fiscalDocument.value.valid
  && companyActivities.value[0]?.trim()
));
const canLocationStep = computed(() => Boolean(
  companyForm.direccion.trim()
  && companyForm.departamento.trim()
  && companyForm.municipio.trim()
  && companyForm.distrito.trim()
));
const canConfigureFiscal = computed(() => Boolean(
  empresaId.value
  && fiscalForm.mh_user?.trim()
  && fiscalForm.mh_password?.trim()
  && fiscalForm.signer_password_pri?.trim()
  && certificateFile.value
));

onMounted(() => {
  void loadCatalogs();
});

watch(() => companyForm.departamento, () => {
  companyForm.municipio = '';
  companyForm.distrito = '';
});

watch(() => companyForm.municipio, () => {
  companyForm.distrito = '';
});

watch(companyActivities, () => {
  syncPrimaryActivity();
}, { deep: true });

async function run<T>(task: () => Promise<T>): Promise<T | null> {
  loading.value = true;
  error.value = null;

  try {
    return await task();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Error inesperado';
    return null;
  } finally {
    loading.value = false;
  }
}

async function loadCatalogs(): Promise<void> {
  const result = await run(() => client.value.billingCatalogs());
  if (result) {
    catalogs.value = result;
  }
}

async function registerCompany(): Promise<void> {
  processOverlayOpen.value = true;
  processOverlayTitle.value = 'Registrando empresa';
  processOverlayMessage.value = 'Guardando empresa fiscal, accesos y correlativos iniciales.';

  const result = await run(() => client.value.registerBillingCompany(normalizeCompanyPayload()));
  if (!result) {
    processOverlayOpen.value = false;
    return;
  }

  company.value = result;
  emit('companyRegistered', result);
  showFloatingToast({
    title: 'Empresa registrada',
    message: `${result.empresa.razon_social} quedo creada en el core fiscal.`,
    variant: 'success'
  });
  processOverlayOpen.value = false;
}

async function nextStep(): Promise<void> {
  if (step.value === 0 && !canCompanyStep.value) {
    return;
  }

  if (step.value === 1) {
    if (!canLocationStep.value) {
      return;
    }
  }

  const shouldRegisterCompany = !company.value && (
    (hasAccessStep.value && step.value === 2)
    || (!hasAccessStep.value && step.value === 1)
  );

  if (shouldRegisterCompany) {
    await registerCompany();
    if (!company.value) {
      return;
    }
  }

  if (step.value < steps.value.length - 1) {
    step.value += 1;
  }
}

function previousStep(): void {
  if (step.value > 0) {
    step.value -= 1;
  }
}

async function saveFiscalSettings(): Promise<void> {
  if (!empresaId.value) {
    error.value = 'Registra una empresa antes de configurar MH.';
    return;
  }

  loading.value = true;
  error.value = null;
  verificationOverlayOpen.value = true;
  verificationOverlayVariant.value = 'loading';
  verificationOverlayTitle.value = 'Verificando credenciales';
  verificationOverlayMessage.value = 'Guardando configuracion fiscal y validando servicios MH.';

  try {
    let certificadoId: number | null = null;
    if (certificateFile.value) {
      const upload = await client.value.uploadCertificate({
        empresa_id: empresaId.value!,
        ambiente: ambiente.value,
        certificate: certificateFile.value
      });
      certificadoId = upload.certificate.id;
    }

    const result = await client.value.saveBillingSettings({
      empresa_id: empresaId.value!,
      ambiente: ambiente.value,
      certificado_id: certificadoId,
      verify: true,
      ...fiscalForm
    });

    showFloatingToast({
      title: 'Configuracion fiscal guardada',
      message: result.verification?.message ?? 'Firma, autorizacion MH y correlativos verificados.',
      variant: 'success'
    });
    verificationOverlayVariant.value = 'success';
    verificationOverlayTitle.value = 'Credenciales verificadas';
    verificationOverlayMessage.value = result.verification?.message ?? 'La firma, la autorizacion MH y los correlativos respondieron correctamente.';
    emit('fiscalConfigured');
  } catch (caught) {
    const message = await errorMessageFromResponse(caught);
    error.value = message;
    verificationOverlayVariant.value = 'error';
    verificationOverlayTitle.value = 'No fue posible verificar';
    verificationOverlayMessage.value = message;
  } finally {
    loading.value = false;
  }
}

function normalizeCompanyPayload(): BillingCompanyPayload {
  syncPrimaryActivity();

  return {
    tenant_nombre: companyForm.nombre_comercial,
    nombre_comercial: companyForm.nombre_comercial,
    razon_social: companyForm.razon_social,
    documento_fiscal: fiscalDocument.value.number,
    nrc: blankToNull(companyForm.nrc),
    codigo_actividad: companyForm.codigo_actividad,
    desc_actividad: companyForm.desc_actividad,
    actividades_economicas: normalizedEconomicActivities(),
    enabled_document_types: props.enabledDocumentTypes,
    enabled_event_types: props.enabledEventTypes,
    ambiente: companyForm.ambiente,
    direccion: companyForm.direccion,
    departamento: companyForm.departamento,
    municipio: companyForm.municipio,
    distrito: companyForm.distrito,
    telefono: blankToNull(companyForm.telefono),
    email: blankToNull(companyForm.email),
    logo: logoFile.value
  };
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

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function departmentCode(value: string | number | null | undefined): string {
  return String(value ?? '').padStart(2, '0');
}

function setCertificate(event: Event): void {
  certificateFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function setLogo(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  logoFile.value = file;
  logoPreview.value = file ? URL.createObjectURL(file) : null;
}

async function errorMessageFromResponse(caught: unknown): Promise<string> {
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

  return caught instanceof Error ? caught.message : 'No fue posible guardar y verificar las credenciales fiscales.';
}

function showFloatingToast(toast: Omit<BillingFloatingToast, 'id'>): void {
  if (!props.showToasts) {
    return;
  }

  const id = ++toastId;
  floatingToasts.value = [...floatingToasts.value, { id, ...toast }];
  const timer = window.setTimeout(() => {
    floatingToasts.value = floatingToasts.value.filter((item) => item.id !== id);
  }, toast.variant === 'success' || !toast.variant ? 4000 : 4300);
  toastTimers.push(timer);
}
</script>

<template>
  <div class="grid gap-6">
    <UiCard>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Onboarding fiscal</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-950">Empresa, certificado y MH</h1>
        </div>
      </div>

      <div class="mt-6">
        <h2 class="sr-only">Pasos</h2>

        <div>
          <div style="height: 8px; overflow: hidden; border-radius: 9999px; background: #e2e8f0;">
            <div style="height: 8px; border-radius: 9999px; background: #0ea5e9; transition: width 180ms ease;" :style="{ width: stepProgressWidth }"></div>
          </div>

          <ol
            class="mt-4 text-sm font-semibold text-slate-500"
            :style="{ display: 'grid', columnGap: '12px', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }"
          >
            <li
              v-for="(item, index) in steps"
              :key="item"
              class="min-w-0"
              :class="[
                stepItemClass(index),
                index === 0 ? 'text-left' : index === steps.length - 1 ? 'text-right' : 'text-center'
              ]"
            >
              <button
                type="button"
                class="min-w-0 rounded-md px-1 py-1 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
                :aria-current="index === step ? 'step' : undefined"
                :aria-label="`${item}: ${stepStatusLabel(index)}`"
                @click="step = index"
              >
                <span class="block truncate">{{ item }}</span>
                <span class="mt-1 block truncate text-xs opacity-75">{{ stepStatusLabel(index) }}</span>
              </button>
            </li>
          </ol>
        </div>
      </div>

      <div v-if="step === 0" class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div class="md:col-span-2 xl:col-span-3">
          <UiSelect
            v-model="companyForm.ambiente"
            label="Ambiente fiscal"
            :options="environmentOptions"
            :disabled="Boolean(company)"
          />
        </div>
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
            id="onboarding-logo-upload"
            label="Logo comercial"
            title="Agregar logo"
            variant="compact"
            :preview-src="logoPreview"
            :selected-label="logoFile?.name"
            @change="setLogo"
          />
        </div>
      </div>

      <div v-else-if="step === 1" class="mt-6 grid gap-4">
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

      <div v-else-if="hasAccessStep && step === 2" class="mt-6">
        <slot name="access" />
      </div>

      <div v-else-if="step === credentialsStepIndex" class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UiSelect
          :model-value="ambiente"
          label="Ambiente fiscal"
          :options="environmentOptions"
          disabled
        />
        <UiInput v-model="fiscalForm.mh_user" label="MH Usuario API" />
        <UiPasswordInput v-model="fiscalForm.mh_password" label="MH Password API" />
        <div class="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-2">
          <label class="block">
            <span class="text-sm font-medium text-slate-700">Certificado</span>
            <UiFileUpload
              id="onboarding-certificate-upload"
              class="mt-1"
              label="Subir certificado"
              :selected-label="certificateFile?.name"
              compact
              @change="setCertificate"
            />
          </label>
          <UiPasswordInput v-model="fiscalForm.signer_password_pri" label="Password privado certificado" />
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <UiButton variant="secondary" :disabled="loading || step === 0" @click="previousStep">
          <UiPreviousIcon class="mr-2 h-5 w-5" />
          Atras
        </UiButton>
        <UiButton v-if="step < steps.length - 1" :disabled="loading || (step === 0 && !canCompanyStep) || (step === 1 && !canLocationStep)" @click="nextStep">
          <span>Continuar</span>
          <UiNextIcon class="ml-2 h-5 w-5" />
        </UiButton>
        <UiButton v-else variant="success" :disabled="loading || !canConfigureFiscal" @click="saveFiscalSettings">
          <UiSaveIcon class="mr-2 h-5 w-5" />
          <span>Guardar</span>
        </UiButton>
      </div>

      <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>

    <Teleport to="body">
      <div
        v-if="processOverlayOpen"
        class="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div class="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl shadow-slate-950/20">
          <UiLoadingMark :label="processOverlayTitle" />
          <p class="mt-3 text-center text-sm text-slate-600">{{ processOverlayMessage }}</p>
        </div>
      </div>
    </Teleport>

    <BillingProcessToastOverlay
      :open="verificationOverlayOpen"
      :variant="verificationOverlayVariant"
      :title="verificationOverlayTitle"
      :message="verificationOverlayMessage"
      @close="verificationOverlayOpen = false"
    />

    <BillingFloatingToastStack v-if="showToasts" :toasts="floatingToasts" />
  </div>
</template>
