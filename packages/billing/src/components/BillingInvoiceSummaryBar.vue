<script setup lang="ts">
import { currency } from '@stelfaro/shared';

defineProps<{
  lineCount: number;
  unitCount: number;
  subtotal: number;
  discountTotal: number;
  totalLabel: number;
}>();
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
    <section class="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-950/95 px-4 py-3 text-white shadow-xl shadow-slate-950/25 backdrop-blur">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
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
      </div>
      <div class="min-w-[150px] rounded-md bg-sky-600 px-4 py-2 text-right text-white shadow-sm shadow-sky-950/30">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-sky-100">Total a pagar</p>
        <p class="text-lg font-bold">{{ currency(totalLabel) }}</p>
      </div>
    </section>
  </div>
</template>
