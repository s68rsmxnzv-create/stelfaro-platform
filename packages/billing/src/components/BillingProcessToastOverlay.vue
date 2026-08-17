<script setup lang="ts">
import { computed } from 'vue';
import { UiCloseCircleIcon } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  open: boolean;
  variant?: 'loading' | 'success' | 'warning' | 'error';
  title: string;
  message?: string | null;
  closeLabel?: string;
}>(), {
  variant: 'loading',
  message: '',
  closeLabel: 'Cerrar'
});

defineEmits<{
  close: [];
}>();

const accentClass = computed(() => {
  if (props.variant === 'success') return 'bg-success';
  if (props.variant === 'warning') return 'bg-warning';
  if (props.variant === 'error') return 'bg-danger';
  return 'bg-primary';
});

const titleClass = computed(() => {
  if (props.variant === 'success') return 'text-success';
  if (props.variant === 'warning') return 'text-warning';
  if (props.variant === 'error') return 'text-danger';
  return 'text-primary';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[9999] grid place-items-center bg-overlay px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div class="flex w-full max-w-sm overflow-hidden rounded-lg bg-surface shadow-xl shadow-surface">
        <div class="flex w-12 shrink-0 items-center justify-center" :class="accentClass">
          <svg
            v-if="variant === 'success'"
            class="h-6 w-6 fill-current text-primary-contrast"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM16.6667 28.3333L8.33337 20L10.6834 17.65L16.6667 23.6166L29.3167 10.9666L31.6667 13.3333L16.6667 28.3333Z" />
          </svg>

          <svg
            v-else-if="variant === 'warning'"
            class="h-6 w-6 fill-current text-primary-contrast"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM21.6667 28.3333H18.3334V25H21.6667V28.3333ZM21.6667 21.6666H18.3334V11.6666H21.6667V21.6666Z" />
          </svg>

          <svg
            v-else-if="variant === 'error'"
            class="h-6 w-6 fill-current text-primary-contrast"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM27.0667 24.7166L24.7167 27.0666L20 22.35L15.2834 27.0666L12.9334 24.7166L17.65 20L12.9334 15.2833L15.2834 12.9333L20 17.65L24.7167 12.9333L27.0667 15.2833L22.35 20L27.0667 24.7166Z" />
          </svg>

          <span v-else class="flex gap-1.5" aria-hidden="true">
            <span class="size-2 animate-bounce rounded-full bg-primary-contrast"></span>
            <span class="size-2 animate-bounce rounded-full bg-primary-contrast [animation-delay:0.2s]"></span>
            <span class="size-2 animate-bounce rounded-full bg-primary-contrast [animation-delay:0.4s]"></span>
          </span>
        </div>

        <div class="min-w-0 flex-1 px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold" :class="titleClass">{{ title }}</p>
              <p v-if="message" class="mt-1 break-words text-sm text-muted">{{ message }}</p>
            </div>

            <button
              v-if="variant !== 'loading'"
              class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-soft hover:bg-surface-muted hover:text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
              type="button"
              :aria-label="closeLabel"
              @click="$emit('close')"
            >
              <UiCloseCircleIcon class="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
