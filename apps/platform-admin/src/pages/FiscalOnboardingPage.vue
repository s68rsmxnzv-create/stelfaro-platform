<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { BillingCompanyResponse } from '@stelfaro/api-client';
import { BillingOnboardingPage } from '@stelfaro/billing';
import { UiLoadingMark } from '@stelfaro/ui';
import { useCoreSessionStore } from '../stores/coreSession';

const core = useCoreSessionStore();

type PlatformAppOption = {
  key: string;
  name: string;
  host: string | null;
  default_path: string | null;
  is_core: boolean;
};

const apps = ref<PlatformAppOption[]>([]);
const selectedAppKeys = ref<string[]>(['facturacion']);
const loadingApps = ref(false);
const appError = ref<string | null>(null);
const tenantStatus = ref<string | null>(null);
const tenantError = ref<string | null>(null);
const adminPlatformApiBaseUrl = import.meta.env.VITE_PLATFORM_API_BASE_URL || 'https://platform.stelfaro.com/api/v1';
const platformLoginUrl = 'https://platform.stelfaro.com/login';
const dteOptions = [
  { code: '01', label: 'Factura consumidor final', short: 'FCF' },
  { code: '03', label: 'Comprobante credito fiscal', short: 'CCF' },
  { code: '05', label: 'Nota de credito', short: 'NC' },
  { code: '06', label: 'Nota de debito', short: 'ND' },
  { code: '14', label: 'Sujeto excluido', short: 'FSE' }
];
const eventOptions = [
  { code: 'invalidacion', label: 'Invalidacion', short: 'INV' },
  { code: 'contingencia', label: 'Contingencia', short: 'CONT' },
  { code: 'operaciones_especiales', label: 'Operaciones especiales', short: 'OPE' }
];
const selectedDteCodes = ref<string[]>(dteOptions.map((option) => option.code));
const selectedEventTypes = ref<string[]>(eventOptions.map((option) => option.code));

const selectableApps = computed(() => apps.value.filter((app) => app.key !== 'facturacion'));
const hasFacturacion = computed(() => apps.value.some((app) => app.key === 'facturacion'));

onMounted(() => {
  void loadPlatformApps();
});

async function loadPlatformApps(): Promise<void> {
  loadingApps.value = true;
  appError.value = null;

  try {
    const response = await fetch(`${adminPlatformApiBaseUrl}/admin/platform/apps`, {
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });

    if (response.status === 401 || response.redirected) {
      window.location.assign(platformLoginUrl);
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`platform-api devolvio ${contentType || 'una respuesta no JSON'} desde ${adminPlatformApiBaseUrl}.`);
    }

    const payload = await response.json() as { apps: PlatformAppOption[] };
    apps.value = payload.apps;
    selectedAppKeys.value = Array.from(new Set([
      'facturacion',
      ...selectedAppKeys.value.filter((key) => payload.apps.some((app) => app.key === key))
    ]));
  } catch (error) {
    appError.value = error instanceof Error ? error.message : 'No fue posible cargar las apps de plataforma.';
  } finally {
    loadingApps.value = false;
  }
}

function toggleApp(key: string): void {
  if (key === 'facturacion') {
    return;
  }

  selectedAppKeys.value = selectedAppKeys.value.includes(key)
    ? selectedAppKeys.value.filter((item) => item !== key)
    : [...selectedAppKeys.value, key];
}

function toggleDte(code: string): void {
  if (selectedDteCodes.value.includes(code)) {
    if (selectedDteCodes.value.length === 1) {
      return;
    }

    selectedDteCodes.value = selectedDteCodes.value.filter((item) => item !== code);
    return;
  }

  selectedDteCodes.value = [...selectedDteCodes.value, code];
}

function toggleEventType(code: string): void {
  if (selectedEventTypes.value.includes(code)) {
    if (selectedEventTypes.value.length === 1) {
      return;
    }

    selectedEventTypes.value = selectedEventTypes.value.filter((item) => item !== code);
    return;
  }

  selectedEventTypes.value = [...selectedEventTypes.value, code];
}

async function registerPlatformTenant(response: BillingCompanyResponse): Promise<void> {
  tenantStatus.value = null;
  tenantError.value = null;

  try {
    const platformResponse = await fetch(`${adminPlatformApiBaseUrl}/admin/platform/tenants`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        core_empresa_id: response.empresa.id,
        core_tenant_id: response.tenant.id,
        name: response.empresa.nombre_comercial || response.empresa.razon_social,
        slug: response.tenant.slug,
        app_keys: selectedAppKeys.value
      })
    });

    if (platformResponse.status === 401 || platformResponse.redirected) {
      window.location.assign(platformLoginUrl);
      return;
    }

    if (!platformResponse.ok) {
      const contentType = platformResponse.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await platformResponse.json().catch(() => null) as { message?: string } | null
        : null;
      throw new Error(payload?.message ?? `HTTP ${platformResponse.status}`);
    }

    const contentType = platformResponse.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`platform-api devolvio ${contentType || 'una respuesta no JSON'} desde ${adminPlatformApiBaseUrl}.`);
    }

    const payload = await platformResponse.json() as { tenant: { name: string; apps: Array<{ name: string }> } };
    tenantStatus.value = `${payload.tenant.name} quedo habilitado para ${payload.tenant.apps.map((app) => app.name).join(', ')}.`;
  } catch (error) {
    tenantError.value = error instanceof Error ? error.message : 'La empresa fiscal se creo, pero no fue posible asignar apps al tenant.';
  }
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div v-if="!core.isConnected" class="rounded-lg border border-slate-200 bg-white p-5">
      <UiLoadingMark label="Preparando registro fiscal" />
      <p v-if="core.lastError" class="mx-auto -mt-8 max-w-xl rounded-md bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
        {{ core.lastError }}
      </p>
    </div>

    <div v-else class="grid gap-4">
      <BillingOnboardingPage
        :core-base-url="core.baseUrl"
        :enabled-document-types="selectedDteCodes"
        :enabled-event-types="selectedEventTypes"
        request-credentials="include"
        @company-registered="registerPlatformTenant"
      >
        <template #access>
          <div class="grid gap-6">
            <section class="grid gap-3 border-b border-slate-100 pb-5">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Apps habilitadas</p>
                  <p class="mt-1 text-xs text-slate-500">Facturacion se habilita siempre. Selecciona las apps operativas adicionales para este tenant.</p>
                </div>
                <button
                  type="button"
                  class="rounded-md px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  :disabled="loadingApps"
                  @click="loadPlatformApps"
                >
                  Actualizar
                </button>
              </div>

              <div v-if="loadingApps" class="text-sm text-slate-500">Cargando apps disponibles...</div>
              <p v-else-if="appError" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ appError }}</p>
              <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label class="flex items-center justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3">
                  <span>
                    <span class="block text-sm font-semibold text-slate-950">Facturacion</span>
                    <span class="mt-0.5 block text-xs text-slate-500">Eje fiscal central</span>
                  </span>
                  <input type="checkbox" class="h-4 w-4 accent-sky-600" checked disabled>
                </label>

                <label
                  v-for="app in selectableApps"
                  :key="app.key"
                  class="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 transition hover:border-sky-200 hover:bg-sky-50/50"
                >
                  <span>
                    <span class="block text-sm font-semibold text-slate-950">{{ app.name }}</span>
                    <span class="mt-0.5 block text-xs text-slate-500">{{ app.host ?? app.key }}</span>
                  </span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-sky-600"
                    :checked="selectedAppKeys.includes(app.key)"
                    @change="toggleApp(app.key)"
                  >
                </label>
              </div>

              <p v-if="!loadingApps && !appError && !hasFacturacion" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Facturacion no esta activa en el catalogo de apps. Activa esa app antes de registrar tenants.
              </p>
            </section>

            <section class="grid gap-3 border-b border-slate-100 pb-5">
              <div>
                <p class="text-sm font-semibold text-slate-950">DTE habilitados</p>
                <p class="mt-1 text-xs text-slate-500">Estos documentos tendran correlativos activos y seran los unicos visibles para el tenant.</p>
              </div>

              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label
                  v-for="option in dteOptions"
                  :key="option.code"
                  class="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-3 transition"
                  :class="selectedDteCodes.includes(option.code) ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/50'"
                >
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-slate-950">{{ option.short }}</span>
                    <span class="mt-0.5 block truncate text-xs text-slate-500">{{ option.label }}</span>
                  </span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-sky-600"
                    :checked="selectedDteCodes.includes(option.code)"
                    @change="toggleDte(option.code)"
                  >
                </label>
              </div>
            </section>

            <section class="grid gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-950">Eventos habilitados</p>
                <p class="mt-1 text-xs text-slate-500">Estos eventos MH seran visibles y permitidos para el tenant.</p>
              </div>

              <div class="grid gap-3 md:grid-cols-3">
                <label
                  v-for="option in eventOptions"
                  :key="option.code"
                  class="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-3 transition"
                  :class="selectedEventTypes.includes(option.code) ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/50'"
                >
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-slate-950">{{ option.short }}</span>
                    <span class="mt-0.5 block truncate text-xs text-slate-500">{{ option.label }}</span>
                  </span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-sky-600"
                    :checked="selectedEventTypes.includes(option.code)"
                    @change="toggleEventType(option.code)"
                  >
                </label>
              </div>
            </section>
          </div>
        </template>
      </BillingOnboardingPage>

      <p v-if="tenantStatus" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{{ tenantStatus }}</p>
      <p v-if="tenantError" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ tenantError }}</p>
    </div>
  </section>
</template>
