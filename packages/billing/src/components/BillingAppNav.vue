<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient } from '@stelfaro/api-client';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getBillingContext, peekBillingContext } from '../support/billingDataCache';

const props = defineProps({
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
  billingBasePath: {
    type: String,
    default: '/facturacion'
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
  billingContextCacheScope: {
    type: String,
    default: 'default'
  },
  extraNavItems: {
    type: Array,
    default: () => []
  },
  mobile: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['navigate']);

const operationalMenuOpen = ref(false);
const billingMenuOpen = ref(false);
const managementMenuOpen = ref(false);
const eventMenuOpen = ref(false);
const responsesMenuOpen = ref(false);
const artifactsMenuOpen = ref(false);
const fiscalReportsMenuOpen = ref(false);
const navRef = ref(null);
const documentTypes = ref([]);
const enabledEventTypes = ref([]);
const userRole = ref('');

const billingSlugByType = {
  '01': 'fe',
  '03': 'ccf',
  '14': 'se',
  '05': 'nc',
  '06': 'nd'
};
const fallbackBillingTypes = [
  { code: '01', label: 'Consumidor final', implemented: true },
  { code: '03', label: 'Credito fiscal', implemented: true },
  { code: '14', label: 'Sujeto excluido', implemented: true },
  { code: '05', label: 'Nota de credito', implemented: true },
  { code: '06', label: 'Nota de debito', implemented: true }
];
const eventOptions = [
  { label: 'Invalidacion', path: '/eventos-mh/invalidacion', slug: 'invalidacion' },
  { label: 'Contingencia', path: '/eventos-mh/contingencia', slug: 'contingencia' },
  { label: 'Retorno', path: '/eventos-mh/retorno', slug: 'retorno' },
  { label: 'Operaciones especiales', path: '/eventos-mh/operaciones-especiales', slug: 'operaciones-especiales' }
];
const eventTypeBySlug = {
  invalidacion: 'invalidacion',
  contingencia: 'contingencia',
  retorno: 'retorno',
  'operaciones-especiales': 'operaciones_especiales'
};
const responseOptions = [
  { label: 'DTE', path: '/respuestas-mh', module: 'mh-responses' },
  { label: 'Eventos', path: '/respuestas-eventos-mh', module: 'mh-event-responses' }
];
const artifactOptions = [
  { label: 'DTE', path: '/comprobantes/dte', slug: 'dte' },
  { label: 'Eventos', path: '/comprobantes/eventos', slug: 'eventos' }
];

const baseUrl = computed(() => props.appBaseUrl.replace(/\/$/, ''));
const responsesMenuActive = computed(() => ['mh-responses', 'mh-event-responses'].includes(props.module));
const artifactsMenuActive = computed(() => props.module === 'artifacts');
const fiscalReportsMenuActive = computed(() => ['annexes', 'iva-books'].includes(props.module));
const operationalMenuActive = computed(() => props.extraNavItems.some((item) => item.active));
const managementMenuActive = computed(() => ['customers', 'catalog', 'inventory', 'cash', 'commercial-orders', 'follow-ups'].includes(props.module));
const hrefFor = (path) => `${baseUrl.value}${path}`;
const fiscalReportOptions = computed(() => [
  { label: 'Anexos', href: hrefFor('/anexos'), module: 'annexes' },
  { label: 'Libros de IVA', href: hrefFor('/libros-iva'), module: 'iva-books' }
]);
const managementOptions = computed(() => [
  { label: 'Órdenes y cotizaciones', href: hrefFor('/ordenes-trabajo'), module: 'commercial-orders' },
  { label: 'Caja', href: hrefFor('/caja'), module: 'cash' },
  { label: 'Pendientes', href: hrefFor('/pendientes'), module: 'follow-ups' },
  { label: 'Clientes', href: hrefFor('/clientes'), module: 'customers' },
  { label: 'Catálogo', href: hrefFor('/catalogo'), module: 'catalog' },
  { label: 'Inventario', href: hrefFor('/inventario'), module: 'inventory', newTab: true }
]);
const billingOptions = computed(() => {
  const source = documentTypes.value.length ? documentTypes.value : fallbackBillingTypes;

  return source
    .filter((type) => ['01', '03', '05', '06', '14'].includes(type.code))
    .map((type) => ({
      label: type.label,
      href: hrefFor(`${props.billingBasePath}/${billingSlugByType[type.code] ?? 'fe'}`),
      slug: billingSlugByType[type.code] ?? 'fe',
      enabled: Boolean(type.implemented)
    }));
});
const visibleEventOptions = computed(() => {
  const enabled = new Set(enabledEventTypes.value);

  return eventOptions.filter((option) => enabled.size === 0 || enabled.has(eventTypeBySlug[option.slug]));
});

onMounted(() => {
  document.addEventListener('pointerdown', closeMenusOnOutsidePointerDown, true);
  window.addEventListener('keydown', closeMenusOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeMenusOnOutsidePointerDown, true);
  window.removeEventListener('keydown', closeMenusOnEscape);
});

watch(() => props.authToken, async (token) => {
  if (!token) {
    documentTypes.value = [];
    enabledEventTypes.value = [];
    return;
  }

  const cached = peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope);
  if (cached) {
    applyBillingContext(cached);
  }

  try {
    const context = await getBillingContext(
      new CoreDteClient(props.coreBaseUrl, { authToken: token }),
      props.coreBaseUrl,
      props.billingContextCacheScope
    );
    applyBillingContext(context);
  } catch {
    documentTypes.value = [];
    enabledEventTypes.value = [];
  }
}, { immediate: true });

function applyBillingContext(context) {
    const enabled = new Set(context.empresas.flatMap((empresa) => empresa.enabled_document_types ?? []));
    enabledEventTypes.value = Array.from(new Set(context.empresas.flatMap((empresa) => empresa.enabled_event_types ?? [])));
    userRole.value = context.user?.role ?? '';
    documentTypes.value = context.documentTypes.map((type) => ({
      ...type,
      implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code))
    }));
}

function toggleOperationalMenu() {
  const next = !operationalMenuOpen.value;
  operationalMenuOpen.value = next;
  billingMenuOpen.value = false;
  managementMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  artifactsMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function toggleBillingMenu() {
  const next = !billingMenuOpen.value;
  billingMenuOpen.value = next;
  operationalMenuOpen.value = false;
  managementMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  artifactsMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function toggleManagementMenu() {
  const next = !managementMenuOpen.value;
  managementMenuOpen.value = next;
  operationalMenuOpen.value = false;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  artifactsMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function toggleEventMenu() {
  const next = !eventMenuOpen.value;
  eventMenuOpen.value = next;
  operationalMenuOpen.value = false;
  billingMenuOpen.value = false;
  managementMenuOpen.value = false;
  responsesMenuOpen.value = false;
  artifactsMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function toggleResponsesMenu() {
  const next = !responsesMenuOpen.value;
  responsesMenuOpen.value = next;
  operationalMenuOpen.value = false;
  billingMenuOpen.value = false;
  managementMenuOpen.value = false;
  eventMenuOpen.value = false;
  artifactsMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function toggleArtifactsMenu() {
  const next = !artifactsMenuOpen.value;
  artifactsMenuOpen.value = next;
  operationalMenuOpen.value = false;
  billingMenuOpen.value = false;
  managementMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function toggleFiscalReportsMenu() {
  const next = !fiscalReportsMenuOpen.value;
  fiscalReportsMenuOpen.value = next;
  operationalMenuOpen.value = false;
  billingMenuOpen.value = false;
  managementMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  artifactsMenuOpen.value = false;
}

function closeMenus() {
  operationalMenuOpen.value = false;
  billingMenuOpen.value = false;
  managementMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
  artifactsMenuOpen.value = false;
  fiscalReportsMenuOpen.value = false;
}

function closeMenusOnOutsidePointerDown(event) {
  if (!operationalMenuOpen.value && !billingMenuOpen.value && !managementMenuOpen.value && !eventMenuOpen.value && !responsesMenuOpen.value && !artifactsMenuOpen.value && !fiscalReportsMenuOpen.value) return;
  if (navRef.value?.contains(event.target)) return;

  closeMenus();
}

function closeMenusOnEscape(event) {
  if (event.key === 'Escape') {
    closeMenus();
  }
}

function navigate(event, href) {
  closeMenus();
  emit('navigate', { event, href });
}
</script>

<template>
  <div
    ref="navRef"
    :class="mobile ? 'billing-nav--mobile flex flex-col items-stretch gap-1' : 'hidden items-center gap-1 md:flex'"
  >
    <div v-if="extraNavItems.length" class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="operationalMenuActive ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleOperationalMenu"
      >
        Taller
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="operationalMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="operationalMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-52 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <a
          v-for="item in extraNavItems"
          :key="item.href"
          :href="item.href"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
          :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': item.active }"
          @click="navigate($event, item.href)"
        >
          {{ item.label }}
        </a>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="module === 'billing' ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleBillingMenu"
      >
        Facturacion
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="billingMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="billingMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <template v-for="option in billingOptions" :key="option.label">
          <a
            v-if="option.enabled"
            :href="option.href"
            class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
            :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': module === 'billing' && documentSlug === option.slug }"
            @click="navigate($event, option.href)"
          >
            {{ option.label }}
          </a>
          <span v-else class="block cursor-not-allowed rounded-md px-3 py-2 text-sm font-semibold text-slate-500">
            {{ option.label }}
          </span>
        </template>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="module === 'mh-events' ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleEventMenu"
      >
        Eventos
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="eventMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="eventMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <a
          v-for="option in visibleEventOptions"
          :key="option.label"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
          :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': module === 'mh-events' && eventSlug === option.slug }"
          @click="navigate($event, hrefFor(option.path))"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="responsesMenuActive ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleResponsesMenu"
      >
        Respuestas
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="responsesMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="responsesMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-44 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <a
          v-for="option in responseOptions"
          :key="option.path"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
          :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': module === option.module }"
          @click="navigate($event, hrefFor(option.path))"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="artifactsMenuActive ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleArtifactsMenu"
      >
        Comprobantes
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="artifactsMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="artifactsMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-44 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <a
          v-for="option in artifactOptions"
          :key="option.path"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
          :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': module === 'artifacts' && artifactSlug === option.slug }"
          @click="navigate($event, hrefFor(option.path))"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="fiscalReportsMenuActive ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleFiscalReportsMenu"
      >
        Fiscal
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="fiscalReportsMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="fiscalReportsMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-48 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <a
          v-for="option in fiscalReportOptions"
          :key="option.href"
          :href="option.href"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
          :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': module === option.module }"
          @click="navigate($event, option.href)"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        :class="managementMenuActive ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
        type="button"
        @click="toggleManagementMenu"
      >
        Gestión
        <span
          class="h-1.5 w-1.5 rotate-45 border-b-2 border-r-2 border-current text-slate-400 transition"
          :class="managementMenuOpen ? 'rotate-[225deg]' : ''"
          aria-hidden="true"
        />
      </button>

      <div
        v-if="managementMenuOpen"
        class="sf-app-menu absolute left-0 z-30 mt-2 w-52 rounded-lg border border-white/10 p-2 shadow-xl shadow-surface ring-1 ring-primary/10"
      >
        <a
          v-for="option in managementOptions"
          :key="option.href"
          :href="option.href"
          :target="option.newTab ? '_blank' : undefined"
          :rel="option.newTab ? 'noopener noreferrer' : undefined"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-primary/15 hover:text-white"
          :class="{ '!bg-primary !text-primary-contrast shadow-sm shadow-surface': module === option.module }"
          @click="option.newTab ? closeMenus() : navigate($event, option.href)"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

  </div>
</template>

<style scoped>
.billing-nav--mobile > div,
.billing-nav--mobile > a {
  width: 100%;
}

.billing-nav--mobile > div > button {
  width: 100%;
  justify-content: space-between;
}

.billing-nav--mobile :deep(.sf-app-menu) {
  position: static !important;
  width: 100% !important;
  margin-top: 0.25rem;
  box-shadow: none;
}
</style>
