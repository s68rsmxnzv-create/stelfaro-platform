<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { UiButton, UiInput, UiSearchSelect, UiToggle } from '@stelfaro/ui';
import type { PlatformCatalogCategory, PlatformCatalogItem, PlatformCatalogItemPayload } from '@stelfaro/api-client';
import { catalogItemTypeOptions, catalogStatusOptions, fiscalUnitMeasureOptions } from '../support/catalogOptions';

const props = withDefaults(defineProps<{
  item?: PlatformCatalogItem | null;
  categories?: PlatformCatalogCategory[];
  busy?: boolean;
}>(), {
  item: null,
  categories: () => [],
  busy: false
});

const emit = defineEmits<{
  submit: [payload: PlatformCatalogItemPayload & { new_category_name?: string | null }];
  cancel: [];
}>();

const newCategoryValue = '__new_category__';
const lastSuggestedSku = ref('');
const form = reactive({
  sku: '',
  name: '',
  new_category_name: '',
  description: '',
  item_type: 'product',
  catalog_category_id: '',
  unit_code: '59',
  unit_name: '',
  units_per_package: 1,
  taxable: true,
  controls_inventory: false,
  base_price: '',
  base_price_includes_tax: false,
  reference_cost: '',
  status: 'active'
});

const categoryOptions = computed(() => [
  { value: '', label: 'Sin categoría' },
  ...props.categories
    .filter((category) => category.status === 'active')
    .map((category) => ({ value: String(category.id), label: category.name, hint: category.kind })),
  { value: newCategoryValue, label: 'Nueva categoría', hint: 'Crear al guardar' }
]);
const stockControlDisabled = computed(() => ['service', 'labor'].includes(form.item_type));
const selectedCategory = computed(() => props.categories.find((category) => String(category.id) === form.catalog_category_id) ?? null);

watch(() => props.item, applyItem, { immediate: true });
watch(() => form.item_type, () => {
  if (stockControlDisabled.value) {
    form.controls_inventory = false;
  }
});
watch(() => [form.name, form.catalog_category_id, form.new_category_name], suggestSku, { deep: true });

function applyItem(item: PlatformCatalogItem | null): void {
  form.sku = item?.sku ?? '';
  form.name = item?.name ?? '';
  form.new_category_name = '';
  form.description = item?.description ?? '';
  form.item_type = item?.item_type ?? 'product';
  form.catalog_category_id = item?.catalog_category_id ? String(item.catalog_category_id) : '';
  form.unit_code = item?.unit_code ?? '59';
  form.unit_name = item?.unit_name ?? '';
  form.units_per_package = item?.units_per_package ?? 1;
  form.taxable = item?.taxable ?? true;
  form.controls_inventory = item?.controls_inventory ?? false;
  form.base_price = item?.base_price !== undefined && item?.base_price !== null ? String(item.base_price) : '';
  form.base_price_includes_tax = item?.base_price_includes_tax ?? false;
  form.reference_cost = item?.reference_cost !== undefined && item?.reference_cost !== null ? String(item.reference_cost) : '';
  form.status = item?.status ?? 'active';
  lastSuggestedSku.value = item?.sku ?? '';
}

function nullableNumber(value: string): number | null {
  if (String(value).trim() === '') return null;
  return Number(value);
}

function submit(): void {
  const isNewCategory = form.catalog_category_id === newCategoryValue;
  emit('submit', {
    sku: form.sku.trim() || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    item_type: form.item_type,
    catalog_category_id: form.catalog_category_id && !isNewCategory ? Number(form.catalog_category_id) : null,
    new_category_name: isNewCategory ? form.new_category_name.trim() || null : null,
    unit_code: form.unit_code,
    unit_name: form.unit_code === '99' ? form.unit_name.trim() || null : null,
    units_per_package: Number(form.units_per_package || 1),
    taxable: form.taxable,
    controls_inventory: stockControlDisabled.value ? false : form.controls_inventory,
    base_price: nullableNumber(form.base_price) ?? 0,
    base_price_includes_tax: form.base_price_includes_tax,
    reference_cost: nullableNumber(form.reference_cost),
    status: form.status
  });
}

function suggestSku(): void {
  if (props.item) return;
  if (form.sku.trim() && form.sku !== lastSuggestedSku.value) return;

  const categoryName = form.catalog_category_id === newCategoryValue
    ? form.new_category_name
    : selectedCategory.value?.name ?? '';
  const candidate = buildSku(categoryName, form.name, nextCategoryNumber());
  lastSuggestedSku.value = candidate;
  form.sku = candidate;
}

function nextCategoryNumber(): number {
  if (form.catalog_category_id === newCategoryValue) return 1;

  return Number(selectedCategory.value?.items_count ?? 0) + 1;
}

function buildSku(categoryName: string, itemName: string, number: number): string {
  const category = skuSegment(categoryName || 'CAT');
  const item = skuSegment(itemName || 'ITEM');

  return `${category}-${item}-${String(Math.max(number, 1)).padStart(3, '0')}`;
}

function skuSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 4))
    .join('')
    .slice(0, 8) || 'ITEM';
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="grid gap-4 md:grid-cols-2">
      <UiInput v-model="form.name" label="Nombre" placeholder="Ej. Mano de obra, Aceite 10W30" required />
      <UiInput v-model="form.sku" label="Código sugerido" placeholder="Se genera desde categoría y nombre" />
      <UiSearchSelect v-model="form.item_type" label="Tipo" :options="catalogItemTypeOptions" placeholder="Buscar tipo" />
      <UiSearchSelect v-model="form.catalog_category_id" label="Categoría" :options="categoryOptions" placeholder="Buscar categoría" clearable clear-label="Sin categoría" />
      <UiInput v-if="form.catalog_category_id === newCategoryValue" v-model="form.new_category_name" label="Nueva categoría" placeholder="Ej. Lubricantes, Pantallas, Mano de obra" />
      <UiInput v-model="form.base_price" label="Precio base" type="number" placeholder="0.00" min="0" step="0.01" />
      <UiInput v-model="form.reference_cost" label="Costo referencial" type="number" placeholder="Opcional" min="0" step="0.0001" />
      <UiSearchSelect v-model="form.unit_code" label="Unidad" :options="fiscalUnitMeasureOptions" placeholder="Buscar unidad CAT-014" />
      <UiInput v-if="form.unit_code === '99'" v-model="form.unit_name" label="Unidad personalizada" placeholder="Ej. caja, paquete" />
      <UiInput v-model="form.units_per_package" label="Unidades por empaque" type="number" min="1" step="1" />
      <UiSearchSelect v-model="form.status" label="Estado" :options="catalogStatusOptions" placeholder="Seleccionar estado" />
    </div>

    <UiInput v-model="form.description" label="Descripción" placeholder="Detalle opcional para búsquedas y ventas" />

    <div class="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-line dark:bg-surface-muted md:grid-cols-3">
      <label class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-slate-700 dark:text-muted">Afecto a IVA</span>
        <UiToggle v-model="form.taxable" variant="success" />
      </label>
      <label class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-slate-700 dark:text-muted">Precio con IVA</span>
        <UiToggle v-model="form.base_price_includes_tax" />
      </label>
      <label class="flex items-center justify-between gap-3">
        <span>
          <span class="block text-sm font-semibold text-slate-700 dark:text-muted">Controla inventario</span>
          <span v-if="stockControlDisabled" class="text-xs text-slate-500 dark:text-soft">No aplica para servicios o mano de obra.</span>
        </span>
        <UiToggle v-model="form.controls_inventory" :disabled="stockControlDisabled" variant="success" />
      </label>
    </div>

    <div class="rounded-md border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-line dark:bg-primary-soft dark:text-primary">
      El stock no se edita desde catálogo. Cuando activemos compras e inventario, las entradas, salidas, lotes y costos reales quedarán trazados por kardex.
    </div>

    <div class="flex justify-end gap-2">
      <UiButton type="button" variant="ghost" @click="emit('cancel')">Cancelar</UiButton>
      <UiButton type="submit" :disabled="busy">{{ item ? 'Guardar cambios' : 'Crear ítem' }}</UiButton>
    </div>
  </form>
</template>
