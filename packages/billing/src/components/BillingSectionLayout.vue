<script setup lang="ts">
import {
  Archive,
  ArrowLeftRight,
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

type NavItem = {
  id: string;
  label: string;
  detail: string;
  icon: string;
  group?: string;
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
const sidebarTooltip = ref<{ label: string; detail: string; top: number } | null>(null);

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
    security: ShieldCheck,
    support: MessageSquare,
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
  sidebarTooltip.value = null;
  compactSidebar.value = !compactSidebar.value;
}

function showSidebarTooltip(item: NavItem, event: FocusEvent | MouseEvent): void {
  if (!compactSidebar.value) return;

  const target = event.currentTarget as HTMLElement | null;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  sidebarTooltip.value = {
    label: item.label,
    detail: item.detail,
    top: Math.round(rect.top + (rect.height / 2))
  };
}

function hideSidebarTooltip(): void {
  sidebarTooltip.value = null;
}

const activeItem = computed(() => props.navItems.find((item) => item.id === props.activeId) ?? props.navItems[0]);
const homeSectionItem = computed(() => props.navItems[0] ?? null);
const canReturnToSectionHome = computed(() => Boolean(homeSectionItem.value && homeSectionItem.value.id !== props.activeId));
const navGroups = computed(() => {
  const groups: Array<{ label: string | null; items: NavItem[] }> = [];

  for (const item of props.navItems) {
    const label = item.group ?? null;
    let group = groups.find((candidate) => candidate.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
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

      <nav class="flex-1 overflow-y-auto py-5" :class="compactSidebar ? 'px-3' : 'px-4'" :aria-label="`Opciones de ${title}`">
        <div class="space-y-5">
          <div v-for="group in navGroups" :key="group.label ?? 'default'" class="space-y-1">
            <p v-if="group.label && !compactSidebar" class="px-3 pb-1 text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-soft">
              {{ group.label }}
            </p>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="group relative flex min-h-14 w-full items-center rounded-lg text-base transition"
              :aria-label="compactSidebar ? `${item.label}: ${item.detail}` : undefined"
              :class="[
                compactSidebar ? 'justify-center px-0' : 'gap-3 px-3 text-left',
                activeId === item.id ? 'bg-slate-100 font-bold text-slate-950 shadow-sm shadow-slate-950/5 dark:bg-surface-muted dark:text-text' : 'font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text'
              ]"
              @mouseenter="showSidebarTooltip(item, $event)"
              @mouseleave="hideSidebarTooltip"
              @focus="showSidebarTooltip(item, $event)"
              @blur="hideSidebarTooltip"
              @click="emit('select', item.id)"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="activeId === item.id ? 'bg-white text-sky-700 dark:bg-surface-raised dark:text-primary' : 'text-slate-500 dark:text-soft'">
                <component :is="iconComponent(item.icon)" class="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <span v-if="!compactSidebar" class="min-w-0">
                <span class="block truncate">{{ item.label }}</span>
                <span class="block truncate text-xs font-medium text-slate-500 dark:text-soft">{{ item.detail }}</span>
              </span>
            </button>
          </div>
        </div>
      </nav>
    </aside>

    <div
      v-if="sidebarTooltip && compactSidebar"
      class="pointer-events-none fixed left-[5.75rem] z-[60] min-w-44 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow-lg shadow-slate-950/10 dark:border-line dark:bg-surface-raised dark:shadow-black/30"
      :style="{ top: `${sidebarTooltip.top}px` }"
      role="tooltip"
    >
      <span class="block whitespace-nowrap text-sm font-bold text-slate-950 dark:text-text">{{ sidebarTooltip.label }}</span>
      <span class="mt-0.5 block whitespace-nowrap text-xs font-medium text-slate-500 dark:text-soft">{{ sidebarTooltip.detail }}</span>
    </div>

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
