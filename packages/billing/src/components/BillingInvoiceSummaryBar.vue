<script setup lang="ts">
import { currency } from '@stelfaro/shared';
import { UiButton } from '@stelfaro/ui';

defineProps<{
  lineCount: number;
  unitCount: number;
  subtotal: number;
  discountTotal: number;
  ivaTotal?: number;
  retentionTotal?: number;
  totalLabel: number;
  issueDisabled?: boolean;
  issuing?: boolean;
  issueDisabledReason?: string | null;
}>();

defineEmits<{
  issue: [];
}>();
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-3 z-30 px-4">
    <section class="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/70 bg-slate-950/95 px-3 py-2 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lineas</p>
          <p class="font-bold text-white">{{ lineCount }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Articulos</p>
          <p class="font-bold text-white">{{ unitCount }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subtotal</p>
          <p class="font-bold text-white">{{ currency(subtotal) }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Descuentos</p>
          <p class="font-bold" :class="discountTotal > 0 ? 'text-emerald-300' : 'text-white'">{{ currency(discountTotal) }}</p>
        </div>
        <div v-if="ivaTotal !== undefined">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">IVA</p>
          <p class="font-bold text-white">{{ currency(ivaTotal) }}</p>
        </div>
        <div v-if="retentionTotal !== undefined && retentionTotal > 0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Retencion</p>
          <p class="font-bold text-amber-300">-{{ currency(retentionTotal) }}</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <p v-if="issueDisabledReason" class="max-w-sm rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">
          {{ issueDisabledReason }}
        </p>
        <div class="min-w-[140px] rounded-md bg-sky-600 px-3 py-1.5 text-right text-white shadow-sm shadow-sky-950/30">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-sky-100">Total a pagar</p>
          <p class="text-lg font-bold">{{ currency(totalLabel) }}</p>
        </div>
        <UiButton
          class="min-w-[140px]"
          :disabled="issueDisabled"
          @click="$emit('issue')"
        >
          {{ issuing ? 'Emitiendo...' : 'Emitir ahora' }}
        </UiButton>
      </div>
    </section>
  </div>
</template>
