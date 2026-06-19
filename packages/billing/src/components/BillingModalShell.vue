<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { UiCloseCircleIcon } from '@stelfaro/ui';

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
  zIndexClass: 'z-50'
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
      :class="zIndexClass"
      @click.self="closeFromBackdrop"
    >
      <component
        :is="panelAs"
        class="flex w-full flex-col rounded-md border border-blue-100 bg-white shadow-2xl shadow-slate-950/25"
        :class="[maxWidth, panelClass]"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @submit.prevent="emit('submit')"
      >
        <header class="shrink-0 border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p v-if="eyebrow" class="text-sm font-semibold uppercase tracking-wide text-sky-700">{{ eyebrow }}</p>
              <h2 class="text-lg font-bold text-slate-950" :class="eyebrow ? 'mt-1' : ''">{{ title }}</h2>
              <p v-if="description" class="mt-1 text-sm text-slate-500">{{ description }}</p>
            </div>
            <button
              type="button"
              class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              :aria-label="closeLabel"
              :disabled="closeDisabled"
              @click="close"
            >
              <UiCloseCircleIcon class="h-6 w-6" />
            </button>
          </div>
        </header>

        <div :class="bodyClass">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="shrink-0 flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <slot name="footer" />
        </footer>
      </component>
    </div>
  </Teleport>
</template>
