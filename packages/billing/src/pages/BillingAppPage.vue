<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient } from '@stelfaro/api-client';
import { UiCloseCircleIcon, UiInfoIcon } from '@stelfaro/ui';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BillingSettingsPage from './BillingSettingsPage.vue';
import BillingWorkspace from './BillingWorkspace.vue';
import DteArtifactsPage from './DteArtifactsPage.vue';
import MhEventResponsesPage from './MhEventResponsesPage.vue';
import MhEventsPage from './MhEventsPage.vue';
import MhResponsesPage from './MhResponsesPage.vue';

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
  }
});

const dteHelpModalOpen = ref(false);
const contextLoading = ref(false);
const documentTypes = ref([]);
const billingCompanies = ref([]);

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
  billing: BillingWorkspace,
  artifacts: DteArtifactsPage,
  'mh-events': MhEventsPage,
  'mh-responses': MhResponsesPage,
  'mh-event-responses': MhEventResponsesPage,
  settings: BillingSettingsPage
};
const eventOptions = [
  { label: 'Invalidacion', slug: 'invalidacion' },
  { label: 'Contingencia', slug: 'contingencia' },
  { label: 'Retorno', slug: 'retorno' },
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
    coreBaseUrl: props.coreBaseUrl
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

  return baseProps;
});
const pageTitle = computed(() => {
  if (props.module === 'billing') {
    return billingOptions.value.find((item) => item.slug === props.documentSlug)?.label ?? 'Facturacion';
  }

  if (props.module === 'mh-events') {
    return eventOptions.find((item) => item.slug === props.eventSlug)?.label ?? 'Eventos MH';
  }

  if (props.module === 'artifacts') return 'Comprobantes';
  if (props.module === 'mh-responses') return 'Respuestas MH';
  if (props.module === 'mh-event-responses') return 'Respuestas MH - Eventos';
  if (props.module === 'settings') return 'Configuracion fiscal';

  return props.app.name;
});
const currentDteHelp = computed(() => (props.module === 'billing' ? dteHelpByType[selectedDocumentType.value] ?? null : null));

watch(() => props.authToken, async (token) => {
  if (!token) {
    documentTypes.value = [];
    billingCompanies.value = [];
    return;
  }

  contextLoading.value = true;

  try {
    const context = await new CoreDteClient(props.coreBaseUrl, { authToken: token }).billingContext();
    billingCompanies.value = context.empresas;
    const enabled = new Set(context.empresas.flatMap((empresa) => empresa.enabled_document_types ?? []));
    documentTypes.value = context.documentTypes.map((type) => ({
      ...type,
      implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code))
    }));
  } catch {
    documentTypes.value = [];
    billingCompanies.value = [];
  } finally {
    contextLoading.value = false;
  }
}, { immediate: true });

onMounted(() => {
  window.addEventListener('keydown', closeDteHelpOnEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeDteHelpOnEscape);
});

function closeDteHelpOnEscape(event) {
  if (event.key === 'Escape') {
    dteHelpModalOpen.value = false;
  }
}

function openDteHelpModal() {
  dteHelpModalOpen.value = true;
}
</script>

<template>
  <div class="bg-[#f6f8fb] text-slate-950">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-bold tracking-tight text-slate-950">{{ pageTitle }}</h1>
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

    <main>
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div v-if="!authToken" class="rounded-md border border-red-200 bg-red-50 p-5 text-red-700">
          No fue posible abrir la sesion fiscal.
        </div>
        <div v-else-if="contextLoading" class="rounded-md border border-slate-200 bg-white p-5 text-slate-600">
          Preparando contexto fiscal...
        </div>
        <component
          :is="selectedComponent"
          v-else
          v-bind="selectedComponentProps"
        />
      </div>
    </main>
  </div>
</template>
