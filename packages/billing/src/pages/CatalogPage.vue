<script setup lang="ts">
// @ts-nocheck
import { PlatformClient } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiInput, UiLoadingMark, UiModalShell, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { computed, onMounted, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import CatalogItemForm from '../components/CatalogItemForm.vue';
import CatalogModeBadge from '../components/CatalogModeBadge.vue';
import { catalogItemTypeOptions } from '../support/catalogOptions';

const props = withDefaults(defineProps<{
  platformSession?: Record<string, unknown> | null;
  platformBaseUrl?: string;
}>(), {
  platformSession: null,
  platformBaseUrl: '/api/v1'
});

const client = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const tenantId = computed(() => Number(props.platformSession?.tenant?.id || 0));
const tenantName = computed(() => props.platformSession?.tenant?.name ?? 'Empresa');
const categories = ref([]);
const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const editingItem = ref(null);
const categoryName = ref('');
const filters = ref({
  q: '',
  status: 'active',
  item_type: '',
  controls_inventory: ''
});
const toasts = ref([]);

const typeLabels = {
  product: 'Producto',
  service: 'Servicio',
  part: 'Repuesto',
  labor: 'Mano de obra',
  other: 'Otro'
};
const filterTypeOptions = [
  { value: '', label: 'Todos' },
  ...catalogItemTypeOptions.map((option) => ({ value: option.value, label: option.label }))
];
const statusOptions = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: '', label: 'Todos' }
];
const inventoryOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Con inventario' },
  { value: 'false', label: 'Solo catálogo' }
];
const stats = computed(() => ({
  total: items.value.length,
  inventory: items.value.filter((item) => item.controls_inventory).length,
  catalogOnly: items.value.filter((item) => !item.controls_inventory).length
}));

watch(tenantId, () => {
  loadCatalog();
});

onMounted(loadCatalog);

async function loadCatalog(): Promise<void> {
  if (!tenantId.value) return;

  loading.value = true;
  try {
    const [categoryResponse, itemResponse] = await Promise.all([
      client.value.catalogCategories(tenantId.value, { status: 'active' }),
      client.value.catalogItems(tenantId.value, normalizedFilters())
    ]);
    categories.value = categoryResponse.data;
    items.value = itemResponse.data;
  } catch (error) {
    notify('No se pudo cargar el catálogo', messageFromError(error), 'error');
  } finally {
    loading.value = false;
  }
}

function normalizedFilters(): Record<string, unknown> {
  return {
    q: filters.value.q || undefined,
    status: filters.value.status || undefined,
    item_type: filters.value.item_type || undefined,
    controls_inventory: filters.value.controls_inventory === '' ? undefined : filters.value.controls_inventory === 'true',
    per_page: 100
  };
}

function openCreate(): void {
  editingItem.value = null;
  modalOpen.value = true;
}

function openEdit(item): void {
  editingItem.value = item;
  modalOpen.value = true;
}

async function saveItem(payload): Promise<void> {
  if (!tenantId.value) return;

  saving.value = true;
  try {
    const newCategoryName = String(payload.new_category_name || '').trim();
    delete payload.new_category_name;

    if (newCategoryName) {
      const categoryResponse = await client.value.createCatalogCategory(tenantId.value, {
        name: newCategoryName,
        kind: kindForItemType(payload.item_type)
      });
      payload.catalog_category_id = categoryResponse.data.id;
    }

    if (editingItem.value) {
      await client.value.updateCatalogItem(tenantId.value, editingItem.value.id, payload);
      notify('Ítem actualizado', 'Los cambios quedaron guardados.', 'success');
    } else {
      await client.value.createCatalogItem(tenantId.value, payload);
      notify('Ítem creado', 'Ya está disponible en el catálogo.', 'success');
    }
    modalOpen.value = false;
    await loadCatalog();
  } catch (error) {
    notify('No se pudo guardar', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function kindForItemType(itemType): string {
  if (['service', 'labor'].includes(itemType)) return 'service';
  if (['product', 'part'].includes(itemType)) return 'product';

  return 'mixed';
}

async function addCategory(): Promise<void> {
  if (!tenantId.value || !categoryName.value.trim()) return;

  saving.value = true;
  try {
    await client.value.createCatalogCategory(tenantId.value, { name: categoryName.value.trim(), kind: 'mixed' });
    categoryName.value = '';
    notify('Categoría creada', 'Podés usarla al crear o editar ítems.', 'success');
    await loadCatalog();
  } catch (error) {
    notify('No se pudo crear la categoría', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function deactivateItem(item): Promise<void> {
  if (!tenantId.value) return;

  saving.value = true;
  try {
    await client.value.deactivateCatalogItem(tenantId.value, item.id);
    notify('Ítem desactivado', 'No aparecerá como activo en el catálogo.', 'success');
    await loadCatalog();
  } catch (error) {
    notify('No se pudo desactivar', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function formatMoney(value): string {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function notify(title: string, message?: string | null, variant = 'info'): void {
  const id = `${Date.now()}-${Math.random()}`;
  toasts.value.push({ id, title, message, variant });
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }, 4300);
}

function messageFromError(error): string {
  return error?.message || 'Revisá los datos e intentá nuevamente.';
}
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />

    <div class="rounded-md border border-slate-200 bg-white p-6 shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:text-text dark:shadow-none">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-950 dark:text-text">Catálogo</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-muted">{{ tenantName }}</p>
        </div>
        <UiButton @click="openCreate">Nuevo ítem</UiButton>
      </div>

      <div class="mt-6 grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted">
          <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Activos visibles</p>
          <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.total }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted">
          <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Controlan inventario</p>
          <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.inventory }}</p>
        </div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line dark:bg-surface-muted">
          <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Solo catálogo</p>
          <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.catalogOnly }}</p>
        </div>
      </div>
    </div>

    <div class="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:shadow-none">
      <div class="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_auto]">
        <UiSearchInput v-model="filters.q" label="Buscar" placeholder="Nombre o código" button-label="Filtrar" @search="loadCatalog" />
        <UiSelect v-model="filters.item_type" label="Tipo" :options="filterTypeOptions" />
        <UiSelect v-model="filters.controls_inventory" label="Modo" :options="inventoryOptions" />
        <UiSelect v-model="filters.status" label="Estado" :options="statusOptions" />
        <div class="flex items-end">
          <UiButton variant="secondary" :disabled="loading" @click="loadCatalog">Actualizar</UiButton>
        </div>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div class="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:shadow-none">
        <UiDataTable overflow="auto" min-width="min-w-[940px]">
          <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
            <tr>
              <th class="px-4 py-3">Ítem</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Modo</th>
              <th class="px-4 py-3">Precio</th>
              <th class="px-4 py-3">Costo ref.</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-line">
            <tr v-if="loading">
              <td class="px-4 py-8" colspan="7">
                <UiLoadingMark label="Cargando catálogo" />
              </td>
            </tr>
            <tr v-else-if="items.length === 0">
              <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="7">Aún no hay ítems con estos filtros.</td>
            </tr>
            <tr v-for="item in items" v-else :key="item.id" class="text-sm">
              <td class="px-4 py-3">
                <p class="font-semibold text-slate-950 dark:text-text">{{ item.name }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-soft">{{ item.sku || 'Sin código' }}<span v-if="item.category"> · {{ item.category.name }}</span></p>
              </td>
              <td class="px-4 py-3 text-slate-700 dark:text-muted">{{ typeLabels[item.item_type] || item.item_type }}</td>
              <td class="px-4 py-3"><CatalogModeBadge :controls-inventory="item.controls_inventory" /></td>
              <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ formatMoney(item.base_price) }}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-muted">{{ item.reference_cost === null ? 'Sin costo' : formatMoney(item.reference_cost) }}</td>
              <td class="px-4 py-3">
                <UiStatusBadge :tone="item.status === 'active' ? 'success' : 'neutral'">{{ item.status === 'active' ? 'Activo' : 'Inactivo' }}</UiStatusBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <UiButton size="sm" variant="secondary" @click="openEdit(item)">Editar</UiButton>
                  <UiButton v-if="item.status === 'active'" size="sm" variant="ghost" :disabled="saving" @click="deactivateItem(item)">Desactivar</UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </UiDataTable>
      </div>

      <aside class="space-y-5">
        <div class="rounded-md border border-slate-200 bg-white p-5 shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:shadow-none">
          <h3 class="text-base font-bold text-slate-950 dark:text-text">Categorías</h3>
          <div class="mt-4 flex gap-2">
            <UiInput v-model="categoryName" label="Nueva categoría" placeholder="Ej. Repuestos" />
            <div class="flex items-end">
              <UiButton variant="secondary" :disabled="saving || !categoryName.trim()" @click="addCategory">Agregar</UiButton>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <UiStatusBadge v-for="category in categories" :key="category.id" tone="neutral">{{ category.name }}</UiStatusBadge>
          </div>
        </div>

        <div class="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 dark:border-line dark:bg-warning-soft dark:text-warning">
          Catálogo puede vender sin inventario. Inventario estricto se activará por ítem y no permitirá inventar existencias ni costos reales.
        </div>
      </aside>
    </div>

    <UiModalShell
      :open="modalOpen"
      :title="editingItem ? 'Editar ítem' : 'Nuevo ítem'"
      description="Datos operativos del catálogo."
      max-width="max-w-3xl"
      @close="modalOpen = false"
    >
      <CatalogItemForm
        :item="editingItem"
        :categories="categories"
        :busy="saving"
        @submit="saveItem"
        @cancel="modalOpen = false"
      />
    </UiModalShell>
  </section>
</template>
