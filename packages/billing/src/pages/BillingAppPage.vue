<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient } from '@stelfaro/api-client';
import { CircleQuestionMark, ClipboardList, Download, FileText, Home, Menu, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BillingAppNav from '../components/BillingAppNav.vue';
import BillingHelpModal from '../components/BillingHelpModal.vue';
import BillingTooltip from '../components/BillingTooltip.vue';
import InternalNotificationsBell from '../components/InternalNotificationsBell.vue';
import BillingCompanySettingsPage from './BillingCompanySettingsPage.vue';
import BillingAnnexesPage from './BillingAnnexesPage.vue';
import BillingCustomersPage from './BillingCustomersPage.vue';
import CatalogPage from './CatalogPage.vue';
import BillingDashboardPage from './BillingDashboardPage.vue';
import CashPage from './CashPage.vue';
import FollowUpNotesPage from './FollowUpNotesPage.vue';
import BillingOperationalPlaceholderPage from './BillingOperationalPlaceholderPage.vue';
import BillingWorkspace from './BillingWorkspace.vue';
import WorkshopAppPage from '../workshop/WorkshopAppPage.vue';
import DteArtifactsPage from './DteArtifactsPage.vue';
import InventoryPage from './InventoryPage.vue';
import MhEventResponsesPage from './MhEventResponsesPage.vue';
import MhEventsPage from './MhEventsPage.vue';
import MhResponsesPage from './MhResponsesPage.vue';
import { getBillingContext, peekBillingContext } from '../support/billingDataCache';

const props = defineProps({
  app: {
    type: Object,
    required: true
  },
  user: {
    type: Object,
    default: null
  },
  authToken: {
    type: String,
    default: null
  },
  coreBaseUrl: {
    type: String,
    default: '/api/v1'
  },
  appBaseUrl: {
    type: String,
    default: ''
  },
  dashboardUrl: {
    type: String,
    default: '/'
  },
  platformAdminUrl: {
    type: String,
    default: ''
  },
  canAccessPlatformAdmin: {
    type: Boolean,
    default: false
  },
  module: {
    type: String,
    default: 'billing'
  },
  documentSlug: {
    type: String,
    default: 'fe'
  },
  eventSlug: {
    type: String,
    default: 'invalidacion'
  },
  artifactSlug: {
    type: String,
    default: 'dte'
  },
  extraNavItems: {
    type: Array,
    default: () => []
  },
  operationalPage: {
    type: Object,
    default: null
  },
  platformSession: {
    type: Object,
    default: null
  },
  platformBaseUrl: {
    type: String,
    default: '/api/v1'
  }
});

const helpModalOpen = ref(false);
const helpTooltip = ref(null);
const userMenuOpen = ref(false);
const mobileMenuOpen = ref(false);
const userMenuRef = ref(null);
const darkMode = ref(false);
const contextLoading = ref(false);
const documentTypes = ref([]);
const billingCompanies = ref([]);
const pwaCanInstall = ref(false);
const pwaDisplayMode = ref('browser');
const emit = defineEmits(['logout', 'navigate']);
const themeStorageKey = 'stelfaro:theme';

const documentTypeBySlug = {
  fe: '01',
  ccf: '03',
  nc: '05',
  nd: '06',
  se: '14'
};
const billingSlugByType = {
  '01': 'fe',
  '03': 'ccf',
  '14': 'se',
  '05': 'nc',
  '06': 'nd'
};
const eventTypeBySlug = {
  invalidacion: 'invalidacion',
  contingencia: 'contingencia',
  retorno: 'retorno',
  'operaciones-especiales': 'operaciones_especiales'
};
const artifactTypeBySlug = {
  dte: 'dte',
  eventos: 'events'
};
const dteHelpByType = {
  '01': {
    title: 'Factura Electronica',
    summary: 'Para ventas al consumidor final.',
    use: 'Usala cuando tu cliente no necesita credito fiscal. Si el monto es alto, identifica al cliente antes de emitir.',
    details: [
      'Es la opcion habitual para ventas a personas que compran para uso propio.',
      'Puedes usar cliente generico cuando la venta lo permite.',
      'No entrega credito fiscal al comprador.'
    ]
  },
  '03': {
    title: 'Credito Fiscal',
    summary: 'Para clientes que declaran IVA.',
    use: 'Usalo cuando vendes a una empresa o contribuyente que necesita usar la compra como credito fiscal.',
    details: [
      'Identifica bien al cliente antes de emitir.',
      'El IVA queda separado para que el comprador pueda declararlo.',
      'Si despues hay ajustes, normalmente se relacionan con este documento.'
    ]
  },
  '05': {
    title: 'Nota de Credito',
    summary: 'Para bajar o anular valores de un CCF.',
    use: 'Usala cuando hubo devolucion, descuento posterior o necesitas corregir a favor del cliente.',
    details: [
      'Elige el documento original que vas a corregir.',
      'Sirve para disminuir montos ya facturados.',
      'Si el documento completo no debe existir, revisa si corresponde invalidarlo.'
    ]
  },
  '06': {
    title: 'Nota de Debito',
    summary: 'Para aumentar valores de un CCF.',
    use: 'Usala cuando faltaron cargos, se agregaron productos o debes cobrar una diferencia.',
    details: [
      'Elige el documento original que vas a complementar.',
      'Sirve para aumentar montos ya facturados.',
      'Revisa concepto, cantidades e impuestos antes de emitir.'
    ]
  },
  '14': {
    title: 'Sujeto Excluido',
    summary: 'Para compras a personas fuera del IVA.',
    use: 'Usala cuando compras bienes o servicios a alguien que no emite DTE ni factura con IVA.',
    details: [
      'Registra compras hechas a proveedores que no facturan con IVA.',
      'No se usa para venderle a un cliente final.',
      'Revisa retenciones y datos del proveedor antes de emitir.'
    ]
  }
};
const eventHelpByType = {
  invalidacion: {
    title: 'Evento de invalidacion',
    summary: 'Para dejar sin efecto un DTE aceptado.',
    use: 'Usalo cuando un documento aceptado ya no debe seguir vigente, por ejemplo por un error importante o porque la operacion se cancelo.',
    details: [
      'El documento debe tener sello de recepcion.',
      'La invalidacion deja sin efecto el documento completo.',
      'Si solo necesitas corregir una parte, revisa si corresponde una nota, un retorno o un nuevo documento.'
    ]
  },
  contingencia: {
    title: 'Evento de contingencia',
    summary: 'Para informar emision diferida.',
    use: 'Usalo cuando emitiste documentos en contingencia y necesitas informarlos despues a Hacienda.',
    details: [
      'Selecciona los documentos que emitiste durante ese periodo.',
      'Completa fecha, hora y motivo cuando aplique.',
      'Despues de enviar, revisa que Hacienda haya aceptado el reporte.'
    ]
  },
  retorno: {
    title: 'Evento de retorno',
    summary: 'Para devoluciones o reembolsos sobre FE, FEXE o FSEE.',
    use: 'Usalo cuando te devuelven bienes, haces un reembolso o recuperas envases y necesitas reflejarlo sobre un documento ya aceptado.',
    details: [
      'El documento original debe tener sello de recepcion y estar dentro del plazo permitido.',
      'Puedes relacionar hasta 50 documentos del mismo tipo.',
      'Si agregas varios documentos, deben corresponder a las mismas partes y al mismo ambiente.',
      'El monto del retorno no debe superar el valor del documento original.'
    ]
  },
  operaciones_especiales: {
    title: 'Evento de operaciones especiales',
    summary: 'Para reportes especiales definidos por normativa.',
    use: 'Usalo cuando necesitas informar operaciones especiales activas o anuladas.',
    details: [
      'Selecciona empresa, ambiente, tipo de documento y modalidad.',
      'Agrega el detalle de las operaciones o rangos que vas a reportar.',
      'Revisa totales y referencias antes de enviar.'
    ]
  }
};
const fallbackBillingTypes = [
  { code: '01', label: 'Consumidor final', version: 2, implemented: true },
  { code: '03', label: 'Credito fiscal', version: 2, implemented: true },
  { code: '14', label: 'Sujeto excluido', version: 2, implemented: true },
  { code: '05', label: 'Nota de credito', version: 4, implemented: true },
  { code: '06', label: 'Nota de debito', version: 4, implemented: true }
];
const moduleComponents = {
  dashboard: BillingDashboardPage,
  cash: CashPage,
  'follow-ups': FollowUpNotesPage,
  'operational-placeholder': BillingOperationalPlaceholderPage,
  'workshop-reception': WorkshopAppPage,
  'workshop-orders': WorkshopAppPage,
  billing: BillingWorkspace,
  customers: BillingCustomersPage,
  catalog: CatalogPage,
  inventory: InventoryPage,
  artifacts: DteArtifactsPage,
  annexes: BillingAnnexesPage,
  'mh-events': MhEventsPage,
  'mh-responses': MhResponsesPage,
  'mh-event-responses': MhEventResponsesPage,
  audit: BillingCompanySettingsPage,
  settings: BillingCompanySettingsPage
};
const eventOptions = [
  { label: 'Invalidacion', slug: 'invalidacion' },
  { label: 'Contingencia', slug: 'contingencia' },
  { label: 'Retorno', slug: 'retorno' },
  { label: 'Operaciones especiales', slug: 'operaciones-especiales' }
];

const selectedComponent = computed(() => moduleComponents[props.module] || BillingWorkspace);
const requiresFiscalSession = computed(() => !['audit', 'catalog', 'inventory', 'cash', 'operational-placeholder'].includes(props.module));
const selectedDocumentType = computed(() => documentTypeBySlug[props.documentSlug] || '01');
const selectedEventType = computed(() => eventTypeBySlug[props.eventSlug] || 'invalidacion');
const selectedArtifactType = computed(() => artifactTypeBySlug[props.artifactSlug] || 'dte');
const billingOptions = computed(() => {
  const source = documentTypes.value.length ? documentTypes.value : fallbackBillingTypes;

  return source
    .filter((type) => ['01', '03', '05', '06', '14'].includes(type.code))
    .map((type) => ({
      label: type.label,
      slug: billingSlugByType[type.code] ?? 'fe',
      enabled: Boolean(type.implemented)
    }));
});
const selectedComponentProps = computed(() => {
  const baseProps = {
    authToken: props.authToken,
    coreBaseUrl: props.coreBaseUrl,
    appBaseUrl: props.appBaseUrl,
    dashboardUrl: props.dashboardUrl || props.appBaseUrl || '/',
    billingContextCacheScope: billingContextCacheScope.value
  };

  if (props.module === 'billing') {
    return {
      ...baseProps,
      initialDocumentType: selectedDocumentType.value,
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl
    };
  }

  if (props.module === 'dashboard') {
    return {
      ...baseProps,
      platformBaseUrl: props.platformBaseUrl,
      tenantId: Number(props.platformSession?.tenant?.id || 0),
      workshopEnabled: props.app.id === 'taller'
    };
  }

  if (props.module === 'cash') {
    return { platformBaseUrl: props.platformBaseUrl, authToken: props.authToken, tenantId: Number(props.platformSession?.tenant?.id || 0), workshopEnabled: props.app.id === 'taller', company: activeCompany.value };
  }

  if (props.module === 'follow-ups') {
    return {
      ...baseProps,
      platformBaseUrl: props.platformBaseUrl,
      tenantId: Number(props.platformSession?.tenant?.id || 0),
      company: activeCompany.value
    };
  }

  if (props.module === 'mh-events') {
    return {
      ...baseProps,
      initialEventType: selectedEventType.value,
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl
    };
  }

  if (props.module === 'operational-placeholder') {
    return props.operationalPage ?? {};
  }

  if (props.module.startsWith('workshop-')) {
    return {
      ...baseProps,
      platformBaseUrl: props.platformBaseUrl,
      tenantId: Number(props.platformSession?.tenant?.id || 0),
      view: props.module.replace('workshop-', ''),
      company: activeCompany.value
    };
  }

  if (props.module === 'catalog') {
    return {
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl
    };
  }

  if (props.module === 'inventory') {
    return {
      ...baseProps,
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl
    };
  }

  if (props.module === 'audit') {
    return {
      ...baseProps,
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl,
      initialView: 'audit'
    };
  }

  if (props.module === 'settings') {
    return {
      ...baseProps,
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl,
      workshopEnabled: props.app.id === 'taller'
    };
  }

  if (props.module === 'annexes') {
    return {
      ...baseProps,
      platformSession: props.platformSession,
      platformBaseUrl: props.platformBaseUrl
    };
  }

  if (props.module === 'artifacts') {
    return {
      ...baseProps,
      initialArtifactType: selectedArtifactType.value
    };
  }

  return baseProps;
});
const dashboardHref = computed(() => props.dashboardUrl || props.appBaseUrl || '/');
const mobileInvoiceHref = computed(() => `${props.appBaseUrl.replace(/\/$/, '')}/facturacion/fe`);
const pageTitle = computed(() => {
  if (props.module === 'dashboard') return 'Dashboard';
  if (props.module === 'operational-placeholder') return props.operationalPage?.title ?? props.app.name;
  if (props.module === 'workshop-reception') return 'Recepción de equipos';
  if (props.module === 'workshop-orders') return 'Órdenes';

  if (props.module === 'billing') {
    return billingOptions.value.find((item) => item.slug === props.documentSlug)?.label ?? 'Facturacion';
  }

  if (props.module === 'catalog') return 'Catálogo';
  if (props.module === 'customers') return 'Clientes';
  if (props.module === 'inventory') return 'Inventario';
  if (props.module === 'cash') return 'Caja';
  if (props.module === 'follow-ups') return 'Pendientes';

  if (props.module === 'mh-events') {
    return eventOptions.find((item) => item.slug === props.eventSlug)?.label ?? 'Eventos MH';
  }

  if (props.module === 'artifacts') return selectedArtifactType.value === 'events' ? 'Comprobantes de eventos' : 'Comprobantes DTE';
  if (props.module === 'annexes') return 'Anexos';
  if (props.module === 'mh-responses') return 'Respuestas MH';
  if (props.module === 'mh-event-responses') return 'Respuestas MH - Eventos';
  if (props.module === 'audit') return 'Auditoría';
  if (props.module === 'settings') return 'Configuracion';

  return props.app.name;
});
const currentHelp = computed(() => {
  if (props.module === 'billing') return dteHelpByType[selectedDocumentType.value] ?? null;
  if (props.module === 'mh-events') return eventHelpByType[selectedEventType.value] ?? null;

  return null;
});
const activeCompany = computed(() => billingCompanies.value.find((empresa) => empresa.lifecycle_status === 'active') ?? billingCompanies.value[0] ?? null);
const billingContextCacheScope = computed(() => props.user?.email ?? props.app?.id ?? 'default');
const companyLogoUrl = computed(() => activeCompany.value?.logo_url ?? null);
const displayName = computed(() => props.user?.name ?? props.app?.name ?? 'Stelfaro');
const firstName = computed(() => displayName.value.split(' ').filter(Boolean)[0] ?? 'Stelfaro');
const themeLabel = computed(() => (darkMode.value ? 'Modo claro' : 'Modo oscuro'));
const initials = computed(() => {
  return displayName.value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SF';
});

watch(() => props.authToken, async (token) => {
  if (!token) {
    documentTypes.value = [];
    billingCompanies.value = [];
    return;
  }

  const cached = peekBillingContext(props.coreBaseUrl, billingContextCacheScope.value);
  if (cached) {
    applyBillingContext(cached);
  } else {
    contextLoading.value = true;
  }

  try {
    const context = await getBillingContext(
      new CoreDteClient(props.coreBaseUrl, { authToken: token }),
      props.coreBaseUrl,
      billingContextCacheScope.value
    );
    applyBillingContext(context);
  } catch {
    documentTypes.value = [];
    billingCompanies.value = [];
  } finally {
    contextLoading.value = false;
  }
}, { immediate: true });

function applyBillingContext(context) {
  billingCompanies.value = context.empresas;
  const enabled = new Set(context.empresas.flatMap((empresa) => empresa.enabled_document_types ?? []));
  documentTypes.value = context.documentTypes.map((type) => ({
    ...type,
    implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code))
  }));
}

watch(() => props.user?.email, () => {
  userMenuOpen.value = false;
});

onMounted(() => {
  initializeTheme();
  syncPwaState();
  window.addEventListener('keydown', closeHelpOnEscape);
  window.addEventListener('stelfaro:pwa-state', syncPwaState);
  document.addEventListener('click', closeUserMenuOnOutsideClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeHelpOnEscape);
  window.removeEventListener('stelfaro:pwa-state', syncPwaState);
  document.removeEventListener('click', closeUserMenuOnOutsideClick);
});

function syncPwaState(event = null) {
  const state = event?.detail || window.stelfaroPwa?.state?.() || {};
  pwaCanInstall.value = Boolean(state.canInstall);
  pwaDisplayMode.value = state.displayMode || 'browser';
}

async function installPwa() {
  const result = await window.stelfaroPwa?.install?.();
  if (result?.outcome === 'accepted') userMenuOpen.value = false;
  syncPwaState();
}

function closeHelpOnEscape(event) {
  if (event.key === 'Escape') {
    helpModalOpen.value = false;
    userMenuOpen.value = false;
    mobileMenuOpen.value = false;
  }
}

function openHelpModal() {
  helpTooltip.value = null;
  helpModalOpen.value = true;
}

function showHelpTooltip(event) {
  if (!currentHelp.value) return;

  const target = event.currentTarget;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  helpTooltip.value = {
    label: 'Ayuda',
    detail: currentHelp.value.title,
    top: Math.round(rect.bottom + 10),
    left: Math.round(rect.left + (rect.width / 2))
  };
}

function hideHelpTooltip() {
  helpTooltip.value = null;
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}

function closeUserMenuOnOutsideClick(event) {
  if (!userMenuOpen.value || !userMenuRef.value) return;

  if (!userMenuRef.value.contains(event.target)) {
    userMenuOpen.value = false;
  }
}

function logout() {
  userMenuOpen.value = false;
  emit('logout');
}

function initializeTheme() {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

  darkMode.value = storedTheme ? storedTheme === 'dark' : prefersDark;
  applyTheme();
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', darkMode.value);
  document.documentElement.dataset.theme = darkMode.value ? 'dark' : 'light';
}

function toggleTheme() {
  darkMode.value = !darkMode.value;
  window.localStorage.setItem(themeStorageKey, darkMode.value ? 'dark' : 'light');
  applyTheme();
}

function navigate(event, href) {
  mobileMenuOpen.value = false;
  emit('navigate', { event, href });
}

function navigateFromMenu(event, href) {
  userMenuOpen.value = false;
  navigate(event, href);
}
</script>

<template>
  <div v-if="['settings', 'audit'].includes(module)" class="sf-app-background min-h-screen text-slate-950 dark:text-text">
    <component
      :is="selectedComponent"
      v-bind="selectedComponentProps"
    />
  </div>

  <div v-else-if="module === 'inventory'" class="sf-app-background min-h-screen text-slate-950 dark:text-text">
    <component
      :is="selectedComponent"
      v-bind="selectedComponentProps"
    />
  </div>

  <div v-else class="relative min-h-screen overflow-x-hidden bg-app pt-[calc(4rem+env(safe-area-inset-top))] text-slate-950 dark:text-text md:pt-16">
    <div class="sf-app-background pointer-events-none fixed inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-0 md:top-16"></div>

    <nav class="sf-app-navbar fixed inset-x-0 top-0 z-50 shadow-sm backdrop-blur">
      <div class="mx-auto max-w-7xl pb-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] md:px-6 md:pt-0 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center">
            <button
              class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-400 md:hidden"
              type="button"
              :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
              aria-controls="billing-mobile-navigation"
              :aria-label="mobileMenuOpen ? 'Cerrar navegación' : 'Abrir navegación'"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <X v-if="mobileMenuOpen" class="h-6 w-6" aria-hidden="true" />
              <Menu v-else class="h-6 w-6" aria-hidden="true" />
            </button>
            <div class="hidden items-baseline gap-1 md:flex">
              <a
                :href="dashboardHref"
                class="rounded-md px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                :class="module === 'dashboard' ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
                @click="navigate($event, dashboardHref)"
              >
                Dashboard
              </a>

              <BillingAppNav
                :auth-token="authToken"
                :core-base-url="coreBaseUrl"
                :document-slug="documentSlug"
                :event-slug="eventSlug"
                :artifact-slug="artifactSlug"
                :extra-nav-items="extraNavItems"
                :module="module"
                :app-base-url="appBaseUrl"
                :billing-context-cache-scope="billingContextCacheScope"
                @navigate="navigate($event.event, $event.href)"
              />
            </div>
          </div>

          <div class="flex items-center gap-4">
            <InternalNotificationsBell
              :platform-base-url="platformBaseUrl"
              :tenant-id="Number(platformSession?.tenant?.id || 0)"
              :scope="canAccessPlatformAdmin ? 'admin' : 'tenant'"
            />
            <div ref="userMenuRef" class="relative">
              <button
                class="sf-app-menu inline-flex h-12 items-center gap-3 rounded-full px-2 pr-3 text-left text-white transition hover:brightness-125 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-400"
                type="button"
                :aria-expanded="userMenuOpen ? 'true' : 'false'"
                aria-haspopup="menu"
                aria-label="Abrir menu de usuario"
                @click="toggleUserMenu"
              >
                <span class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 text-xs font-bold text-indigo-950 ring-2 ring-sky-400">
                  <img
                    v-if="companyLogoUrl"
                    :src="companyLogoUrl"
                    class="h-full w-full object-contain p-1"
                    alt=""
                  >
                  <span v-else>{{ initials }}</span>
                </span>
                <span class="hidden max-w-32 truncate text-sm font-semibold md:block">{{ firstName }}</span>
                <svg class="h-4 w-4 text-slate-300 transition" :class="userMenuOpen ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
                </svg>
              </button>

              <div
                v-if="userMenuOpen"
                class="absolute right-0 z-30 mt-3 w-80 origin-top-right rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-950/15 dark:border-line dark:bg-surface dark:text-text dark:shadow-black/30"
                role="menu"
              >
                <div class="px-1 pb-4">
                  <p class="truncate text-sm font-semibold text-slate-950 dark:text-text">{{ user?.name ?? app.name }}</p>
                  <p class="mt-1 truncate text-sm text-slate-500 dark:text-muted">{{ user?.email ?? 'Sesion activa' }}</p>
                </div>
                <div class="space-y-1 py-2 text-sm font-semibold">
                  <button
                    v-if="pwaCanInstall && pwaDisplayMode !== 'standalone'"
                    class="flex w-full items-center gap-4 rounded-lg bg-sky-50 px-3 py-3 text-left text-sky-800 hover:bg-sky-100 dark:bg-primary-soft dark:text-primary dark:hover:bg-surface-muted"
                    type="button"
                    role="menuitem"
                    @click="installPwa"
                  >
                    <Download class="h-5 w-5" aria-hidden="true" />
                    Instalar aplicación
                  </button>
                  <a
                    :href="dashboardHref"
                    class="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                    role="menuitem"
                    @click="navigateFromMenu($event, dashboardHref)"
                  >
                    <svg class="h-5 w-5 text-slate-500 dark:text-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="M4 11.5 12 4l8 7.5" />
                      <path d="M6.5 10.5V20h11v-9.5" />
                    </svg>
                    Dashboard
                  </a>
                  <a
                    v-if="canAccessPlatformAdmin && platformAdminUrl"
                    :href="platformAdminUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                    role="menuitem"
                    @click="userMenuOpen = false"
                  >
                    <svg class="h-5 w-5 text-slate-500 dark:text-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="M4 5h16" />
                      <path d="M4 12h16" />
                      <path d="M4 19h16" />
                    </svg>
                    Panel administrativo
                  </a>
                  <a
                    :href="`${appBaseUrl || ''}/configuracion`"
                    class="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                    role="menuitem"
                    @click="navigateFromMenu($event, `${appBaseUrl || ''}/configuracion`)"
                  >
                    <svg class="h-5 w-5 text-slate-500 dark:text-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
                    </svg>
                    Configuracion
                  </a>
                  <button
                    class="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                    type="button"
                    role="menuitem"
                    @click="toggleTheme"
                  >
                    <span class="flex items-center gap-4">
                      <svg v-if="darkMode" class="h-5 w-5 text-slate-500 dark:text-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path d="M12 4V2M12 22v-2M4.93 4.93 3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41" />
                        <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
                      </svg>
                      <svg v-else class="h-5 w-5 text-slate-500 dark:text-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path d="M21 13.1A8.3 8.3 0 0 1 10.9 3 7.8 7.8 0 1 0 21 13.1Z" />
                      </svg>
                      {{ themeLabel }}
                    </span>
                    <span class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-200 transition dark:bg-primary-soft">
                      <span class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition" :class="darkMode ? 'translate-x-5' : 'translate-x-1'" />
                    </span>
                  </button>
                </div>
                <div class="mt-2 border-t border-slate-200 pt-2 dark:border-line">
                  <button
                    class="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:text-muted dark:hover:bg-danger-soft dark:hover:text-danger"
                    type="button"
                    role="menuitem"
                    @click="logout"
                  >
                    <svg class="h-5 w-5 text-slate-500 dark:text-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="M15 17l5-5-5-5" />
                      <path d="M20 12H9" />
                      <path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                    </svg>
                    Salir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </nav>

    <Teleport to="body">
      <div
        v-if="mobileMenuOpen"
        id="billing-mobile-navigation"
        class="fixed inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 md:hidden"
      >
        <button
          class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          type="button"
          aria-label="Cerrar navegación"
          @click="mobileMenuOpen = false"
        />
        <div class="sf-app-navbar relative h-full w-full overflow-y-auto px-4 pb-8 pt-5 shadow-2xl shadow-black/40">
          <p class="mb-3 px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Accesos rápidos</p>
          <div class="mb-7 grid grid-cols-2 gap-2">
            <a
              :href="dashboardHref"
              class="flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white transition active:scale-[0.98] active:bg-white/10"
              :class="module === 'dashboard' ? 'border-sky-400/60 bg-sky-500/20 text-sky-100' : ''"
              @click="navigate($event, dashboardHref)"
            >
              <Home class="h-6 w-6 text-sky-400" />
              Dashboard
            </a>
            <a
              v-for="item in extraNavItems"
              :key="item.href"
              :href="item.href"
              class="flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white transition active:scale-[0.98] active:bg-white/10"
              :class="item.active ? 'border-sky-400/60 bg-sky-500/20 text-sky-100' : ''"
              @click="navigate($event, item.href)"
            >
              <ClipboardList class="h-6 w-6 text-sky-400" />
              {{ item.label }}
            </a>
            <a
              :href="mobileInvoiceHref"
              class="flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white transition active:scale-[0.98] active:bg-white/10"
              :class="module === 'billing' && documentSlug === 'fe' ? 'border-sky-400/60 bg-sky-500/20 text-sky-100' : ''"
              @click="navigate($event, mobileInvoiceHref)"
            >
              <FileText class="h-6 w-6 text-sky-400" />
              Emitir factura
            </a>
          </div>

          <p class="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Más opciones</p>
          <BillingAppNav
            mobile
            :auth-token="authToken"
            :core-base-url="coreBaseUrl"
            :document-slug="documentSlug"
            :event-slug="eventSlug"
            :artifact-slug="artifactSlug"
            :extra-nav-items="[]"
            :module="module"
            :app-base-url="appBaseUrl"
            :billing-context-cache-scope="billingContextCacheScope"
            @navigate="navigate($event.event, $event.href)"
          />
        </div>
      </div>
    </Teleport>

    <header
      class="relative z-10 border-b border-blue-100/70 bg-white/85 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:shadow-black/20"
      :class="['dashboard', 'billing', 'workshop-reception', 'workshop-orders'].includes(module) ? 'hidden md:block' : ''"
    >
      <div
        class="mx-auto max-w-7xl"
        :class="module === 'workshop-reception' ? 'px-0 py-0 md:px-6 md:py-4 lg:px-8' : 'px-4 py-4 sm:px-6 lg:px-8'"
      >
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-text">{{ pageTitle }}</h1>
          <div v-if="currentHelp">
            <button
              class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-950/20 transition hover:border-sky-700 hover:bg-sky-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500 dark:border-primary dark:bg-primary dark:text-primary-contrast dark:shadow-black/20 dark:hover:border-primary-hover dark:hover:bg-primary-hover"
              type="button"
              :aria-label="`Ayuda sobre ${currentHelp.title}`"
              :aria-describedby="helpTooltip ? 'billing-help-tooltip' : undefined"
              @mouseenter="showHelpTooltip"
              @mouseleave="hideHelpTooltip"
              @focus="showHelpTooltip"
              @blur="hideHelpTooltip"
              @click="openHelpModal"
            >
              <CircleQuestionMark class="h-7 w-7" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <BillingTooltip
      v-if="helpTooltip"
      id="billing-help-tooltip"
      :open="true"
      :label="helpTooltip.label"
      :detail="helpTooltip.detail"
      :top="helpTooltip.top"
      :left="helpTooltip.left"
      placement="bottom"
    />

    <BillingHelpModal
      :open="helpModalOpen"
      :help="currentHelp"
      @close="helpModalOpen = false"
    />

    <main class="relative z-10">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div v-if="requiresFiscalSession && !authToken" class="rounded-md border border-red-200 bg-red-50 p-5 text-red-700">
          No fue posible abrir la sesion fiscal.
        </div>
        <slot
          v-else
          name="before-content"
        />
        <component
          :is="selectedComponent"
          v-if="!requiresFiscalSession || authToken"
          v-bind="selectedComponentProps"
        />
      </div>
    </main>
  </div>
</template>
