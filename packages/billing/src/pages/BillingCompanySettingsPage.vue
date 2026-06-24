<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { PlatformClient, type PlatformSubscriptionTenantRow } from '@stelfaro/api-client';
import { UiButton, UiPanel, UiRefreshButton, UiStatusBadge, UiSubscriptionPlanCard } from '@stelfaro/ui';
import BillingSettingsPage from './BillingSettingsPage.vue';

type CompanyView = 'summary' | 'requests' | 'profile' | 'subscription' | 'printer' | 'security' | 'support';
type SettingsCompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos';
type NavIcon = 'summary' | 'requests' | 'profile' | 'subscription' | 'printer' | 'security' | 'support';
type SelectedCompany = {
  id: number;
  coreEmpresaId: number;
  name: string;
  tradeName: string;
  documentLabel: string;
  lifecycleStatus: string;
  ambiente: '00' | '01';
};
type MarketingPlanCard = {
  key: 'entrepreneur' | 'professional' | 'enterprise';
  title: string;
  headline: string;
  suffix: string;
  description: string;
  features: string[];
  actionLabel: string;
  featured?: boolean;
  badgeLabel?: string;
};

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  platformBaseUrl?: string;
  authToken?: string | null;
  appBaseUrl?: string;
  dashboardUrl?: string;
  billingContextCacheScope?: string;
  requestCredentials?: RequestCredentials;
}>(), {
  coreBaseUrl: '/api/v1',
  platformBaseUrl: '/api/v1',
  authToken: null,
  appBaseUrl: '',
  dashboardUrl: '',
  billingContextCacheScope: '',
  requestCredentials: undefined
});

const selectedCompany = ref<SelectedCompany | null>(null);
const activeView = ref<CompanyView>('summary');
const subscriptionRow = ref<PlatformSubscriptionTenantRow | null>(null);
const subscriptionLoading = ref(false);
const subscriptionError = ref<string | null>(null);
const subscriptionRequestMessage = ref<string | null>(null);
const wompiScriptUrl = 'https://pagos.wompi.sv/js/wompi.pagos.js';
const wompiCheckoutUrls: Partial<Record<MarketingPlanCard['key'], string>> = {
  entrepreneur: 'https://pagos.wompi.sv/IntentoPago/Redirect?id=bdfd9af6-ace2-48b1-92e4-07bd182619db',
  professional: 'https://pagos.wompi.sv/IntentoPago/Redirect?id=33bcab4e-0036-4477-a0a0-326a4a415c31'
};

const companyTitle = computed(() => selectedCompany.value?.tradeName || selectedCompany.value?.name || 'Mi empresa');
const activeItem = computed(() => navItems.find((item) => item.id === activeView.value) ?? navItems[0]);
const subscription = computed(() => subscriptionRow.value?.subscription ?? null);
const fiscalEnvironment = computed(() => selectedCompany.value?.ambiente ?? subscriptionRow.value?.tenant.environment ?? null);
const isFiscalTesting = computed(() => fiscalEnvironment.value === '00');
const subscriptionEndsAt = computed(() => subscription.value?.current_period_ends_at ?? subscription.value?.trial_ends_at ?? null);
const remainingDays = computed(() => daysUntil(subscriptionEndsAt.value));
const status = computed(() => {
  if (isFiscalTesting.value) return 'testing';
  if (!subscription.value) return 'none';
  if (subscription.value.status === 'active' && typeof remainingDays.value === 'number' && remainingDays.value < 0) return 'expired';
  if (subscription.value.status === 'trialing' && typeof remainingDays.value === 'number' && remainingDays.value < 0) return 'expired';

  return subscription.value.status;
});
const navItems: Array<{
  id: CompanyView;
  label: string;
  detail: string;
  icon: NavIcon;
}> = [
  { id: 'summary', label: 'Resumen', detail: 'Información de empresa', icon: 'summary' },
  { id: 'requests', label: 'Solicitudes', detail: 'Cambios sensibles', icon: 'requests' },
  { id: 'profile', label: 'Perfil', detail: 'Datos de contacto', icon: 'profile' },
  { id: 'subscription', label: 'Suscripción', detail: 'Plan y vigencia', icon: 'subscription' },
  { id: 'printer', label: 'Impresora', detail: 'Preferencias locales', icon: 'printer' },
  { id: 'security', label: 'Seguridad', detail: 'Contraseña y acceso', icon: 'security' },
  { id: 'support', label: 'Soporte', detail: 'Canales de ayuda', icon: 'support' }
];

const currentPlanKey = computed<MarketingPlanCard['key']>(() => {
  if (subscription.value?.plan?.key === 'starter') return 'entrepreneur';
  if (subscription.value?.plan?.key === 'pro') return 'professional';
  if (subscription.value?.plan?.key === 'implementation') return 'professional';

  return 'entrepreneur';
});
const marketingPlans = computed<MarketingPlanCard[]>(() => [
  {
    key: 'entrepreneur',
    title: 'Emprendedor',
    headline: '$99',
    suffix: '+ IVA / año',
    description: 'Para negocios que necesitan emitir documentos electrónicos y llevar control básico.',
    features: [
      'Facturación electrónica',
      'Catálogo de productos y servicios',
      'Gestión de clientes',
      'Anexo de ventas',
      'Actualizaciones del sistema',
      'Soporte por correo',
      'No incluye registro de compras'
    ],
    actionLabel: currentPlanKey.value === 'entrepreneur' ? 'Plan actual' : 'Comenzar'
  },
  {
    key: 'professional',
    title: 'Profesional',
    headline: '$199',
    suffix: '+ IVA / año',
    description: 'La mejor combinación entre funciones, soporte y acompañamiento.',
    features: [
      'Facturación electrónica completa',
      'Catálogo de productos y servicios',
      'Registro de compras',
      'Anexo de ventas y compras',
      'Módulo de taller si aplica',
      'Historial y reportes',
      'Soporte prioritario',
      'Nuevas funcionalidades incluidas',
      'Atención directa para incidencias',
      'Elegido por la mayoría de clientes'
    ],
    actionLabel: currentPlanKey.value === 'professional' ? 'Plan actual' : 'Elegir Profesional',
    featured: true,
    badgeLabel: '🔥 MAS POPULAR'
  },
  {
    key: 'enterprise',
    title: 'Empresarial',
    headline: '$299',
    suffix: '+ IVA / año',
    description: 'Para empresas que necesitan acompañamiento cercano y soluciones más personalizadas.',
    features: [
      'Todo lo incluido en Profesional',
      'Atención prioritaria avanzada',
      'Configuraciones especiales según operación',
      'Acceso anticipado a nuevas funciones',
      'Asesoría para optimizar procesos',
      'Prioridad en solicitudes de mejora'
    ],
    actionLabel: currentPlanKey.value === 'enterprise' ? 'Plan actual' : 'Contactar'
  }
]);

function openView(item: (typeof navItems)[number]): void {
  activeView.value = item.id;
}

function setSelectedCompany(company: SelectedCompany): void {
  selectedCompany.value = company;
  subscriptionRequestMessage.value = null;
}

function clearSelectedCompany(): void {
  selectedCompany.value = null;
  activeView.value = 'summary';
}

function setCompanyView(view: SettingsCompanyView): void {
  if (view === 'summary') {
    activeView.value = 'summary';
  }
}

watch([activeView, selectedCompany], () => {
  if (activeView.value === 'subscription' && selectedCompany.value) {
    void loadSubscription();
    void loadWompiWidget();
  }
}, { immediate: true });

async function loadSubscription(): Promise<void> {
  if (!selectedCompany.value) {
    subscriptionRow.value = null;
    return;
  }

  subscriptionLoading.value = true;
  subscriptionError.value = null;

  try {
    const client = new PlatformClient(props.platformBaseUrl, {
      credentials: props.requestCredentials
    });
    const response = await client.tenantSubscriptionByCoreEmpresaForTenant(selectedCompany.value.coreEmpresaId);
    subscriptionRow.value = response.row;
    subscriptionRequestMessage.value = null;
  } catch (caught) {
    subscriptionError.value = caught instanceof Error ? caught.message : 'No fue posible cargar la suscripcion.';
  } finally {
    subscriptionLoading.value = false;
  }
}

function requestPlan(plan: MarketingPlanCard): void {
  if (currentPlanKey.value === plan.key) return;
  if (wompiCheckoutUrls[plan.key]) return;

  subscriptionRequestMessage.value = `Para activar ${plan.title}, solicita el cambio al platform owner. Esta pantalla no modifica planes directamente.`;
}

function wompiCheckoutUrl(plan: MarketingPlanCard): string | null {
  return wompiCheckoutUrls[plan.key] ?? null;
}

function wompiWidgetUrl(plan: MarketingPlanCard): string | null {
  const checkoutUrl = wompiCheckoutUrl(plan);

  return checkoutUrl ? `${checkoutUrl}&esWidget=1` : null;
}

async function loadWompiWidget(): Promise<void> {
  if (typeof document === 'undefined') return;

  await nextTick();

  const existing = document.querySelector(`script[src="${wompiScriptUrl}"]`) as HTMLScriptElement | null;

  if (existing) {
    existing.dispatchEvent(new Event('load'));
    return;
  }

  const script = document.createElement('script');
  script.src = wompiScriptUrl;
  script.async = true;
  document.body.appendChild(script);
}

function statusLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    testing: 'Pruebas',
    trialing: 'Prueba',
    active: 'Activa',
    expired: 'Vencida',
    past_due: 'Por revisar',
    suspended: 'Suspendida',
    canceled: 'Cancelada',
    none: 'Sin plan'
  };

  return labels[value ?? 'none'] ?? 'Sin plan';
}

function statusTone(value: string | null | undefined): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (value === 'active') return 'success';
  if (value === 'trialing' || value === 'testing') return 'info';
  if (value === 'none' || value === 'past_due') return 'warning';
  if (value === 'expired' || value === 'suspended' || value === 'canceled') return 'danger';

  return 'neutral';
}

function environmentLabel(value: string | null | undefined): string {
  if (value === '01') return '01 · Producción';
  if (value === '00') return '00 · Pruebas';

  return 'No definido';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

</script>

<template>
  <div class="sf-app-background min-h-screen dark:text-text">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-80 flex-col border-r border-slate-200 bg-white lg:flex">
      <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-sky-600 text-white shadow-sm shadow-sky-900/20">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
        </span>
        <span class="text-sm font-black uppercase tracking-wide text-slate-950">Configuración</span>
      </div>

      <div class="border-b border-slate-200 px-6 py-5">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Empresa</p>
        <p class="mt-1 truncate text-lg font-bold text-slate-950">{{ companyTitle }}</p>
        <p v-if="selectedCompany" class="mt-1 truncate text-xs font-semibold text-slate-500">{{ selectedCompany.documentLabel }}</p>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-5" aria-label="Opciones de configuración">
        <div class="space-y-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition"
            :class="activeView === item.id ? 'bg-slate-100 font-bold text-slate-950 shadow-sm shadow-slate-950/5' : 'font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950'"
            @click="openView(item)"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="activeView === item.id ? 'bg-white text-sky-700' : 'text-slate-500'">
              <svg v-if="item.icon === 'summary'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M4 5h16M4 12h10M4 19h16" />
                <path d="M17 10h3v4h-3z" />
              </svg>
              <svg v-else-if="item.icon === 'requests'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M6 3h9l3 3v15H6z" />
                <path d="M14 3v4h4M9 13h6M9 17h4" />
                <path d="m9 9 1.5 1.5L14 7" />
              </svg>
              <svg v-else-if="item.icon === 'profile'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <svg v-else-if="item.icon === 'subscription'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                <path d="M2 11h20M6 16h4" />
              </svg>
              <svg v-else-if="item.icon === 'printer'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M7 8V3h10v5" />
                <path d="M6 17H5a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1" />
                <path d="M7 14h10v7H7z" />
              </svg>
              <svg v-else-if="item.icon === 'security'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" />
                <path d="M9.5 12.5 11 14l3.5-4" />
              </svg>
              <svg v-else class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M4 5h16v11H7l-3 3z" />
                <path d="M9 9h6M9 13h4" />
              </svg>
            </span>
            <span class="min-w-0">
              <span class="block truncate">{{ item.label }}</span>
              <span class="block truncate text-xs font-medium text-slate-500">{{ item.detail }}</span>
            </span>
          </button>
        </div>
      </nav>
    </aside>

    <main class="px-4 py-6 sm:px-6 lg:pl-[344px] lg:pr-8">
      <div class="mb-5 flex items-center overflow-x-auto whitespace-nowrap">
        <a :href="dashboardUrl || appBaseUrl || '/'" class="text-slate-600 transition hover:text-slate-950" aria-label="Inicio">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
          </svg>
        </a>
        <span class="mx-4 text-slate-400">/</span>
        <span class="text-sm font-semibold text-sky-700">Configuración</span>
        <span class="mx-4 text-slate-400">/</span>
        <span class="text-sm font-semibold text-slate-700">{{ activeItem.label }}</span>
      </div>

      <BillingSettingsPage
        v-if="activeView === 'summary'"
        :core-base-url="coreBaseUrl"
        :platform-base-url="platformBaseUrl"
        :auth-token="authToken"
        :request-credentials="requestCredentials"
        :detail-mode="true"
        @company-selected="setSelectedCompany"
        @company-cleared="clearSelectedCompany"
        @company-view-changed="setCompanyView"
      />

      <section v-else class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5">
        <div class="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="mt-1 text-2xl font-bold text-slate-950">{{ activeItem.label }}</h1>
          </div>
          <span v-if="activeView !== 'subscription'" class="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">Placeholder</span>
        </div>

        <div v-if="activeView === 'requests'" class="mt-6 grid gap-4 lg:grid-cols-3">
          <article class="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-bold text-slate-950">Nueva sucursal</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">Solicita creacion de sucursales adicionales. El limite operativo para usuarios es casa matriz y 2 sucursales adicionales.</p>
          </article>
          <article class="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-bold text-slate-950">Certificados fiscales</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">Solicita cambio o renovacion de certificado, credenciales MH o firmador.</p>
          </article>
          <article class="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm font-bold text-slate-950">Correlativos</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">Solicita revision de series o puntos de venta cuando necesites asistencia administrativa.</p>
          </article>
        </div>

        <div v-else-if="activeView === 'profile'" class="mt-6 grid gap-4 md:grid-cols-2">
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-950">Datos editables</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">Nombre, nombre comercial visible, telefono, direccion y correo de contacto iran aqui.</p>
          </div>
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-950">Datos protegidos</p>
            <p class="mt-2 text-sm leading-6 text-slate-600">NIT, NRC, fiscalidad, certificados, sucursales y correlativos se manejaran por solicitud.</p>
          </div>
        </div>

        <div v-else-if="activeView === 'subscription'" class="mt-6 space-y-4">
          <UiPanel v-if="!selectedCompany" variant="muted">
            <p class="text-sm font-bold text-slate-950 dark:text-text">Selecciona una empresa</p>
            <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-muted">Primero elige la empresa desde Resumen para consultar su estado de suscripcion.</p>
          </UiPanel>

          <UiPanel v-else-if="subscriptionError" variant="default">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-bold text-rose-700 dark:text-danger">No se pudo cargar la suscripcion</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-muted">{{ subscriptionError }}</p>
              </div>
              <UiRefreshButton :loading="subscriptionLoading" label="Reintentar" @click="loadSubscription" />
            </div>
          </UiPanel>

          <template v-else>
            <div class="grid gap-5 xl:grid-cols-3">
              <UiSubscriptionPlanCard
                v-for="plan in marketingPlans"
                :key="plan.key"
                :title="plan.title"
                :headline="plan.headline"
                :suffix="plan.suffix"
                :description="plan.description"
                :featured="plan.featured"
                :current="currentPlanKey === plan.key"
                :badge-label="plan.badgeLabel"
              >
                <template #badges>
                  <UiStatusBadge v-if="currentPlanKey === plan.key" :tone="statusTone(status)">{{ statusLabel(status) }}</UiStatusBadge>
                  <UiStatusBadge v-if="currentPlanKey === plan.key" :tone="fiscalEnvironment === '01' ? 'success' : 'warning'">
                    {{ environmentLabel(fiscalEnvironment) }}
                  </UiStatusBadge>
                </template>

                <template #features>
                  <li v-for="feature in plan.features" :key="feature" class="flex gap-3">
                    <span
                      class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-black"
                      :class="feature.startsWith('No incluye') ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'"
                    >
                      {{ feature.startsWith('No incluye') ? '!' : '✓' }}
                    </span>
                    <span>{{ feature }}</span>
                  </li>
                  <li v-if="currentPlanKey === plan.key">Vigente hasta {{ isFiscalTesting ? 'no aplica' : formatDate(subscriptionEndsAt) }}</li>
                </template>

                <template #actions>
                  <div v-if="wompiCheckoutUrl(plan)" class="space-y-3">
                    <div
                      class="wompi_button_widget flex justify-center"
                      :data-url-pago="wompiWidgetUrl(plan)"
                      data-render="widget"
                    />
                    <a
                      :href="wompiCheckoutUrl(plan) ?? '#'"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-6 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-line dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                    >
                      Abrir checkout
                    </a>
                  </div>
                  <UiButton
                    v-else
                    :variant="plan.featured ? 'primary' : 'secondary'"
                    size="md"
                    class="w-full"
                    :disabled="subscriptionLoading || currentPlanKey === plan.key"
                    @click="requestPlan(plan)"
                  >
                    {{ plan.actionLabel }}
                  </UiButton>
                </template>
              </UiSubscriptionPlanCard>
            </div>

            <UiPanel v-if="subscriptionRequestMessage" variant="muted">
              <p class="text-sm font-semibold text-slate-700 dark:text-muted">{{ subscriptionRequestMessage }}</p>
            </UiPanel>
          </template>
        </div>

        <div v-else-if="activeView === 'printer'" class="mt-6 rounded-md border border-slate-200 p-4">
          <p class="text-sm font-bold text-slate-950">Configuración de impresora</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">Aquí configuraremos preferencias locales de impresión, formato y dispositivo predeterminado.</p>
        </div>

        <div v-else-if="activeView === 'security'" class="mt-6 rounded-md border border-slate-200 p-4">
          <p class="text-sm font-bold text-slate-950">Cambio de contraseña</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">Aquí irá el flujo para actualizar contraseña y revisar accesos activos.</p>
        </div>

        <div v-else class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-950">Correo</p>
            <p class="mt-2 text-sm text-slate-600">soporte@stelfaro.com</p>
          </div>
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-950">WhatsApp</p>
            <p class="mt-2 text-sm text-slate-600">Pendiente</p>
          </div>
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-950">Horario</p>
            <p class="mt-2 text-sm text-slate-600">Pendiente</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
