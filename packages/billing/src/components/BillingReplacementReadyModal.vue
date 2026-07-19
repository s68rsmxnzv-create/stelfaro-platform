<script setup lang="ts">
import type { DteDraftSummary } from '@stelfaro/api-client';
import { UiButton } from '@stelfaro/ui';
import { CircleCheck } from 'lucide-vue-next';
import BillingModalShell from './BillingModalShell.vue';

defineProps<{
  open: boolean;
  source: DteDraftSummary;
  replacement: DteDraftSummary;
}>();

defineEmits<{
  close: [];
  continue: [];
}>();
</script>

<template>
  <BillingModalShell
    :open="open"
    title="Nuevo comprobante recibido"
    description="El nuevo comprobante está listo. Ahora puedes completar la invalidación del documento original."
    max-width="max-w-xl"
    close-label="Cerrar y continuar después"
    @close="$emit('close')"
  >
    <div class="flex gap-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-success/30 dark:bg-success-soft">
      <CircleCheck class="h-7 w-7 shrink-0 text-emerald-600 dark:text-success" aria-hidden="true" />
      <div>
        <p class="font-semibold text-emerald-950 dark:text-text">El documento fue recibido correctamente.</p>
        <p class="mt-1 text-sm text-emerald-800 dark:text-muted">Continúa para solicitar la invalidación del comprobante que estás corrigiendo.</p>
      </div>
    </div>

    <dl class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-line dark:bg-surface-muted">
        <dt class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Documento original</dt>
        <dd class="mt-1 break-all text-sm font-semibold text-slate-950 dark:text-text">{{ source.numeroControl }}</dd>
      </div>
      <div class="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-line dark:bg-surface-muted">
        <dt class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Nuevo documento</dt>
        <dd class="mt-1 break-all text-sm font-semibold text-slate-950 dark:text-text">{{ replacement.numeroControl }}</dd>
      </div>
    </dl>

    <template #footer>
      <UiButton type="button" @click="$emit('continue')">Continuar con la invalidación</UiButton>
    </template>
  </BillingModalShell>
</template>
