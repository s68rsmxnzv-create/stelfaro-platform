<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoreDteClient, type BillingDocumentType } from '@stelfaro/api-client';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const mobileOpen = ref(false);
const userMenuOpen = ref(false);
const billingMenuOpen = ref(false);
const eventMenuOpen = ref(false);
const responsesMenuOpen = ref(false);
const appNav = ref<HTMLElement | null>(null);
const documentTypes = ref<BillingDocumentType[]>([]);
const isPublicLayout = computed(() => Boolean(route.meta.public));
const nav = computed(() => [
  { label: 'Dashboard', to: '/', show: true },
  { label: 'Onboarding fiscal', to: '/onboarding', show: auth.isBackoffice },
  { label: auth.isBackoffice ? 'Empresas y configuracion fiscal' : 'Configuracion fiscal', to: '/companies', show: auth.canManageFiscalSettings }
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

  if (route.path === '/mh-responses') {
    return 'Respuestas MH';
  }

  if (route.path === '/mh-event-responses') {
    return 'Respuestas MH - Eventos';
  }

  const current = nav.value.find((item) => item.to === route.path);
  return current?.label ?? 'Billing';
});
const homePath = computed(() => auth.isBackoffice ? '/companies' : '/billing/fe');
const initials = computed(() => {
  const name = auth.user?.name ?? 'Stelfaro';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SF';
});

watch(() => route.fullPath, () => {
  mobileOpen.value = false;
  userMenuOpen.value = false;
  billingMenuOpen.value = false;
  eventMenuOpen.value = false;
  responsesMenuOpen.value = false;
});

watch(() => auth.token, async () => {
  if (!auth.token || auth.isBackoffice) {
    documentTypes.value = [];
    return;
  }

  try {
    const context = await new CoreDteClient('/api/v1', { authToken: auth.token }).billingContext();
    const enabled = new Set(context.empresas.flatMap((empresa) => empresa.enabled_document_types ?? []));
    documentTypes.value = context.documentTypes.map((type) => ({
      ...type,
      implemented: Boolean(type.implemented) && (['05', '06', '14'].includes(type.code) || enabled.size === 0 || enabled.has(type.code)),
    }));
  } catch {
    documentTypes.value = [];
  }
}, { immediate: true });

onMounted(() => {
  document.addEventListener('click', closeMenusOnOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenusOnOutsideClick);
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
</script>

<template>
  <RouterView v-if="isPublicLayout" />

  <div v-else class="min-h-screen bg-[#eaf7ff] text-slate-950">
    <nav ref="appNav" class="bg-slate-900 shadow-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center">
            <RouterLink :to="homePath" class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-md bg-sky-500 text-sm font-black text-white">SF</span>
              <span class="hidden text-sm font-semibold text-white sm:inline">Stelfaro Billing</span>
            </RouterLink>

            <div class="ml-10 hidden items-baseline gap-1 md:flex">
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
                  Eventos MH
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
                  class="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-white/5 hover:text-white"
                  :class="responsesMenuActive ? 'bg-slate-950/50 text-slate-100' : ''"
                  type="button"
                  @click="toggleResponsesMenu"
                >
                  Respuestas MH
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
            </div>
          </div>

          <div class="hidden items-center gap-4 md:flex">
            <RouterLink v-if="!auth.isBackoffice" to="/billing/fe" class="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400">
              Nueva factura
            </RouterLink>

            <div class="relative">
              <button
                class="flex max-w-xs items-center gap-3 rounded-full text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500"
                type="button"
                @click="toggleUserMenu"
              >
                <span class="sr-only">Abrir menu de usuario</span>
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white outline outline-1 -outline-offset-1 outline-white/10">
                  {{ initials }}
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
            <p class="text-base font-semibold text-white">Eventos MH</p>
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

          <div v-if="responseOptions.length" class="rounded-md px-3 py-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Respuestas MH</p>
            <div class="mt-1 space-y-1">
              <RouterLink
                v-for="option in responseOptions"
                :key="option.to"
                :to="option.to"
                class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                active-class="bg-slate-950/70 text-white"
              >
                {{ option.label }}
              </RouterLink>
            </div>
          </div>
        </div>
        <div class="border-t border-white/10 pb-3 pt-4">
          <div class="flex items-center px-5">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white outline outline-1 -outline-offset-1 outline-white/10">
              {{ initials }}
            </span>
            <div class="ml-3 min-w-0">
              <p class="truncate text-base font-medium text-white">{{ auth.user?.name }}</p>
              <p class="truncate text-sm font-medium text-slate-400">{{ auth.user?.email }}</p>
            </div>
          </div>
          <div class="mt-3 space-y-1 px-2">
            <RouterLink v-if="!auth.isBackoffice" to="/billing/fe" class="block rounded-md px-3 py-2 text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white">
              Nueva factura
            </RouterLink>
            <button class="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white" type="button" @click="logout">
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>

    <header class="relative bg-white shadow-sm">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 class="text-3xl font-bold tracking-tight text-slate-950">{{ pageTitle }}</h1>
      </div>
    </header>

    <main>
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
