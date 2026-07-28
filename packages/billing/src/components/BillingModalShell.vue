<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { UiCloseButton } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  eyebrow?: string | null;
  description?: string | null;
  maxWidth?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeDisabled?: boolean;
  panelAs?: 'section' | 'form';
  panelClass?: string;
  bodyClass?: string;
  zIndexClass?: string;
  mobileFullscreen?: boolean;
}>(), {
  eyebrow: null,
  description: null,
  maxWidth: 'max-w-2xl',
  closeLabel: 'Cerrar',
  closeOnBackdrop: true,
  closeDisabled: false,
  panelAs: 'section',
  panelClass: '',
  bodyClass: 'px-5 py-5',
  zIndexClass: 'z-50',
  mobileFullscreen: false
});

const emit = defineEmits<{
  close: [];
  submit: [];
}>();

function close(): void {
  if (!props.closeDisabled) {
    emit('close');
  }
}

function closeFromBackdrop(): void {
  if (props.closeOnBackdrop) {
    close();
  }
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

watch(() => props.open, (open) => {
  if (open) {
    window.addEventListener('keydown', closeOnEscape);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeOnEscape);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      :class="[
        zIndexClass,
        mobileFullscreen ? 'place-items-stretch overflow-hidden p-0 md:place-items-center md:overflow-y-auto md:px-4 md:py-6' : ''
      ]"
      @click.self="closeFromBackdrop"
    >
      <component
        :is="panelAs"
        class="flex w-full flex-col rounded-md border border-blue-100 bg-white shadow-2xl shadow-slate-950/25 dark:border-line dark:bg-surface dark:shadow-black/40"
        :class="[
          maxWidth,
          panelClass,
          mobileFullscreen ? 'h-[100dvh] max-h-[100dvh] rounded-none border-0 md:h-auto md:max-h-[calc(100dvh-3rem)] md:rounded-md md:border' : ''
        ]"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @submit.prevent="emit('submit')"
      >
        <header
          class="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-line"
          :class="mobileFullscreen ? 'pt-[max(1rem,env(safe-area-inset-top))] md:pt-4' : ''"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p v-if="eyebrow" class="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-primary">{{ eyebrow }}</p>
              <h2 class="text-lg font-bold text-slate-950 dark:text-text" :class="eyebrow ? 'mt-1' : ''">{{ title }}</h2>
              <p v-if="description" class="mt-1 text-sm text-slate-500 dark:text-muted">{{ description }}</p>
            </div>
            <UiCloseButton :label="closeLabel" :disabled="closeDisabled" @click="close" />
          </div>
        </header>

        <div :class="[mobileFullscreen ? 'min-h-0 flex-1 overflow-hidden' : '', bodyClass]">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="shrink-0 flex justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-line">
          <slot name="footer" />
        </footer>
      </component>
    </div>
  </Teleport>
</template>
