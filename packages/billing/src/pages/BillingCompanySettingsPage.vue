<script setup lang="ts">
import { computed, ref } from 'vue';
import BillingSettingsPage from './BillingSettingsPage.vue';

type CompanyView = 'summary' | 'requests' | 'profile' | 'subscription' | 'printer' | 'security' | 'support';
type SettingsCompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos';
type NavIcon = 'summary' | 'requests' | 'profile' | 'subscription' | 'printer' | 'security' | 'support';

defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  appBaseUrl?: string;
  dashboardUrl?: string;
  billingContextCacheScope?: string;
}>();

const selectedCompany = ref<{ name: string; tradeName: string; documentLabel: string; lifecycleStatus: string } | null>(null);
const activeView = ref<CompanyView>('summary');

const companyTitle = computed(() => selectedCompany.value?.tradeName || selectedCompany.value?.name || 'Mi empresa');
const activeItem = computed(() => navItems.find((item) => item.id === activeView.value) ?? navItems[0]);

const navItems: Array<{
  id: CompanyView;
  label: string;
  detail: string;
  icon: NavIcon;
}> = [
  { id: 'summary', label: 'Resumen', detail: 'Informacion de empresa', icon: 'summary' },
  { id: 'requests', label: 'Solicitudes', detail: 'Cambios sensibles', icon: 'requests' },
  { id: 'profile', label: 'Perfil', detail: 'Datos de contacto', icon: 'profile' },
  { id: 'subscription', label: 'Suscripcion', detail: 'Plan y vigencia', icon: 'subscription' },
  { id: 'printer', label: 'Impresora', detail: 'Preferencias locales', icon: 'printer' },
  { id: 'security', label: 'Seguridad', detail: 'Contrasena y acceso', icon: 'security' },
  { id: 'support', label: 'Soporte', detail: 'Canales de ayuda', icon: 'support' }
];

function openView(item: (typeof navItems)[number]): void {
  activeView.value = item.id;
}

function setSelectedCompany(company: { name: string; tradeName: string; documentLabel: string; lifecycleStatus: string }): void {
  selectedCompany.value = company;
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
</script>

<template>
  <div class="min-h-screen bg-app">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-80 flex-col border-r border-line bg-surface lg:flex">
      <div class="flex h-16 items-center gap-3 border-b border-line px-6">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-contrast shadow-sm shadow-sky-900/20">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
        </span>
        <span class="text-sm font-black uppercase tracking-wide text-text">Configuracion</span>
      </div>

      <div class="border-b border-line px-6 py-5">
        <p class="text-xs font-bold uppercase tracking-wide text-muted">Empresa</p>
        <p class="mt-1 truncate text-lg font-bold text-text">{{ companyTitle }}</p>
        <p v-if="selectedCompany" class="mt-1 truncate text-xs font-semibold text-muted">{{ selectedCompany.documentLabel }}</p>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-5" aria-label="Opciones de configuracion">
        <div class="space-y-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition"
            :class="activeView === item.id ? 'bg-surface-muted font-bold text-text shadow-surface' : 'font-semibold text-muted hover:bg-surface-muted hover:text-text'"
            @click="openView(item)"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="activeView === item.id ? 'bg-surface text-primary' : 'text-muted'">
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
              <span class="block truncate text-xs font-medium text-muted">{{ item.detail }}</span>
            </span>
          </button>
        </div>
      </nav>
    </aside>

    <main class="px-4 py-6 text-text sm:px-6 lg:pl-[344px] lg:pr-8">
      <div class="mb-5 flex items-center overflow-x-auto whitespace-nowrap">
        <a :href="dashboardUrl || appBaseUrl || '/'" class="text-muted transition hover:text-text" aria-label="Inicio">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
          </svg>
        </a>
        <span class="mx-4 text-soft">/</span>
        <span class="text-sm font-semibold text-primary">Configuracion</span>
        <span class="mx-4 text-soft">/</span>
        <span class="text-sm font-semibold text-muted">{{ activeItem.label }}</span>
      </div>

      <BillingSettingsPage
        v-if="activeView === 'summary'"
        :core-base-url="coreBaseUrl"
        :auth-token="authToken"
        :detail-mode="true"
        @company-selected="setSelectedCompany"
        @company-cleared="clearSelectedCompany"
        @company-view-changed="setCompanyView"
      />

      <section v-else class="rounded-lg border border-line bg-surface p-6 shadow-surface">
        <div class="flex flex-col gap-2 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-muted">Configuracion</p>
            <h1 class="mt-1 text-2xl font-bold text-text">{{ activeItem.label }}</h1>
            <p class="mt-1 text-sm text-muted">{{ activeItem.detail }}</p>
          </div>
          <span class="rounded-md bg-surface-muted px-3 py-1 text-xs font-bold uppercase text-muted">Placeholder</span>
        </div>

        <div v-if="activeView === 'requests'" class="mt-6 grid gap-4 lg:grid-cols-3">
          <article class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Nueva sucursal</p>
            <p class="mt-2 text-sm leading-6 text-muted">Solicita creacion de sucursales adicionales. El limite operativo para usuarios es casa matriz y 2 sucursales adicionales.</p>
          </article>
          <article class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Certificados fiscales</p>
            <p class="mt-2 text-sm leading-6 text-muted">Solicita cambio o renovacion de certificado, credenciales MH o firmador.</p>
          </article>
          <article class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Correlativos</p>
            <p class="mt-2 text-sm leading-6 text-muted">Solicita revision de series o puntos de venta cuando necesites asistencia administrativa.</p>
          </article>
        </div>

        <div v-else-if="activeView === 'profile'" class="mt-6 grid gap-4 md:grid-cols-2">
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Datos editables</p>
            <p class="mt-2 text-sm leading-6 text-muted">Nombre, nombre comercial visible, telefono, direccion y correo de contacto iran aqui.</p>
          </div>
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Datos protegidos</p>
            <p class="mt-2 text-sm leading-6 text-muted">NIT, NRC, fiscalidad, certificados, sucursales y correlativos se manejaran por solicitud.</p>
          </div>
        </div>

        <div v-else-if="activeView === 'subscription'" class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-xs font-bold uppercase text-muted">Plan</p>
            <p class="mt-2 text-lg font-bold text-text">Pendiente</p>
          </div>
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-xs font-bold uppercase text-muted">Dias restantes</p>
            <p class="mt-2 text-lg font-bold text-text">Pendiente</p>
          </div>
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-xs font-bold uppercase text-muted">Caducidad</p>
            <p class="mt-2 text-lg font-bold text-text">Pendiente</p>
          </div>
        </div>

        <div v-else-if="activeView === 'printer'" class="mt-6 rounded-md border border-line bg-surface-muted p-4">
          <p class="text-sm font-bold text-text">Configuracion de impresora</p>
          <p class="mt-2 text-sm leading-6 text-muted">Aqui configuraremos preferencias locales de impresion, formato y dispositivo predeterminado.</p>
        </div>

        <div v-else-if="activeView === 'security'" class="mt-6 rounded-md border border-line bg-surface-muted p-4">
          <p class="text-sm font-bold text-text">Cambio de contrasena</p>
          <p class="mt-2 text-sm leading-6 text-muted">Aqui ira el flujo para actualizar contrasena y revisar accesos activos.</p>
        </div>

        <div v-else class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Correo</p>
            <p class="mt-2 text-sm text-muted">soporte@stelfaro.com</p>
          </div>
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">WhatsApp</p>
            <p class="mt-2 text-sm text-muted">Pendiente</p>
          </div>
          <div class="rounded-md border border-line bg-surface-muted p-4">
            <p class="text-sm font-bold text-text">Horario</p>
            <p class="mt-2 text-sm text-muted">Pendiente</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
