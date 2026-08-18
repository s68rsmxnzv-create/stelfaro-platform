<script setup lang="ts">
import type { DteDraftSummary } from '@stelfaro/api-client';
import { UiButton } from '@stelfaro/ui';

defineProps<{
  document: DteDraftSummary;
  retryable: boolean;
  retrying?: boolean;
  retrySucceeded?: boolean;
  errorMessage?: string | null;
}>();

defineEmits<{
  (event: 'retry'): void;
  (event: 'dismiss'): void;
}>();
</script>

<template>
  <section class="rounded-md border border-danger/40 bg-danger-soft/90 p-4 text-danger shadow-sm dark:border-danger/30">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-danger">Documento atascado</p>
        <p class="mt-1 font-semibold">
          {{ document.numeroControl }} quedó detenido durante su emisión.
        </p>
        <p v-if="document.errorMessage" class="mt-1 text-sm text-danger/90">
          {{ document.errorMessage }}
        </p>
        <p v-if="retrySucceeded" class="mt-2 text-sm font-semibold text-success">
          Se reintentó la emisión. Estado actual: {{ document.estado }}.
        </p>
        <p v-if="errorMessage" class="mt-2 text-sm font-semibold text-danger">
          {{ errorMessage }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UiButton
          v-if="retryable"
          variant="danger"
          size="sm"
          :disabled="retrying"
          @click="$emit('retry')"
        >
          {{ retrying ? 'Reintentando…' : 'Reintentar' }}
        </UiButton>
        <UiButton variant="ghost" size="sm" @click="$emit('dismiss')">Cerrar</UiButton>
      </div>
    </div>
  </section>
</template>
