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
    <section class="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/70 backdrop-blur">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lineas</p>
          <p class="font-bold text-slate-950">{{ lineCount }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Articulos</p>
          <p class="font-bold text-slate-950">{{ unitCount }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
          <p class="font-bold text-slate-950">{{ currency(subtotal) }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Descuentos</p>
          <p class="font-bold" :class="discountTotal > 0 ? 'text-emerald-700' : 'text-slate-950'">{{ currency(discountTotal) }}</p>
        </div>
      </div>
      <div class="min-w-[150px] rounded-md bg-slate-950 px-4 py-2 text-right text-white">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Total a pagar</p>
        <p class="text-lg font-bold">{{ currency(totalLabel) }}</p>
      </div>
    </section>
  </div>
</template>
