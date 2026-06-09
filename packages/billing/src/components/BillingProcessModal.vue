<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';

export type BillingProcessLogEntry = {
  message?: string;
  label?: string;
  status: 'ok' | 'error';
};

const props = withDefaults(defineProps<{
  open: boolean;
  eyebrow: string;
  title: string;
  subtitle?: string;
  processing?: boolean;
  accepted?: boolean;
  rejected?: boolean;
  statusLabel: string;
  statusDetail?: string | null;
  progress: number;
  progressLabel: string;
  logs?: BillingProcessLogEntry[];
  closeLabel?: string;
}>(), {
  subtitle: '',
  processing: false,
  accepted: false,
  rejected: false,
  statusDetail: '',
  logs: () => [],
  closeLabel: 'Cerrar'
});

const emit = defineEmits<{
  close: [];
}>();

const statusPanelClass = computed(() => {
  if (props.accepted) return 'border-emerald-100 bg-emerald-50';
  if (props.rejected) return 'border-rose-100 bg-rose-50';
  return 'border-sky-100 bg-sky-50';
});

const statusDotClass = computed(() => {
  if (props.processing) return 'animate-ping bg-sky-500';
  if (props.accepted) return 'bg-emerald-500';
  return 'bg-red-500';
});

type TimelineState = 'ok' | 'error' | 'processing' | 'pending';

const timelineItems = computed<Array<{
  key: string;
  title: string;
  detail: string;
  state: TimelineState;
}>>(() => {
  const items = props.logs.map((entry, index) => ({
    key: `${entry.message ?? entry.label}-${index}`,
    title: entry.message ?? entry.label ?? 'Evento',
    detail: entry.status === 'error' ? 'Detenido' : 'Completado',
    state: entry.status as TimelineState
  }));

  if (props.processing) {
    const lastTitle = items.at(-1)?.title;
    if (lastTitle !== props.statusLabel) {
      items.push({
        key: `processing-${props.statusLabel}`,
        title: props.statusLabel,
        detail: props.statusDetail || 'En proceso',
        state: 'processing'
      });
    }
  }

  if (items.length === 0) {
    items.push({
      key: `status-${props.statusLabel}`,
      title: props.statusLabel,
      detail: props.statusDetail || props.progressLabel,
      state: props.rejected ? 'error' : props.accepted ? 'ok' : 'pending'
    });
  }

  return items;
});

function timelineDotClass(state: string): string {
  if (state === 'error') return 'bg-red-500 ring-red-100';
  if (state === 'processing') return 'animate-pulse bg-sky-600 ring-sky-100';
  if (state === 'ok') return 'bg-emerald-500 ring-emerald-100';
  return 'bg-slate-300 ring-slate-100';
}

function close(): void {
  if (props.processing) return;
  emit('close');
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

watch(() => props.open, (open) => {
  if (open) {
    window.addEventListener('keydown', handleKeydown);
  } else {
    window.removeEventListener('keydown', handleKeydown);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-8">
      <div class="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl shadow-slate-950/25">
        <div class="border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">{{ eyebrow }}</p>
              <h2 class="mt-1 text-xl font-bold text-slate-950">{{ title }}</h2>
              <p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
            </div>
            <button
              class="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="processing"
              type="button"
              @click="close"
            >
              {{ closeLabel }}
            </button>
          </div>
        </div>

        <div class="min-h-0 overflow-y-auto px-6 py-5">
          <div class="flex items-center gap-4 rounded-md border p-4" :class="statusPanelClass">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-sm">
              <span class="h-4 w-4 rounded-full" :class="statusDotClass"></span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-slate-950">{{ statusLabel }}</p>
              <p v-if="statusDetail" class="mt-1 break-all text-sm text-slate-600">{{ statusDetail }}</p>
            </div>
            <slot name="status-badge"></slot>
          </div>

          <div class="mt-4 rounded-md border border-slate-200 bg-white px-4 py-4">
            <div class="mb-4 flex items-center justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ progressLabel }}</p>
              <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{{ progress }}%</span>
            </div>

            <div class="overflow-x-auto pb-1">
              <ol class="relative flex min-w-full gap-6 before:absolute before:left-0 before:top-1.5 before:h-0.5 before:w-full before:rounded-full before:bg-slate-200">
                <li
                  v-for="item in timelineItems"
                  :key="item.key"
                  class="relative min-w-[150px] flex-1"
                >
                  <span class="block size-3 rounded-full ring-8" :class="timelineDotClass(item.state)"></span>
                  <div class="mt-4">
                    <p class="text-xs font-medium uppercase text-slate-500">{{ item.detail }}</p>
                    <h3 class="mt-1 text-sm font-bold text-slate-950">{{ item.title }}</h3>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
