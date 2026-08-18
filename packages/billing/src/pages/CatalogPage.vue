<script setup lang="ts">
// @ts-nocheck
import {
  PlatformClient,
  type PlatformCatalogCategory,
  type PlatformCatalogItem,
  type PlatformCatalogItemPayload
} from '@stelfaro/api-client';
import {
  UiButton,
  UiCard,
  UiCheckbox,
  UiDataTable,
  UiInput,
  UiLoadingMark,
  UiMetricCard,
  UiModalShell,
  UiPanel,
  UiSearchInput,
  UiSelect,
  UiStatusBadge
} from '@stelfaro/ui';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingPaginationBar from '../components/BillingPaginationBar.vue';
import CatalogItemForm from '../components/CatalogItemForm.vue';
import CatalogModeBadge from '../components/CatalogModeBadge.vue';
import { catalogItemTypeOptions } from '../support/catalogOptions';
import {
  adjustedCatalogPrice,
  catalogPriceBreakdown,
  catalogPriceMode,
  type CatalogPriceOperation,
  type CatalogPriceRounding
} from '../support/catalogPricing';

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
const activeView = ref<'items' | 'categories'>('items');
const categories = ref<PlatformCatalogCategory[]>([]);
const itemsPageSize = 100;
const itemsPage = ref(1);
const itemsMeta = ref(null);
const items = ref<PlatformCatalogItem[]>([]);
const loading = ref(false);
const saving = ref(false);
const itemModalOpen = ref(false);
const editingItem = ref<PlatformCatalogItem | null>(null);
const categoryModalOpen = ref(false);
const editingCategory = ref<PlatformCatalogCategory | null>(null);
const categoryDraft = reactive({ name: '', kind: 'mixed', status: 'active' });
const editingPriceId = ref<number | null>(null);
const quickPrice = ref('');
const selectedIds = ref<Set<number>>(new Set());
const bulkModalOpen = ref(false);
const bulkOperation = ref<CatalogPriceOperation>('percentage');
const bulkValue = ref<number>(10);
const bulkRounding = ref<CatalogPriceRounding>('none');
const filters = ref({
  q: '',
  category_id: '',
  status: 'active',
  item_type: '',
  controls_inventory: ''
});
const toasts = ref([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const typeLabels = {
  product: 'Producto',
  service: 'Servicio',
  part: 'Repuesto',
  labor: 'Mano de obra',
  other: 'Otro'
};
const categoryKindLabels = { product: 'Productos', service: 'Servicios', mixed: 'Mixta' };
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
const categoryKindOptions = [
  { value: 'mixed', label: 'Mixta', hint: 'Productos y servicios' },
  { value: 'product', label: 'Productos' },
  { value: 'service', label: 'Servicios' }
];
const categoryFilterOptions = computed(() => [
  { value: '', label: 'Todas' },
  ...categories.value
    .filter((category) => category.status === 'active')
    .map((category) => ({ value: String(category.id), label: category.name }))
]);
const bulkOperationOptions = [
  { value: 'percentage', label: 'Aumentar o disminuir %' },
  { value: 'fixed', label: 'Sumar o restar monto' },
  { value: 'margin', label: 'Aplicar margen sobre costo' },
  { value: 'set', label: 'Establecer el mismo precio' }
];
const bulkRoundingOptions = [
  { value: 'none', label: 'Sin redondeo adicional' },
  { value: 'whole', label: 'Al dólar superior' },
  { value: 'half', label: 'Al siguiente $0.50' },
  { value: 'ninety_nine', label: 'Terminación .99 superior' }
];
const bulkValueLabel = computed(() => {
  if (bulkOperation.value === 'margin') return 'Margen objetivo %';
  if (bulkOperation.value === 'percentage') return 'Cambio %';
  if (bulkOperation.value === 'fixed') return 'Cambio en dólares';

  return 'Nuevo precio';
});
const stats = computed(() => ({
  total: items.value.length,
  inventory: items.value.filter((item) => item.controls_inventory).length,
  needsReview: items.value.filter((item) => {
    const margin = itemMargin(item);
    return margin !== null && margin < 20;
  }).length
}));
const selectedItems = computed(() => items.value.filter((item) => selectedIds.value.has(item.id)));
const allVisibleSelected = computed(() => items.value.length > 0 && items.value.every((item) => selectedIds.value.has(item.id)));
const bulkPreview = computed(() => selectedItems.value.map((item) => {
  const newPrice = adjustedCatalogPrice(item, bulkOperation.value, Number(bulkValue.value), bulkRounding.value);
  const margin = newPrice === null
    ? null
    : catalogPriceBreakdown(newPrice, catalogPriceMode(item), item.reference_cost).marginPercent;

  return { item, newPrice, margin, changed: newPrice !== null && newPrice !== Number(item.base_price) };
}));
const applicableBulkRows = computed(() => bulkPreview.value.filter((row) => row.newPrice !== null && row.changed));
const bulkValueValid = computed(() => {
  const value = Number(bulkValue.value);
  if (!Number.isFinite(value)) return false;
  if (bulkOperation.value === 'margin') return value >= 0 && value < 100;
  if (bulkOperation.value === 'percentage') return value >= -100;
  if (bulkOperation.value === 'set') return value >= 0;

  return true;
});

watch(tenantId, () => void loadCatalog());
watch(() => filters.value.q, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  itemsPage.value = 1;
  searchTimer = window.setTimeout(() => {
    const query = filters.value.q.trim();
    if (query.length === 0 || query.length >= 2) void loadCatalog();
  }, 250);
});
watch(() => [filters.value.category_id, filters.value.item_type, filters.value.controls_inventory, filters.value.status], () => {
  itemsPage.value = 1;
  void loadCatalog();
});

onMounted(loadCatalog);
onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
});

async function loadCatalog(): Promise<void> {
  if (!tenantId.value) return;

  loading.value = true;
  try {
    const [categoryResponse, itemResponse] = await Promise.all([
      client.value.catalogCategories(tenantId.value),
      client.value.catalogItems(tenantId.value, normalizedFilters())
    ]);
    categories.value = categoryResponse.data;
    items.value = itemResponse.data;
    itemsMeta.value = itemResponse.meta ?? {
      current_page: itemsPage.value,
      last_page: 1,
      total: items.value.length,
      from: items.value.length === 0 ? 0 : 1,
      to: items.value.length
    };
    const visibleIds = new Set(items.value.map((item) => item.id));
    selectedIds.value = new Set([...selectedIds.value].filter((id) => visibleIds.has(id)));
  } catch (error) {
    notify('No se pudo cargar el catálogo', messageFromError(error), 'error');
  } finally {
    loading.value = false;
  }
}

function goToItemsPage(page: number): void {
  if (page === itemsPage.value) return;
  itemsPage.value = page;
  void loadCatalog();
}

function normalizedFilters(): Record<string, unknown> {
  return {
    q: filters.value.q || undefined,
    category_id: filters.value.category_id ? Number(filters.value.category_id) : undefined,
    status: filters.value.status || undefined,
    item_type: filters.value.item_type || undefined,
    controls_inventory: filters.value.controls_inventory === '' ? undefined : filters.value.controls_inventory === 'true',
    page: itemsPage.value,
    per_page: itemsPageSize
  };
}

function openCreate(): void {
  editingItem.value = null;
  itemModalOpen.value = true;
}

function openEdit(item: PlatformCatalogItem): void {
  editingItem.value = item;
  itemModalOpen.value = true;
}

async function saveItem(payload: PlatformCatalogItemPayload & { new_category_name?: string | null }): Promise<void> {
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
    itemModalOpen.value = false;
    await loadCatalog();
  } catch (error) {
    notify('No se pudo guardar', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function kindForItemType(itemType: string): string {
  if (['service', 'labor'].includes(itemType)) return 'service';
  if (['product', 'part'].includes(itemType)) return 'product';

  return 'mixed';
}

async function setItemStatus(item: PlatformCatalogItem, status: 'active' | 'inactive'): Promise<void> {
  if (!tenantId.value) return;
  saving.value = true;
  try {
    if (status === 'inactive') await client.value.deactivateCatalogItem(tenantId.value, item.id);
    else await client.value.updateCatalogItem(tenantId.value, item.id, { status });
    notify(status === 'active' ? 'Ítem reactivado' : 'Ítem desactivado', 'El estado del catálogo fue actualizado.', 'success');
    await loadCatalog();
  } catch (error) {
    notify('No se pudo cambiar el estado', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function startQuickPrice(item: PlatformCatalogItem): void {
  editingPriceId.value = item.id;
  quickPrice.value = Number(item.base_price).toFixed(2);
}

function cancelQuickPrice(): void {
  editingPriceId.value = null;
  quickPrice.value = '';
}

async function saveQuickPrice(item: PlatformCatalogItem): Promise<void> {
  const price = Number(quickPrice.value);
  if (!tenantId.value || !Number.isFinite(price) || price < 0) return;
  saving.value = true;
  try {
    const response = await client.value.updateCatalogItem(tenantId.value, item.id, { base_price: price });
    items.value = items.value.map((current) => current.id === item.id ? response.data : current);
    cancelQuickPrice();
    notify('Precio actualizado', `${item.name} ahora tiene un precio de ${formatMoney(price)}.`, 'success');
  } catch (error) {
    notify('No se pudo actualizar el precio', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function toggleSelected(itemId: number): void {
  const next = new Set(selectedIds.value);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  selectedIds.value = next;
}

function toggleAllVisible(): void {
  const next = new Set(selectedIds.value);
  if (allVisibleSelected.value) items.value.forEach((item) => next.delete(item.id));
  else items.value.forEach((item) => next.add(item.id));
  selectedIds.value = next;
}

function openBulkPrices(): void {
  if (!selectedItems.value.length) return;
  bulkOperation.value = 'percentage';
  bulkValue.value = 10;
  bulkRounding.value = 'none';
  bulkModalOpen.value = true;
}

async function applyBulkPrices(): Promise<void> {
  if (!tenantId.value || !bulkValueValid.value || !applicableBulkRows.value.length) return;
  saving.value = true;
  try {
    const response = await client.value.bulkUpdateCatalogPrices(
      tenantId.value,
      applicableBulkRows.value.map((row) => ({ id: row.item.id, base_price: row.newPrice }))
    );
    bulkModalOpen.value = false;
    selectedIds.value = new Set();
    notify(
      'Precios actualizados',
      `${response.meta.updated} ${response.meta.updated === 1 ? 'artículo fue actualizado' : 'artículos fueron actualizados'}.`,
      'success'
    );
    await loadCatalog();
  } catch (error) {
    notify('No se pudieron actualizar los precios', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function openCreateCategory(): void {
  editingCategory.value = null;
  Object.assign(categoryDraft, { name: '', kind: 'mixed', status: 'active' });
  categoryModalOpen.value = true;
}

function openEditCategory(category: PlatformCatalogCategory): void {
  editingCategory.value = category;
  Object.assign(categoryDraft, { name: category.name, kind: category.kind, status: category.status });
  categoryModalOpen.value = true;
}

async function saveCategory(): Promise<void> {
  if (!tenantId.value || !categoryDraft.name.trim()) return;
  saving.value = true;
  try {
    const payload = { name: categoryDraft.name.trim(), kind: categoryDraft.kind, status: categoryDraft.status };
    if (editingCategory.value) {
      await client.value.updateCatalogCategory(tenantId.value, editingCategory.value.id, payload);
      notify('Categoría actualizada', 'Los cambios quedaron guardados.', 'success');
    } else {
      await client.value.createCatalogCategory(tenantId.value, payload);
      notify('Categoría creada', 'Ya puede asignarse a productos y servicios.', 'success');
    }
    categoryModalOpen.value = false;
    await loadCatalog();
  } catch (error) {
    notify('No se pudo guardar la categoría', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleCategoryStatus(category: PlatformCatalogCategory): Promise<void> {
  if (!tenantId.value) return;
  const status = category.status === 'active' ? 'inactive' : 'active';
  saving.value = true;
  try {
    await client.value.updateCatalogCategory(tenantId.value, category.id, { status });
    if (status === 'inactive' && String(category.id) === filters.value.category_id) {
      filters.value.category_id = '';
    }
    notify(status === 'active' ? 'Categoría reactivada' : 'Categoría desactivada', 'Los artículos conservaron su categoría.', 'success');
    await loadCatalog();
  } catch (error) {
    notify('No se pudo cambiar la categoría', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function itemPriceTotal(item: PlatformCatalogItem): number {
  return catalogPriceBreakdown(item.base_price, catalogPriceMode(item), item.reference_cost).total;
}

function itemMargin(item: PlatformCatalogItem): number | null {
  return catalogPriceBreakdown(item.base_price, catalogPriceMode(item), item.reference_cost).marginPercent;
}

function itemPriceHint(item: PlatformCatalogItem): string {
  const mode = catalogPriceMode(item);
  if (mode === 'final_with_tax') return 'Final · incluye IVA';
  if (mode === 'before_tax') return `Base ${formatMoney(item.base_price)} · + IVA`;

  return 'No afecto a IVA';
}

function formatMoney(value: number | null): string {
  if (value === null) return '—';

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

    <UiCard>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-text">Catálogo</h2>
          <p class="mt-1 text-sm text-muted">{{ tenantName }} · productos, servicios, precios y categorías</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton v-if="activeView === 'items'" variant="secondary" :disabled="selectedItems.length === 0" @click="openBulkPrices">
            Actualizar precios<span v-if="selectedItems.length"> · {{ selectedItems.length }}</span>
          </UiButton>
          <UiButton v-if="activeView === 'items'" @click="openCreate">Nuevo ítem</UiButton>
          <UiButton v-else @click="openCreateCategory">Nueva categoría</UiButton>
        </div>
      </div>

      <div class="mt-5 inline-flex rounded-lg bg-surface-muted p-1">
        <UiButton
          size="sm"
          :variant="activeView === 'items' ? 'primary' : 'ghost'"
          @click="activeView = 'items'"
        >Productos y servicios</UiButton>
        <UiButton
          size="sm"
          :variant="activeView === 'categories' ? 'primary' : 'ghost'"
          @click="activeView = 'categories'"
        >Categorías · {{ categories.length }}</UiButton>
      </div>

      <div v-if="activeView === 'items'" class="mt-6 grid gap-3 md:grid-cols-3">
        <UiMetricCard label="Resultados" :value="stats.total" />
        <UiMetricCard label="Controlan inventario" :value="stats.inventory" />
        <UiMetricCard label="Margen menor a 20%" :value="stats.needsReview" :tone="stats.needsReview ? 'warning' : 'neutral'" />
      </div>
    </UiCard>

    <template v-if="activeView === 'items'">
      <UiCard>
        <div class="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_180px_150px_160px_145px_auto]">
          <UiSearchInput v-model="filters.q" label="Buscar" placeholder="Nombre o código" @search="loadCatalog" />
          <UiSelect v-model="filters.category_id" label="Categoría" :options="categoryFilterOptions" />
          <UiSelect v-model="filters.item_type" label="Tipo" :options="filterTypeOptions" />
          <UiSelect v-model="filters.controls_inventory" label="Modo" :options="inventoryOptions" />
          <UiSelect v-model="filters.status" label="Estado" :options="statusOptions" />
          <div class="flex items-end">
            <UiButton variant="secondary" :disabled="loading" @click="loadCatalog">Actualizar</UiButton>
          </div>
        </div>
      </UiCard>

      <UiPanel v-if="selectedItems.length" variant="default" class="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary-soft">
        <p class="text-sm font-semibold text-text">{{ selectedItems.length }} {{ selectedItems.length === 1 ? 'artículo seleccionado' : 'artículos seleccionados' }}</p>
        <div class="flex gap-2">
          <UiButton size="sm" variant="ghost" @click="selectedIds = new Set()">Limpiar</UiButton>
          <UiButton size="sm" @click="openBulkPrices">Actualizar precios</UiButton>
        </div>
      </UiPanel>

      <UiCard>
        <div v-if="itemsMeta && itemsMeta.last_page > 1" class="border-b border-line pb-3">
          <BillingPaginationBar :meta="itemsMeta" :loading="loading" @page="goToItemsPage" />
        </div>

        <UiDataTable overflow="auto" min-width="min-w-[1080px]">
          <thead class="border-b border-line text-xs uppercase text-soft">
            <tr>
              <th class="w-10 px-3 py-3">
                <UiCheckbox :model-value="allVisibleSelected" label="Seleccionar resultados" hide-label @update:model-value="toggleAllVisible" />
              </th>
              <th class="px-4 py-3">Ítem</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Modo</th>
              <th class="px-4 py-3">Precio cliente</th>
              <th class="px-4 py-3">Costo / margen</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-if="loading">
              <td class="px-4 py-8" colspan="8"><UiLoadingMark label="Cargando catálogo" /></td>
            </tr>
            <tr v-else-if="items.length === 0">
              <td class="px-4 py-8 text-center text-sm text-muted" colspan="8">Aún no hay ítems con estos filtros.</td>
            </tr>
            <tr v-for="item in items" v-else :key="item.id" class="text-sm" :class="selectedIds.has(item.id) ? 'bg-primary-soft/30' : ''">
              <td class="px-3 py-3">
                <UiCheckbox :model-value="selectedIds.has(item.id)" :label="`Seleccionar ${item.name}`" hide-label @update:model-value="toggleSelected(item.id)" />
              </td>
              <td class="px-4 py-3">
                <p class="font-semibold text-text">{{ item.name }}</p>
                <p class="mt-1 text-xs text-soft">{{ item.sku || 'Sin código' }}<span v-if="item.category"> · {{ item.category.name }}</span></p>
              </td>
              <td class="px-4 py-3 text-muted">{{ typeLabels[item.item_type] || item.item_type }}</td>
              <td class="px-4 py-3"><CatalogModeBadge :controls-inventory="item.controls_inventory" /></td>
              <td class="px-4 py-3">
                <div v-if="editingPriceId === item.id" class="min-w-56">
                  <div class="flex items-center gap-2">
                    <div class="w-28">
                      <UiInput
                      v-model="quickPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      label="Nuevo precio"
                      hide-label
                      @keydown.enter.prevent="saveQuickPrice(item)"
                      @keydown.escape.prevent="cancelQuickPrice"
                      />
                    </div>
                    <UiButton size="sm" :disabled="saving || Number(quickPrice) < 0" @click="saveQuickPrice(item)">Guardar</UiButton>
                    <UiButton size="sm" variant="ghost" @click="cancelQuickPrice">Cancelar</UiButton>
                  </div>
                  <p class="mt-1 text-xs text-soft">{{ catalogPriceMode(item) === 'before_tax' ? 'Editando monto antes de IVA' : 'Editando precio final' }}</p>
                </div>
                <div v-else>
                  <UiButton size="sm" variant="ghost" class="-ml-3 font-bold text-text underline decoration-dotted underline-offset-4 hover:text-primary" title="Editar precio" @click="startQuickPrice(item)">
                    {{ formatMoney(itemPriceTotal(item)) }}
                  </UiButton>
                  <span class="block text-xs text-soft">{{ itemPriceHint(item) }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <p class="text-muted">{{ item.reference_cost === null ? 'Sin costo' : formatMoney(item.reference_cost) }}</p>
                <p v-if="itemMargin(item) !== null" class="mt-1 text-xs font-bold" :class="itemMargin(item) < 20 ? 'text-warning' : 'text-success'">Margen {{ itemMargin(item) }}%</p>
              </td>
              <td class="px-4 py-3">
                <UiStatusBadge :tone="item.status === 'active' ? 'success' : 'neutral'">{{ item.status === 'active' ? 'Activo' : 'Inactivo' }}</UiStatusBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <UiButton size="sm" variant="secondary" @click="openEdit(item)">Editar</UiButton>
                  <UiButton size="sm" variant="ghost" :disabled="saving" @click="setItemStatus(item, item.status === 'active' ? 'inactive' : 'active')">
                    {{ item.status === 'active' ? 'Desactivar' : 'Reactivar' }}
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </UiDataTable>

        <div v-if="itemsMeta && itemsMeta.last_page > 1" class="border-t border-line pt-3">
          <BillingPaginationBar :meta="itemsMeta" :loading="loading" @page="goToItemsPage" />
        </div>
      </UiCard>
    </template>

    <template v-else>
      <UiCard>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-text">Administrar categorías</h3>
            <p class="mt-1 text-sm text-muted">Renombra, desactiva o reactiva categorías sin perder la relación con sus artículos.</p>
          </div>
          <UiButton size="sm" @click="openCreateCategory">Nueva categoría</UiButton>
        </div>
        <UiDataTable overflow="auto" min-width="min-w-[720px]">
          <thead class="border-b border-line text-xs uppercase text-soft">
            <tr>
              <th class="px-4 py-3">Categoría</th>
              <th class="px-4 py-3">Uso</th>
              <th class="px-4 py-3">Artículos</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-if="loading"><td colspan="5" class="px-4 py-8"><UiLoadingMark label="Cargando categorías" /></td></tr>
            <tr v-else-if="categories.length === 0"><td colspan="5" class="px-4 py-10 text-center text-sm text-muted">Todavía no hay categorías. Crea la primera para organizar el catálogo.</td></tr>
            <tr v-for="category in categories" v-else :key="category.id" class="text-sm">
              <td class="px-4 py-3 font-semibold text-text">{{ category.name }}</td>
              <td class="px-4 py-3 text-muted">{{ categoryKindLabels[category.kind] || category.kind }}</td>
              <td class="px-4 py-3 text-muted">{{ category.items_count ?? 0 }}</td>
              <td class="px-4 py-3"><UiStatusBadge :tone="category.status === 'active' ? 'success' : 'neutral'">{{ category.status === 'active' ? 'Activa' : 'Inactiva' }}</UiStatusBadge></td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <UiButton size="sm" variant="secondary" @click="openEditCategory(category)">Editar</UiButton>
                  <UiButton size="sm" variant="ghost" :disabled="saving" @click="toggleCategoryStatus(category)">{{ category.status === 'active' ? 'Desactivar' : 'Reactivar' }}</UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </UiDataTable>
      </UiCard>
    </template>

    <UiModalShell
      :open="itemModalOpen"
      :title="editingItem ? 'Editar ítem' : 'Nuevo ítem'"
      max-width="max-w-4xl"
      @close="itemModalOpen = false"
    >
      <CatalogItemForm
        :item="editingItem"
        :categories="categories"
        :busy="saving"
        @submit="saveItem"
        @cancel="itemModalOpen = false"
      />
    </UiModalShell>

    <UiModalShell
      :open="categoryModalOpen"
      :title="editingCategory ? 'Editar categoría' : 'Nueva categoría'"
      description="Organiza productos y servicios para encontrarlos y actualizar precios con mayor rapidez."
      max-width="max-w-lg"
      @close="categoryModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveCategory">
        <UiInput v-model="categoryDraft.name" label="Nombre" placeholder="Ej. Lubricantes, Pantallas, Mano de obra" required />
        <UiSelect v-model="categoryDraft.kind" label="Uso de la categoría" :options="categoryKindOptions" />
        <div class="flex justify-end gap-2">
          <UiButton type="button" variant="ghost" @click="categoryModalOpen = false">Cancelar</UiButton>
          <UiButton type="submit" :disabled="saving || !categoryDraft.name.trim()">{{ editingCategory ? 'Guardar cambios' : 'Crear categoría' }}</UiButton>
        </div>
      </form>
    </UiModalShell>

    <UiModalShell
      :open="bulkModalOpen"
      title="Actualizar precios"
      description="Revisa la simulación antes de aplicar. Los costos y los precios históricos de documentos no se modifican."
      max-width="max-w-4xl"
      @close="bulkModalOpen = false"
    >
      <div class="space-y-5">
        <div class="grid gap-4 md:grid-cols-3">
          <UiSelect v-model="bulkOperation" label="Operación" :options="bulkOperationOptions" />
          <UiInput v-model.number="bulkValue" :label="bulkValueLabel" type="number" :min="bulkOperation === 'percentage' ? -100 : bulkOperation === 'fixed' ? undefined : 0" :max="bulkOperation === 'margin' ? 99.99 : undefined" step="0.01" />
          <UiSelect v-model="bulkRounding" label="Redondeo" :options="bulkRoundingOptions" />
        </div>

        <p class="text-xs text-soft">La operación se aplica al monto configurado. En artículos con precio antes de IVA, el total que paga el cliente se recalcula automáticamente.</p>

        <UiPanel v-if="!bulkValueValid" variant="default" class="border-danger/30 bg-danger-soft text-sm text-danger">El valor indicado no es válido para esta operación.</UiPanel>
        <UiPanel v-if="bulkOperation === 'margin' && applicableBulkRows.length < bulkPreview.length" variant="default" class="border-warning/30 bg-warning-soft text-sm text-warning">
          Los artículos sin costo referencial aparecen en la vista previa, pero no se actualizarán.
        </UiPanel>

        <UiDataTable overflow="auto" min-width="min-w-[660px]" class="max-h-96">
            <thead class="sticky top-0 bg-surface-muted text-xs uppercase text-soft">
              <tr><th class="px-3 py-2">Artículo</th><th class="px-3 py-2 text-right">Monto actual</th><th class="px-3 py-2 text-right">Monto nuevo</th><th class="px-3 py-2 text-right">Margen nuevo</th></tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="row in bulkPreview" :key="row.item.id">
                <td class="px-3 py-2"><strong class="text-text">{{ row.item.name }}</strong><span class="block text-xs text-soft">{{ row.item.sku || 'Sin código' }}</span></td>
                <td class="px-3 py-2 text-right text-muted">{{ formatMoney(row.item.base_price) }}</td>
                <td class="px-3 py-2 text-right font-bold" :class="row.newPrice === null ? 'text-warning' : 'text-text'">{{ row.newPrice === null ? 'Sin costo' : formatMoney(row.newPrice) }}</td>
                <td class="px-3 py-2 text-right" :class="row.margin !== null && row.margin < 20 ? 'text-warning' : 'text-success'">{{ row.margin === null ? '—' : `${row.margin}%` }}</td>
              </tr>
            </tbody>
        </UiDataTable>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted">Se aplicarán {{ applicableBulkRows.length }} de {{ bulkPreview.length }} artículos seleccionados.</p>
          <div class="flex gap-2">
            <UiButton variant="ghost" @click="bulkModalOpen = false">Cancelar</UiButton>
            <UiButton :disabled="saving || !bulkValueValid || applicableBulkRows.length === 0" @click="applyBulkPrices">Aplicar precios</UiButton>
          </div>
        </div>
      </div>
    </UiModalShell>
  </section>
</template>
