<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient } from '@stelfaro/api-client';
import { computed, ref, watch } from 'vue';

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

const billingMenuOpen = ref(false);
const eventMenuOpen = ref(false);
const responsesMenuOpen = ref(false);
const documentTypes = ref([]);

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
const responseOptions = [
  { label: 'DTE', path: '/respuestas-mh', module: 'mh-responses' },
  { label: 'Eventos', path: '/respuestas-eventos-mh', module: 'mh-event-responses' }
];

const baseUrl = computed(() => props.appBaseUrl.replace(/\/$/, ''));
const responsesMenuActive = computed(() => ['mh-responses', 'mh-event-responses'].includes(props.module));
const hrefFor = (path) => `${baseUrl.value}${path}`;
const billingOptions = computed(() => {
  const source = documentTypes.value.length ? documentTypes.value : fallbackBillingTypes;

  return source
    .filter((type) => ['01', '03', '05', '06', '14'].includes(type.code))
    .map((type) => ({
      label: type.label,
      href: hrefFor(`/facturacion/${billingSlugByType[type.code] ?? 'fe'}`),
      slug: billingSlugByType[type.code] ?? 'fe',
      enabled: Boolean(type.implemented)
    }));
});

watch(() => props.authToken, async (token) => {
  if (!token) {
    documentTypes.value = [];
    return;
  }

  try {
    const context = await new CoreDteClient(props.coreBaseUrl, { authToken: token }).billingContext();
    const enabled = new Set(context.empresas.flatMap((empresa) => empresa.enabled_document_types ?? []));
    documentTypes.value = context.documentTypes.map((type) => ({
      ...type,
      implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code))
    }));
  } catch {
    documentTypes.value = [];
  }
}, { immediate: true });

function toggleBillingMenu() {
  const next = !billingMenuOpen.value;
  billingMenuOpen.value = next;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function toggleEventMenu() {
  const next = !eventMenuOpen.value;
  eventMenuOpen.value = next;
  billingMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function toggleResponsesMenu() {
  const next = !responsesMenuOpen.value;
  responsesMenuOpen.value = next;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
}
</script>

<template>
  <div class="hidden items-center gap-1 md:flex">
    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        :class="module === 'billing' ? 'bg-white text-[#0d1629] hover:bg-white hover:text-[#0d1629]' : ''"
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
        class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
      >
        <template v-for="option in billingOptions" :key="option.label">
          <a
            v-if="option.enabled"
            :href="option.href"
            class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
            :class="{ 'bg-sky-500 text-white shadow-sm shadow-sky-950/20': module === 'billing' && documentSlug === option.slug }"
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
        class="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        :class="module === 'mh-events' ? 'bg-white text-[#0d1629] hover:bg-white hover:text-[#0d1629]' : ''"
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
        class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
      >
        <a
          v-for="option in eventOptions"
          :key="option.label"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
          :class="{ 'bg-sky-500 text-white shadow-sm shadow-sky-950/20': module === 'mh-events' && eventSlug === option.slug }"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <div class="relative">
      <button
        class="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        :class="responsesMenuActive ? 'bg-white text-[#0d1629] hover:bg-white hover:text-[#0d1629]' : ''"
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
        class="absolute left-0 z-30 mt-2 w-44 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
      >
        <a
          v-for="option in responseOptions"
          :key="option.path"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
          :class="{ 'bg-sky-500 text-white shadow-sm shadow-sky-950/20': module === option.module }"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <a
      :href="hrefFor('/comprobantes')"
      class="rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
      :class="module === 'artifacts' ? 'bg-white text-[#0d1629] hover:bg-white hover:text-[#0d1629]' : ''"
    >
      Comprobantes
    </a>
  </div>
</template>
