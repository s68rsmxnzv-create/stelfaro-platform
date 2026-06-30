<script setup lang="ts">
// @ts-nocheck
import { PlatformClient } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiInput, UiLoadingMark, UiModalShell, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { computed, onMounted, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingProcessToastOverlay from '../components/BillingProcessToastOverlay.vue';
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
const savingAction = ref('');
const items = ref([]);
const catalogItems = ref([]);
const categories = ref([]);
const lots = ref([]);
const movements = ref([]);
const suppliers = ref([]);
const toasts = ref([]);
const stockEntryOpen = ref(false);
const supplierOpen = ref(false);
const resolveLineIndex = ref(null);
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
const purchaseImport = ref({
  fileName: '',
  preview: null,
  supplier_id: '',
  create_supplier: false,
  supplier: { name: '', tax_id: '', nrc: '', phone: '', email: '', address: '' },
  document: {
    document_type: 'dte_ccf',
    document_mode: 'dte',
    document_number: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    payment_condition: 'cash',
    subtotal: 0,
    tax_amount: 0,
    document_total: 0,
    is_consumable: false,
    apply_tax_perceived: false,
    tax_perceived_mode: 'auto',
    tax_perceived_rate: 1,
    tax_perceived_amount: 0,
    apply_fuel_charges: false,
    fovial_per_unit: 0,
    cotrans_per_unit: 0,
    fiscal_profile: '',
    fiscal_sector: ''
  },
  lines: [],
  import_metadata: null
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
const catalogOptions = computed(() => catalogItems.value.map((item) => ({
  value: String(item.id),
  label: item.name,
  hint: `${item.sku || 'Sin código'} · ${item.controls_inventory ? 'Inventario' : 'Catálogo'}`
})));
const categoryOptions = computed(() => categories.value.map((category) => ({
  value: String(category.id),
  label: category.name,
  hint: category.kind || 'mixta'
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
const activeResolveLine = computed(() => {
  if (resolveLineIndex.value === null) return null;

  return purchaseImport.value.lines[resolveLineIndex.value] ?? null;
});
const purchaseDocumentLabel = computed(() => ({
  dte_ccf: 'DTE CCF',
  dte_fcf: 'DTE FC',
  ccf: 'CCF físico',
  fcf: 'FC física',
  fse: 'FSE',
  nota_envio: 'Nota de envío'
}[purchaseImport.value.document.document_type] ?? (purchaseImport.value.document.document_type || 'Documento')));
const purchasePaymentLabel = computed(() => purchaseImport.value.document.payment_condition === 'credit' ? 'Crédito' : 'Contado');
const purchaseImportSubtotal = computed(() => {
  const dteSubtotal = Number(purchaseImport.value.document.subtotal ?? 0);
  if (purchaseImport.value.document.document_mode === 'dte' && dteSubtotal > 0) return dteSubtotal;

  return roundMoney(purchaseImport.value.lines.reduce((sum, line) => sum + Number(line.subtotal ?? (Number(line.quantity || 0) * Number(line.unit_cost || 0))), 0));
});
const purchaseImportTax = computed(() => {
  if (['nota_envio', 'manual'].includes(String(purchaseImport.value.document.document_type || ''))) return 0;

  const dteTax = Number(purchaseImport.value.document.tax_amount ?? 0);
  if (purchaseImport.value.document.document_mode === 'dte') return dteTax;

  return roundMoney(purchaseImportSubtotal.value * 0.13);
});
const purchaseImportFuel = computed(() => {
  if (!purchaseImport.value.document.apply_fuel_charges) return 0;

  const quantity = purchaseImport.value.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  return roundMoney(quantity * (Number(purchaseImport.value.document.fovial_per_unit || 0) + Number(purchaseImport.value.document.cotrans_per_unit || 0)));
});
const purchaseImportPerceived = computed(() => {
  if (!purchaseImport.value.document.apply_tax_perceived) return 0;

  const detectedAmount = Number(purchaseImport.value.document.tax_perceived_amount || 0);
  if (detectedAmount > 0) return detectedAmount;

  const rate = purchaseImport.value.document.tax_perceived_mode === 'manual'
    ? Number(purchaseImport.value.document.tax_perceived_rate || 0) / 100
    : 0.01;

  return roundMoney(purchaseImportSubtotal.value * rate);
});
const purchaseImportCalculatedTotal = computed(() => roundMoney(purchaseImportSubtotal.value + purchaseImportTax.value + purchaseImportFuel.value + purchaseImportPerceived.value));
const purchaseImportDifference = computed(() => roundMoney(Number(purchaseImport.value.document.document_total || 0) - purchaseImportCalculatedTotal.value));
const purchaseImportTotalsOk = computed(() => Math.abs(purchaseImportDifference.value) <= 0.02);
const purchaseImportResolvedLines = computed(() => purchaseImport.value.lines.filter((line) => lineResolved(line)).length);
const purchaseImportCanRegister = computed(() => {
  const supplierReady = purchaseImport.value.create_supplier
    ? purchaseImport.value.supplier.name.trim() !== ''
    : purchaseImport.value.supplier_id !== '';

  return Boolean(purchaseImport.value.preview)
    && supplierReady
    && purchaseImport.value.lines.length > 0
    && purchaseImport.value.lines.every((line) => lineResolved(line))
    && purchaseImportTotalsOk.value;
});
const processOverlayOpen = computed(() => saving.value && savingAction.value === 'purchase');

watch(tenantId, loadInventory);
onMounted(loadInventory);

async function loadInventory(): Promise<void> {
  if (!tenantId.value) return;

  loading.value = true;
  try {
    const [inventoryItemResponse, catalogItemResponse, lotResponse, movementResponse, supplierResponse, categoryResponse] = await Promise.all([
      client.value.catalogItems(tenantId.value, { status: 'active', controls_inventory: true, per_page: 100 }),
      client.value.catalogItems(tenantId.value, { status: 'active', per_page: 100 }),
      client.value.inventoryLots(tenantId.value, { available_only: false, per_page: 100 }),
      client.value.inventoryMovements(tenantId.value, { per_page: 100 }),
      client.value.inventorySuppliers(tenantId.value, { status: 'active', per_page: 100 }),
      client.value.catalogCategories(tenantId.value, { status: 'active' })
    ]);
    items.value = inventoryItemResponse.data ?? [];
    catalogItems.value = catalogItemResponse.data ?? [];
    lots.value = lotResponse.data ?? [];
    movements.value = movementResponse.data ?? [];
    suppliers.value = supplierResponse.data ?? [];
    categories.value = categoryResponse.data ?? [];
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

async function importPurchaseJson(event): Promise<void> {
  const file = event?.target?.files?.[0] ?? null;
  if (!tenantId.value || !file) return;

  saving.value = true;
  try {
    const payload = JSON.parse(await file.text());
    const response = await client.value.importInventoryPurchaseDteJson(tenantId.value, payload);
    const preview = response.data;
    const supplierSource = preview.supplier.matched ?? preview.supplier.from_json;
    purchaseImport.value.fileName = file.name;
    purchaseImport.value.preview = preview;
    purchaseImport.value.supplier_id = preview.supplier.matched ? String(preview.supplier.matched.id) : '';
    purchaseImport.value.create_supplier = !preview.supplier.matched;
    purchaseImport.value.supplier = {
      name: normalizeSupplierName(supplierSource.name || ''),
      tax_id: formatNit(supplierSource.tax_id || ''),
      nrc: formatNrc(supplierSource.nrc || ''),
      phone: formatPhone(preview.supplier.from_json.phone || ''),
      email: preview.supplier.from_json.email || '',
      address: preview.supplier.from_json.address || ''
    };
    purchaseImport.value.document = {
      ...purchaseImport.value.document,
      ...preview.document,
      is_consumable: false,
      apply_tax_perceived: Boolean(preview.document.apply_tax_perceived),
      tax_perceived_mode: preview.document.tax_perceived_mode || 'auto',
      tax_perceived_rate: Number(preview.document.tax_perceived_rate || 1),
      tax_perceived_amount: Number(preview.document.tax_perceived_amount || 0),
      fiscal_profile: '',
      fiscal_sector: ''
    };
    purchaseImport.value.lines = preview.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      subtotal: line.subtotal,
      unit_code: line.unit_code,
      supplier_code: line.supplier_code || '',
      no_inventory: line.no_inventory,
      catalog_item_id: line.matched_catalog_item ? String(line.matched_catalog_item.id) : '',
      create_item: !line.matched_catalog_item,
      new_item_name: line.description,
      category_id: '',
      new_category_name: '',
      controls_inventory: !line.no_inventory
    }));
    purchaseImport.value.import_metadata = preview.import_metadata;
    notify('JSON cargado', 'Revisa proveedor y líneas antes de registrar.', 'success');
  } catch (error) {
    notify('No se pudo importar JSON', messageFromError(error), 'error');
  } finally {
    saving.value = false;
    if (event?.target) event.target.value = '';
  }
}

async function registerImportedPurchase(): Promise<void> {
  if (!tenantId.value || !purchaseImport.value.preview) return;

  saving.value = true;
  savingAction.value = 'purchase';
  try {
    const supplierId = await resolvePurchaseSupplier();
    const lines = [];
    for (const line of purchaseImport.value.lines) {
      const catalogItemId = await resolvePurchaseLineItem(line);
      lines.push({
        catalog_item_id: catalogItemId,
        description: line.description,
        unit_code: line.unit_code || '59',
        quantity: Number(line.quantity || 0),
        unit_cost: Number(line.unit_cost || 0),
        subtotal: line.subtotal !== undefined && line.subtotal !== null ? Number(line.subtotal || 0) : null,
        no_inventory: Boolean(line.no_inventory),
        price_includes_tax: false
      });
    }

    await client.value.createInventoryPurchase(tenantId.value, {
      inventory_supplier_id: supplierId,
      document_type: purchaseImport.value.document.document_type || null,
      document_mode: purchaseImport.value.document.document_mode || 'dte',
      document_number: purchaseImport.value.document.document_number || null,
      payment_condition: purchaseImport.value.document.payment_condition || 'cash',
      tax_amount: Number(purchaseImport.value.document.tax_amount || 0),
      document_total: Number(purchaseImport.value.document.document_total || 0),
      purchase_date: purchaseImport.value.document.purchase_date,
      is_consumable: Boolean(purchaseImport.value.document.is_consumable),
      apply_tax_perceived: Boolean(purchaseImport.value.document.apply_tax_perceived),
      tax_perceived_mode: purchaseImport.value.document.tax_perceived_mode || 'auto',
      tax_perceived_rate: Number(purchaseImport.value.document.tax_perceived_rate || 1),
      tax_perceived_amount: Number(purchaseImport.value.document.tax_perceived_amount || 0),
      apply_fuel_charges: Boolean(purchaseImport.value.document.apply_fuel_charges),
      fovial_per_unit: Number(purchaseImport.value.document.fovial_per_unit || 0),
      cotrans_per_unit: Number(purchaseImport.value.document.cotrans_per_unit || 0),
      fiscal_profile: purchaseImport.value.document.fiscal_profile || null,
      fiscal_sector: purchaseImport.value.document.fiscal_sector ? Number(purchaseImport.value.document.fiscal_sector) : null,
      supplier_snapshot: purchaseImport.value.supplier,
      import_metadata: purchaseImport.value.import_metadata,
      lines
    });

    notify('Compra registrada', 'Se crearon lotes y kardex para las líneas inventariables.', 'success');
    clearPurchaseImport();
    await loadInventory();
  } catch (error) {
    notify('No se pudo registrar compra', messageFromError(error), 'error');
  } finally {
    saving.value = false;
    savingAction.value = '';
  }
}

async function resolvePurchaseSupplier(): Promise<number | null> {
  if (!purchaseImport.value.create_supplier) {
    return purchaseImport.value.supplier_id ? Number(purchaseImport.value.supplier_id) : null;
  }

  if (!purchaseImport.value.supplier.name.trim()) {
    throw new Error('Debes ingresar el nombre del proveedor.');
  }

  const response = await client.value.createInventorySupplier(tenantId.value, {
    name: purchaseImport.value.supplier.name.trim(),
    tax_id: purchaseImport.value.supplier.tax_id.trim() || null,
    nrc: purchaseImport.value.supplier.nrc.trim() || null,
    phone: purchaseImport.value.supplier.phone.trim() || null,
    email: purchaseImport.value.supplier.email.trim() || null,
    address: purchaseImport.value.supplier.address.trim() || null
  });

  return response.data.id;
}

async function resolvePurchaseLineItem(line): Promise<number> {
  if (!line.create_item && line.catalog_item_id) {
    return Number(line.catalog_item_id);
  }

  const categoryId = await resolvePurchaseCategory(line);
  const response = await client.value.createCatalogItem(tenantId.value, {
    catalog_category_id: categoryId,
    name: line.new_item_name.trim() || line.description,
    item_type: line.no_inventory ? 'service' : 'part',
    unit_code: line.unit_code || '59',
    controls_inventory: !line.no_inventory && Boolean(line.controls_inventory),
    reference_cost: Number(line.unit_cost || 0),
    base_price: 0,
    status: 'active'
  });

  return response.data.id;
}

async function resolvePurchaseCategory(line): Promise<number | null> {
  if (line.category_id) {
    return Number(line.category_id);
  }

  const name = line.new_category_name.trim();
  if (!name) {
    return null;
  }

  const response = await client.value.createCatalogCategory(tenantId.value, {
    name,
    kind: line.no_inventory ? 'service' : 'product',
    status: 'active'
  });

  return response.data.id;
}

function clearPurchaseImport(): void {
  purchaseImport.value.fileName = '';
  purchaseImport.value.preview = null;
  purchaseImport.value.supplier_id = '';
  purchaseImport.value.create_supplier = false;
  purchaseImport.value.lines = [];
  purchaseImport.value.import_metadata = null;
}

function openLineResolver(index: number): void {
  resolveLineIndex.value = index;
}

function closeLineResolver(): void {
  resolveLineIndex.value = null;
}

function lineResolved(line): boolean {
  if (line.create_item) {
    return Boolean((line.new_item_name || line.description || '').trim());
  }

  return Boolean(line.catalog_item_id);
}

function lineLinkedItemName(line): string {
  const item = catalogItems.value.find((candidate) => String(candidate.id) === String(line.catalog_item_id));

  return item?.name ?? 'Pendiente';
}

function lineModeLabel(line): string {
  if (purchaseImport.value.document.is_consumable || line.no_inventory) return 'No inventario';
  if (line.create_item) return line.controls_inventory ? 'Nuevo inventariable' : 'Nuevo catálogo';

  const item = catalogItems.value.find((candidate) => String(candidate.id) === String(line.catalog_item_id));

  return item?.controls_inventory ? 'Inventario' : 'Catálogo';
}

function normalizeSupplierName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function formatNit(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value.trim();

  return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`;
}

function formatNrc(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length <= 1) return value.trim();

  return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
}

function formatPhone(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return value.trim();

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function updateImportedSupplierName(value: string): void {
  purchaseImport.value.supplier.name = normalizeSupplierName(value);
}

function updateImportedSupplierNit(value: string): void {
  purchaseImport.value.supplier.tax_id = formatNit(value);
}

function updateImportedSupplierNrc(value: string): void {
  purchaseImport.value.supplier.nrc = formatNrc(value);
}

function updateImportedSupplierPhone(value: string): void {
  purchaseImport.value.supplier.phone = formatPhone(value);
}

function formatMoney(value): string {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function roundMoney(value): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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
    <BillingProcessToastOverlay
      :open="processOverlayOpen"
      title="Registrando compra"
      message="Creando proveedor, productos, lotes y kardex según corresponda."
    />

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

          <div v-if="activeTab === 'entries'" class="space-y-4">
            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-base font-bold text-slate-950 dark:text-text">Compras y entradas</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-muted">Registra entradas rápidas o importa el JSON DTE recibido del proveedor.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <label class="inline-flex cursor-pointer items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-200 dark:bg-surface-muted dark:text-text dark:hover:bg-surface-raised">
                    Importar JSON
                    <input class="sr-only" type="file" accept=".json,application/json" :disabled="saving" @change="importPurchaseJson" />
                  </label>
                  <UiButton :disabled="items.length === 0" @click="openEntry(null)">Entrada rápida</UiButton>
                </div>
              </div>
            </div>

            <div v-if="purchaseImport.preview" class="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:shadow-none">
              <div class="border-b border-slate-200 px-5 py-4 dark:border-line">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Compra importada</p>
                    <h3 class="mt-1 text-xl font-black text-slate-950 dark:text-text">{{ purchaseDocumentLabel }}</h3>
                    <p class="mt-1 max-w-full truncate text-sm text-slate-600 dark:text-muted">{{ purchaseImport.document.document_number || 'Sin código de generación' }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UiStatusBadge :tone="purchaseImportTotalsOk ? 'success' : 'warning'">{{ purchaseImportTotalsOk ? 'Totales OK' : 'Revisar total' }}</UiStatusBadge>
                    <UiStatusBadge :tone="purchaseImportResolvedLines === purchaseImport.lines.length ? 'success' : 'warning'">{{ purchaseImportResolvedLines }}/{{ purchaseImport.lines.length }} líneas</UiStatusBadge>
                    <UiButton variant="ghost" @click="clearPurchaseImport">Limpiar</UiButton>
                  </div>
                </div>

                <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Fecha</p>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ purchaseImport.document.purchase_date || 'N/D' }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Condición</p>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ purchasePaymentLabel }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Archivo</p>
                    <p class="mt-1 truncate font-semibold text-slate-950 dark:text-text">{{ purchaseImport.fileName }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Documento</p>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ purchaseDocumentLabel }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Total DTE</p>
                    <p class="mt-1 text-lg font-black text-slate-950 dark:text-text">{{ formatMoney(purchaseImport.document.document_total) }}</p>
                  </div>
                </div>
              </div>

              <div class="grid gap-0 lg:grid-cols-[1fr_320px]">
                <div class="min-w-0 px-5 py-5">
                  <section class="rounded-md border border-slate-200 dark:border-line">
                    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-line">
                      <div>
                        <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Proveedor</p>
                        <p class="mt-1 text-base font-bold text-slate-950 dark:text-text">{{ purchaseImport.supplier.name || 'Proveedor pendiente' }}</p>
                        <p class="mt-1 text-sm text-slate-600 dark:text-muted">
                          {{ purchaseImport.supplier.tax_id || 'Sin NIT' }}
                          <span v-if="purchaseImport.supplier.nrc"> · NRC {{ purchaseImport.supplier.nrc }}</span>
                          <span v-if="purchaseImport.supplier.phone"> · {{ purchaseImport.supplier.phone }}</span>
                        </p>
                      </div>
                      <UiStatusBadge :tone="purchaseImport.create_supplier ? 'warning' : 'success'">{{ purchaseImport.create_supplier ? 'Nuevo proveedor' : 'Proveedor vinculado' }}</UiStatusBadge>
                    </div>
                    <div class="px-4 py-4">
                      <div v-if="!purchaseImport.create_supplier" class="grid gap-3 md:grid-cols-3">
                        <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                          <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Nombre</p>
                          <p class="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-text">{{ purchaseImport.supplier.name }}</p>
                        </div>
                        <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                          <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">NIT / NRC</p>
                          <p class="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-text">{{ purchaseImport.supplier.tax_id || 'Sin NIT' }}<span v-if="purchaseImport.supplier.nrc"> · {{ purchaseImport.supplier.nrc }}</span></p>
                        </div>
                        <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                          <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Origen</p>
                          <p class="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-text">Base de proveedores</p>
                        </div>
                      </div>
                      <template v-if="purchaseImport.create_supplier">
                        <div class="grid gap-4 md:grid-cols-2">
                          <UiInput
                            :model-value="purchaseImport.supplier.name"
                            label="Nombre proveedor"
                            @update:model-value="updateImportedSupplierName"
                          />
                          <UiInput
                            :model-value="purchaseImport.supplier.tax_id"
                            label="NIT"
                            @update:model-value="updateImportedSupplierNit"
                          />
                          <UiInput
                            :model-value="purchaseImport.supplier.nrc"
                            label="NRC"
                            @update:model-value="updateImportedSupplierNrc"
                          />
                          <UiInput
                            :model-value="purchaseImport.supplier.phone"
                            label="Teléfono"
                            @update:model-value="updateImportedSupplierPhone"
                          />
                        </div>
                      </template>
                    </div>
                  </section>

                  <section class="mt-5 rounded-md border border-slate-200 dark:border-line">
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-line">
                      <div>
                        <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Detalle</p>
                        <p class="mt-1 text-base font-bold text-slate-950 dark:text-text">Líneas del documento</p>
                      </div>
                      <UiStatusBadge :tone="purchaseImportResolvedLines === purchaseImport.lines.length ? 'success' : 'warning'">
                        {{ purchaseImportResolvedLines }} resueltas
                      </UiStatusBadge>
                    </div>
                    <UiDataTable overflow="auto" min-width="min-w-[940px]">
                      <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                        <tr>
                          <th class="px-4 py-3">Descripción DTE</th>
                          <th class="px-4 py-3">Resolución</th>
                          <th class="px-4 py-3">Modo</th>
                          <th class="px-4 py-3 text-right">Cantidad</th>
                          <th class="px-4 py-3 text-right">Costo</th>
                          <th class="px-4 py-3 text-right">Total</th>
                          <th class="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-line">
                        <tr v-for="(line, idx) in purchaseImport.lines" :key="`${line.description}-${idx}`" class="text-sm">
                          <td class="px-4 py-3">
                            <p class="max-w-[320px] truncate font-semibold text-slate-950 dark:text-text">{{ line.description }}</p>
                            <p class="text-xs text-slate-500 dark:text-soft">Unidad {{ line.unit_code || '59' }}</p>
                          </td>
                          <td class="px-4 py-3">
                            <p class="max-w-[240px] truncate font-semibold text-slate-950 dark:text-text">{{ line.create_item ? (line.new_item_name || 'Nuevo ítem') : lineLinkedItemName(line) }}</p>
                            <p class="text-xs text-slate-500 dark:text-soft">{{ lineResolved(line) ? 'Lista para registrar' : 'Pendiente de resolver' }}</p>
                          </td>
                          <td class="px-4 py-3">
                            <UiStatusBadge :tone="line.no_inventory || purchaseImport.document.is_consumable ? 'neutral' : 'success'">{{ lineModeLabel(line) }}</UiStatusBadge>
                          </td>
                          <td class="px-4 py-3 text-right font-semibold">{{ formatQuantity(line.quantity) }}</td>
                          <td class="px-4 py-3 text-right">{{ formatMoney(line.unit_cost) }}</td>
                          <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(Number(line.quantity || 0) * Number(line.unit_cost || 0)) }}</td>
                          <td class="px-4 py-3 text-right">
                            <UiButton size="sm" variant="secondary" @click="openLineResolver(idx)">Resolver</UiButton>
                          </td>
                        </tr>
                      </tbody>
                    </UiDataTable>
                  </section>
                </div>

                <aside class="border-t border-slate-200 px-5 py-5 dark:border-line lg:border-l lg:border-t-0">
                  <div class="rounded-md border border-slate-200 p-4 dark:border-line">
                    <p class="text-sm font-black text-slate-950 dark:text-text">Resumen</p>
                    <div class="mt-4 space-y-2 text-sm">
                      <div class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">Subtotal</span>
                        <strong>{{ formatMoney(purchaseImportSubtotal) }}</strong>
                      </div>
                      <div class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">IVA estimado</span>
                        <strong>{{ formatMoney(purchaseImportTax) }}</strong>
                      </div>
                      <div v-if="purchaseImport.document.apply_tax_perceived" class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">IVA percibido</span>
                        <strong>{{ formatMoney(purchaseImportPerceived) }}</strong>
                      </div>
                      <div v-if="purchaseImport.document.apply_fuel_charges" class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">FOVIAL/COTRANS</span>
                        <strong>{{ formatMoney(purchaseImportFuel) }}</strong>
                      </div>
                      <div class="border-t border-slate-200 pt-3 dark:border-line">
                        <div class="flex justify-between gap-4">
                          <span class="font-bold text-slate-950 dark:text-text">Calculado</span>
                          <strong>{{ formatMoney(purchaseImportCalculatedTotal) }}</strong>
                        </div>
                        <div class="mt-2 flex justify-between gap-4">
                          <span class="font-bold text-slate-950 dark:text-text">Total DTE</span>
                          <strong>{{ formatMoney(purchaseImport.document.document_total) }}</strong>
                        </div>
                        <div class="mt-2 flex justify-between gap-4" :class="purchaseImportTotalsOk ? 'text-emerald-700 dark:text-success' : 'text-amber-700 dark:text-warning'">
                          <span class="font-bold">Diferencia</span>
                          <strong>{{ formatMoney(purchaseImportDifference) }}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 rounded-md border border-slate-200 p-4 dark:border-line">
                    <p class="text-sm font-black text-slate-950 dark:text-text">Ajustes</p>
                    <div class="mt-3 space-y-3">
                      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-muted">
                        <input v-model="purchaseImport.document.is_consumable" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
                        Compra consumible
                      </label>
                      <div v-if="Number(purchaseImport.document.tax_perceived_amount || 0) > 0" class="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-success/50 dark:bg-surface-2">
                        <span class="font-semibold text-slate-800 dark:text-text">IVA percibido detectado</span>
                        <span class="shrink-0 rounded bg-emerald-100 px-2 py-1 font-black text-emerald-800 dark:bg-success-soft dark:text-success">{{ formatMoney(purchaseImport.document.tax_perceived_amount) }}</span>
                      </div>
                      <label v-else class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-muted">
                        <input v-model="purchaseImport.document.apply_tax_perceived" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
                        IVA percibido
                      </label>
                      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-muted">
                        <input v-model="purchaseImport.document.apply_fuel_charges" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
                        FOVIAL/COTRANS
                      </label>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-col gap-2">
                    <UiButton :disabled="saving || !purchaseImportCanRegister" @click="registerImportedPurchase">Registrar compra</UiButton>
                    <p v-if="!purchaseImportCanRegister" class="text-xs text-slate-500 dark:text-soft">Resuelve proveedor, líneas y diferencia de totales antes de registrar.</p>
                  </div>
                </aside>
              </div>
            </div>
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
      :open="Boolean(activeResolveLine)"
      title="Resolver línea"
      :description="activeResolveLine?.description || ''"
      max-width="max-w-2xl"
      @close="closeLineResolver"
    >
      <div v-if="activeResolveLine" class="space-y-5">
        <div class="rounded-md border border-slate-200 p-4 dark:border-line">
          <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Línea DTE</p>
          <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ activeResolveLine.description }}</p>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <UiInput v-model="activeResolveLine.quantity" label="Cantidad" type="number" min="0.001" step="0.001" />
            <UiInput v-model="activeResolveLine.unit_cost" label="Costo unitario" type="number" min="0" step="0.0001" />
            <UiInput v-model="activeResolveLine.unit_code" label="Unidad" />
          </div>
        </div>

        <div class="rounded-md border border-slate-200 p-4 dark:border-line">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-black text-slate-950 dark:text-text">Resolución operativa</p>
              <p class="mt-1 text-sm text-slate-600 dark:text-muted">Define cómo quedará relacionada esta línea con el catálogo.</p>
            </div>
            <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-muted">
              <input v-model="activeResolveLine.create_item" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
              Crear ítem
            </label>
          </div>

          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <UiSelect
              v-if="!activeResolveLine.create_item"
              v-model="activeResolveLine.catalog_item_id"
              label="Producto existente"
              :options="catalogOptions"
            />
            <template v-else>
              <UiInput v-model="activeResolveLine.new_item_name" label="Nombre nuevo" />
              <UiSelect v-model="activeResolveLine.category_id" label="Categoría" :options="categoryOptions" />
              <UiInput v-model="activeResolveLine.new_category_name" label="Nueva categoría" placeholder="Opcional" />
              <label class="flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-muted">
                <input v-model="activeResolveLine.controls_inventory" type="checkbox" class="h-4 w-4 rounded border-slate-300" :disabled="activeResolveLine.no_inventory" />
                Afecta inventario
              </label>
            </template>

            <label class="flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-muted">
              <input v-model="activeResolveLine.no_inventory" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
              No ingresa a inventario
            </label>
          </div>
        </div>

        <div class="flex justify-end">
          <UiButton :disabled="!lineResolved(activeResolveLine)" @click="closeLineResolver">Aplicar</UiButton>
        </div>
      </div>
    </UiModalShell>

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
