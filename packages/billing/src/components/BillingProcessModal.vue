<script setup lang="ts">
export type BillingProcessLogEntry = {
  message?: string;
  label?: string;
  status: 'ok' | 'error';
};

withDefaults(defineProps<{
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

defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-8">
      <div class="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
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
              @click="$emit('close')"
            >
              {{ closeLabel }}
            </button>
          </div>
        </div>

        <div class="min-h-0 overflow-y-auto px-6 py-5">
          <div class="flex items-center gap-4 rounded-md border border-sky-100 bg-sky-50 p-4">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white">
              <span v-if="processing" class="h-4 w-4 animate-ping rounded-full bg-sky-500"></span>
              <span v-else-if="rejected" class="h-4 w-4 rounded-full bg-red-500"></span>
              <span v-else-if="accepted" class="h-4 w-4 rounded-full bg-emerald-500"></span>
              <span v-else class="h-4 w-4 rounded-full bg-red-500"></span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-slate-950">{{ statusLabel }}</p>
              <p v-if="statusDetail" class="mt-1 break-all text-sm text-slate-600">{{ statusDetail }}</p>
            </div>
            <slot name="status-badge"></slot>
          </div>

          <div class="mt-4">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{{ progressLabel }}</span>
              <span>{{ progress }}%</span>
            </div>
            <div class="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-sky-600 transition-all"
                :class="processing ? 'animate-pulse' : rejected ? 'bg-red-500' : accepted ? 'bg-emerald-500' : ''"
                :style="{ width: `${progress}%` }"
              ></div>
            </div>

            <div v-if="logs.length" class="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <p class="text-xs font-semibold uppercase text-slate-500">Eventos</p>
              <ul class="mt-2 max-h-20 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                <li v-for="(entry, index) in logs" :key="`${entry.message ?? entry.label}-${index}`" class="flex items-start gap-2">
                  <span
                    class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                    :class="entry.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'"
                  >
                    {{ entry.status === 'error' ? 'x' : '✓' }}
                  </span>
                  <span>{{ entry.message ?? entry.label }}</span>
                </li>
              </ul>
            </div>
          </div>

          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
