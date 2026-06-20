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
  billingContextCacheScope: {
    type: String,
    default: 'default'
  }
});
const emit = defineEmits(['navigate']);

const billingMenuOpen = ref(false);
const eventMenuOpen = ref(false);
const responsesMenuOpen = ref(false);
const navRef = ref(null);
const documentTypes = ref([]);
const enabledEventTypes = ref([]);

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
  { label: 'Operaciones especiales', path: '/eventos-mh/operaciones-especiales', slug: 'operaciones-especiales' }
];
const eventTypeBySlug = {
  invalidacion: 'invalidacion',
  contingencia: 'contingencia',
  'operaciones-especiales': 'operaciones_especiales'
};
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
    documentTypes.value = context.documentTypes.map((type) => ({
      ...type,
      implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code))
    }));
}

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

function closeMenus() {
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
}

function closeMenusOnOutsidePointerDown(event) {
  if (!billingMenuOpen.value && !eventMenuOpen.value && !responsesMenuOpen.value) return;
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
  <div ref="navRef" class="hidden items-center gap-1 md:flex">
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
        class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
      >
        <template v-for="option in billingOptions" :key="option.label">
          <a
            v-if="option.enabled"
            :href="option.href"
            class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
            :class="{ 'bg-sky-500 text-white shadow-sm shadow-sky-950/20': module === 'billing' && documentSlug === option.slug }"
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
        class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
      >
        <a
          v-for="option in visibleEventOptions"
          :key="option.label"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
          :class="{ 'bg-sky-500 text-white shadow-sm shadow-sky-950/20': module === 'mh-events' && eventSlug === option.slug }"
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
        class="absolute left-0 z-30 mt-2 w-44 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl shadow-slate-950/30 ring-1 ring-sky-400/10"
      >
        <a
          v-for="option in responseOptions"
          :key="option.path"
          :href="hrefFor(option.path)"
          class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-sky-500/15 hover:text-white"
          :class="{ 'bg-sky-500 text-white shadow-sm shadow-sky-950/20': module === option.module }"
          @click="navigate($event, hrefFor(option.path))"
        >
          {{ option.label }}
        </a>
      </div>
    </div>

    <a
      :href="hrefFor('/comprobantes')"
      class="rounded-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
      :class="module === 'artifacts' ? 'bg-slate-950 text-white shadow-sm shadow-black/20' : ''"
      @click="navigate($event, hrefFor('/comprobantes'))"
    >
      Comprobantes
    </a>
  </div>
</template>
