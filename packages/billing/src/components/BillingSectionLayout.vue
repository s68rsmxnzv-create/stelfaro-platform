<script setup lang="ts">
import { computed } from 'vue';

type NavItem = {
  id: string;
  label: string;
  detail: string;
  icon: string;
};

const props = withDefaults(defineProps<{
  title: string;
  icon?: string;
  entityEyebrow?: string;
  entityTitle: string;
  entityDetail?: string | null;
  navItems: NavItem[];
  activeId: string;
  homeHref?: string;
}>(), {
  icon: 'summary',
  entityEyebrow: 'Empresa',
  entityDetail: null,
  homeHref: '/'
});

const emit = defineEmits<{
  select: [id: string];
}>();

function iconPath(icon: string): string {
  const paths: Record<string, string> = {
    settings: 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z',
    inventory: 'M4 7l8-4 8 4-8 4-8-4ZM4 7v10l8 4 8-4V7M12 11v10',
    summary: 'M4 5h16M4 12h10M4 19h16M17 10h3v4h-3z',
    requests: 'M6 3h9l3 3v15H6z M14 3v4h4M9 13h6M9 17h4 m0-8 1.5 1.5L14 7',
    profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
    subscription: 'M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z M2 11h20M6 16h4',
    printer: 'M7 8V3h10v5 M6 17H5a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1 M7 14h10v7H7z',
    security: 'M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z M9.5 12.5 11 14l3.5-4',
    support: 'M4 5h16v11H7l-3 3z M9 9h6M9 13h4',
    stock: 'M4 7l8-4 8 4-8 4-8-4ZM4 7v10l8 4 8-4V7M12 11v10',
    entries: 'M12 3v12M8 7l4-4 4 4M5 21h14M6 15h12v6H6z',
    lots: 'M4 6h16v5H4zM4 13h16v5H4zM8 8h.01M8 15h.01',
    kardex: 'M5 5h14M5 12h14M5 19h14M9 3v18',
    adjustments: 'M12 3v18M3 12h18M6 6l12 12',
    suppliers: 'M4 7h11v10H4zM15 10h3l2 3v4h-5zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'
  };

  return paths[icon] ?? paths.summary;
}

const activeItem = computed(() => props.navItems.find((item) => item.id === props.activeId) ?? props.navItems[0]);
</script>

<template>
  <div class="sf-app-background min-h-screen text-slate-950 dark:text-text">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-80 flex-col border-r border-slate-200 bg-white dark:border-line dark:bg-surface lg:flex">
      <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-line">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-sky-600 text-white shadow-sm shadow-sky-900/20 dark:bg-primary">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="iconPath(icon)" />
          </svg>
        </span>
        <span class="text-sm font-black uppercase tracking-wide text-slate-950 dark:text-text">{{ title }}</span>
      </div>

      <div class="border-b border-slate-200 px-6 py-5 dark:border-line">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">{{ entityEyebrow }}</p>
        <p class="mt-1 truncate text-lg font-bold text-slate-950 dark:text-text">{{ entityTitle }}</p>
        <p v-if="entityDetail" class="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-soft">{{ entityDetail }}</p>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 py-5" :aria-label="`Opciones de ${title}`">
        <div class="space-y-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition"
            :class="activeId === item.id ? 'bg-slate-100 font-bold text-slate-950 shadow-sm shadow-slate-950/5 dark:bg-surface-muted dark:text-text' : 'font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text'"
            @click="emit('select', item.id)"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="activeId === item.id ? 'bg-white text-sky-700 dark:bg-surface-raised dark:text-primary' : 'text-slate-500 dark:text-soft'">
              <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="iconPath(item.icon)" />
              </svg>
            </span>
            <span class="min-w-0">
              <span class="block truncate">{{ item.label }}</span>
              <span class="block truncate text-xs font-medium text-slate-500 dark:text-soft">{{ item.detail }}</span>
            </span>
          </button>
        </div>
      </nav>
    </aside>

    <main class="px-4 py-6 sm:px-6 lg:pl-[344px] lg:pr-8">
      <div class="mb-5 flex items-center overflow-x-auto whitespace-nowrap">
        <a :href="homeHref" class="text-slate-600 transition hover:text-slate-950 dark:text-soft dark:hover:text-text" aria-label="Inicio">
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L4 10.414V17a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.586l.293.293a1 1 0 0 0 1.414-1.414l-7-7Z" />
          </svg>
        </a>
        <span class="mx-4 text-slate-400 dark:text-soft">/</span>
        <span class="text-sm font-semibold text-sky-700 dark:text-primary">{{ title }}</span>
        <span class="mx-4 text-slate-400 dark:text-soft">/</span>
        <span class="text-sm font-semibold text-slate-700 dark:text-muted">{{ activeItem?.label }}</span>
      </div>

      <slot />
    </main>
  </div>
</template>
