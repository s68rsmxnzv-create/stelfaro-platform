<script setup lang="ts">
import { computed, ref } from 'vue';
import BillingSettingsPage from './BillingSettingsPage.vue';

type CompanyAction = 'summary' | 'edit-data' | 'edit-fiscal' | 'edit-sucursales' | 'edit-correlativos';
type CompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos';

defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
  appBaseUrl?: string;
  dashboardUrl?: string;
  billingContextCacheScope?: string;
}>();

const selectedCompany = ref<{ name: string; tradeName: string; documentLabel: string; lifecycleStatus: string } | null>(null);
const activeView = ref<CompanyView>('summary');
const companyAction = ref<{ action: CompanyAction; nonce: number } | null>(null);

const companyTitle = computed(() => selectedCompany.value?.tradeName || selectedCompany.value?.name || 'Mi empresa');

const navItems: Array<{
  id: CompanyView;
  label: string;
  detail: string;
  action: CompanyAction;
}> = [
  { id: 'summary', label: 'Resumen', detail: 'Estado general', action: 'summary' },
  { id: 'data', label: 'Empresa', detail: 'Datos, contacto y logo', action: 'edit-data' },
  { id: 'fiscal', label: 'Fiscalidad', detail: 'MH, certificado y firmador', action: 'edit-fiscal' },
  { id: 'sucursales', label: 'Sucursales', detail: 'Establecimientos y cajas', action: 'edit-sucursales' },
  { id: 'correlativos', label: 'Correlativos', detail: 'Series por punto de venta', action: 'edit-correlativos' }
];

function openView(item: (typeof navItems)[number]): void {
  activeView.value = item.id;

  companyAction.value = {
    action: item.action,
    nonce: Date.now()
  };
}

function setSelectedCompany(company: { name: string; tradeName: string; documentLabel: string; lifecycleStatus: string }): void {
  selectedCompany.value = company;
}

function clearSelectedCompany(): void {
  selectedCompany.value = null;
  activeView.value = 'summary';
  companyAction.value = null;
}

function setCompanyView(view: CompanyView): void {
  activeView.value = view;
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-[420px] border-r border-slate-200 bg-white lg:flex">
      <div class="flex w-24 flex-col border-r border-slate-200">
        <div class="grid h-16 place-items-center border-b border-slate-200">
          <span class="text-lg font-black tracking-tight text-slate-950">SF</span>
        </div>

        <nav class="flex-1 overflow-y-auto px-2 py-4" aria-label="Navegacion de configuracion">
          <a
            :href="dashboardUrl || appBaseUrl || '/'"
            class="flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="m4 11 8-7 8 7" />
              <path d="M6.5 10.5V20h11v-9.5" />
            </svg>
            Inicio
          </a>

          <a
            :href="`${appBaseUrl || ''}/facturacion`"
            class="mt-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h10" />
              <path d="M17 17h3M18.5 15.5v3" />
            </svg>
            Facturar
          </a>

          <a
            :href="`${appBaseUrl || ''}/comprobantes`"
            class="mt-1 flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M6 3h9l3 3v15H6z" />
              <path d="M14 3v4h4M9 12h6M9 16h6" />
            </svg>
            DTE
          </a>

          <button
            type="button"
            class="mt-1 flex w-full flex-col items-center gap-1 rounded-lg bg-slate-100 px-2 py-3 text-xs font-bold text-slate-950"
          >
            <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
            </svg>
            Config.
          </button>
        </nav>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Empresa</p>
          <p class="mt-1 truncate text-lg font-bold text-slate-950">{{ companyTitle }}</p>
          <p v-if="selectedCompany" class="mt-1 truncate text-xs font-semibold text-slate-500">{{ selectedCompany.documentLabel }}</p>
        </div>

        <nav class="flex-1 overflow-y-auto px-4 py-5" aria-label="Opciones de empresa">
          <div class="space-y-1">
            <button
              v-for="item in navItems"
              :key="item.id"
              type="button"
              class="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition"
              :class="activeView === item.id ? 'bg-slate-100 font-bold text-slate-950' : 'font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950'"
              @click="openView(item)"
            >
              <span class="grid h-[22px] w-[22px] place-items-center text-xs font-black" :class="activeView === item.id ? 'text-slate-950' : 'text-slate-600'">
                {{ item.label.slice(0, 2).toUpperCase() }}
              </span>
              <span class="min-w-0">
                <span class="block truncate">{{ item.label }}</span>
                <span class="block truncate text-xs font-medium text-slate-500">{{ item.detail }}</span>
              </span>
            </button>
          </div>
        </nav>
      </div>
    </aside>

    <main class="px-4 py-6 sm:px-6 lg:pl-[444px] lg:pr-8">
      <div class="mb-5 flex items-center overflow-x-auto whitespace-nowrap">
        <a :href="dashboardUrl || appBaseUrl || '/'" class="text-slate-600 transition hover:text-slate-950" aria-label="Inicio">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
          </svg>
        </a>
        <span class="mx-4 text-slate-400">/</span>
        <span class="text-sm font-semibold text-sky-700">Configuracion</span>
      </div>

      <BillingSettingsPage
        :core-base-url="coreBaseUrl"
        :auth-token="authToken"
        :detail-mode="true"
        :company-action="companyAction"
        @company-selected="setSelectedCompany"
        @company-cleared="clearSelectedCompany"
        @company-view-changed="setCompanyView"
      />
    </main>
  </div>
</template>
