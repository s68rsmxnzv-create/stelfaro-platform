<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import UiDotsVerticalIcon from './UiDotsVerticalIcon.vue';

const props = withDefaults(defineProps<{
  label?: string;
  menuWidth?: string;
  placement?: 'bottom' | 'top' | 'auto';
}>(), {
  label: 'Abrir acciones',
  menuWidth: 'w-52',
  placement: 'auto'
});

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const resolvedPlacement = ref<'bottom' | 'top'>('bottom');
const menuStyle = ref<Record<string, string>>({});

function toggle(): void {
  open.value = !open.value;
  if (open.value) {
    positionMenu();
  }
}

function close(): void {
  open.value = false;
}

function closeOnOutsidePointerDown(event: PointerEvent): void {
  if (!open.value) return;

  const target = event.target;
  if (target instanceof Node && root.value?.contains(target)) {
    return;
  }

  close();
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

function resolvePlacement(): void {
  if (props.placement !== 'auto') {
    resolvedPlacement.value = props.placement;
    return;
  }

  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;

  const menuHeight = menu.value?.offsetHeight ?? 160;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  resolvedPlacement.value = spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow ? 'top' : 'bottom';
}

function positionMenu(): void {
  if (!open.value) return;

  nextTick(() => {
    const rect = trigger.value?.getBoundingClientRect();
    const menuWidth = menu.value?.offsetWidth ?? 208;
    const menuHeight = menu.value?.offsetHeight ?? 160;
    if (!rect) return;

    resolvePlacement();

    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      Math.max(8, window.innerWidth - menuWidth - 8)
    );
    const top = resolvedPlacement.value === 'top'
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.max(8, Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 4));

    menuStyle.value = {
      left: `${left}px`,
      top: `${top}px`
    };
  });
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
  window.addEventListener('keydown', closeOnEscape);
  window.addEventListener('resize', positionMenu);
  window.addEventListener('scroll', positionMenu, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true);
  window.removeEventListener('keydown', closeOnEscape);
  window.removeEventListener('resize', positionMenu);
  window.removeEventListener('scroll', positionMenu, true);
});
</script>

<template>
  <div ref="root" class="relative flex justify-start md:justify-end">
    <button
      ref="trigger"
      type="button"
      class="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-line dark:bg-surface-raised dark:text-muted dark:shadow-none dark:hover:border-line-strong dark:hover:bg-surface-muted dark:hover:text-text dark:focus:ring-primary-soft"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="label"
      @click="toggle"
    >
      <UiDotsVerticalIcon class="h-5 w-5" />
    </button>

    <div
      v-if="open"
      ref="menu"
      class="fixed z-[70] rounded-md border border-slate-200 bg-white py-2 text-sm shadow-xl shadow-slate-950/10 dark:border-line dark:bg-surface dark:shadow-black/25"
      :class="[
        menuWidth,
        resolvedPlacement === 'top' ? 'origin-bottom-right' : 'origin-top-right'
      ]"
      :style="{ visibility: menuStyle.top ? 'visible' : 'hidden', ...menuStyle }"
      @click="close"
    >
      <slot />
    </div>
  </div>
</template>
