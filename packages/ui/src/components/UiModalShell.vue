<script setup lang="ts">
import UiCloseButton from './UiCloseButton.vue';

withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string | null;
  maxWidth?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  mobileFullscreen?: boolean;
}>(), {
  description: null,
  maxWidth: 'max-w-2xl',
  closeLabel: 'Cerrar',
  closeOnBackdrop: true,
  mobileFullscreen: false
});

const emit = defineEmits<{
  close: [];
}>();

function closeFromBackdrop(closeOnBackdrop: boolean): void {
  if (closeOnBackdrop) {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="sf-safe-overlay fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 backdrop-blur-sm"
      :class="mobileFullscreen ? 'sf-safe-overlay-full' : ''"
      @click.self="closeFromBackdrop(closeOnBackdrop)"
    >
      <section
        class="w-full border border-blue-100 bg-white text-slate-950 shadow-2xl shadow-slate-950/25 dark:border-line dark:bg-surface dark:text-text dark:shadow-black/30"
        :class="[maxWidth, mobileFullscreen ? 'flex h-full max-h-full flex-col rounded-none md:h-auto md:max-h-[calc(100dvh-3rem)] md:rounded-md' : 'rounded-md']"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-line sm:px-5 sm:py-4">
          <div class="min-w-0">
            <p class="text-lg font-bold text-slate-950 dark:text-text">{{ title }}</p>
            <p v-if="description" class="mt-1 text-sm text-slate-500 dark:text-muted">{{ description }}</p>
          </div>
          <UiCloseButton :label="closeLabel" @click="emit('close')" />
        </header>

        <div :class="mobileFullscreen ? 'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5' : 'px-5 py-5'">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-line">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>
