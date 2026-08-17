<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { ref, watch } from 'vue';

export type UiSidebarNavItem = {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
  badge?: string | number;
};

export type UiSidebarNavGroup = {
  id: string;
  label: string;
  detail?: string;
  icon?: string;
  badge?: string | number;
  children: UiSidebarNavItem[];
};

export type UiSidebarNavEntry = UiSidebarNavItem | UiSidebarNavGroup;

const props = withDefaults(defineProps<{
  entries: UiSidebarNavEntry[];
  activeId: string;
  compact?: boolean;
}>(), {
  compact: false
});

const emit = defineEmits<{
  select: [id: string];
  requestExpand: [];
}>();

const openGroupId = ref<string | null>(null);

watch(() => [props.activeId, props.entries] as const, () => {
  const activeGroup = props.entries.find((entry) => isGroup(entry) && entry.children.some((child) => child.id === props.activeId));
  if (activeGroup && isGroup(activeGroup)) openGroupId.value = activeGroup.id;
}, { immediate: true, deep: true });

function isGroup(entry: UiSidebarNavEntry): entry is UiSidebarNavGroup {
  return 'children' in entry;
}

function isActive(entry: UiSidebarNavEntry): boolean {
  return entry.id === props.activeId || (isGroup(entry) && entry.children.some((child) => child.id === props.activeId));
}

function toggleGroup(group: UiSidebarNavGroup): void {
  if (props.compact) emit('requestExpand');
  openGroupId.value = openGroupId.value === group.id ? null : group.id;
}
</script>

<template>
  <nav class="space-y-1" aria-label="Navegación de sección">
    <template v-for="entry in entries" :key="entry.id">
      <div v-if="isGroup(entry)">
        <button
          type="button"
          class="group flex min-h-14 w-full items-center rounded-lg text-base transition"
          :class="[
            compact ? 'justify-center px-0' : 'gap-3 px-3 text-left',
            isActive(entry) ? 'bg-surface-muted font-bold text-text shadow-sm shadow-surface' : 'font-semibold text-muted hover:bg-surface-muted hover:text-text'
          ]"
          :aria-expanded="openGroupId === entry.id"
          :aria-label="compact ? `${entry.label}: ${entry.detail || ''}` : undefined"
          :title="compact ? entry.label : undefined"
          @click="toggleGroup(entry)"
        >
          <span class="relative grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="isActive(entry) ? 'bg-surface-raised text-primary' : 'text-soft'">
            <slot name="icon" :entry="entry" />
            <span v-if="compact && entry.badge" class="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black leading-none text-primary-contrast ring-2 ring-surface">{{ Number(entry.badge) > 99 ? '99+' : entry.badge }}</span>
          </span>
          <span v-if="!compact" class="min-w-0 flex-1">
            <span class="block truncate">{{ entry.label }}</span>
            <span v-if="entry.detail" class="block truncate text-xs font-medium text-soft">{{ entry.detail }}</span>
          </span>
          <span v-if="!compact && entry.badge" class="grid min-h-6 min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-black text-primary-contrast">{{ Number(entry.badge) > 99 ? '99+' : entry.badge }}</span>
          <ChevronRight v-if="!compact" class="h-4 w-4 shrink-0 text-soft transition" :class="openGroupId === entry.id ? 'rotate-90' : ''" />
        </button>

        <div v-if="!compact && openGroupId === entry.id" class="ml-[30px] border-l border-line py-1 pl-4">
          <button
            v-for="child in entry.children"
            :key="child.id"
            type="button"
            class="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] transition"
            :class="child.id === activeId ? 'bg-surface-muted font-bold text-text' : 'font-medium text-muted hover:bg-surface-muted hover:text-text'"
            @click="emit('select', child.id)"
          >
            <span v-if="child.icon" class="grid h-5 w-5 shrink-0 place-items-center text-soft"><slot name="icon" :entry="child" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ child.label }}</span>
              <span v-if="child.detail" class="block truncate text-xs font-normal text-soft">{{ child.detail }}</span>
            </span>
          </button>
        </div>
      </div>

      <button
        v-else
        type="button"
        class="group flex min-h-14 w-full items-center rounded-lg text-base transition"
        :class="[
          compact ? 'justify-center px-0' : 'gap-3 px-3 text-left',
          entry.id === activeId ? 'bg-surface-muted font-bold text-text shadow-sm shadow-surface' : 'font-semibold text-muted hover:bg-surface-muted hover:text-text'
        ]"
        :aria-label="compact ? `${entry.label}: ${entry.detail || ''}` : undefined"
        :title="compact ? entry.label : undefined"
        @click="emit('select', entry.id)"
      >
        <span class="relative grid h-9 w-9 shrink-0 place-items-center rounded-md" :class="entry.id === activeId ? 'bg-surface-raised text-primary' : 'text-soft'">
          <slot name="icon" :entry="entry" />
          <span v-if="compact && entry.badge" class="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black leading-none text-primary-contrast ring-2 ring-surface">{{ Number(entry.badge) > 99 ? '99+' : entry.badge }}</span>
        </span>
        <span v-if="!compact" class="min-w-0 flex-1">
          <span class="block truncate">{{ entry.label }}</span>
          <span v-if="entry.detail" class="block truncate text-xs font-medium text-soft">{{ entry.detail }}</span>
        </span>
        <span v-if="!compact && entry.badge" class="grid min-h-6 min-w-6 place-items-center rounded-full bg-danger px-1.5 text-xs font-black text-primary-contrast">{{ Number(entry.badge) > 99 ? '99+' : entry.badge }}</span>
      </button>
    </template>
  </nav>
</template>
