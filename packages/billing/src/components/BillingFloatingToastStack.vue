<script setup lang="ts">
import { computed } from 'vue';

export type BillingFloatingToast = {
  id: number | string;
  title: string;
  message?: string | null;
  variant?: 'success' | 'warning' | 'error' | 'info';
};

const props = withDefaults(defineProps<{
  toasts: BillingFloatingToast[];
}>(), {
  toasts: () => []
});

const dotClass = (variant: BillingFloatingToast['variant']): string => {
  if (variant === 'warning') return 'bg-amber-400';
  if (variant === 'error') return 'bg-rose-500';
  if (variant === 'info') return 'bg-sky-500';
  return 'bg-emerald-500';
};

const titleClass = (variant: BillingFloatingToast['variant']): string => {
  if (variant === 'warning') return 'text-amber-700';
  if (variant === 'error') return 'text-rose-700';
  if (variant === 'info') return 'text-sky-700';
  return 'text-emerald-700';
};

const animationClass = (variant: BillingFloatingToast['variant']): string => (
  variant === 'success' || !variant ? 'stelfaro-floating-toast-success' : 'stelfaro-floating-toast'
);

const visibleToasts = computed(() => props.toasts.slice(-4));
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-[25vh] right-4 z-[10000] grid w-[min(360px,calc(100vw-2rem))] gap-2">
      <div
        v-for="toast in visibleToasts"
        :key="toast.id"
        class="pointer-events-auto rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-950/10"
        :class="animationClass(toast.variant)"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-start gap-3">
          <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :class="dotClass(toast.variant)"></span>
          <span class="min-w-0">
            <span class="block text-sm font-bold" :class="titleClass(toast.variant)">{{ toast.title }}</span>
            <span v-if="toast.message" class="mt-1 block text-sm leading-5 text-slate-600">{{ toast.message }}</span>
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.stelfaro-floating-toast {
  animation: stelfaro-toast-rise 4.2s ease forwards;
}

.stelfaro-floating-toast-success {
  animation: stelfaro-toast-rise-quick 4s ease forwards;
}

@keyframes stelfaro-toast-rise {
  0% {
    opacity: 0;
    transform: translateY(16px);
  }
  12% {
    opacity: 1;
    transform: translateY(0);
  }
  78% {
    opacity: 1;
    transform: translateY(-14px);
  }
  100% {
    opacity: 0;
    transform: translateY(-34px);
  }
}

@keyframes stelfaro-toast-rise-quick {
  0% {
    opacity: 0;
    transform: translateY(14px);
  }
  8% {
    opacity: 1;
    transform: translateY(0);
  }
  82% {
    opacity: 1;
    transform: translateY(-8px);
  }
  100% {
    opacity: 0;
    transform: translateY(-22px);
  }
}
</style>
