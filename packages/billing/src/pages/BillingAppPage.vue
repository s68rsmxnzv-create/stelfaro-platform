<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient } from '@stelfaro/api-client';
import { UiInfoIcon } from '@stelfaro/ui';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BillingAppNav from '../components/BillingAppNav.vue';
import BillingModalShell from '../components/BillingModalShell.vue';
import BillingCompanySettingsPage from './BillingCompanySettingsPage.vue';
import BillingDashboardPage from './BillingDashboardPage.vue';
import BillingOperationalPlaceholderPage from './BillingOperationalPlaceholderPage.vue';
import BillingWorkspace from './BillingWorkspace.vue';
import DteArtifactsPage from './DteArtifactsPage.vue';
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
  extraNavItems: {
    type: Array,
    default: () => []
  },
  operationalPage: {
    type: Object,
    default: null
  }
});

const dteHelpModalOpen = ref(false);
const userMenuOpen = ref(false);
const userMenuRef = ref(null);
const darkMode = ref(false);
const contextLoading = ref(false);
const documentTypes = ref([]);
const billingCompanies = ref([]);
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
const dteHelpByType = {
  '01': {
    title: 'Factura Electronica',
    summary: 'Para ventas al consumidor final.',
    use: 'Usala cuando tu cliente no necesita credito fiscal. Si el monto es alto, identifica al cliente antes de emitir.'
  },
  '03': {
    title: 'Credito Fiscal',
    summary: 'Para clientes que declaran IVA.',
    use: 'Usalo cuando vendes a una empresa o contribuyente que necesita usar la compra como credito fiscal.'
  },
  '05': {
    title: 'Nota de Credito',
    summary: 'Para bajar o anular valores de un CCF.',
    use: 'Usala cuando hubo devolucion, descuento posterior o necesitas corregir a favor del cliente.'
  },
  '06': {
    title: 'Nota de Debito',
    summary: 'Para aumentar valores de un CCF.',
    use: 'Usala cuando faltaron cargos, se agregaron productos o debes cobrar una diferencia.'
  },
  '14': {
    title: 'Sujeto Excluido',
    summary: 'Para compras a personas fuera del IVA.',
    use: 'Usala cuando compras bienes o servicios a alguien que no emite DTE ni factura con IVA.'
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
  'operational-placeholder': BillingOperationalPlaceholderPage,
  billing: BillingWorkspace,
  artifacts: DteArtifactsPage,
  'mh-events': MhEventsPage,
  'mh-responses': MhResponsesPage,
  'mh-event-responses': MhEventResponsesPage,
  settings: BillingCompanySettingsPage
};
const eventOptions = [
  { label: 'Invalidacion', slug: 'invalidacion' },
  { label: 'Contingencia', slug: 'contingencia' },
  { label: 'Operaciones especiales', slug: 'operaciones-especiales' }
];

const selectedComponent = computed(() => moduleComponents[props.module] || BillingWorkspace);
const selectedDocumentType = computed(() => documentTypeBySlug[props.documentSlug] || '01');
const selectedEventType = computed(() => eventTypeBySlug[props.eventSlug] || 'invalidacion');
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
      initialDocumentType: selectedDocumentType.value
    };
  }

  if (props.module === 'mh-events') {
    return {
      ...baseProps,
      initialEventType: selectedEventType.value
    };
  }

  if (props.module === 'operational-placeholder') {
    return props.operationalPage ?? {};
  }

  return baseProps;
});
const dashboardHref = computed(() => props.dashboardUrl || props.appBaseUrl || '/');
const pageTitle = computed(() => {
  if (props.module === 'dashboard') return 'Dashboard';
  if (props.module === 'operational-placeholder') return props.operationalPage?.title ?? props.app.name;

  if (props.module === 'billing') {
    return billingOptions.value.find((item) => item.slug === props.documentSlug)?.label ?? 'Facturacion';
  }

  if (props.module === 'mh-events') {
    return eventOptions.find((item) => item.slug === props.eventSlug)?.label ?? 'Eventos MH';
  }

  if (props.module === 'artifacts') return 'Comprobantes';
  if (props.module === 'mh-responses') return 'Respuestas MH';
  if (props.module === 'mh-event-responses') return 'Respuestas MH - Eventos';
  if (props.module === 'settings') return 'Configuracion';

  return props.app.name;
});
const currentDteHelp = computed(() => (props.module === 'billing' ? dteHelpByType[selectedDocumentType.value] ?? null : null));
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
  window.addEventListener('keydown', closeDteHelpOnEscape);
  document.addEventListener('click', closeUserMenuOnOutsideClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeDteHelpOnEscape);
  document.removeEventListener('click', closeUserMenuOnOutsideClick);
});

function closeDteHelpOnEscape(event) {
  if (event.key === 'Escape') {
    dteHelpModalOpen.value = false;
    userMenuOpen.value = false;
  }
}

function openDteHelpModal() {
  dteHelpModalOpen.value = true;
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
  emit('navigate', { event, href });
}

function navigateFromMenu(event, href) {
  userMenuOpen.value = false;
  navigate(event, href);
}
</script>

<template>
  <div v-if="module === 'settings'" class="sf-app-background min-h-screen text-slate-950 dark:text-text">
    <div v-if="!authToken" class="mx-auto max-w-3xl px-4 py-8">
      <div class="rounded-md border border-red-200 bg-red-50 p-5 text-red-700">
        No fue posible abrir la sesion fiscal.
      </div>
    </div>
    <component
      :is="selectedComponent"
      v-else
      v-bind="selectedComponentProps"
    />
  </div>

  <div v-else class="relative min-h-screen overflow-x-hidden bg-app pt-16 text-slate-950 dark:text-text">
    <div class="sf-app-background pointer-events-none fixed inset-x-0 bottom-0 top-16 z-0"></div>

    <nav class="sf-app-navbar fixed inset-x-0 top-0 z-50 shadow-sm backdrop-blur">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center">
            <div class="hidden items-baseline gap-1 md:flex">
              <a
                :href="dashboardHref"
                class="rounded-md px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                :class="module === 'dashboard' ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
                @click="navigate($event, dashboardHref)"
              >
                Dashboard
              </a>

              <a
                v-for="item in extraNavItems"
                :key="item.href"
                :href="item.href"
                class="rounded-md px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                :class="item.active ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
                @click="navigate($event, item.href)"
              >
                {{ item.label }}
              </a>

              <BillingAppNav
                :auth-token="authToken"
                :core-base-url="coreBaseUrl"
                :document-slug="documentSlug"
                :event-slug="eventSlug"
                :module="module"
                :app-base-url="appBaseUrl"
                :billing-context-cache-scope="billingContextCacheScope"
                @navigate="navigate($event.event, $event.href)"
              />
            </div>
          </div>

          <div class="flex items-center gap-4">
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
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text"
                    role="menuitem"
                    @click="userMenuOpen = false"
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

    <header class="relative z-10 border-b border-blue-100/70 bg-white/85 shadow-sm shadow-blue-950/5 backdrop-blur dark:border-line dark:bg-surface dark:shadow-black/20">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-bold tracking-tight text-slate-950 dark:text-text">{{ pageTitle }}</h1>
          <div v-if="currentDteHelp">
            <button
              class="grid h-9 w-9 place-items-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm shadow-sky-950/5 transition hover:border-sky-300 hover:bg-sky-100 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500"
              type="button"
              :aria-label="`Ayuda sobre ${currentDteHelp.title}`"
              @click="openDteHelpModal"
            >
              <UiInfoIcon class="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <BillingModalShell
      :open="dteHelpModalOpen && Boolean(currentDteHelp)"
      :title="currentDteHelp?.title ?? 'Ayuda'"
      :eyebrow="currentDteHelp?.summary ?? null"
      max-width="max-w-md"
      z-index-class="z-[100]"
      panel-class="rounded-xl"
      close-label="Cerrar ayuda"
      @close="dteHelpModalOpen = false"
    >
      <div class="flex items-start gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
          <UiInfoIcon class="h-7 w-7" />
        </span>
        <p class="text-sm leading-6 text-slate-700">{{ currentDteHelp?.use }}</p>
      </div>
    </BillingModalShell>

    <main class="relative z-10">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div v-if="!authToken" class="rounded-md border border-red-200 bg-red-50 p-5 text-red-700">
          No fue posible abrir la sesion fiscal.
        </div>
        <slot
          v-else
          name="before-content"
        />
        <component
          :is="selectedComponent"
          v-if="authToken"
          v-bind="selectedComponentProps"
        />
      </div>
    </main>
  </div>
</template>
