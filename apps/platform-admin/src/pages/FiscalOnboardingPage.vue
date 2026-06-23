<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { BillingCompanyResponse } from '@stelfaro/api-client';
import { BillingFloatingToastStack, BillingOnboardingPage, type BillingFloatingToast } from '@stelfaro/billing';
import { UiButton, UiCard, UiLoadingMark, UiRefreshButton, UiToggle } from '@stelfaro/ui';
import { useCoreSessionStore } from '../stores/coreSession';

const core = useCoreSessionStore();
const router = useRouter();

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
const tenantError = ref<string | null>(null);
const tenantSyncing = ref(false);
const tenantReady = ref(false);
const fiscalReady = ref(false);
const redirectingToNewCompany = ref(false);
const ownerCredentials = ref<{ email: string; name: string; temporaryPassword: string | null; created: boolean } | null>(null);
const floatingToasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;
const toastTimers: ReturnType<typeof window.setTimeout>[] = [];
let redirectTimer: ReturnType<typeof window.setTimeout> | null = null;
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

onBeforeUnmount(() => {
  toastTimers.forEach((timer) => window.clearTimeout(timer));
  if (redirectTimer) {
    window.clearTimeout(redirectTimer);
  }
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
  tenantError.value = null;
  tenantSyncing.value = true;
  tenantReady.value = false;
  fiscalReady.value = false;
  redirectingToNewCompany.value = false;
  ownerCredentials.value = null;
  showFloatingToast({
    title: 'Empresa registrada',
    message: `${response.empresa.razon_social} quedo creada en el core fiscal.`,
    variant: 'success'
  });

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
        app_keys: selectedAppKeys.value,
        make_default: false,
        owner_name: response.empresa.razon_social || response.empresa.nombre_comercial,
        owner_email: response.empresa.sucursales?.[0]?.email,
        environment: response.empresa.ambiente
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

    const payload = await platformResponse.json() as {
      tenant: {
        name: string;
        apps: Array<{ name: string }>;
        owner?: { email: string; name: string; temporary_password: string | null; created: boolean } | null;
      };
    };
    if (payload.tenant.owner) {
      ownerCredentials.value = {
        email: payload.tenant.owner.email,
        name: payload.tenant.owner.name,
        temporaryPassword: payload.tenant.owner.temporary_password,
        created: payload.tenant.owner.created
      };
    }
    const message = `${payload.tenant.name} quedo habilitado para ${payload.tenant.apps.map((app) => app.name).join(', ')}.`;
    showFloatingToast({
      title: 'Tenant habilitado',
      message,
      variant: 'success'
    });
    tenantReady.value = true;
    redirectToNewCompanyWhenComplete();
  } catch (error) {
    tenantError.value = error instanceof Error ? error.message : 'La empresa fiscal se creo, pero no fue posible asignar apps al tenant.';
    showFloatingToast({
      title: 'No fue posible habilitar el tenant',
      message: tenantError.value,
      variant: 'error'
    });
  } finally {
    tenantSyncing.value = false;
  }
}

function handleFiscalConfigured(): void {
  fiscalReady.value = true;
  redirectToNewCompanyWhenComplete();
}

function redirectToNewCompanyWhenComplete(): void {
  if (
    redirectingToNewCompany.value
    || tenantSyncing.value
    || tenantError.value
    || !tenantReady.value
    || !fiscalReady.value
  ) {
    return;
  }

  redirectingToNewCompany.value = true;
  showFloatingToast({
    title: 'Registro completado',
    message: 'Abriendo un nuevo registro de empresa.',
    variant: 'success'
  });

  redirectTimer = window.setTimeout(() => {
    void router.replace({
      name: 'fiscal-onboarding',
      query: { new: String(Date.now()) }
    });
  }, 1200);
}

function showFloatingToast(toast: Omit<BillingFloatingToast, 'id'>): void {
  const id = ++toastId;
  floatingToasts.value = [...floatingToasts.value, { id, ...toast }];
  const timer = window.setTimeout(() => {
    floatingToasts.value = floatingToasts.value.filter((item) => item.id !== id);
  }, 4300);
  toastTimers.push(timer);
}

async function copyOwnerPassword(): Promise<void> {
  if (!ownerCredentials.value?.temporaryPassword) {
    return;
  }

  await navigator.clipboard?.writeText(ownerCredentials.value.temporaryPassword);
  showFloatingToast({
    title: 'Contrasena copiada',
    message: ownerCredentials.value.email,
    variant: 'success'
  });
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
      <UiCard v-if="ownerCredentials">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Owner creado</p>
            <h2 class="mt-1 text-lg font-black">{{ ownerCredentials.email }}</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-muted">Debe cambiar su contrasena temporal en el primer inicio de sesion.</p>
            <p v-if="ownerCredentials.temporaryPassword" class="mt-3 rounded-md border border-blue-100 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-950 dark:border-line dark:bg-surface-muted dark:text-text">
              {{ ownerCredentials.temporaryPassword }}
            </p>
            <p v-else class="mt-2 text-sm text-slate-600 dark:text-muted">El usuario ya existia; conserva sus credenciales actuales.</p>
          </div>
          <UiButton v-if="ownerCredentials.temporaryPassword" variant="secondary" class="shrink-0" @click="copyOwnerPassword">
            Copiar contrasena
          </UiButton>
        </div>
      </UiCard>

      <BillingOnboardingPage
        :core-base-url="core.baseUrl"
        :enabled-document-types="selectedDteCodes"
        :enabled-event-types="selectedEventTypes"
        :show-toasts="false"
        request-credentials="include"
        @company-registered="registerPlatformTenant"
        @fiscal-configured="handleFiscalConfigured"
      >
        <template #access>
          <div class="grid gap-5">
            <section class="grid gap-3">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm font-semibold text-slate-950">Apps habilitadas</p>
                </div>
                <UiRefreshButton
                  class="self-start px-3 py-1.5 text-xs sm:self-auto"
                  :loading="loadingApps"
                  @click="loadPlatformApps"
                />
              </div>

              <div v-if="loadingApps" class="text-sm text-slate-500">Cargando apps disponibles...</div>
              <p v-else-if="appError" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ appError }}</p>
              <div v-else class="grid gap-2 md:grid-cols-2">
                <div class="flex min-h-14 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-slate-950">Facturacion</span>
                    <span class="mt-0.5 block truncate text-xs text-slate-500">Eje fiscal central</span>
                  </span>
                  <span class="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
                    Siempre activa
                    <UiToggle :model-value="true" aria-label="Facturacion activa" disabled />
                  </span>
                </div>

                <div
                  v-for="app in selectableApps"
                  :key="app.key"
                  class="flex min-h-14 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-slate-950">{{ app.name }}</span>
                    <span class="mt-0.5 block truncate text-xs text-slate-500">{{ app.host ?? app.key }}</span>
                  </span>
                  <UiToggle
                    class="shrink-0"
                    :model-value="selectedAppKeys.includes(app.key)"
                    :aria-label="`Habilitar ${app.name}`"
                    @update:model-value="toggleApp(app.key)"
                  />
                </div>
              </div>

              <p v-if="!loadingApps && !appError && !hasFacturacion" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Facturacion no esta activa en el catalogo de apps. Activa esa app antes de registrar tenants.
              </p>
            </section>

            <section class="grid gap-3 border-t border-slate-100 pt-5">
              <div>
                <p class="text-sm font-semibold text-slate-950">DTE habilitados</p>
                <p class="mt-1 text-xs text-slate-500">Estos documentos tendran correlativos activos y seran los unicos visibles para el tenant.</p>
              </div>

              <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="option in dteOptions"
                  :key="option.code"
                  class="flex min-h-14 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-slate-950">{{ option.short }}</span>
                    <span class="mt-0.5 block truncate text-xs text-slate-500">{{ option.label }}</span>
                  </span>
                  <UiToggle
                    class="shrink-0"
                    :model-value="selectedDteCodes.includes(option.code)"
                    :aria-label="`Habilitar ${option.label}`"
                    @update:model-value="toggleDte(option.code)"
                  />
                </div>
              </div>
            </section>

            <section class="grid gap-3 border-t border-slate-100 pt-5">
              <div>
                <p class="text-sm font-semibold text-slate-950">Eventos habilitados</p>
                <p class="mt-1 text-xs text-slate-500">Estos eventos MH seran visibles y permitidos para el tenant.</p>
              </div>

              <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <div
                  v-for="option in eventOptions"
                  :key="option.code"
                  class="flex min-h-14 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-slate-950">{{ option.short }}</span>
                    <span class="mt-0.5 block truncate text-xs text-slate-500">{{ option.label }}</span>
                  </span>
                  <UiToggle
                    class="shrink-0"
                    :model-value="selectedEventTypes.includes(option.code)"
                    :aria-label="`Habilitar ${option.label}`"
                    @update:model-value="toggleEventType(option.code)"
                  />
                </div>
              </div>
            </section>
          </div>
        </template>
      </BillingOnboardingPage>

      <Teleport to="body">
        <div
          v-if="tenantSyncing"
          class="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div class="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl shadow-slate-950/20">
            <UiLoadingMark label="Sincronizando tenant" />
            <p class="mt-3 text-center text-sm text-slate-600">Asignando apps, permisos y acceso operativo para la empresa.</p>
          </div>
        </div>
      </Teleport>

      <BillingFloatingToastStack :toasts="floatingToasts" />
    </div>
  </section>
</template>
