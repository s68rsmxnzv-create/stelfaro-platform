<script setup lang="ts">
import { currency } from '@stelfaro/shared';
import { UiButton } from '@stelfaro/ui';

defineProps<{
  lineCount: number;
  total: number;
  taxTotal?: number;
  depositAmount?: number;
  saveDisabled?: boolean;
  saving?: boolean;
  isEditing?: boolean;
  cancelHref: string;
}>();

defineEmits<{
  save: [];
}>();
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-0 md:bottom-3 md:px-4">
    <section class="pointer-events-auto mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-t-2xl border border-slate-700/70 bg-slate-950/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-xl shadow-slate-950/25 backdrop-blur md:flex md:flex-wrap md:justify-between md:gap-2 md:rounded-lg md:px-3 md:py-2">
      <p class="text-xs font-semibold text-slate-300 md:hidden">{{ lineCount }} línea{{ lineCount === 1 ? '' : 's' }}</p>
      <div class="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs md:flex">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lineas</p>
          <p class="font-bold text-white">{{ lineCount }}</p>
        </div>
        <div v-if="taxTotal !== undefined && taxTotal > 0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">IVA</p>
          <p class="font-bold text-white">{{ currency(taxTotal) }}</p>
        </div>
        <div v-if="depositAmount !== undefined && depositAmount > 0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Anticipo sugerido</p>
          <p class="font-bold text-white">{{ currency(depositAmount) }}</p>
        </div>
      </div>
      <div class="contents md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
        <a
          :href="cancelHref"
          class="hidden items-center rounded-md border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 md:inline-flex"
          >Cancelar</a
        >
        <div class="col-start-1 row-start-2 text-left text-white md:min-w-[140px] md:rounded-md md:bg-sky-600 md:px-3 md:py-1.5 md:text-right md:shadow-sm md:shadow-sky-950/30">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:text-[11px] md:text-sky-100">Total cotizado</p>
          <p class="text-xl font-black md:text-lg md:font-bold">{{ currency(total) }}</p>
        </div>
        <UiButton
          class="col-start-2 row-span-2 row-start-1 min-h-12 min-w-32 justify-center md:min-h-0 md:min-w-[160px]"
          :disabled="saveDisabled"
          @click="$emit('save')"
        >
          <span>{{ saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Guardar cotización" }}</span>
        </UiButton>
      </div>
    </section>
  </div>
</template>
