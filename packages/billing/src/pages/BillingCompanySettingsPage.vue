<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { PlatformClient, type PlatformSubscriptionTenantRow } from '@stelfaro/api-client';
import { UiButton, UiPanel, UiRefreshButton, UiStatusBadge, UiSubscriptionPlanCard } from '@stelfaro/ui';
import BillingSectionLayout from '../components/BillingSectionLayout.vue';
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
const hasBillableSubscription = computed(() => {
  if (isFiscalTesting.value || !subscription.value) return false;
  if (!['trialing', 'active', 'past_due'].includes(subscription.value.status)) return false;

  return typeof remainingDays.value !== 'number' || remainingDays.value >= 0;
});
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

function openViewById(id: string): void {
  activeView.value = id as CompanyView;
}

function setSelectedCompany(company: SelectedCompany): void {
  selectedCompany.value = company;
  subscriptionRequestMessage.value = null;
}

function clearSelectedCompany(): void {
  selectedCompany.value = null;
  subscriptionRow.value = null;
  subscriptionError.value = null;
  subscriptionRequestMessage.value = null;
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
    if (!hasBillableSubscription.value) {
      void loadWompiWidget();
    }
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
  if (hasBillableSubscription.value) return;
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
  <BillingSectionLayout
    title="Configuración"
    icon="settings"
    :entity-title="companyTitle"
    :entity-detail="selectedCompany?.documentLabel ?? null"
    :nav-items="navItems"
    :active-id="activeView"
    :home-href="dashboardUrl || appBaseUrl || '/'"
    @select="openViewById"
  >

      <BillingSettingsPage
        v-if="activeView === 'summary'"
        :core-base-url="coreBaseUrl"
        :platform-base-url="platformBaseUrl"
        :auth-token="authToken"
        :request-credentials="requestCredentials"
        :billing-context-cache-scope="billingContextCacheScope || 'default'"
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
                  <div v-if="wompiCheckoutUrl(plan) && !hasBillableSubscription && !isFiscalTesting" class="space-y-3">
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
                  <p
                    v-else-if="hasBillableSubscription && currentPlanKey === plan.key"
                    class="rounded-md bg-success-soft px-4 py-3 text-sm font-semibold text-success"
                  >
                    Suscripción activa
                  </p>
                  <UiButton
                    v-else-if="!hasBillableSubscription && !isFiscalTesting"
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

            <UiPanel v-if="hasBillableSubscription" variant="muted">
              <p class="text-sm font-semibold text-slate-700 dark:text-muted">
                Tu suscripción está activa. No es necesario realizar otro pago por ahora.
              </p>
            </UiPanel>

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
  </BillingSectionLayout>
</template>
