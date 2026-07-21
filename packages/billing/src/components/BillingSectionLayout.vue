<script setup lang="ts">
import {
  Archive,
  ArrowLeftRight,
  Banknote,
  Box,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileChartColumn,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  PackagePlus,
  PackageSearch,
  Printer,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  User,
  Warehouse,
  Wrench
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { UiHierarchicalSidebarNav, type UiSidebarNavEntry } from '@stelfaro/ui';

type NavItem = {
  id: string;
  label: string;
  detail: string;
  icon: string;
  group?: string;
  href?: string;
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
  collapsible?: boolean;
  sidebarStorageKey?: string;
}>(), {
  icon: 'summary',
  entityEyebrow: 'Empresa',
  entityDetail: null,
  homeHref: '/',
  collapsible: true,
  sidebarStorageKey: 'stelfaro:section-sidebar-compact'
});

const emit = defineEmits<{
  select: [id: string];
}>();

const compactSidebar = ref(false);
const sidebarWidthClass = computed(() => compactSidebar.value ? 'w-20' : 'w-80');
const mainOffsetClass = computed(() => compactSidebar.value ? 'lg:pl-24' : 'lg:pl-[344px]');

onMounted(() => {
  if (!props.collapsible) return;
  compactSidebar.value = window.localStorage.getItem(props.sidebarStorageKey) === 'compact';
});

watch(compactSidebar, (value) => {
  if (!props.collapsible) return;
  window.localStorage.setItem(props.sidebarStorageKey, value ? 'compact' : 'full');
});

function iconComponent(icon: string): Component {
  const icons: Record<string, Component> = {
    settings: Settings,
    inventory: Warehouse,
    summary: LayoutDashboard,
    requests: FileText,
    profile: User,
    subscription: CreditCard,
    printer: Printer,
    ticket: ReceiptText,
    security: ShieldCheck,
    support: MessageSquare,
    cash: Banknote,
    stock: PackageSearch,
    entries: PackagePlus,
    purchases: ReceiptText,
    lots: Layers,
    kardex: ListOrdered,
    reports: FileChartColumn,
    'report-document': FileChartColumn,
    alerts: TriangleAlert,
    transfers: ArrowLeftRight,
    counts: ClipboardList,
    adjustments: SlidersHorizontal,
    suppliers: Truck,
    box: Box,
    archive: Archive,
    tools: Wrench
  };

  return icons[icon] ?? LayoutDashboard;
}

function toggleSidebar(): void {
  if (!props.collapsible) return;
  compactSidebar.value = !compactSidebar.value;
}

function selectNavItem(id: string): void {
  const item = props.navItems.find((candidate) => candidate.id === id);
  if (item?.href) {
    window.location.assign(item.href);
    return;
  }
  emit('select', id);
}

const activeItem = computed(() => props.navItems.find((item) => item.id === props.activeId) ?? props.navItems[0]);
const homeSectionItem = computed(() => props.navItems[0] ?? null);
const canReturnToSectionHome = computed(() => Boolean(homeSectionItem.value && homeSectionItem.value.id !== props.activeId));
const hierarchicalEntries = computed<UiSidebarNavEntry[]>(() => {
  const entries: UiSidebarNavEntry[] = [];
  const groups = new Map<string, Extract<UiSidebarNavEntry, { children: unknown }>>();

  for (const item of props.navItems) {
    if (!item.group) {
      entries.push({ id: item.id, label: item.label, detail: item.detail, icon: item.icon });
      continue;
    }

    let group = groups.get(item.group);
    if (!group) {
      group = { id: `group:${item.group}`, label: item.group, detail: `Opciones de ${item.group.toLowerCase()}`, icon: item.icon, children: [] };
      groups.set(item.group, group);
      entries.push(group);
    }
    group.children.push({ id: item.id, label: item.label, detail: item.detail, icon: item.icon });
  }

  return entries;
});
</script>

<template>
  <div class="sf-app-background min-h-screen text-slate-950 dark:text-text">
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-line dark:bg-surface lg:flex"
      :class="sidebarWidthClass"
    >
      <div class="flex h-16 items-center border-b border-slate-200 dark:border-line" :class="compactSidebar ? 'justify-center px-3' : 'gap-3 px-6'">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-sky-600 text-white shadow-sm shadow-sky-900/20 dark:bg-primary">
          <component :is="iconComponent(icon)" class="h-5 w-5" aria-hidden="true" />
        </span>
        <span v-if="!compactSidebar" class="min-w-0 truncate text-sm font-black uppercase tracking-wide text-slate-950 dark:text-text">{{ title }}</span>
        <button
          v-if="collapsible && !compactSidebar"
          type="button"
          class="ml-auto grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-soft dark:hover:bg-surface-muted dark:hover:text-text"
          aria-label="Contraer barra lateral"
          title="Contraer"
          @click="toggleSidebar"
        >
          <ChevronLeft class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div v-if="!compactSidebar" class="border-b border-slate-200 px-6 py-5 dark:border-line">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">{{ entityEyebrow }}</p>
        <p class="mt-1 truncate text-lg font-bold text-slate-950 dark:text-text">{{ entityTitle }}</p>
        <p v-if="entityDetail" class="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-soft">{{ entityDetail }}</p>
      </div>
      <div v-else class="border-b border-slate-200 px-3 py-3 dark:border-line">
        <button
          type="button"
          class="grid h-10 w-full place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-soft dark:hover:bg-surface-muted dark:hover:text-text"
          aria-label="Expandir barra lateral"
          title="Expandir"
          @click="toggleSidebar"
        >
          <ChevronRight class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-5" :class="compactSidebar ? 'px-3' : 'px-4'">
        <UiHierarchicalSidebarNav :entries="hierarchicalEntries" :active-id="activeId" :compact="compactSidebar" @select="selectNavItem" @request-expand="compactSidebar = false">
          <template #icon="{ entry }"><component :is="iconComponent(entry.icon || 'summary')" class="h-[22px] w-[22px]" aria-hidden="true" /></template>
        </UiHierarchicalSidebarNav>
      </div>
    </aside>

    <main class="px-4 py-6 transition-[padding] duration-200 sm:px-6 lg:pr-8" :class="mainOffsetClass">
      <div class="mb-5 flex items-center overflow-x-auto whitespace-nowrap">
        <a :href="homeHref" class="text-slate-600 transition hover:text-slate-950 dark:text-soft dark:hover:text-text" aria-label="Inicio">
          <Home class="h-5 w-5" aria-hidden="true" />
        </a>
        <span class="mx-4 text-slate-400 dark:text-soft">/</span>
        <button
          v-if="canReturnToSectionHome"
          type="button"
          class="text-sm font-semibold text-sky-700 transition hover:text-sky-900 dark:text-primary dark:hover:text-text"
          @click="homeSectionItem && emit('select', homeSectionItem.id)"
        >
          {{ title }}
        </button>
        <span v-else class="text-sm font-semibold text-sky-700 dark:text-primary">{{ title }}</span>
        <span class="mx-4 text-slate-400 dark:text-soft">/</span>
        <span class="text-sm font-semibold text-slate-700 dark:text-muted">{{ activeItem?.label }}</span>
      </div>

      <slot />
    </main>
  </div>
</template>
