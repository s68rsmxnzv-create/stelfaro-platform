<script setup lang="ts">
// @ts-nocheck
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  /** 'auto' caps at 70vh, 'tall' uses 90vh with internal scroll. */
  size: { type: String, default: 'auto' },
});
const emit = defineEmits(['close']);

const panelRef = ref(null);
const dragOffset = ref(0);
let dragStartY = null;

watch(
  () => props.open,
  (open) => {
    if (open) {
      dragOffset.value = 0;
      nextTick(() => panelRef.value?.focus());
    }
  },
);

function onKeydown(event) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

function onTouchStart(event) {
  dragStartY = event.touches[0].clientY;
}

function onTouchMove(event) {
  if (dragStartY === null) return;
  const delta = event.touches[0].clientY - dragStartY;
  dragOffset.value = Math.max(0, delta);
}

function onTouchEnd() {
  if (dragOffset.value > 96) {
    emit('close');
  }
  dragOffset.value = 0;
  dragStartY = null;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sf-sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex flex-col justify-end md:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Menú'"
        @keydown="onKeydown"
      >
        <button
          type="button"
          class="absolute inset-0 bg-overlay"
          aria-label="Cerrar"
          @click="emit('close')"
        />

        <div
          ref="panelRef"
          tabindex="-1"
          class="sheet-glass relative flex w-full flex-col rounded-t-3xl border-t border-line pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-2 outline-none"
          :class="size === 'tall' ? 'max-h-[90vh]' : 'max-h-[70vh]'"
          :style="{
            transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
            transition: dragOffset ? 'none' : undefined,
          }"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div
            class="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong"
            aria-hidden="true"
          />

          <div
            v-if="title"
            class="flex shrink-0 items-center justify-between px-2 pb-2"
          >
            <h2 class="text-base font-bold text-text">{{ title }}</h2>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-surface-muted text-soft active:bg-surface-strong"
              aria-label="Cerrar"
              @click="emit('close')"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sf-sheet-enter-active,
.sf-sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sf-sheet-enter-active > div:last-child,
.sf-sheet-leave-active > div:last-child {
  transition: transform 0.2s ease-out;
}
.sf-sheet-enter-from,
.sf-sheet-leave-to {
  opacity: 0;
}
.sf-sheet-enter-from > div:last-child,
.sf-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .sf-sheet-enter-active > div:last-child,
  .sf-sheet-leave-active > div:last-child {
    transition: none;
  }
  .sf-sheet-enter-from > div:last-child,
  .sf-sheet-leave-to > div:last-child {
    transform: none;
  }
}
</style>
