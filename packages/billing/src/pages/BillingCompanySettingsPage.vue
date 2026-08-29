<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PlatformClient, type BillingSucursal, type PlatformSubscriptionTenantRow } from '@stelfaro/api-client';
import { UiButton, UiPanel, UiRefreshButton, UiStatusBadge, UiSubscriptionPlanCard } from '@stelfaro/ui';
import BillingSectionLayout from '../components/BillingSectionLayout.vue';
import BillingSettingsPage from './BillingSettingsPage.vue';
import BillingAuditPage from './BillingAuditPage.vue';
import PrinterSettingsPanel from '../printing/PrinterSettingsPanel.vue';
import ThermalTicketSettingsPanel from '../printing/ThermalTicketSettingsPanel.vue';
import TenantRequestsPanel from '../settings/TenantRequestsPanel.vue';
import UserProfilePanel from '../settings/UserProfilePanel.vue';
import UserSecurityPanel from '../settings/UserSecurityPanel.vue';
import CashSettingsPanel from '../settings/CashSettingsPanel.vue';
import CashierAssignmentsPanel from '../settings/CashierAssignmentsPanel.vue';
import DownloadCenterPanel from '../settings/DownloadCenterPanel.vue';
import MobilePrinterSettingsPanel from '../printing/MobilePrinterSettingsPanel.vue';
import { detectMobilePrintingDevice } from '../printing/deviceClass';
import { allowedSections } from '../moduleAccess';

type CompanyView = 'summary' | 'requests' | 'users' | 'profile' | 'subscription' | 'downloads' | 'cash' | 'printer' | 'ticket' | 'security' | 'audit' | 'support';
type CompanyNavId = CompanyView;
type SettingsCompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos';
type NavIcon = 'summary' | 'requests' | 'profile' | 'subscription' | 'downloads' | 'cash' | 'printer' | 'ticket' | 'security' | 'support';
type SelectedCompany = {
  id: number;
  coreEmpresaId: number;
  name: string;
  tradeName: string;
  documentLabel: string;
  lifecycleStatus: string;
  ambiente: '00' | '01';
  logoUrl: string | null;
  nit: string;
  nrc: string | null;
  activity: string;
  sucursales: BillingSucursal[];
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
  platformSession?: (Record<string, unknown> & { tenant?: { id?: number | string | null; name?: string | null; role?: string | null } }) | null;
  initialView?: CompanyView;
  workshopEnabled?: boolean;
  fiscalRole?: string;
}>(), {
  coreBaseUrl: '/api/v1',
  platformBaseUrl: '/api/v1',
  authToken: null,
  appBaseUrl: '',
  dashboardUrl: '',
  billingContextCacheScope: '',
  requestCredentials: undefined,
  platformSession: null,
  initialView: 'summary',
  workshopEnabled: false,
  fiscalRole: ''
});

// `null` = sin restricción de sección; un array = lista blanca (p. ej. cajero).
const allowedSettingsSections = computed(() => allowedSections(props.fiscalRole, 'settings'));
function isSectionAllowed(view: CompanyView): boolean {
  const allowed = allowedSettingsSections.value;
  return !allowed || allowed.includes(view);
}

const selectedCompany = ref<SelectedCompany | null>(null);
const mobilePrintingDevice = ref(false);
const validViews: CompanyView[] = ['summary', 'requests', 'users', 'profile', 'subscription', 'downloads', 'cash', 'printer', 'ticket', 'security', 'audit', 'support'];
const requestedView = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;
const initialCandidate: CompanyView = requestedView && validViews.includes(requestedView as CompanyView)
  ? requestedView as CompanyView
  : props.initialView;
const activeView = ref<CompanyView>(
  isSectionAllowed(initialCandidate)
    ? initialCandidate
    : ((allowedSettingsSections.value?.[0] as CompanyView) ?? 'profile'),
);
const subscriptionRow = ref<PlatformSubscriptionTenantRow | null>(null);
const subscriptionLoading = ref(false);
const subscriptionError = ref<string | null>(null);
const subscriptionRequestMessage = ref<string | null>(null);
const wompiScriptUrl = 'https://pagos.wompi.sv/js/wompi.pagos.js';
const wompiCheckoutUrls: Partial<Record<MarketingPlanCard['key'], string>> = {
  entrepreneur: 'https://pagos.wompi.sv/IntentoPago/Redirect?id=bdfd9af6-ace2-48b1-92e4-07bd182619db',
  professional: 'https://pagos.wompi.sv/IntentoPago/Redirect?id=33bcab4e-0036-4477-a0a0-326a4a415c31'
};

function updatePrintingDeviceClass(): void {
  mobilePrintingDevice.value = detectMobilePrintingDevice();
}

onMounted(() => {
  updatePrintingDeviceClass();
  window.addEventListener('resize', updatePrintingDeviceClass, { passive: true });
  window.addEventListener('orientationchange', updatePrintingDeviceClass, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePrintingDeviceClass);
  window.removeEventListener('orientationchange', updatePrintingDeviceClass);
});

const companyTitle = computed(() => selectedCompany.value?.tradeName || selectedCompany.value?.name || String(props.platformSession?.tenant?.name || 'Mi empresa'));
const canManageCashiers = computed(() => ['owner', 'company_admin'].includes(String(props.platformSession?.tenant?.role || '')));
const activeItem = computed(() => navItems.value.find((item) => item.id === activeView.value) ?? navItems.value[0]);
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
type CompanyNavEntry = {
  id: CompanyNavId;
  label: string;
  detail: string;
  icon: NavIcon;
  href?: string;
  group?: string;
};
const navItems = computed<CompanyNavEntry[]>(() => ([
  { id: 'summary', label: 'Resumen', detail: 'Información de empresa', icon: 'summary' },
  { id: 'requests', label: 'Solicitudes', detail: 'Cambios sensibles', icon: 'requests' },
  ...(canManageCashiers.value ? [{ id: 'users' as const, label: 'Cajeros', detail: 'Asignación de caja', icon: 'profile' as const }] : []),
  { id: 'profile', label: 'Perfil de usuario', detail: 'Cuenta y contraseña', icon: 'profile' },
  { id: 'subscription', label: 'Suscripción', detail: 'Plan y vigencia', icon: 'subscription' },
  { id: 'downloads', label: 'Centro de descargas', detail: 'Agentes para tus dispositivos', icon: 'downloads' },
  { id: 'cash', label: 'Caja', detail: 'Horarios y sucursales', icon: 'cash', group: 'Operación' },
  { id: 'printer', label: 'Conexión e impresora', detail: 'Agente, dispositivo y papel', icon: 'printer', group: 'Impresión' },
  { id: 'ticket', label: 'Formato del ticket', detail: 'Logo, datos y vista previa', icon: 'ticket', group: 'Impresión' },
  { id: 'security', label: 'Seguridad', detail: 'Contraseña y acceso', icon: 'security' },
  { id: 'audit', label: 'Auditoría', detail: 'Actividad de la empresa', icon: 'security' },
  { id: 'support', label: 'Soporte', detail: 'Canales de ayuda', icon: 'support' }
] as CompanyNavEntry[]).filter((item) => isSectionAllowed(item.id)));

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
  if (!isSectionAllowed(id as CompanyView)) return;
  activeView.value = id as CompanyView;
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (activeView.value === 'summary') url.searchParams.delete('view');
    else url.searchParams.set('view', activeView.value);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
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
    sidebar-storage-key="stelfaro:settings-sidebar-compact"
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

      <section v-else class="rounded-lg border border-line bg-surface p-6 shadow-sm shadow-surface">
        <div class="flex flex-col gap-2 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="mt-1 text-2xl font-bold text-text">{{ activeItem.label }}</h1>
          </div>
        </div>

        <TenantRequestsPanel v-if="activeView === 'requests'" class="mt-6" :platform-base-url="platformBaseUrl" :platform-session="platformSession" />

        <CashierAssignmentsPanel
          v-else-if="activeView === 'users'"
          :tenant-id="Number(platformSession?.tenant?.id || 0)"
          :platform-base-url="platformBaseUrl"
          :request-credentials="requestCredentials"
        />

        <UserProfilePanel v-else-if="activeView === 'profile'" class="mt-6" :platform-base-url="platformBaseUrl" :platform-session="platformSession" />

        <DownloadCenterPanel v-else-if="activeView === 'downloads'" class="mt-6" />

        <div v-else-if="activeView === 'subscription'" class="mt-6 space-y-4">
          <UiPanel v-if="!selectedCompany" variant="muted">
            <p class="text-sm font-bold text-text">Selecciona una empresa</p>
            <p class="mt-2 text-sm leading-6 text-muted">Primero elige la empresa desde Resumen para consultar su estado de suscripcion.</p>
          </UiPanel>

          <UiPanel v-else-if="subscriptionError" variant="default">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-bold text-danger">No se pudo cargar la suscripcion</p>
                <p class="mt-1 text-sm text-muted">{{ subscriptionError }}</p>
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
                      class="inline-flex w-full items-center justify-center rounded-lg border border-line px-6 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-text"
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
              <p class="text-sm font-semibold text-muted">
                Tu suscripción está activa. No es necesario realizar otro pago por ahora.
              </p>
            </UiPanel>

            <UiPanel v-if="subscriptionRequestMessage" variant="muted">
              <p class="text-sm font-semibold text-muted">{{ subscriptionRequestMessage }}</p>
            </UiPanel>
          </template>
        </div>

        <MobilePrinterSettingsPanel
          v-else-if="activeView === 'printer' && mobilePrintingDevice"
          class="mt-6"
          :tenant-id="Number(platformSession?.tenant?.id || 0)"
          :platform-base-url="platformBaseUrl"
        />

        <div v-else-if="activeView === 'printer'" class="mt-6 rounded-lg border border-line bg-surface p-5 sm:p-6"><PrinterSettingsPanel /></div>

        <CashSettingsPanel v-else-if="activeView === 'cash'" class="mt-6" :tenant-id="Number(platformSession?.tenant?.id || 0)" :platform-base-url="platformBaseUrl" :auth-token="authToken" :branches="selectedCompany?.sucursales || []" />

        <div v-else-if="activeView === 'ticket'" class="mt-6 rounded-lg border border-line bg-surface p-5 sm:p-6"><ThermalTicketSettingsPanel :company="selectedCompany" :workshop-enabled="workshopEnabled" :tenant-id="Number(platformSession?.tenant?.id || 0)" :platform-base-url="platformBaseUrl" /></div>

        <BillingAuditPage v-else-if="activeView === 'audit'" class="mt-6" :auth-token="authToken" :core-base-url="coreBaseUrl" :platform-base-url="platformBaseUrl" :platform-session="platformSession" :billing-context-cache-scope="billingContextCacheScope" />

        <UserSecurityPanel v-else-if="activeView === 'security'" class="mt-6" :platform-base-url="platformBaseUrl" />

        <div v-else class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-md border border-line p-4">
            <p class="text-sm font-bold text-text">Correo</p>
            <a href="mailto:soporte@stelfaro.com" class="mt-2 block text-sm text-primary hover:underline">soporte@stelfaro.com</a>
          </div>
          <div class="rounded-md border border-line p-4">
            <p class="text-sm font-bold text-text">WhatsApp</p>
            <a href="https://wa.me/50375640652" target="_blank" rel="noopener" class="mt-2 block text-sm text-primary hover:underline">+503 7564-0652</a>
          </div>
          <div class="rounded-md border border-line p-4">
            <p class="text-sm font-bold text-text">Horario</p>
            <p class="mt-2 text-sm text-muted">Lunes a domingo, 6:00 a. m. – 8:00 p. m.</p>
          </div>
        </div>
      </section>
  </BillingSectionLayout>
</template>
