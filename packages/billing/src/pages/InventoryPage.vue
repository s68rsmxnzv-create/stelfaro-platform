<script setup lang="ts">
// @ts-nocheck
import { PlatformClient } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiInput, UiLoadingMark, UiModalShell, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { computed, onMounted, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingSectionLayout from '../components/BillingSectionLayout.vue';

const props = withDefaults(defineProps<{
  platformSession?: Record<string, unknown> | null;
  platformBaseUrl?: string;
  appBaseUrl?: string;
  dashboardUrl?: string;
}>(), {
  platformSession: null,
  platformBaseUrl: '/api/v1',
  appBaseUrl: '',
  dashboardUrl: ''
});

const client = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const tenantId = computed(() => Number(props.platformSession?.tenant?.id || 0));
const tenantName = computed(() => props.platformSession?.tenant?.name ?? 'Empresa');
const homeHref = computed(() => props.dashboardUrl || props.appBaseUrl || '/');
const activeTab = ref('overview');
const loading = ref(false);
const saving = ref(false);
const items = ref([]);
const lots = ref([]);
const movements = ref([]);
const suppliers = ref([]);
const toasts = ref([]);
const stockEntryOpen = ref(false);
const supplierOpen = ref(false);
const selectedItem = ref(null);
const filters = ref({ q: '' });
const entryForm = ref({
  catalog_item_id: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  document_type: '',
  document_number: '',
  quantity: 1,
  unit_cost: 0
});
const adjustmentForm = ref({
  catalog_item_id: '',
  direction: 'entry',
  quantity: 1,
  unit_cost: 0,
  notes: ''
});
const supplierForm = ref({
  name: '',
  tax_id: '',
  nrc: '',
  phone: '',
  email: '',
  address: ''
});

const tabs = [
  { key: 'overview', label: 'Resumen', detail: 'Estado general', icon: 'summary' },
  { key: 'stock', label: 'Existencias', detail: 'Productos y stock', icon: 'stock' },
  { key: 'entries', label: 'Entradas', detail: 'Compras y lotes', icon: 'entries' },
  { key: 'lots', label: 'Lotes', detail: 'Disponibilidad FIFO', icon: 'lots' },
  { key: 'kardex', label: 'Kardex', detail: 'Movimientos', icon: 'kardex' },
  { key: 'adjustments', label: 'Ajustes', detail: 'Correcciones', icon: 'adjustments' },
  { key: 'suppliers', label: 'Proveedores', detail: 'Compras', icon: 'suppliers' }
];
const sectionNavItems = computed(() => tabs.map((tab) => ({ ...tab, id: tab.key })));
const inventoryOptions = computed(() => items.value.map((item) => ({
  value: String(item.id),
  label: item.name,
  hint: item.sku || 'Sin código'
})));
const visibleItems = computed(() => {
  const term = filters.value.q.trim().toLowerCase();
  if (!term) return items.value;

  return items.value.filter((item) => `${item.name} ${item.sku || ''}`.toLowerCase().includes(term));
});
const lowStockItems = computed(() => items.value.filter((item) => Number(item.stock_quantity || 0) <= 0));
const stats = computed(() => ({
  products: items.value.length,
  units: items.value.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0),
  value: items.value.reduce((sum, item) => sum + (Number(item.stock_quantity || 0) * Number(item.reference_cost || 0)), 0),
  lowStock: lowStockItems.value.length,
  lots: lots.value.length,
  movements: movements.value.length
}));

watch(tenantId, loadInventory);
onMounted(loadInventory);

async function loadInventory(): Promise<void> {
  if (!tenantId.value) return;

  loading.value = true;
  try {
    const [itemResponse, lotResponse, movementResponse, supplierResponse] = await Promise.all([
      client.value.catalogItems(tenantId.value, { status: 'active', controls_inventory: true, per_page: 100 }),
      client.value.inventoryLots(tenantId.value, { available_only: false, per_page: 100 }),
      client.value.inventoryMovements(tenantId.value, { per_page: 100 }),
      client.value.inventorySuppliers(tenantId.value, { status: 'active', per_page: 100 })
    ]);
    items.value = itemResponse.data ?? [];
    lots.value = lotResponse.data ?? [];
    movements.value = movementResponse.data ?? [];
    suppliers.value = supplierResponse.data ?? [];
  } catch (error) {
    notify('No se pudo cargar inventario', messageFromError(error), 'error');
  } finally {
    loading.value = false;
  }
}

function openEntry(item = null): void {
  selectedItem.value = item;
  entryForm.value = {
    catalog_item_id: item ? String(item.id) : '',
    purchase_date: new Date().toISOString().slice(0, 10),
    document_type: '',
    document_number: '',
    quantity: 1,
    unit_cost: Number(item?.reference_cost || 0)
  };
  stockEntryOpen.value = true;
}

async function saveEntry(): Promise<void> {
  if (!tenantId.value) return;

  const catalogItemId = selectedItem.value?.id ?? Number(entryForm.value.catalog_item_id || 0);
  if (!catalogItemId) return;

  saving.value = true;
  try {
    await client.value.createInventoryPurchase(tenantId.value, {
      document_type: entryForm.value.document_type || null,
      document_number: entryForm.value.document_number || null,
      purchase_date: entryForm.value.purchase_date,
      lines: [{
        catalog_item_id: catalogItemId,
        quantity: Number(entryForm.value.quantity || 0),
        unit_cost: Number(entryForm.value.unit_cost || 0)
      }]
    });
    notify('Entrada registrada', 'Se creó lote y movimiento de kardex.', 'success');
    stockEntryOpen.value = false;
    await loadInventory();
  } catch (error) {
    notify('No se pudo registrar entrada', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function saveAdjustment(): Promise<void> {
  if (!tenantId.value || !adjustmentForm.value.catalog_item_id) return;

  saving.value = true;
  try {
    await client.value.createInventoryAdjustment(tenantId.value, {
      catalog_item_id: Number(adjustmentForm.value.catalog_item_id),
      direction: adjustmentForm.value.direction,
      quantity: Number(adjustmentForm.value.quantity || 0),
      unit_cost: Number(adjustmentForm.value.unit_cost || 0),
      notes: adjustmentForm.value.notes || null
    });
    notify('Ajuste registrado', 'Stock y kardex quedaron actualizados.', 'success');
    adjustmentForm.value.quantity = 1;
    adjustmentForm.value.notes = '';
    await loadInventory();
  } catch (error) {
    notify('No se pudo registrar ajuste', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function saveSupplier(): Promise<void> {
  if (!tenantId.value || !supplierForm.value.name.trim()) return;

  saving.value = true;
  try {
    await client.value.createInventorySupplier(tenantId.value, {
      name: supplierForm.value.name.trim(),
      tax_id: supplierForm.value.tax_id.trim() || null,
      nrc: supplierForm.value.nrc.trim() || null,
      phone: supplierForm.value.phone.trim() || null,
      email: supplierForm.value.email.trim() || null,
      address: supplierForm.value.address.trim() || null
    });
    notify('Proveedor creado', 'Ya queda disponible para compras.', 'success');
    supplierOpen.value = false;
    supplierForm.value = { name: '', tax_id: '', nrc: '', phone: '', email: '', address: '' };
    await loadInventory();
  } catch (error) {
    notify('No se pudo crear proveedor', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

function formatMoney(value): string {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function formatQuantity(value): string {
  return new Intl.NumberFormat('es-SV', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function movementTone(type): string {
  return type === 'entry' ? 'success' : 'neutral';
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
  <BillingSectionLayout
    title="Inventario"
    icon="inventory"
    :entity-title="tenantName"
    :entity-detail="`${stats.products} productos inventariables`"
    :nav-items="sectionNavItems"
    :active-id="activeTab"
    :home-href="homeHref"
    @select="activeTab = $event"
  >
    <BillingFloatingToastStack :toasts="toasts" />

    <div class="space-y-5">
      <div class="flex flex-wrap justify-end gap-2">
        <UiButton variant="secondary" :disabled="loading" @click="loadInventory">Actualizar</UiButton>
        <UiButton :disabled="items.length === 0" @click="openEntry(null)">Entrada</UiButton>
      </div>

        <div v-if="loading" class="rounded-md border border-slate-200 bg-white p-10 dark:border-line dark:bg-surface">
          <UiLoadingMark label="Cargando inventario" />
        </div>

        <template v-else>
          <div v-if="activeTab === 'overview'" class="space-y-5">
            <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Productos</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.products }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Unidades</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ formatQuantity(stats.units) }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Valor costo</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ formatMoney(stats.value) }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Sin stock</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.lowStock }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Lotes</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.lots }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Movimientos</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.movements }}</p>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Movimientos recientes</h3>
              <div class="mt-4 divide-y divide-slate-100 dark:divide-line">
                <div v-for="movement in movements.slice(0, 8)" :key="movement.id" class="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p class="font-semibold text-slate-950 dark:text-text">{{ movement.catalog_item?.name ?? 'Producto' }}</p>
                    <p class="text-xs text-slate-500 dark:text-soft">{{ movement.reason }} · {{ movement.reference_number || movement.created_at }}</p>
                  </div>
                  <div class="text-right">
                    <UiStatusBadge :tone="movementTone(movement.movement_type)">{{ movement.movement_type === 'entry' ? 'Entrada' : 'Salida' }}</UiStatusBadge>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ formatQuantity(movement.quantity) }}</p>
                  </div>
                </div>
                <p v-if="movements.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-muted">Sin movimientos todavía.</p>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'stock'" class="space-y-4">
            <div class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
              <UiSearchInput v-model="filters.q" label="Buscar producto" placeholder="Nombre o código" button-label="Filtrar" />
            </div>
            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <UiDataTable overflow="auto" min-width="min-w-[820px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3">Stock</th>
                    <th class="px-4 py-3">Costo prom.</th>
                    <th class="px-4 py-3">Valor</th>
                    <th class="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="item in visibleItems" :key="item.id" class="text-sm">
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ item.name }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ item.sku || 'Sin código' }}</p>
                    </td>
                    <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ formatQuantity(item.stock_quantity) }}</td>
                    <td class="px-4 py-3">{{ formatMoney(item.reference_cost) }}</td>
                    <td class="px-4 py-3">{{ formatMoney(Number(item.stock_quantity || 0) * Number(item.reference_cost || 0)) }}</td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end gap-2">
                        <UiButton size="sm" variant="secondary" @click="openEntry(item)">Entrada</UiButton>
                        <UiButton size="sm" variant="ghost" @click="adjustmentForm.catalog_item_id = String(item.id); activeTab = 'adjustments'">Ajuste</UiButton>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="visibleItems.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin productos inventariables.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </div>
          </div>

          <div v-if="activeTab === 'entries'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Entradas</h3>
              <UiButton :disabled="items.length === 0" @click="openEntry(null)">Nueva entrada</UiButton>
            </div>
            <p class="mt-4 text-sm text-slate-600 dark:text-muted">Las entradas crean lotes y registran kardex a costo real.</p>
          </div>

          <div v-if="activeTab === 'lots'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <UiDataTable overflow="auto" min-width="min-w-[820px]">
              <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                <tr>
                  <th class="px-4 py-3">Lote</th>
                  <th class="px-4 py-3">Producto</th>
                  <th class="px-4 py-3">Fecha</th>
                  <th class="px-4 py-3">Disponible</th>
                  <th class="px-4 py-3">Costo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-line">
                <tr v-for="lot in lots" :key="lot.id" class="text-sm">
                  <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ lot.lot_code }}</td>
                  <td class="px-4 py-3">{{ lot.catalog_item?.name ?? 'Producto' }}</td>
                  <td class="px-4 py-3">{{ lot.received_date || 'Sin fecha' }}</td>
                  <td class="px-4 py-3">{{ formatQuantity(lot.available_quantity) }}</td>
                  <td class="px-4 py-3">{{ formatMoney(lot.unit_cost) }}</td>
                </tr>
                <tr v-if="lots.length === 0">
                  <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin lotes registrados.</td>
                </tr>
              </tbody>
            </UiDataTable>
          </div>

          <div v-if="activeTab === 'kardex'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <UiDataTable overflow="auto" min-width="min-w-[900px]">
              <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                <tr>
                  <th class="px-4 py-3">Producto</th>
                  <th class="px-4 py-3">Tipo</th>
                  <th class="px-4 py-3">Motivo</th>
                  <th class="px-4 py-3">Cantidad</th>
                  <th class="px-4 py-3">Costo</th>
                  <th class="px-4 py-3">Referencia</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-line">
                <tr v-for="movement in movements" :key="movement.id" class="text-sm">
                  <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ movement.catalog_item?.name ?? 'Producto' }}</td>
                  <td class="px-4 py-3"><UiStatusBadge :tone="movementTone(movement.movement_type)">{{ movement.movement_type === 'entry' ? 'Entrada' : 'Salida' }}</UiStatusBadge></td>
                  <td class="px-4 py-3">{{ movement.reason }}</td>
                  <td class="px-4 py-3">{{ formatQuantity(movement.quantity) }}</td>
                  <td class="px-4 py-3">{{ movement.unit_cost === null ? 'N/D' : formatMoney(movement.unit_cost) }}</td>
                  <td class="px-4 py-3">{{ movement.reference_number || movement.reference_id || movement.created_at }}</td>
                </tr>
                <tr v-if="movements.length === 0">
                  <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="6">Sin movimientos registrados.</td>
                </tr>
              </tbody>
            </UiDataTable>
          </div>

          <div v-if="activeTab === 'adjustments'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <form class="grid gap-4 lg:grid-cols-2" @submit.prevent="saveAdjustment">
              <UiSelect v-model="adjustmentForm.catalog_item_id" label="Producto" :options="inventoryOptions" />
              <UiSelect v-model="adjustmentForm.direction" label="Tipo" :options="[{ value: 'entry', label: 'Entrada' }, { value: 'exit', label: 'Salida' }]" />
              <UiInput v-model="adjustmentForm.quantity" label="Cantidad" type="number" min="0.001" step="0.001" />
              <UiInput v-model="adjustmentForm.unit_cost" label="Costo unitario" type="number" min="0" step="0.0001" />
              <div class="lg:col-span-2">
                <UiInput v-model="adjustmentForm.notes" label="Notas" placeholder="Motivo del ajuste" />
              </div>
              <div class="flex justify-end lg:col-span-2">
                <UiButton type="submit" :disabled="saving || !adjustmentForm.catalog_item_id">Registrar ajuste</UiButton>
              </div>
            </form>
          </div>

          <div v-if="activeTab === 'suppliers'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Proveedores</h3>
              <UiButton @click="supplierOpen = true">Nuevo proveedor</UiButton>
            </div>
            <div class="mt-4 divide-y divide-slate-100 dark:divide-line">
              <div v-for="supplier in suppliers" :key="supplier.id" class="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p class="font-semibold text-slate-950 dark:text-text">{{ supplier.name }}</p>
                  <p class="text-xs text-slate-500 dark:text-soft">{{ supplier.tax_id || 'Sin NIT' }}<span v-if="supplier.nrc"> · NRC {{ supplier.nrc }}</span></p>
                </div>
                <UiStatusBadge tone="success">Activo</UiStatusBadge>
              </div>
              <p v-if="suppliers.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-muted">Sin proveedores registrados.</p>
            </div>
          </div>
        </template>
    </div>

    <UiModalShell
      :open="stockEntryOpen"
      title="Entrada de inventario"
      :description="selectedItem ? selectedItem.name : ''"
      max-width="max-w-xl"
      @close="stockEntryOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveEntry">
        <UiSelect
          v-if="!selectedItem"
          v-model="entryForm.catalog_item_id"
          label="Producto"
          :options="inventoryOptions"
        />
        <div class="grid gap-4 md:grid-cols-2">
          <UiInput v-model="entryForm.purchase_date" label="Fecha" type="date" required />
          <UiInput v-model="entryForm.document_number" label="Documento" placeholder="Factura, CCF o referencia" />
          <UiInput v-model="entryForm.quantity" label="Cantidad" type="number" min="0.001" step="0.001" required />
          <UiInput v-model="entryForm.unit_cost" label="Costo unitario" type="number" min="0" step="0.0001" required />
        </div>
        <UiInput v-model="entryForm.document_type" label="Tipo de documento" placeholder="Opcional" />
        <div class="flex justify-end gap-2">
          <UiButton type="button" variant="ghost" @click="stockEntryOpen = false">Cancelar</UiButton>
          <UiButton type="submit" :disabled="saving || (!selectedItem && !entryForm.catalog_item_id)">Registrar entrada</UiButton>
        </div>
      </form>
    </UiModalShell>

    <UiModalShell
      :open="supplierOpen"
      title="Nuevo proveedor"
      max-width="max-w-xl"
      @close="supplierOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveSupplier">
        <UiInput v-model="supplierForm.name" label="Nombre" required />
        <div class="grid gap-4 md:grid-cols-2">
          <UiInput v-model="supplierForm.tax_id" label="NIT/DUI" />
          <UiInput v-model="supplierForm.nrc" label="NRC" />
          <UiInput v-model="supplierForm.phone" label="Teléfono" />
          <UiInput v-model="supplierForm.email" label="Correo" type="email" />
        </div>
        <UiInput v-model="supplierForm.address" label="Dirección" />
        <div class="flex justify-end gap-2">
          <UiButton type="button" variant="ghost" @click="supplierOpen = false">Cancelar</UiButton>
          <UiButton type="submit" :disabled="saving || !supplierForm.name.trim()">Crear proveedor</UiButton>
        </div>
      </form>
    </UiModalShell>
  </BillingSectionLayout>
</template>
