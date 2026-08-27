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
  <div class="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-0 md:bottom-3 md:z-30 md:px-4">
    <section class="sheet-glass sf-invoice-bar pointer-events-auto mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-t-2xl px-4 pb-3 pt-3 text-text md:flex md:flex-wrap md:justify-between md:gap-2 md:rounded-lg md:px-3 md:py-2">
      <p class="text-xs font-semibold text-muted md:hidden">{{ lineCount }} línea{{ lineCount === 1 ? '' : 's' }} · {{ unitCount }} artículo{{ unitCount === 1 ? '' : 's' }}</p>
      <div class="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs md:flex">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-soft">Lineas</p>
          <p class="font-bold text-text">{{ lineCount }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-soft">Articulos</p>
          <p class="font-bold text-text">{{ unitCount }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-soft">Subtotal</p>
          <p class="font-bold text-text">{{ currency(subtotal) }}</p>
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-soft">Descuentos</p>
          <p class="font-bold" :class="discountTotal > 0 ? 'text-success' : 'text-text'">{{ currency(discountTotal) }}</p>
        </div>
        <div v-if="ivaTotal !== undefined">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-soft">IVA</p>
          <p class="font-bold text-text">{{ currency(ivaTotal) }}</p>
        </div>
        <div v-if="retentionTotal !== undefined && retentionTotal > 0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-soft">Retencion</p>
          <p class="font-bold text-warning">-{{ currency(retentionTotal) }}</p>
        </div>
      </div>
      <div class="contents md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
        <p v-if="issueDisabledReason" class="hidden max-w-sm rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning md:block">
          {{ issueDisabledReason }}
        </p>
        <div class="col-start-1 row-start-2 text-left text-text md:min-w-[140px] md:rounded-md md:bg-primary md:px-3 md:py-1.5 md:text-right md:text-primary-contrast md:shadow-sm md:shadow-surface">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-soft md:text-[11px] md:text-primary-contrast">Total</p>
          <p class="text-xl font-black text-text md:text-lg md:font-bold md:text-primary-contrast">{{ currency(totalLabel) }}</p>
        </div>
        <UiButton
          class="col-start-2 row-span-2 row-start-1 min-h-12 min-w-32 justify-center md:min-h-0 md:min-w-[140px]"
          :disabled="issueDisabled"
          :title="issueDisabledReason || undefined"
          @click="$emit('issue')"
        >
          <span class="md:hidden">{{ issuing ? 'Procesando…' : 'Continuar' }}</span>
          <span class="hidden md:inline">{{ issuing ? 'Emitiendo...' : 'Emitir ahora' }}</span>
        </UiButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
/*
 * En móvil esta barra convive con la tab bar del shell, que usa el glass
 * frosted plano (.sf-mobile-glass) en vez del filtro SVG url(#liquid-glass).
 * Igualamos el tratamiento aquí para que no desentone: sin displacement
 * (que además Safari ignora dejándola casi transparente) y con tinte fuerte.
 * En >=768px se mantiene .sheet-glass como el resto del escritorio.
 */
@media (max-width: 767.98px) {
  .sf-invoice-bar {
    background: color-mix(in oklab, var(--sf-color-surface) 82%, transparent);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
  }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .sf-invoice-bar {
      background: color-mix(in oklab, var(--sf-color-surface) 96%, transparent);
    }
  }
}

@media (max-width: 767.98px) and (prefers-reduced-transparency: reduce) {
  .sf-invoice-bar {
    background: var(--sf-color-surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
