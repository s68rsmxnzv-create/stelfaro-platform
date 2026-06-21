<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoreDteClient, type BillingDocumentType, type BillingEmpresa } from '@stelfaro/api-client';
import { UiCloseCircleIcon, UiInfoIcon } from '@stelfaro/ui';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const mobileOpen = ref(false);
const userMenuOpen = ref(false);
const billingMenuOpen = ref(false);
const eventMenuOpen = ref(false);
const responsesMenuOpen = ref(false);
const dteHelpModalOpen = ref(false);
const appNav = ref<HTMLElement | null>(null);
const documentTypes = ref<BillingDocumentType[]>([]);
const billingCompanies = ref<BillingEmpresa[]>([]);
const companyLogoBroken = ref(false);
const themeStorageKey = 'stelfaro:theme';
const platformAdminUrl = import.meta.env.VITE_PLATFORM_ADMIN_URL || 'https://admin.stelfaro.com/';
const platformAdminEmails = String(import.meta.env.VITE_PLATFORM_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const platformAdminRoles = new Set(['super_admin', 'admin_fiscal', 'platform_owner', 'platform_admin']);
const isPublicLayout = computed(() => Boolean(route.meta.public));
const nav = computed(() => [
  { label: 'Dashboard', to: '/', show: true },
  { label: 'Onboarding fiscal', to: '/onboarding', show: auth.isBackoffice }
].filter((item) => item.show));
const fallbackBillingTypes: BillingDocumentType[] = [
  { code: '01', label: 'Consumidor final', version: 2, implemented: true },
  { code: '03', label: 'Credito fiscal', version: 2, implemented: true },
  { code: '14' as BillingDocumentType['code'], label: 'Sujeto excluido', version: 2, implemented: true },
  { code: '05' as BillingDocumentType['code'], label: 'Nota de credito', version: 4, implemented: true },
  { code: '06' as BillingDocumentType['code'], label: 'Nota de debito', version: 4, implemented: true }
];
const billingSlugByType: Record<string, string> = {
  '01': 'fe',
  '03': 'ccf',
  '14': 'se',
  '05': 'nc',
  '06': 'nd'
};
const billingTypeBySlug: Record<string, BillingDocumentType['code']> = {
  fe: '01',
  ccf: '03',
  se: '14',
  nc: '05',
  nd: '06'
};
const dteHelpByType: Record<string, { title: string; summary: string; use: string }> = {
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
const billingOptions = computed(() => {
  const source = documentTypes.value.length ? documentTypes.value : fallbackBillingTypes;
  return source
    .filter((type) => ['01', '03', '05', '06', '14'].includes(type.code))
    .map((type) => ({
      label: type.label,
      to: `/billing/${billingSlugByType[type.code] ?? 'fe'}`,
      enabled: Boolean(type.implemented),
    }));
});
const responseOptions = computed(() => [
  { label: 'DTE', to: '/mh-responses', show: !auth.isBackoffice },
  { label: 'Eventos', to: '/mh-event-responses', show: !auth.isBackoffice },
].filter((item) => item.show));
const responsesMenuActive = computed(() => responseOptions.value.some((item) => item.to === route.path));
const eventOptions = computed(() => [
  { label: 'Invalidacion', to: '/mh-events/invalidacion', enabled: true },
  { label: 'Contingencia', to: '/mh-events/contingencia', enabled: true },
  { label: 'Retorno', to: '/mh-events/retorno', enabled: true },
  { label: 'Operaciones especiales', to: '/mh-events/operaciones-especiales', enabled: true },
]);
const pageTitle = computed(() => {
  if (route.path.startsWith('/billing')) {
    const currentDte = billingOptions.value.find((item) => item.to === route.path);
    return currentDte?.label ?? 'Facturacion';
  }

  if (route.path.startsWith('/mh-events')) {
    const currentEvent = eventOptions.value.find((item) => item.to === route.path);
    return currentEvent?.label ?? 'Eventos MH';
  }

  if (route.path.startsWith('/comprobantes')) {
    return 'Comprobantes';
  }

  if (route.path === '/mh-responses') {
    return 'Respuestas MH';
  }

  if (route.path === '/mh-event-responses') {
    return 'Respuestas MH - Eventos';
  }

  if (route.path === '/companies') {
    return auth.isBackoffice ? 'Empresas y configuracion fiscal' : 'Configuracion fiscal';
  }

  const current = nav.value.find((item) => item.to === route.path);
  return current?.label ?? 'Billing';
});
const currentBillingType = computed(() => {
  if (!route.path.startsWith('/billing')) return null;

  const slug = String(route.params.documentSlug ?? '').trim();
  return billingTypeBySlug[slug] ?? null;
});
const currentDteHelp = computed(() => currentBillingType.value ? dteHelpByType[currentBillingType.value] ?? null : null);
const activeCompany = computed(() => billingCompanies.value.find((empresa) => empresa.lifecycle_status === 'active') ?? billingCompanies.value[0] ?? null);
const companyLogoUrl = computed(() => companyLogoBroken.value ? null : activeCompany.value?.logo_url ?? null);
const initials = computed(() => {
  const name = auth.user?.name ?? 'Stelfaro';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SF';
});
const canAccessPlatformAdmin = computed(() => {
  const role = String(auth.user?.role ?? '').trim().toLowerCase();
  const email = String(auth.user?.email ?? '').trim().toLowerCase();

  return auth.isBackoffice
    || platformAdminRoles.has(role)
    || platformAdminEmails.includes(email);
});

watch(() => route.fullPath, () => {
  mobileOpen.value = false;
  userMenuOpen.value = false;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  dteHelpModalOpen.value = false;
});

watch(() => auth.token, async () => {
  if (!auth.token || auth.isBackoffice) {
    documentTypes.value = [];
    billingCompanies.value = [];
    companyLogoBroken.value = false;
    return;
  }

  try {
    const context = await new CoreDteClient('/api/v1', { authToken: auth.token }).billingContext();
    billingCompanies.value = context.empresas;
    companyLogoBroken.value = false;
    const enabled = new Set(context.empresas.flatMap((empresa) => empresa.enabled_document_types ?? []));
    documentTypes.value = context.documentTypes.map((type) => ({
      ...type,
      implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code)),
    }));
  } catch {
    documentTypes.value = [];
    billingCompanies.value = [];
    companyLogoBroken.value = false;
  }
}, { immediate: true });

onMounted(() => {
  initializeTheme();
  document.addEventListener('click', closeMenusOnOutsideClick);
  window.addEventListener('keydown', closeDteHelpOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenusOnOutsideClick);
  window.removeEventListener('keydown', closeDteHelpOnEscape);
});

async function logout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}

function closeOpenMenus(): void {
  userMenuOpen.value = false;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function closeMenusOnOutsideClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (appNav.value?.contains(target)) return;

  closeOpenMenus();
}

function toggleBillingMenu(): void {
  const next = !billingMenuOpen.value;
  billingMenuOpen.value = next;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function toggleEventMenu(): void {
  const next = !eventMenuOpen.value;
  eventMenuOpen.value = next;
  billingMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function toggleResponsesMenu(): void {
  const next = !responsesMenuOpen.value;
  responsesMenuOpen.value = next;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
}

function toggleUserMenu(): void {
  userMenuOpen.value = !userMenuOpen.value;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function openDteHelpModal(): void {
  dteHelpModalOpen.value = true;
  closeOpenMenus();
}

function closeDteHelpOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    dteHelpModalOpen.value = false;
  }
}

function initializeTheme(): void {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const darkMode = storedTheme ? storedTheme === 'dark' : prefersDark;

  document.documentElement.classList.toggle('dark', darkMode);
  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
}
</script>

<template>
  <RouterView v-if="isPublicLayout" />

  <div v-else class="relative min-h-screen overflow-hidden bg-app text-slate-950 dark:text-text">
    <nav ref="appNav" class="relative z-50 bg-slate-900 shadow-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center">
            <div class="hidden items-baseline gap-1 md:flex">
              <RouterLink
                v-for="item in nav"
                :key="item.to"
                :to="item.to"
                class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                active-class="bg-slate-950/70 text-white"
              >
                {{ item.label }}
              </RouterLink>

              <div v-if="!auth.isBackoffice" class="relative">
                <button
                  class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                  :class="route.path.startsWith('/billing') ? 'bg-slate-950/70 text-white' : ''"
                  type="button"
                  @click="toggleBillingMenu"
                >
                  Facturacion
                  <span
                    class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
                    :class="billingMenuOpen ? 'rotate-[225deg] text-slate-200' : ''"
                    aria-hidden="true"
                  ></span>
                </button>

                <div
                  v-if="billingMenuOpen"
                  class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
                >
                  <template v-for="option in billingOptions" :key="option.label">
                    <RouterLink
                      v-if="option.enabled"
                      :to="option.to"
                      class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
                      active-class="bg-sky-500 text-white shadow-sm shadow-sky-950/20"
                    >
                      {{ option.label }}
                    </RouterLink>
                    <span v-else class="block cursor-not-allowed rounded-md px-3 py-2 text-sm font-semibold text-slate-500">
                      {{ option.label }}
                    </span>
                  </template>
                </div>
              </div>

              <div v-if="!auth.isBackoffice" class="relative">
                <button
                  class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                  :class="route.path.startsWith('/mh-events') ? 'bg-slate-950/70 text-white' : ''"
                  type="button"
                  @click="toggleEventMenu"
                >
                  Eventos
                  <span
                    class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
                    :class="eventMenuOpen ? 'rotate-[225deg] text-slate-200' : ''"
                    aria-hidden="true"
                  ></span>
                </button>

                <div
                  v-if="eventMenuOpen"
                  class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
                >
                  <template v-for="option in eventOptions" :key="option.label">
                    <RouterLink
                      v-if="option.enabled"
                      :to="option.to"
                      class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
                      active-class="bg-sky-500 text-white shadow-sm shadow-sky-950/20"
                    >
                      {{ option.label }}
                    </RouterLink>
                    <span v-else class="block cursor-not-allowed rounded-md px-3 py-2 text-sm font-semibold text-slate-500">
                      {{ option.label }}
                    </span>
                  </template>
                </div>
              </div>

              <div v-if="responseOptions.length" class="relative">
                <button
                  class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                  :class="responsesMenuActive ? 'bg-slate-950/70 text-white' : ''"
                  type="button"
                  @click="toggleResponsesMenu"
                >
                  Respuestas
                  <span
                    class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-500 transition"
                    :class="responsesMenuOpen ? 'rotate-[225deg] text-slate-200' : ''"
                    aria-hidden="true"
                  ></span>
                </button>

                <div
                  v-if="responsesMenuOpen"
                  class="absolute left-0 z-30 mt-2 w-44 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
                >
                  <RouterLink
                    v-for="option in responseOptions"
                    :key="option.to"
                    :to="option.to"
                    class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
                    active-class="bg-sky-500 text-white shadow-sm shadow-sky-950/20"
                  >
                    {{ option.label }}
                  </RouterLink>
                </div>
              </div>

              <RouterLink
                v-if="!auth.isBackoffice"
                to="/comprobantes"
                class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                active-class="bg-slate-950/70 text-white"
              >
                Comprobantes
              </RouterLink>

              <a
                v-if="canAccessPlatformAdmin"
                :href="platformAdminUrl"
                class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Panel admin
              </a>
            </div>
          </div>

          <div class="hidden items-center gap-4 md:flex">
            <div class="relative">
              <button
                class="flex max-w-xs items-center gap-3 rounded-full text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500"
                type="button"
                @click="toggleUserMenu"
              >
                <span class="sr-only">Abrir menu de usuario</span>
                <span class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-bold text-slate-900 outline outline-1 -outline-offset-1 outline-white/10">
                  <img
                    v-if="companyLogoUrl"
                    :src="companyLogoUrl"
                    class="h-full w-full object-contain p-1"
                    alt=""
                    @error="companyLogoBroken = true"
                  >
                  <span v-else>
                    {{ initials }}
                  </span>
                </span>
              </button>

              <div
                v-if="userMenuOpen"
                class="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg outline outline-1 outline-black/5"
              >
                <div class="border-b border-slate-100 px-4 py-3">
                  <p class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</p>
                  <p class="truncate text-xs text-slate-500">{{ auth.user?.email }}</p>
                </div>
                <p class="px-4 py-2 text-xs font-semibold uppercase text-slate-400">{{ auth.user?.role }}</p>
                <RouterLink
                  v-if="auth.canManageFiscalSettings"
                  to="/companies"
                  class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  @click="userMenuOpen = false"
                >
                  Configuracion fiscal
                </RouterLink>
                <a
                  v-if="canAccessPlatformAdmin"
                  :href="platformAdminUrl"
                  class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  @click="userMenuOpen = false"
                >
                  Panel administrativo
                </a>
                <button class="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" type="button" @click="logout">
                  Salir
                </button>
              </div>
            </div>
          </div>

          <button
            class="-mr-2 inline-flex items-center justify-center rounded-md p-2 text-slate-300 hover:bg-white/5 hover:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500 md:hidden"
            type="button"
            @click="mobileOpen = !mobileOpen"
          >
            <span class="sr-only">Abrir menu principal</span>
            <span class="text-2xl leading-none">{{ mobileOpen ? 'x' : '≡' }}</span>
          </button>
        </div>
      </div>

      <div v-if="mobileOpen" class="border-t border-white/10 md:hidden">
        <div class="space-y-1 px-2 pb-3 pt-2">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="block rounded-md px-3 py-2 text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            active-class="bg-slate-950/70 text-white"
          >
            {{ item.label }}
          </RouterLink>

          <div v-if="!auth.isBackoffice" class="rounded-md bg-white/5 px-3 py-2">
            <p class="text-base font-semibold text-white">Facturacion</p>
            <div class="mt-2 space-y-1">
              <template v-for="option in billingOptions" :key="option.label">
                <RouterLink
                  v-if="option.enabled"
                  :to="option.to"
                  class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
                  active-class="bg-sky-500 text-white shadow-sm"
                >
                  {{ option.label }}
                </RouterLink>
                <span v-else class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-500">
                  {{ option.label }}
                </span>
              </template>
            </div>
          </div>

          <div v-if="!auth.isBackoffice" class="rounded-md bg-white/5 px-3 py-2">
            <p class="text-base font-semibold text-white">Eventos</p>
            <div class="mt-2 space-y-1">
              <template v-for="option in eventOptions" :key="option.label">
                <RouterLink
                  v-if="option.enabled"
                  :to="option.to"
                  class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
                  active-class="bg-sky-500 text-white shadow-sm"
                >
                  {{ option.label }}
                </RouterLink>
                <span v-else class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-500">
                  {{ option.label }}
                </span>
              </template>
            </div>
          </div>

          <div v-if="responseOptions.length" class="rounded-md bg-white/5 px-3 py-2">
            <p class="text-base font-semibold text-white">Respuestas</p>
            <div class="mt-1 space-y-1">
              <RouterLink
                v-for="option in responseOptions"
                :key="option.to"
                :to="option.to"
                class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
                active-class="bg-sky-500 text-white shadow-sm"
              >
                {{ option.label }}
              </RouterLink>
            </div>
          </div>

          <RouterLink
            v-if="!auth.isBackoffice"
            to="/comprobantes"
            class="block rounded-md px-3 py-2 text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            active-class="bg-slate-950/70 text-white"
          >
            Comprobantes
          </RouterLink>

          <a
            v-if="canAccessPlatformAdmin"
            :href="platformAdminUrl"
            class="block rounded-md px-3 py-2 text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Panel admin
          </a>
        </div>
        <div class="border-t border-white/10 pb-3 pt-4">
          <div class="flex items-center px-5">
            <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-bold text-slate-900 outline outline-1 -outline-offset-1 outline-white/10">
              <img
                v-if="companyLogoUrl"
                :src="companyLogoUrl"
                class="h-full w-full object-contain p-1"
                alt=""
                @error="companyLogoBroken = true"
              >
              <span v-else>
                {{ initials }}
              </span>
            </span>
            <div class="ml-3 min-w-0">
              <p class="truncate text-base font-medium text-white">{{ auth.user?.name }}</p>
              <p class="truncate text-sm font-medium text-slate-400">{{ auth.user?.email }}</p>
            </div>
          </div>
          <div class="mt-3 space-y-1 px-2">
            <button class="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white" type="button" @click="logout">
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>

    <div class="sf-app-background relative z-10 min-h-[calc(100vh-4rem)]">
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

      <div
        v-if="dteHelpModalOpen && currentDteHelp"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-label="`Ayuda sobre ${currentDteHelp.title}`"
        @click.self="dteHelpModalOpen = false"
      >
        <section class="w-full max-w-md rounded-xl border border-sky-100 bg-white p-5 shadow-2xl shadow-slate-950/20">
          <div class="flex items-start justify-between gap-4">
            <div class="flex min-w-0 items-start gap-3">
              <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
                <UiInfoIcon class="h-7 w-7" />
              </span>
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase text-sky-700">{{ currentDteHelp.summary }}</p>
                <h2 class="mt-1 text-xl font-bold text-slate-950">{{ currentDteHelp.title }}</h2>
              </div>
            </div>
            <button
              class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500"
              type="button"
              aria-label="Cerrar ayuda"
              @click="dteHelpModalOpen = false"
            >
              <UiCloseCircleIcon class="h-6 w-6" />
            </button>
          </div>
          <p class="mt-4 text-sm leading-6 text-slate-700">{{ currentDteHelp.use }}</p>
        </section>
      </div>

      <main class="relative z-10">
        <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
