<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import OwnerAvatarMenu from './components/OwnerAvatarMenu.vue';
import { useAdminSessionStore } from './stores/adminSession';
import { useAdminWorkspaceStore } from './stores/adminWorkspace';
import { useCoreSessionStore } from './stores/coreSession';
import { usePlatformSessionStore } from './stores/platformSession';

const route = useRoute();
const platform = usePlatformSessionStore();
const session = useAdminSessionStore();
const core = useCoreSessionStore();
const workspace = useAdminWorkspaceStore();
const darkMode = ref(false);
const themeStorageKey = 'stelfaro:theme';

const themeLabel = computed(() => (darkMode.value ? 'Modo claro' : 'Modo oscuro'));

onMounted(async () => {
  initializeTheme();
  await platform.initialize();

  if (!platform.canAccessAdmin) {
    return;
  }

  await Promise.all([
    session.initialize().catch(() => undefined),
    core.initialize().catch(() => undefined)
  ]);
});

function goToLogin(): void {
  window.location.assign(platform.loginUrl);
}

async function logout(): Promise<void> {
  await fetch(`${platform.platformApiBaseUrl}/logout`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include'
  }).catch(() => undefined);

  window.location.assign(platform.loginUrl);
}

function initializeTheme(): void {
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

  darkMode.value = storedTheme ? storedTheme === 'dark' : prefersDark;
  applyTheme();
}

function applyTheme(): void {
  document.documentElement.classList.toggle('dark', darkMode.value);
  document.documentElement.dataset.theme = darkMode.value ? 'dark' : 'light';
}

function toggleTheme(): void {
  darkMode.value = !darkMode.value;
  window.localStorage.setItem(themeStorageKey, darkMode.value ? 'dark' : 'light');
  applyTheme();
}

function companyViewButtonClass(view: 'data' | 'fiscal' | 'sucursales' | 'correlativos' | 'users' | 'subscription'): string {
  return workspace.activeCompanyView === view
    ? 'bg-slate-100 text-slate-950'
    : 'text-slate-800 hover:bg-slate-50 hover:text-slate-950';
}

function companyViewIconClass(view: 'data' | 'fiscal' | 'sucursales' | 'correlativos' | 'users' | 'subscription'): string {
  return workspace.activeCompanyView === view ? 'text-slate-950' : 'text-slate-600';
}

type NavIcon = 'home' | 'users' | 'building' | 'plus' | 'credit-card' | 'mail' | 'settings';

type NavLink = {
  label: string;
  to: string;
  icon?: NavIcon;
};

type NavGroup = {
  id: string;
  label: string;
  icon: NavIcon;
  links: NavLink[];
};

type NavEntry = NavLink | NavGroup;

const openGroupId = ref<string | null>('companies');

const navEntries: NavEntry[] = [
  { label: 'Inicio', to: '/', icon: 'home' },
  {
    id: 'companies',
    label: 'Empresas',
    icon: 'building',
    links: [
      { label: 'Empresas fiscales', to: '/empresas', icon: 'settings' },
      { label: 'Registrar empresa', to: '/fiscal/onboarding', icon: 'plus' }
    ]
  },
  { label: 'Suscripciones', to: '/subscriptions', icon: 'credit-card' },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: 'mail',
    links: [
      { label: 'Alias de remitente', to: '/notifications/sender-aliases' },
      { label: 'Buzon SMTP', to: '/notifications/mail-transport' }
    ]
  }
];

watch(
  () => route.path,
  () => {
    const activeGroup = navEntries.find((entry) => isGroup(entry) && isGroupActive(entry));
    openGroupId.value = activeGroup && isGroup(activeGroup) ? activeGroup.id : null;
  },
  { immediate: true }
);

const breadcrumbs = computed(() => {
  if (route.path === '/') {
    return [];
  }

  for (const entry of navEntries) {
    if (!isGroup(entry) && isActivePath(entry.to)) {
      return [{ label: entry.label, to: entry.to }];
    }

    if (isGroup(entry)) {
      const activeChild = entry.links.find((item) => isActivePath(item.to));

      if (activeChild) {
        return [{ label: activeChild.label, to: activeChild.to }];
      }
    }
  }

  return [];
});

const serviceStatus = computed(() => {
  const connectedCount = [core.isConnected, session.isConnected].filter(Boolean).length;

  if (connectedCount === 2) {
    return {
      tone: 'ready' as const,
      label: 'Todo listo',
      description: 'Core fiscal y notificaciones conectados'
    };
  }

  if (connectedCount === 1) {
    return {
      tone: 'partial' as const,
      label: 'Conexion parcial',
      description: core.isConnected ? 'Core fiscal conectado' : 'Notificaciones conectadas'
    };
  }

  return {
    tone: 'offline' as const,
    label: 'Sin conexion',
    description: 'Servicios internos no conectados'
  };
});

const companyDetailActive = computed(() => route.path.startsWith('/empresas') && workspace.hasCompanyDetail);

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'links' in entry;
}

function isActivePath(path: string): boolean {
  const active = path === '/'
    ? route.path === '/'
    : route.path.startsWith(path);

  return active;
}

function isGroupActive(group: NavGroup): boolean {
  return group.links.some((item) => isActivePath(item.to));
}

function isGroupOpen(group: NavGroup): boolean {
  return openGroupId.value === group.id;
}

function toggleGroup(group: NavGroup): void {
  openGroupId.value = isGroupOpen(group) ? null : group.id;
}

function linkClass(path: string): string {
  return isActivePath(path)
    ? 'bg-slate-100 text-slate-950 font-bold'
    : 'text-slate-800 hover:bg-slate-50 hover:text-slate-950';
}

function groupClass(group: NavGroup): string {
  return isGroupActive(group)
    ? 'bg-slate-100 text-slate-950 font-bold'
    : 'font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950';
}
</script>

<template>
  <div v-if="platform.loading" class="sf-app-background grid min-h-screen place-items-center px-4">
    <div class="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm">
      Validando sesion de plataforma...
    </div>
  </div>

  <div v-else-if="platform.lastError || !platform.authenticated" class="sf-app-background grid min-h-screen place-items-center px-4">
    <div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-lg font-semibold text-slate-950">Sesion requerida</h1>
      <p class="mt-2 text-sm text-slate-600">Ingresa desde Stelfaro para abrir el panel administrativo.</p>
      <p v-if="platform.lastError" class="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ platform.lastError }}</p>
      <button type="button" class="mt-5 h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800" @click="goToLogin">
        Ir al login
      </button>
    </div>
  </div>

  <div v-else-if="!platform.canAccessAdmin" class="sf-app-background grid min-h-screen place-items-center px-4">
    <div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-lg font-semibold text-slate-950">Acceso reservado</h1>
      <p class="mt-2 text-sm text-slate-600">Tu usuario no tiene permisos para administrar la plataforma.</p>
    </div>
  </div>

  <div v-else class="sf-app-background min-h-screen">
    <aside v-if="!companyDetailActive" class="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-slate-200 bg-white text-[15.5px] lg:flex">
      <div class="flex h-16 items-center border-b border-slate-200 px-6">
        <div>
          <p class="text-sm font-bold uppercase tracking-wide text-slate-500">Stelfaro Admin</p>
          <h1 class="text-lg font-bold text-slate-950">Administracion global</h1>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-5">
        <div class="space-y-1">
          <template v-for="entry in navEntries" :key="isGroup(entry) ? entry.id : entry.to">
            <div v-if="isGroup(entry)">
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition"
                :class="groupClass(entry)"
                :aria-expanded="isGroupOpen(entry) ? 'true' : 'false'"
                @click="toggleGroup(entry)"
              >
                <span class="grid h-6 w-6 shrink-0 place-items-center text-slate-600">
                  <svg v-if="entry.icon === 'building'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                    <path d="M4 21h16" />
                    <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                    <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" />
                  </svg>
                  <svg v-else-if="entry.icon === 'mail'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                    <path d="M4 6h16v12H4z" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                </span>
                <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
                <svg class="h-4 w-4 shrink-0 text-slate-500 transition" :class="isGroupOpen(entry) ? 'rotate-90' : ''" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.21 5.23a.75.75 0 0 1 1.06-.02l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 1 1-1.04-1.08L11.17 10 7.23 6.29a.75.75 0 0 1-.02-1.06Z" clip-rule="evenodd" />
                </svg>
              </button>

              <div v-if="isGroupOpen(entry)" class="ml-6 border-l border-slate-200 py-1 pl-4">
                <RouterLink
                  v-for="item in entry.links"
                  :key="item.to"
                  :to="item.to"
                  class="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition"
                  :class="linkClass(item.to)"
                >
                  <span v-if="item.icon" class="grid h-5 w-5 shrink-0 place-items-center text-slate-600">
                    <svg v-if="item.icon === 'settings'" class="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
                    </svg>
                    <svg v-else-if="item.icon === 'plus'" class="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                </RouterLink>
              </div>
            </div>

            <RouterLink
              v-else
              :to="entry.to"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-semibold transition"
              :class="linkClass(entry.to)"
            >
              <span class="grid h-6 w-6 shrink-0 place-items-center text-slate-600">
                <svg v-if="entry.icon === 'home'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="m4 11 8-7 8 7" />
                  <path d="M6.5 10.5V20h11v-9.5" />
                </svg>
                <svg v-else-if="entry.icon === 'credit-card'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                  <path d="M2 11h20M6 16h4" />
                </svg>
                <svg v-else-if="entry.icon === 'users'" class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M16 20a4 4 0 0 0-8 0" />
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  <path d="M20 19a3.5 3.5 0 0 0-3-3.46" />
                  <path d="M17 4.5a3.5 3.5 0 0 1 0 6.9" />
                </svg>
              </span>
              <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
            </RouterLink>
          </template>
        </div>

      </nav>

      <div class="border-t border-slate-200 p-4">
        <OwnerAvatarMenu
          :name="platform.session?.user.name"
          :email="platform.session?.user.email"
          :service-status="serviceStatus"
          :dark-mode="darkMode"
          :theme-label="themeLabel"
          @toggle-theme="toggleTheme"
          @logout="logout"
        />
      </div>
    </aside>

    <aside v-else class="fixed inset-y-0 left-0 hidden w-[420px] border-r border-slate-200 bg-white lg:flex">
      <div class="flex w-24 flex-col border-r border-slate-200">
        <div class="grid h-16 place-items-center border-b border-slate-200">
          <span class="text-lg font-black tracking-tight text-slate-950">SF</span>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 py-4">
          <RouterLink
            to="/"
            class="flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            :class="route.path === '/' ? 'bg-slate-100 text-slate-950' : ''"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="m4 11 8-7 8 7" />
              <path d="M6.5 10.5V20h11v-9.5" />
            </svg>
            Inicio
          </RouterLink>

          <RouterLink
            to="/empresas"
            class="mt-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            :class="route.path.startsWith('/empresas') ? 'bg-slate-100 text-slate-950' : ''"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M4 21h16" />
              <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" />
            </svg>
            Empresas
          </RouterLink>

          <RouterLink
            to="/subscriptions"
            class="mt-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            :class="route.path.startsWith('/subscriptions') ? 'bg-slate-100 text-slate-950' : ''"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
              <path d="M2 11h20M6 16h4" />
            </svg>
            Suscrip.
          </RouterLink>

          <RouterLink
            to="/notifications/sender-aliases"
            class="mt-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            :class="route.path.startsWith('/notifications') ? 'bg-slate-100 text-slate-950' : ''"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M4 6h16v12H4z" />
              <path d="m4 7 8 6 8-6" />
            </svg>
            Correo
          </RouterLink>
        </nav>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Empresa seleccionada</p>
          <p class="mt-1 truncate text-lg font-bold text-slate-950">{{ workspace.selectedCompany?.tradeName }}</p>
          <p class="mt-1 truncate text-xs font-semibold text-slate-500">{{ workspace.selectedCompany?.documentLabel }}</p>
        </div>

        <nav class="flex-1 overflow-y-auto px-4 py-5">
          <button
            type="button"
            class="mb-4 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            @click="workspace.showCompanySearch"
          >
            <svg class="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Todas las empresas
          </button>

          <div class="space-y-1">
            <RouterLink
              to="/empresas"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-bold transition"
              :class="workspace.activeCompanyView === 'users' ? 'text-slate-800 hover:bg-slate-50 hover:text-slate-950' : 'bg-slate-100 text-slate-950'"
              @click="workspace.setCompanyView('summary')"
            >
              <svg class="h-[22px] w-[22px] text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
              </svg>
              Configuracion fiscal
            </RouterLink>
            <button
              type="button"
              class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition"
              :class="companyViewButtonClass('users')"
              @click="workspace.requestCompanyAction('users')"
            >
              <svg class="h-[22px] w-[22px]" :class="companyViewIconClass('users')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M16 20a4 4 0 0 0-8 0" />
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                <path d="M20 19a3.5 3.5 0 0 0-3-3.46" />
                <path d="M17 4.5a3.5 3.5 0 0 1 0 6.9" />
              </svg>
              Accesos
            </button>
            <button
              type="button"
              class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition"
              :class="companyViewButtonClass('subscription')"
              @click="workspace.requestCompanyAction('subscription')"
            >
              <svg class="h-[22px] w-[22px]" :class="companyViewIconClass('subscription')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                <path d="M2 11h20M6 16h4" />
              </svg>
              Suscripcion
            </button>
            <template v-if="workspace.companyEditMode">
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition"
                :class="companyViewButtonClass('data')"
                @click="workspace.requestCompanyAction('edit-data')"
              >
                <span class="grid h-[22px] w-[22px] place-items-center" :class="companyViewIconClass('data')">ID</span>
                Datos generales
              </button>
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition"
                :class="companyViewButtonClass('fiscal')"
                @click="workspace.requestCompanyAction('edit-fiscal')"
              >
                <svg class="h-[22px] w-[22px]" :class="companyViewIconClass('fiscal')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M15 7a5 5 0 1 0-4 4.9L20 21l1-1-2-2 2-2-2-2 2-2-1-1-2 2-1.6-1.6A5 5 0 0 0 15 7Z" />
                </svg>
                Datos fiscales
              </button>
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition"
                :class="companyViewButtonClass('sucursales')"
                @click="workspace.requestCompanyAction('edit-sucursales')"
              >
                <svg class="h-[22px] w-[22px]" :class="companyViewIconClass('sucursales')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M4 21V9l8-5 8 5v12" />
                  <path d="M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01" />
                </svg>
                Sucursales
              </button>
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold transition"
                :class="companyViewButtonClass('correlativos')"
                @click="workspace.requestCompanyAction('edit-correlativos')"
              >
                <svg class="h-[22px] w-[22px]" :class="companyViewIconClass('correlativos')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                  <path d="M8 5v14M16 5v14" />
                </svg>
                Correlativos
              </button>
            </template>
          </div>

          <div class="mt-6 border-t border-slate-200 pt-5">
            <p class="px-3 text-xs font-bold uppercase tracking-wide text-slate-500">Acciones</p>
            <div class="mt-2 space-y-1">
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold text-slate-800 transition hover:bg-slate-50 hover:text-slate-950"
                @click="workspace.requestCompanyAction('edit')"
              >
                <svg class="h-[22px] w-[22px] text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                </svg>
                Editar datos
              </button>
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold text-slate-800 transition hover:bg-slate-50 hover:text-slate-950"
                @click="workspace.requestCompanyAction('toggle-status')"
              >
                <svg class="h-[22px] w-[22px] text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M12 3a9 9 0 1 0 9 9" />
                  <path d="M12 7v5l3 2" />
                  <path d="M19 3v5h-5" />
                </svg>
                {{ workspace.selectedCompany?.lifecycleStatus === 'inactive' ? 'Activar' : 'Desactivar' }}
              </button>
              <button
                type="button"
                class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold text-rose-700 transition hover:bg-rose-50"
                @click="workspace.requestCompanyAction('delete')"
              >
                <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6 18 20H6L5 6" />
                  <path d="M10 11v5M14 11v5" />
                </svg>
                Borrar
              </button>
            </div>
          </div>
        </nav>
      </div>
    </aside>

    <div :class="companyDetailActive ? 'lg:pl-[420px]' : 'lg:pl-72'">
      <main class="px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex items-center overflow-x-auto whitespace-nowrap pb-5">
          <RouterLink to="/" class="text-slate-600 transition hover:text-slate-950" aria-label="Inicio">
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
            </svg>
          </RouterLink>

          <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb.label}-${index}`">
            <span class="mx-4 text-slate-400">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z" clip-rule="evenodd" />
              </svg>
            </span>

            <RouterLink
              v-if="crumb.to && index < breadcrumbs.length - 1"
              :to="crumb.to"
              class="text-sm font-medium text-slate-600 transition hover:text-slate-950 hover:underline"
            >
              {{ crumb.label }}
            </RouterLink>
            <span
              v-else
              class="text-sm font-semibold"
              :class="index === breadcrumbs.length - 1 ? 'text-sky-700' : 'text-slate-600'"
            >
              {{ crumb.label }}
            </span>
          </template>
        </div>

        <RouterView :key="route.fullPath" />
      </main>
    </div>
  </div>
</template>
