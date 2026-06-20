<script setup lang="ts">
import { computed, ref } from 'vue';
import BillingSettingsPage from './BillingSettingsPage.vue';

type CompanyView = 'summary' | 'requests' | 'profile' | 'subscription' | 'printer' | 'security' | 'support';
type SettingsCompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos';

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
}> = [
  { id: 'summary', label: 'Resumen', detail: 'Informacion de empresa' },
  { id: 'requests', label: 'Solicitudes', detail: 'Cambios sensibles' },
  { id: 'profile', label: 'Perfil', detail: 'Datos de contacto' },
  { id: 'subscription', label: 'Suscripcion', detail: 'Plan y vigencia' },
  { id: 'printer', label: 'Impresora', detail: 'Preferencias locales' },
  { id: 'security', label: 'Seguridad', detail: 'Contrasena y acceso' },
  { id: 'support', label: 'Soporte', detail: 'Canales de ayuda' }
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
  <div class="min-h-screen bg-slate-50">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-80 flex-col border-r border-slate-200 bg-white lg:flex">
      <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-sm font-black tracking-tight text-white">SF</span>
        <span class="text-sm font-black uppercase tracking-wide text-slate-950">Configuracion</span>
      </div>

      <div class="border-b border-slate-200 px-6 py-5">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Empresa</p>
        <p class="mt-1 truncate text-lg font-bold text-slate-950">{{ companyTitle }}</p>
        <p v-if="selectedCompany" class="mt-1 truncate text-xs font-semibold text-slate-500">{{ selectedCompany.documentLabel }}</p>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-5" aria-label="Navegacion de configuracion">
        <div class="space-y-1">
          <a
            :href="dashboardUrl || appBaseUrl || '/'"
            class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="m4 11 8-7 8 7" />
              <path d="M6.5 10.5V20h11v-9.5" />
            </svg>
            Inicio
          </a>

          <a
            :href="`${appBaseUrl || ''}/facturacion`"
            class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h10" />
              <path d="M17 17h3M18.5 15.5v3" />
            </svg>
            Facturar
          </a>

          <a
            :href="`${appBaseUrl || ''}/comprobantes`"
            class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M6 3h9l3 3v15H6z" />
              <path d="M14 3v4h4M9 12h6M9 16h6" />
            </svg>
            DTE
          </a>
        </div>

        <div class="mt-6 border-t border-slate-200 pt-5">
          <p class="px-3 text-xs font-bold uppercase tracking-wide text-slate-500">Mi configuracion</p>
          <div class="mt-3 space-y-1">
            <button
              v-for="item in navItems"
              :key="item.id"
              type="button"
              class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition"
              :class="activeView === item.id ? 'bg-slate-100 font-bold text-slate-950' : 'font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950'"
              @click="openView(item)"
            >
              <span class="h-2 w-2 shrink-0 rounded-full" :class="activeView === item.id ? 'bg-sky-600' : 'bg-slate-300'" />
              <span class="min-w-0">
                <span class="block truncate">{{ item.label }}</span>
                <span class="block truncate text-xs font-medium text-slate-500">{{ item.detail }}</span>
              </span>
            </button>
          </div>
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
        <span class="text-sm font-semibold text-sky-700">Configuracion</span>
        <span class="mx-4 text-slate-400">/</span>
        <span class="text-sm font-semibold text-slate-700">{{ activeItem.label }}</span>
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

      <section v-else class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5">
        <div class="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Configuracion</p>
            <h1 class="mt-1 text-2xl font-bold text-slate-950">{{ activeItem.label }}</h1>
            <p class="mt-1 text-sm text-slate-500">{{ activeItem.detail }}</p>
          </div>
          <span class="rounded-md bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">Placeholder</span>
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

        <div v-else-if="activeView === 'subscription'" class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-xs font-bold uppercase text-slate-500">Plan</p>
            <p class="mt-2 text-lg font-bold text-slate-950">Pendiente</p>
          </div>
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-xs font-bold uppercase text-slate-500">Dias restantes</p>
            <p class="mt-2 text-lg font-bold text-slate-950">Pendiente</p>
          </div>
          <div class="rounded-md border border-slate-200 p-4">
            <p class="text-xs font-bold uppercase text-slate-500">Caducidad</p>
            <p class="mt-2 text-lg font-bold text-slate-950">Pendiente</p>
          </div>
        </div>

        <div v-else-if="activeView === 'printer'" class="mt-6 rounded-md border border-slate-200 p-4">
          <p class="text-sm font-bold text-slate-950">Configuracion de impresora</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">Aqui configuraremos preferencias locales de impresion, formato y dispositivo predeterminado.</p>
        </div>

        <div v-else-if="activeView === 'security'" class="mt-6 rounded-md border border-slate-200 p-4">
          <p class="text-sm font-bold text-slate-950">Cambio de contrasena</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">Aqui ira el flujo para actualizar contrasena y revisar accesos activos.</p>
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
