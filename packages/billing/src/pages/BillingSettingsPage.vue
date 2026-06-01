<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { CoreDteClient, type BillingContext, type BillingSettingsPayload, type BillingSignerVerification } from '@stelfaro/api-client';
import { UiButton, UiCard, UiInput } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
}>(), {
  coreBaseUrl: '/api/v1'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl));
const loading = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);
const signerStatus = ref<BillingSignerVerification | null>(null);
const context = ref<BillingContext | null>(null);
const certificateFile = ref<File | null>(null);

const form = reactive<BillingSettingsPayload>({
  empresa_id: 0,
  ambiente: '00',
  certificado_id: null,
  active: true,
  transmission_provider: 'mh',
  signing_provider: 'jar',
  base_url: '',
  auth_url: '',
  reception_url: '',
  event_reception_url: '',
  query_url: '',
  signer_url: '',
  mh_nit: '',
  mh_user: '',
  mh_password: '',
  auth_payload_mode: 'form',
  auth_token_path: 'body.token',
  signer_nit: '',
  signer_password_pri: '',
  signer_activo: true
});

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => empresa.id === form.empresa_id) ?? null);
const certificados = computed(() => selectedEmpresa.value?.certificados.filter((cert) => cert.ambiente === form.ambiente) ?? []);

onMounted(() => {
  void loadContext();
});

watch(() => [form.empresa_id, form.ambiente] as const, () => {
  if (form.empresa_id) {
    void loadSettings();
  }
});

async function loadContext(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    context.value = await client.value.billingContext();
    form.empresa_id = context.value.empresas[0]?.id ?? 0;
    form.ambiente = context.value.empresas[0]?.ambiente ?? '00';
    await loadSettings();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar contexto fiscal.';
  } finally {
    loading.value = false;
  }
}

async function loadSettings(): Promise<void> {
  if (!form.empresa_id) {
    return;
  }

  const response = await client.value.billingSettings(form.empresa_id, form.ambiente);

  if (!response.config) {
    return;
  }

  Object.assign(form, {
    certificado_id: response.config.certificado_id ?? null,
    active: response.config.active,
    transmission_provider: response.config.transmission_provider,
    signing_provider: response.config.signing_provider,
    base_url: response.config.base_url ?? '',
    auth_url: response.config.auth_url ?? '',
    reception_url: response.config.reception_url ?? '',
    event_reception_url: response.config.event_reception_url ?? '',
    query_url: response.config.query_url ?? '',
    signer_url: response.config.signer_url ?? ''
  });
}

async function saveSettings(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    if (certificateFile.value) {
      const upload = await client.value.uploadCertificate({
        empresa_id: form.empresa_id,
        ambiente: form.ambiente,
        certificate: certificateFile.value
      });
      form.certificado_id = upload.certificate.id;
    }

    await client.value.saveBillingSettings(form);
    saved.value = 'Configuracion fiscal guardada. Los secretos no se devuelven por API.';
    await loadContext();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar configuracion fiscal.';
  } finally {
    loading.value = false;
  }
}

async function verifySigner(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;
  signerStatus.value = null;

  try {
    const response = await client.value.verifyBillingSigner({
      empresa_id: form.empresa_id,
      ambiente: form.ambiente
    });
    signerStatus.value = response.signer;
    await loadSettings();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible sincronizar el firmador.';
  } finally {
    loading.value = false;
  }
}

function setCertificate(event: Event): void {
  certificateFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}
</script>

<template>
  <UiCard>
    <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Configuracion fiscal</p>
    <h1 class="mt-1 text-2xl font-bold text-slate-950">MH, certificado y firmador</h1>
    <p class="mt-2 text-sm text-slate-500">
      Configuracion persistente por empresa y ambiente. Endpoints y credenciales se cargan aqui; no quedan quemados en el frontend.
    </p>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Empresa</span>
        <select v-model.number="form.empresa_id" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">
            {{ empresa.razon_social }} · {{ empresa.nit }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-slate-700">Ambiente</span>
        <select v-model="form.ambiente" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="00">00 · Pruebas</option>
          <option value="01">01 · Produccion</option>
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-slate-700">Transmision</span>
        <select v-model="form.transmission_provider" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="stub">Stub</option>
          <option value="mh">MH real</option>
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-slate-700">Firma</span>
        <select v-model="form.signing_provider" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="stub">Stub</option>
          <option value="jar">Firmador JAR</option>
        </select>
      </label>

      <UiInput v-model="form.base_url" label="MH Base URL" />
      <UiInput v-model="form.auth_url" label="MH Auth URL" />
      <UiInput v-model="form.reception_url" label="MH Recepcion DTE URL" />
      <UiInput v-model="form.event_reception_url" label="MH Recepcion Eventos URL" />
      <UiInput v-model="form.query_url" label="MH Consulta URL" />
      <UiInput v-model="form.signer_url" label="Firmador URL" />
      <UiInput v-model="form.mh_nit" label="MH NIT" />
      <UiInput v-model="form.mh_user" label="MH Usuario API" />
      <UiInput v-model="form.mh_password" label="MH Password API" type="password" />
      <UiInput v-model="form.signer_password_pri" label="Password privado certificado" type="password" />
    </div>

    <div class="mt-5 grid gap-4 md:grid-cols-2">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Certificado activo</span>
        <select v-model.number="form.certificado_id" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option :value="null">Sin certificado seleccionado</option>
          <option v-for="cert in certificados" :key="cert.id" :value="cert.id">
            #{{ cert.id }} · {{ cert.filename }} {{ cert.activo ? '(activo)' : '' }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-slate-700">Subir certificado .p12/.crt</span>
        <input class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="file" @change="setCertificate">
      </label>
    </div>

    <div class="mt-6 flex items-center gap-3">
      <UiButton :disabled="loading || !form.empresa_id" @click="saveSettings">Guardar configuracion</UiButton>
      <UiButton variant="secondary" :disabled="loading || !form.empresa_id" @click="verifySigner">Sincronizar firmador</UiButton>
      <p v-if="saved" class="text-sm text-emerald-700">{{ saved }}</p>
    </div>

    <div v-if="signerStatus" class="mt-4 rounded-md border p-3 text-sm" :class="signerStatus.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'">
      <p class="font-semibold">
        Firmador {{ signerStatus.available ? 'disponible' : 'no disponible' }}
      </p>
      <p class="mt-1">Status URL: {{ signerStatus.status_url }}</p>
      <p v-if="signerStatus.status_code">HTTP {{ signerStatus.status_code }}</p>
      <p v-if="signerStatus.last_verified_at">Verificado: {{ signerStatus.last_verified_at }}</p>
      <p v-if="signerStatus.message">Detalle: {{ signerStatus.message }}</p>
    </div>

    <p v-if="error" class="mt-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
  </UiCard>
</template>
