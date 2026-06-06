<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoreDteClient, type BillingDocumentType } from '@stelfaro/api-client';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const mobileOpen = ref(false);
const userMenuOpen = ref(false);
const billingMenuOpen = ref(false);
const documentTypes = ref<BillingDocumentType[]>([]);
const isPublicLayout = computed(() => Boolean(route.meta.public));
const nav = computed(() => [
  { label: 'Dashboard', to: '/', show: true },
  { label: 'Onboarding fiscal', to: '/onboarding', show: auth.isBackoffice },
  { label: 'Empresas', to: '/companies', show: auth.isBackoffice }
].filter((item) => item.show));
const fallbackBillingTypes: BillingDocumentType[] = [
  { code: '01', label: 'Consumidor final', version: 2, implemented: true },
  { code: '03', label: 'Credito fiscal', version: 2, implemented: true },
  { code: '14' as BillingDocumentType['code'], label: 'Sujeto excluido', version: 2, implemented: false },
  { code: '05' as BillingDocumentType['code'], label: 'Nota de credito', version: 2, implemented: false },
  { code: '06' as BillingDocumentType['code'], label: 'Nota de debito', version: 2, implemented: false }
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
const pageTitle = computed(() => {
  if (route.path.startsWith('/billing')) {
    const currentDte = billingOptions.value.find((item) => item.to === route.path);
    return currentDte?.label ?? 'Facturacion';
  }

  if (route.path === '/mh-responses') {
    return 'Respuestas MH';
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
      implemented: Boolean(type.implemented) && (enabled.size === 0 || enabled.has(type.code)),
    }));
  } catch {
    documentTypes.value = [];
  }
}, { immediate: true });

async function logout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <RouterView v-if="isPublicLayout" />

  <div v-else class="min-h-screen bg-slate-100 text-slate-950">
    <nav class="bg-slate-900 shadow-sm">
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
                  class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                  :class="route.path.startsWith('/billing') ? 'bg-slate-950/70 text-white' : ''"
                  type="button"
                  @click="billingMenuOpen = !billingMenuOpen"
                >
                  Facturacion
                </button>

                <div
                  v-if="billingMenuOpen"
                  class="absolute left-0 z-30 mt-2 w-56 rounded-md bg-white py-1 shadow-lg outline outline-1 outline-black/5"
                >
                  <template v-for="option in billingOptions" :key="option.label">
                    <RouterLink
                      v-if="option.enabled"
                      :to="option.to"
                      class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      active-class="bg-sky-50 text-sky-700"
                    >
                      {{ option.label }}
                    </RouterLink>
                    <span v-else class="block cursor-not-allowed px-4 py-2 text-sm text-slate-400">
                      {{ option.label }}
                    </span>
                  </template>
                </div>
              </div>

              <RouterLink
                v-if="!auth.isBackoffice"
                to="/mh-responses"
                class="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                active-class="bg-slate-950/70 text-white"
              >
                Respuestas MH
              </RouterLink>
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
                @click="userMenuOpen = !userMenuOpen"
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
                  class="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  {{ option.label }}
                </RouterLink>
                <span v-else class="block rounded-md px-3 py-2 text-sm font-medium text-slate-500">
                  {{ option.label }}
                </span>
              </template>
            </div>
          </div>

          <RouterLink
            v-if="!auth.isBackoffice"
            to="/mh-responses"
            class="block rounded-md px-3 py-2 text-base font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            active-class="bg-slate-950/70 text-white"
          >
            Respuestas MH
          </RouterLink>
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
