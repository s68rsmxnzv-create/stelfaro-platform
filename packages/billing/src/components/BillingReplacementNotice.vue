<script setup lang="ts">
import type { DteDraftSummary } from '@stelfaro/api-client';
import { UiButton } from '@stelfaro/ui';

defineProps<{
  source: DteDraftSummary;
  issued: boolean;
  loading?: boolean;
}>();

defineEmits<{
  continue: [];
}>();
</script>

<template>
  <section class="rounded-md border border-sky-200 bg-sky-50/90 p-4 text-sky-950 shadow-sm dark:border-primary/30 dark:bg-primary-soft dark:text-text">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-primary">DTE sustituto</p>
        <p class="mt-1 font-semibold">Corrige la información conservando la operación original.</p>
        <p class="mt-1 truncate text-sm text-sky-800 dark:text-muted">
          {{ source.numeroControl }} · Las líneas idénticas de inventario ya entregadas no descontarán otra unidad.
        </p>
      </div>
      <UiButton v-if="issued" class="shrink-0" type="button" @click="$emit('continue')">
        Continuar invalidación
      </UiButton>
      <span v-else class="shrink-0 rounded bg-white/80 px-3 py-2 text-xs font-semibold text-sky-700 dark:bg-surface dark:text-primary">
        {{ loading ? 'Preparando…' : 'Pendiente de emitir' }}
      </span>
    </div>
  </section>
</template>
