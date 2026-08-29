<script setup lang="ts">
import { PlatformClient, type PlatformStockByBranchItem } from '@stelfaro/api-client';
import { UiDataTable, UiLoadingMark, UiSearchInput } from '@stelfaro/ui';
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{
  platformSession?: Record<string, unknown> | null;
  platformBaseUrl?: string;
  appBaseUrl?: string;
  dashboardUrl?: string;
}>(), {
  platformSession: null,
  platformBaseUrl: '/api/v1',
  appBaseUrl: '',
  dashboardUrl: '',
});

const client = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const tenantId = computed(() => Number((props.platformSession as any)?.tenant?.id || 0));

const loading = ref(true);
const error = ref('');
const items = ref<PlatformStockByBranchItem[]>([]);
const query = ref('');

onMounted(load);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await client.value.inventoryStockByBranch(tenantId.value);
    items.value = response.data.items ?? [];
  } catch (caught) {
    error.value = caught instanceof Error && caught.message
      ? caught.message
      : 'No se pudieron cargar las existencias.';
  } finally {
    loading.value = false;
  }
}

/** Columnas de sucursal: unión de todas las sucursales presentes, ordenadas. */
const branches = computed(() => {
  const seen = new Map<number, { id: number; label: string }>();
  for (const item of items.value) {
    for (const row of item.by_branch) {
      if (!seen.has(row.sucursal_id)) {
        seen.set(row.sucursal_id, { id: row.sucursal_id, label: row.nombre || row.codigo || `Sucursal ${row.sucursal_id}` });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
});

const filteredItems = computed(() => {
  const q = query.value.trim().toLocaleLowerCase();
  if (!q) return items.value;
  return items.value.filter((item) => `${item.name} ${item.sku ?? ''}`.toLocaleLowerCase().includes(q));
});

function quantityFor(item: PlatformStockByBranchItem, sucursalId: number): number {
  return item.by_branch.find((row) => row.sucursal_id === sucursalId)?.quantity ?? 0;
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('es-SV', { maximumFractionDigits: 3 }).format(value || 0);
}
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-5">
    <div class="rounded-md border border-line bg-surface p-6 text-text shadow-sm shadow-surface dark:shadow-none">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-text">Existencias</h2>
          <p class="mt-1 text-sm text-muted">Consulta de stock por sucursal. Solo lectura.</p>
        </div>
        <div class="w-full max-w-xs">
          <UiSearchInput v-model="query" label="Buscar" hide-label placeholder="Nombre o código" />
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {{ error }}
    </div>

    <div class="overflow-hidden rounded-md border border-line bg-surface">
      <UiDataTable overflow="auto" :min-width="branches.length > 3 ? 'min-w-[880px]' : 'min-w-[520px]'">
        <thead class="border-b border-line text-xs uppercase text-soft">
          <tr>
            <th class="px-4 py-3 text-left">Producto</th>
            <th v-for="branch in branches" :key="branch.id" class="px-4 py-3 text-right">{{ branch.label }}</th>
            <th class="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-if="loading">
            <td class="px-4 py-8" :colspan="branches.length + 2"><UiLoadingMark label="Cargando existencias" /></td>
          </tr>
          <tr v-else-if="filteredItems.length === 0">
            <td class="px-4 py-8 text-center text-sm text-muted" :colspan="branches.length + 2">
              {{ items.length === 0 ? 'No hay productos con inventario.' : 'Sin coincidencias.' }}
            </td>
          </tr>
          <tr v-for="item in filteredItems" v-else :key="item.catalog_item_id" class="text-sm">
            <td class="px-4 py-3">
              <p class="font-semibold text-text">{{ item.name }}</p>
              <p class="mt-1 text-xs text-soft">{{ item.sku || 'Sin código' }}<span v-if="item.unit_name"> · {{ item.unit_name }}</span></p>
            </td>
            <td
              v-for="branch in branches"
              :key="branch.id"
              class="px-4 py-3 text-right font-mono tabular-nums"
              :class="quantityFor(item, branch.id) <= 0 ? 'text-soft' : 'text-text'"
            >
              {{ formatQty(quantityFor(item, branch.id)) }}
            </td>
            <td class="px-4 py-3 text-right font-mono font-semibold tabular-nums text-text">{{ formatQty(item.total) }}</td>
          </tr>
        </tbody>
      </UiDataTable>
    </div>
  </section>
</template>
