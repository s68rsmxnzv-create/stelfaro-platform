<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  variant?: 'loading' | 'success' | 'warning';
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
  if (props.variant === 'success') return 'bg-emerald-500';
  if (props.variant === 'warning') return 'bg-amber-400';
  return 'bg-sky-600';
});

const titleClass = computed(() => {
  if (props.variant === 'success') return 'text-emerald-600';
  if (props.variant === 'warning') return 'text-amber-600';
  return 'text-sky-600';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/25 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div class="flex w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-xl shadow-slate-950/20">
        <div class="flex w-12 shrink-0 items-center justify-center" :class="accentClass">
          <svg
            v-if="variant === 'success'"
            class="h-6 w-6 fill-current text-white"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM16.6667 28.3333L8.33337 20L10.6834 17.65L16.6667 23.6166L29.3167 10.9666L31.6667 13.3333L16.6667 28.3333Z" />
          </svg>

          <svg
            v-else-if="variant === 'warning'"
            class="h-6 w-6 fill-current text-white"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M20 3.33331C10.8 3.33331 3.33337 10.8 3.33337 20C3.33337 29.2 10.8 36.6666 20 36.6666C29.2 36.6666 36.6667 29.2 36.6667 20C36.6667 10.8 29.2 3.33331 20 3.33331ZM21.6667 28.3333H18.3334V25H21.6667V28.3333ZM21.6667 21.6666H18.3334V11.6666H21.6667V21.6666Z" />
          </svg>

          <span v-else class="flex gap-1.5" aria-hidden="true">
            <span class="size-2 animate-bounce rounded-full bg-white"></span>
            <span class="size-2 animate-bounce rounded-full bg-white [animation-delay:0.2s]"></span>
            <span class="size-2 animate-bounce rounded-full bg-white [animation-delay:0.4s]"></span>
          </span>
        </div>

        <div class="min-w-0 flex-1 px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold" :class="titleClass">{{ title }}</p>
              <p v-if="message" class="mt-1 break-words text-sm text-slate-600">{{ message }}</p>
            </div>

            <button
              v-if="variant !== 'loading'"
              class="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              type="button"
              @click="$emit('close')"
            >
              {{ closeLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
