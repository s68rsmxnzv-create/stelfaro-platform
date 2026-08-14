<script setup lang="ts">
import { Check, X } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { UiButton, UiInput, UiMetricCard, UiPanel, UiSearchSelect, UiSelect, UiToggleField } from '@stelfaro/ui';
import type { PlatformCatalogCategory, PlatformCatalogItem, PlatformCatalogItemPayload } from '@stelfaro/api-client';
import { catalogItemTypeOptions, catalogStatusOptions, fiscalUnitMeasureOptions } from '../support/catalogOptions';
import {
  catalogPriceBreakdown,
  catalogPriceFlags,
  catalogPriceMode,
  priceForTargetMargin,
  type CatalogPriceMode
} from '../support/catalogPricing';

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
const targetMargin = ref('');
const categoryEditorOpen = ref(false);
const categoryBeforeCreate = ref('');
const categoryNameBeforeCreate = ref('');
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
  controls_inventory: false,
  base_price: '',
  price_mode: 'final_with_tax' as CatalogPriceMode,
  reference_cost: '',
  status: 'active'
});

const categoryOptions = computed(() => [
  { value: '', label: 'Sin categoría' },
  ...props.categories
    .filter((category) => category.status === 'active')
    .map((category) => ({ value: String(category.id), label: category.name, hint: category.kind })),
  ...(form.new_category_name.trim()
    ? [{ value: newCategoryValue, label: form.new_category_name.trim(), hint: 'Nueva categoría' }]
    : [])
]);
const priceModeOptions = [
  { value: 'final_with_tax', label: 'Precio final, incluye IVA', hint: 'Recomendado para venta al consumidor' },
  { value: 'before_tax', label: 'Precio antes de IVA', hint: 'Se sumará IVA al vender' },
  { value: 'exempt', label: 'No afecto a IVA', hint: 'El precio no genera IVA' }
];
const stockControlDisabled = computed(() => ['service', 'labor'].includes(form.item_type));
const selectedCategory = computed(() => props.categories.find((category) => String(category.id) === form.catalog_category_id) ?? null);
const inventoryManagedCost = computed(() => props.item?.cost_source === 'real');
const numericCost = computed(() => nullableNumber(form.reference_cost));
const priceBreakdown = computed(() => catalogPriceBreakdown(
  nullableNumber(form.base_price) ?? 0,
  form.price_mode,
  numericCost.value
));

watch(() => props.item, applyItem, { immediate: true });
watch(() => form.item_type, () => {
  if (stockControlDisabled.value) form.controls_inventory = false;
});
watch(() => form.catalog_category_id, (value) => {
  if (value !== newCategoryValue && !categoryEditorOpen.value) form.new_category_name = '';
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
  form.controls_inventory = item?.controls_inventory ?? false;
  form.base_price = item?.base_price !== undefined && item?.base_price !== null ? String(item.base_price) : '';
  form.price_mode = item ? catalogPriceMode(item) : 'final_with_tax';
  form.reference_cost = item?.reference_cost !== undefined && item?.reference_cost !== null ? String(item.reference_cost) : '';
  form.status = item?.status ?? 'active';
  targetMargin.value = '';
  categoryEditorOpen.value = false;
  categoryBeforeCreate.value = '';
  categoryNameBeforeCreate.value = '';
  lastSuggestedSku.value = item?.sku ?? '';
}

function nullableNumber(value: string | number): number | null {
  if (String(value).trim() === '') return null;
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function submit(): void {
  const isNewCategory = form.catalog_category_id === newCategoryValue;
  const flags = catalogPriceFlags(form.price_mode);
  const payload: PlatformCatalogItemPayload & { new_category_name?: string | null } = {
    sku: form.sku.trim() || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    item_type: form.item_type,
    catalog_category_id: form.catalog_category_id && !isNewCategory ? Number(form.catalog_category_id) : null,
    new_category_name: isNewCategory ? form.new_category_name.trim() || null : null,
    unit_code: form.unit_code,
    unit_name: form.unit_code === '99' ? form.unit_name.trim() || null : null,
    units_per_package: Number(form.units_per_package || 1),
    taxable: flags.taxable,
    controls_inventory: stockControlDisabled.value ? false : form.controls_inventory,
    base_price: nullableNumber(form.base_price) ?? 0,
    base_price_includes_tax: flags.basePriceIncludesTax,
    status: form.status
  };
  if (!inventoryManagedCost.value) payload.reference_cost = numericCost.value;

  emit('submit', payload);
}

function beginNewCategory(): void {
  categoryBeforeCreate.value = form.catalog_category_id;
  categoryNameBeforeCreate.value = form.new_category_name;
  form.catalog_category_id = newCategoryValue;
  if (categoryBeforeCreate.value !== newCategoryValue) form.new_category_name = '';
  categoryEditorOpen.value = true;
}

function confirmNewCategory(): void {
  const name = form.new_category_name.trim();
  if (!name) return;

  form.new_category_name = name;
  form.catalog_category_id = newCategoryValue;
  categoryEditorOpen.value = false;
}

function cancelNewCategory(): void {
  form.catalog_category_id = categoryBeforeCreate.value;
  form.new_category_name = categoryNameBeforeCreate.value;
  categoryEditorOpen.value = false;
}

function applyTargetMargin(): void {
  const cost = numericCost.value;
  const margin = nullableNumber(targetMargin.value);
  if (cost === null || margin === null) return;
  const price = priceForTargetMargin(cost, margin, form.price_mode);
  if (price !== null) form.base_price = price.toFixed(2);
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

function formatMoney(value: number | null): string {
  if (value === null) return '—';

  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="grid gap-4 md:grid-cols-2">
      <UiInput v-model="form.name" label="Nombre" placeholder="Ej. Aceite 10W30" required />
      <UiSelect v-model="form.item_type" label="Tipo" :options="catalogItemTypeOptions" />

      <div>
        <div class="flex items-end gap-2">
          <div class="min-w-0 flex-1">
            <UiSelect
              v-if="!categoryEditorOpen"
              v-model="form.catalog_category_id"
              label="Categoría"
              :options="categoryOptions"
              searchable
              search-placeholder="Buscar categoría"
            />
            <UiInput
              v-else
              v-model="form.new_category_name"
              label="Nueva categoría"
              placeholder="Ej. Lubricantes"
              required
              @keydown.enter.prevent="confirmNewCategory"
              @keydown.escape.prevent="cancelNewCategory"
            />
          </div>
          <UiButton
            v-if="!categoryEditorOpen"
            type="button"
            size="sm"
            variant="secondary"
            class="mb-2 whitespace-nowrap"
            @click="beginNewCategory"
          >
            {{ form.catalog_category_id === newCategoryValue ? 'Editar' : '+ Nueva' }}
          </UiButton>
          <template v-else>
            <UiButton
              type="button"
              icon-only
              :disabled="!form.new_category_name.trim()"
              aria-label="Usar nueva categoría"
              title="Usar nueva categoría"
              @click="confirmNewCategory"
            >
              <Check class="h-5 w-5" aria-hidden="true" />
            </UiButton>
            <UiButton
              type="button"
              icon-only
              variant="secondary"
              aria-label="Cancelar nueva categoría"
              title="Cancelar nueva categoría"
              @click="cancelNewCategory"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </UiButton>
          </template>
        </div>
      </div>

      <UiToggleField
        v-model="form.controls_inventory"
        title="Controla inventario"
        :description="stockControlDisabled
          ? 'No aplica para servicios o mano de obra.'
          : form.controls_inventory
            ? 'Disponible solo con existencias en inventario.'
            : 'Podrás vender sin tener existencias en inventario.'"
        :disabled="stockControlDisabled"
        variant="success"
      />
    </div>

    <UiPanel variant="default" class="space-y-4 border-primary/30 bg-primary-soft">
      <div>
        <h3 class="font-bold text-text">Precio de venta</h3>
        <p class="mt-1 text-sm text-muted">Define el monto y confirma qué verá el cliente.</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <UiInput v-model="form.base_price" label="Monto" type="number" placeholder="0.00" min="0" step="0.01" required />
        <UiSelect v-model="form.price_mode" label="Tratamiento del precio" :options="priceModeOptions" />
        <UiMetricCard v-if="inventoryManagedCost" label="Costo promedio actual" :value="formatMoney(numericCost)" hint="Se actualiza automáticamente desde inventario." size="sm" />
        <UiInput v-else v-model="form.reference_cost" label="Costo referencial" type="number" placeholder="Opcional" min="0" step="0.0001" />
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <UiInput v-model="targetMargin" label="Margen objetivo %" type="number" placeholder="Ej. 35" min="0" max="99.99" step="0.1" :disabled="numericCost === null" />
          <UiButton type="button" size="sm" variant="secondary" class="mb-1" :disabled="numericCost === null || targetMargin === ''" @click="applyTargetMargin">Aplicar</UiButton>
        </div>
      </div>

      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <UiMetricCard label="Cliente paga" :value="formatMoney(priceBreakdown.total)" size="sm" />
        <UiMetricCard label="Valor sin IVA" :value="formatMoney(priceBreakdown.net)" size="sm" />
        <UiMetricCard label="IVA" :value="formatMoney(priceBreakdown.tax)" size="sm" />
        <UiMetricCard
          label="Margen estimado"
          :value="priceBreakdown.marginPercent === null ? 'Sin costo' : `${priceBreakdown.marginPercent}%`"
          :tone="priceBreakdown.marginPercent !== null && priceBreakdown.marginPercent < 0 ? 'danger' : 'neutral'"
          size="sm"
        />
      </div>
    </UiPanel>

    <details class="group rounded-xl border border-line bg-surface-muted">
      <summary class="cursor-pointer list-none px-4 py-3 text-sm font-bold text-text">
        Más detalles
        <span class="ml-2 text-xs font-normal text-soft">SKU, unidad, descripción y estado</span>
      </summary>
      <div class="grid gap-4 border-t border-line p-4 md:grid-cols-2">
        <UiInput v-model="form.sku" label="Código/SKU" placeholder="Se genera automáticamente" />
        <UiSearchSelect v-model="form.unit_code" label="Unidad" :options="fiscalUnitMeasureOptions" placeholder="Buscar unidad CAT-014" />
        <UiInput v-if="form.unit_code === '99'" v-model="form.unit_name" label="Unidad personalizada" placeholder="Ej. caja, paquete" />
        <UiInput v-model="form.units_per_package" label="Unidades por empaque" type="number" min="1" step="1" />
        <UiSelect v-model="form.status" label="Estado" :options="catalogStatusOptions" />
        <UiInput v-model="form.description" class="md:col-span-2" label="Descripción" placeholder="Detalle opcional para búsquedas, ventas y catálogo público" />
      </div>
    </details>

    <div class="flex justify-end gap-2">
      <UiButton type="button" variant="ghost" @click="emit('cancel')">Cancelar</UiButton>
      <UiButton type="submit" :disabled="busy || categoryEditorOpen || !form.name.trim() || (form.catalog_category_id === newCategoryValue && !form.new_category_name.trim())">
        {{ item ? 'Guardar cambios' : 'Crear ítem' }}
      </UiButton>
    </div>
  </form>
</template>
