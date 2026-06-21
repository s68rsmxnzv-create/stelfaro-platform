<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import UiDotsVerticalIcon from './UiDotsVerticalIcon.vue';

withDefaults(defineProps<{
  label?: string;
  menuWidth?: string;
  placement?: 'bottom' | 'top';
}>(), {
  label: 'Abrir acciones',
  menuWidth: 'w-52',
  placement: 'bottom'
});

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
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

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
  window.addEventListener('keydown', closeOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true);
  window.removeEventListener('keydown', closeOnEscape);
});
</script>

<template>
  <div ref="root" class="relative flex justify-start md:justify-end">
    <button
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
      class="absolute right-auto z-30 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-xl shadow-slate-950/10 dark:border-line dark:bg-surface dark:shadow-black/25 md:right-0"
      :class="[
        menuWidth,
        placement === 'top'
          ? 'bottom-11 origin-bottom-left md:origin-bottom-right'
          : 'top-11 origin-top-left md:origin-top-right'
      ]"
      @click="close"
    >
      <slot />
    </div>
  </div>
</template>
