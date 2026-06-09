<script setup lang="ts">
import type { BillingCustomer } from '@stelfaro/api-client';
import { UiButton, UiSearchInput } from '@stelfaro/ui';

defineProps<{
  open: boolean;
  loading?: boolean;
  search: string;
  results: BillingCustomer[];
  selectedCustomerId: number | null;
}>();

const emit = defineEmits<{
  close: [];
  clear: [];
  select: [customer: BillingCustomer];
  'update:search': [value: string];
}>();

function customerDocumentLabel(customer: BillingCustomer): string {
  const value = customer.nit ?? customer.document_number ?? '';
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
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-6">
      <section class="w-full max-w-2xl rounded-md bg-white shadow-2xl">
        <div class="border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Receptor</p>
              <h2 class="mt-1 text-xl font-bold text-slate-950">Buscar cliente guardado</h2>
              <p class="mt-1 text-sm text-slate-500">Busca por DUI, NIT, nombre, correo o telefono.</p>
            </div>
            <button
              class="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              type="button"
              @click="emit('close')"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div class="px-6 py-5">
          <div class="relative">
            <UiSearchInput
              :model-value="search"
              label="Cliente"
              placeholder="Escribe al menos 2 caracteres"
              :show-button="false"
              @update:model-value="emit('update:search', $event)"
            />
            <button
              v-if="search"
              class="absolute bottom-1.5 right-1.5 grid size-9 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              type="button"
              aria-label="Limpiar busqueda"
              @click="emit('clear')"
            >
              x
            </button>
          </div>

          <div v-if="results.length" class="mt-4 max-h-80 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 bg-white">
            <button
              v-for="customer in results"
              :key="customer.id"
              class="block w-full px-4 py-3 text-left transition hover:bg-sky-50"
              :class="selectedCustomerId === customer.id ? 'bg-sky-50' : ''"
              type="button"
              @click="emit('select', customer)"
            >
              <span class="block font-semibold text-slate-950">{{ customer.name }}</span>
              <span class="mt-1 block text-xs text-slate-500">
                {{ customerDocumentLabel(customer) }}
                <span v-if="customer.email"> · {{ customer.email }}</span>
                <span v-if="customer.phone"> · {{ customer.phone }}</span>
              </span>
            </button>
          </div>

          <p v-else class="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-500">
            {{ search.trim().length < 2 ? 'Escribe al menos 2 caracteres para buscar.' : loading ? 'Buscando clientes...' : 'Sin clientes encontrados para esa busqueda.' }}
          </p>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <UiButton variant="secondary" type="button" @click="emit('close')">Cerrar</UiButton>
        </div>
      </section>
    </div>
  </Teleport>
</template>
