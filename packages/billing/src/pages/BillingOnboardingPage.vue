<script setup lang="ts">
import { computed, onMounted, reactive, ref, useSlots, watch } from 'vue';
import {
  CoreDteClient,
  type BillingCatalogs,
  type BillingCompanyPayload,
  type BillingCompanyResponse,
  type BillingSettingsPayload,
  type BillingSignerVerification,
  type MhBearerVerification
} from '@stelfaro/api-client';
import { UiButton, UiCard, UiEmailInput, UiFileUpload, UiFiscalDocumentInput, UiInput, UiLogoUpload, UiPasswordInput, UiSearchSelect, type FiscalDocumentDetection } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  requestCredentials?: RequestCredentials;
  enabledDocumentTypes?: string[];
  enabledEventTypes?: string[];
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null,
  requestCredentials: undefined,
  enabledDocumentTypes: () => ['01', '03', '05', '06', '14'],
  enabledEventTypes: () => ['invalidacion', 'contingencia', 'operaciones_especiales']
});

const emit = defineEmits<{
  companyRegistered: [response: BillingCompanyResponse];
}>();
const slots = useSlots();

const client = computed(() => new CoreDteClient(props.coreBaseUrl, {
  authToken: props.authToken,
  credentials: props.requestCredentials
}));
const loading = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);
const company = ref<BillingCompanyResponse | null>(null);
const signer = ref<BillingSignerVerification | null>(null);
const bearer = ref<MhBearerVerification | null>(null);
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
const hasAccessStep = computed(() => Boolean(slots.access));
const steps = computed(() => [
  'Empresa',
  'Ubicacion',
  ...(hasAccessStep.value ? ['Accesos'] : []),
  'Credenciales',
  'Verificacion'
]);
const credentialsStepIndex = computed(() => hasAccessStep.value ? 3 : 2);
const verificationStepIndex = computed(() => hasAccessStep.value ? 4 : 3);
const stepProgressWidth = computed(() => `${((step.value + 1) / steps.value.length) * 100}%`);

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
  saved.value = null;

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
  const result = await run(() => client.value.registerBillingCompany(normalizeCompanyPayload()));
  if (!result) {
    return;
  }

  company.value = result;
  emit('companyRegistered', result);
  saved.value = `Empresa registrada: ${result.empresa.razon_social}`;
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

  const result = await run(async () => {
    let certificadoId: number | null = null;
    if (certificateFile.value) {
      const upload = await client.value.uploadCertificate({
        empresa_id: empresaId.value!,
        ambiente: ambiente.value,
        certificate: certificateFile.value
      });
      certificadoId = upload.certificate.id;
    }

    return client.value.saveBillingSettings({
      empresa_id: empresaId.value!,
      ambiente: ambiente.value,
      certificado_id: certificadoId,
      ...fiscalForm
    });
  });

  if (result) {
    saved.value = 'Configuracion fiscal guardada.';
  }
}

async function verifySigner(): Promise<void> {
  if (!empresaId.value) {
    return;
  }

  const result = await run(() => client.value.verifyBillingSigner({
    empresa_id: empresaId.value!,
    ambiente: ambiente.value
  }));

  if (result) {
    signer.value = result.signer;
  }
}

async function requestBearer(): Promise<void> {
  if (!empresaId.value) {
    return;
  }

  const result = await run(() => client.value.requestMhBearer({
    empresa_id: empresaId.value!,
    ambiente: ambiente.value,
    include_token: true
  }));

  if (result) {
    bearer.value = result.auth;
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

</script>

<template>
  <div class="grid gap-6">
    <UiCard>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Onboarding fiscal</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-950">Empresa, certificado y MH</h1>
        </div>
        <div v-if="company" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Empresa #{{ company.empresa.id }} · {{ company.tenant.slug }}
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
        <div class="grid gap-4 md:col-span-2 xl:col-span-3" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <UiInput v-model="companyForm.razon_social" label="Nombre del contribuyente" />
          <UiInput v-model="companyForm.nombre_comercial" label="Nombre comercial" />
        </div>
        <div class="grid gap-4 md:col-span-2 xl:col-span-3" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <UiFiscalDocumentInput v-model="companyForm.documento_fiscal" label="NIT" allowed-types="nit" @detected="fiscalDocument = $event" />
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
        <UiLogoUpload
          id="onboarding-logo-upload"
          :preview-src="logoPreview"
          :selected-label="logoFile?.name"
          @change="setLogo"
        />
      </div>

      <div v-else-if="step === 1" class="mt-6 grid gap-4">
        <UiInput v-model="companyForm.direccion" label="Direccion" />
        <div class="grid gap-4" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
          <UiSearchSelect v-model="companyForm.departamento" label="Departamento" :options="departamentoOptions" placeholder="Seleccionar departamento" />
          <UiSearchSelect v-model="companyForm.municipio" label="Municipio" :options="municipioOptions" :disabled="!companyForm.departamento" placeholder="Seleccionar municipio" />
          <UiSearchSelect v-model="companyForm.distrito" label="Distrito" :options="distritoOptions" :disabled="!companyForm.municipio" placeholder="Seleccionar distrito" />
        </div>
        <div class="grid gap-4" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <UiInput v-model="companyForm.telefono" label="Telefono" />
          <UiEmailInput v-model="companyForm.email" label="Correo" />
        </div>
      </div>

      <div v-else-if="hasAccessStep && step === 2" class="mt-6">
        <slot name="access" />
      </div>

      <div v-else-if="step === credentialsStepIndex" class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Ambiente</span>
          <select v-model="companyForm.ambiente" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="00">00 · Pruebas</option>
            <option value="01">01 · Produccion</option>
          </select>
        </label>
        <UiInput v-model="fiscalForm.mh_user" label="MH Usuario API" />
        <UiPasswordInput v-model="fiscalForm.mh_password" label="MH Password API" />
        <UiPasswordInput v-model="fiscalForm.signer_password_pri" label="Password privado certificado" />
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Certificado .p12/.crt</span>
          <UiFileUpload
            id="onboarding-certificate-upload"
            class="mt-1"
            label="Subir certificado"
            :selected-label="certificateFile?.name"
            @change="setCertificate"
          />
        </label>
      </div>

      <div v-else-if="step === verificationStepIndex" class="mt-6 grid gap-4 lg:grid-cols-2">
        <div class="rounded-md border border-slate-200 p-4 text-sm">
          <p class="font-semibold text-slate-900">{{ company?.empresa.razon_social }}</p>
          <p class="mt-1 text-slate-600">{{ company?.empresa.fiscal_document_number }} · {{ company?.empresa.nombre_comercial }}</p>
          <p class="mt-1 text-slate-600">Ambiente {{ ambiente === '01' ? 'Produccion' : 'Pruebas' }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UiButton :disabled="loading || !canConfigureFiscal" @click="saveFiscalSettings">Guardar configuracion</UiButton>
          <UiButton variant="secondary" :disabled="loading || !empresaId" @click="verifySigner">Verificar firma</UiButton>
          <UiButton variant="secondary" :disabled="loading || !empresaId" @click="requestBearer">Verificar autorizacion MH</UiButton>
        </div>
        <div v-if="signer" class="rounded-md border p-3 text-sm" :class="signer.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
          <p class="font-semibold">{{ signer.available ? 'Firma verificada' : 'Firma no verificada' }}</p>
          <p v-if="signer.status_code">HTTP {{ signer.status_code }}</p>
          <p v-if="signer.message">Detalle: {{ signer.message }}</p>
        </div>
        <div v-if="bearer" class="rounded-md border p-3 text-sm" :class="bearer.status === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
          <p class="font-semibold">Autorizacion MH {{ bearer.status === 'ok' ? 'verificada' : 'no disponible' }}</p>
          <p v-if="bearer.http_status" class="mt-1">HTTP {{ bearer.http_status }}</p>
          <p v-if="bearer.auth_url">Servicio: {{ bearer.auth_url }}</p>
          <p v-if="bearer.bearer_token" class="mt-2 break-all font-mono text-xs">{{ bearer.bearer_token }}</p>
          <p v-else-if="bearer.token_preview" class="mt-2 font-mono text-xs">{{ bearer.token_preview }}</p>
          <p v-if="bearer.message" class="mt-1">{{ bearer.message }}</p>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <UiButton variant="secondary" :disabled="loading || step === 0" @click="previousStep">Atras</UiButton>
        <UiButton v-if="step < steps.length - 1" :disabled="loading || (step === 0 && !canCompanyStep) || (step === 1 && !canLocationStep)" @click="nextStep">
          Continuar
        </UiButton>
      </div>

      <p v-if="saved" class="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{{ saved }}</p>
      <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>
  </div>
</template>
