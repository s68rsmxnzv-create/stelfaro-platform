<script setup lang="ts">
import { computed, ref } from 'vue';
import BillingSettingsPage from './BillingSettingsPage.vue';

type CompanyAction = 'summary' | 'edit-data' | 'edit-fiscal' | 'edit-sucursales' | 'edit-correlativos';
type CompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos';

defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
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
  <div class="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
    <aside class="lg:sticky lg:top-24 lg:self-start">
      <div class="rounded-md border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
        <div class="border-b border-slate-200 px-4 py-4">
          <p class="text-xs font-bold uppercase text-slate-500">Configuracion</p>
          <h2 class="mt-1 truncate text-base font-bold text-slate-950">{{ companyTitle }}</h2>
          <p v-if="selectedCompany" class="mt-1 truncate text-xs text-slate-500">{{ selectedCompany.documentLabel }}</p>
        </div>

        <nav class="p-2" aria-label="Configuracion de empresa">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition"
            :class="activeView === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'"
            @click="openView(item)"
          >
            <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="activeView === item.id ? 'bg-sky-300' : 'bg-slate-300'"></span>
            <span class="min-w-0">
              <span class="block text-sm font-bold">{{ item.label }}</span>
              <span class="mt-0.5 block text-xs" :class="activeView === item.id ? 'text-slate-300' : 'text-slate-500'">{{ item.detail }}</span>
            </span>
          </button>
        </nav>
      </div>
    </aside>

    <section class="min-w-0">
      <BillingSettingsPage
        :core-base-url="coreBaseUrl"
        :auth-token="authToken"
        :detail-mode="true"
        :company-action="companyAction"
        @company-selected="setSelectedCompany"
        @company-cleared="clearSelectedCompany"
        @company-view-changed="setCompanyView"
      />
    </section>
  </div>
</template>
