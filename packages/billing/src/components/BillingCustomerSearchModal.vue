<script setup lang="ts">
import type { BillingCustomer } from '@stelfaro/api-client';
import { UiSearchInput } from '@stelfaro/ui';
import { nextTick, ref, watch } from 'vue';
import BillingModalShell from './BillingModalShell.vue';

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  search: string;
  results: BillingCustomer[];
  selectedCustomerId: number | null;
}>();
const searchInput = ref<InstanceType<typeof UiSearchInput> | null>(null);

const emit = defineEmits<{
  close: [];
  clear: [];
  select: [customer: BillingCustomer];
  'update:search': [value: string];
}>();

function customerDocumentLabel(customer: BillingCustomer): string {
  const value = customer.document_number ?? customer.nit ?? '';
  const digits = value.replace(/\D+/g, '');
  const label = digits.length === 14 ? 'NIT' : digits.length === 9 ? 'DUI' : customer.document_type ?? 'Doc';

  if (digits.length === 9) {
    return `${label} ${digits.slice(0, 8)}-${digits.slice(8)}`;
  }

  if (digits.length === 14) {
    return `${label} ${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`;
  }

  return value ? `${label} ${value}` : 'Sin documento';
}

watch(() => props.open, async (open) => {
  if (!open) return;
  await nextTick();
  searchInput.value?.focus();
});
</script>

<template>
  <BillingModalShell
    :open="open"
    eyebrow="Receptor"
    title="Buscar cliente guardado"
    max-width="max-w-2xl"
    mobile-fullscreen
    body-class="flex min-h-0 flex-col px-4 py-3 md:block md:px-5 md:py-5"
    @close="emit('close')"
  >
    <div class="relative shrink-0">
      <UiSearchInput
        ref="searchInput"
        :model-value="search"
        autofocus
        label="Cliente"
        placeholder="Escribe al menos 2 caracteres"
        :show-button="false"
        @update:model-value="emit('update:search', $event)"
      />
      <button
        v-if="search"
        class="absolute bottom-1.5 right-1.5 grid size-9 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:text-soft dark:hover:bg-surface-muted dark:hover:text-text"
        type="button"
        aria-label="Limpiar busqueda"
        @click="emit('clear')"
      >
        x
      </button>
    </div>

    <div v-if="results.length" class="mt-3 min-h-0 flex-1 divide-y divide-slate-200 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white md:mt-4 md:max-h-80 md:flex-none md:rounded-md dark:divide-line dark:border-line dark:bg-surface-raised">
      <button
        v-for="customer in results"
        :key="customer.id"
        class="block w-full px-4 py-3 text-left transition hover:bg-sky-50 dark:hover:bg-primary-soft"
        :class="selectedCustomerId === customer.id ? 'bg-sky-50 dark:bg-primary-soft' : ''"
        type="button"
        @click="emit('select', customer)"
      >
        <span class="block font-semibold text-slate-950 dark:text-text">{{ customer.name }}</span>
        <span class="mt-1 block text-xs text-slate-500 dark:text-muted">
          {{ customerDocumentLabel(customer) }}
          <span v-if="customer.email"> · {{ customer.email }}</span>
          <span v-if="customer.phone"> · {{ customer.phone }}</span>
        </span>
      </button>
    </div>

    <p v-else-if="search.trim().length >= 2" class="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-500 dark:bg-surface-muted dark:text-muted">
      {{ loading ? 'Buscando clientes...' : 'Sin clientes encontrados para esa busqueda.' }}
    </p>
  </BillingModalShell>
</template>
