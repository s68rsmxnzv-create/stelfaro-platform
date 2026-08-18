<script setup lang="ts">
// @ts-nocheck
import { PlatformClient } from '@stelfaro/api-client';
import { UiActionDropdown, UiActionMenuItem, UiButton, UiCheckbox, UiDataTable, UiFileUpload, UiInput, UiLoadingMark, UiModalShell, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingPaginationBar from '../components/BillingPaginationBar.vue';
import BillingProcessToastOverlay from '../components/BillingProcessToastOverlay.vue';
import BillingSectionLayout from '../components/BillingSectionLayout.vue';
import { inventoryMovementReasonLabel } from '../support/inventoryMovementLabels';

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

const INVENTORY_CHANGED_EVENT = 'stelfaro:inventory-changed';
const INVENTORY_ACTIVE_VIEW_KEY = 'stelfaro:inventory-active-view';
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
const purchases = ref([]);
const fiscalScope = ref(null);
const salesReport = ref([]);
const marginReport = ref([]);
const stockAlerts = ref([]);
const inventorySummary = ref(null);
const selectedBranchId = ref('');
const toasts = ref([]);
const supplierOpen = ref(false);
const resolveLineIndex = ref(null);
const productDetailItem = ref(null);
const selectedLot = ref(null);
const selectedPurchase = ref(null);
const duplicatePurchase = ref(null);
const filters = ref({ q: '' });
const lotFilters = ref({
  q: '',
  status: '',
  catalog_item_id: '',
  inventory_supplier_id: '',
  from: '',
  to: ''
});
const purchaseFilters = ref({
  q: '',
  document_mode: '',
  supplier_id: '',
  from: '',
  to: ''
});
const stockPage = ref(1);
const stockPageSize = ref('12');
const adjustmentForm = ref({
  catalog_item_id: '',
  direction: 'entry',
  quantity: 1,
  unit_cost: 0,
  notes: ''
});
const countForm = ref({
  count_date: new Date().toISOString().slice(0, 10),
  catalog_item_id: '',
  counted_quantity: 0,
  notes: ''
});
const transferForm = ref({
  from_core_sucursal_id: '',
  to_core_sucursal_id: '',
  catalog_item_id: '',
  quantity: 1,
  notes: ''
});
const reportFilters = ref({
  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10)
});
const supplierForm = ref({
  name: '',
  tax_id: '',
  nrc: '',
  phone: '',
  email: '',
  address: ''
});
const compraImportada = ref({
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
  { key: 'overview', label: 'Resumen', detail: 'Estado general', icon: 'summary', group: 'Frecuente' },
  { key: 'stock', label: 'Existencias', detail: 'Productos y stock', icon: 'stock', group: 'Frecuente' },
  { key: 'entries', label: 'Entradas', detail: 'Compras y lotes', icon: 'entries', group: 'Frecuente' },
  { key: 'purchases', label: 'Compras', detail: 'Historial', icon: 'purchases', group: 'Frecuente' },
  { key: 'lots', label: 'Lotes', detail: 'Disponibilidad FIFO', icon: 'lots', group: 'Seguimiento' },
  { key: 'kardex', label: 'Kardex', detail: 'Movimientos', icon: 'kardex', group: 'Seguimiento' },
  { key: 'reports', label: 'Reportes', detail: 'Ventas y margen', icon: 'report-document', group: 'Seguimiento' },
  { key: 'alerts', label: 'Alertas', detail: 'Stock mínimo', icon: 'alerts', group: 'Seguimiento' },
  { key: 'transfers', label: 'Transferencias', detail: 'Entre sucursales', icon: 'transfers', group: 'Operaciones' },
  { key: 'counts', label: 'Conteo', detail: 'Inventario físico', icon: 'counts', group: 'Operaciones' },
  { key: 'adjustments', label: 'Ajustes', detail: 'Correcciones', icon: 'adjustments', group: 'Operaciones' },
  { key: 'suppliers', label: 'Proveedores', detail: 'Compras', icon: 'suppliers', group: 'Administración' }
];
const validTabKeys = new Set(tabs.map((tab) => tab.key));
const sectionNavItems = computed(() => tabs.map((tab) => ({ ...tab, id: tab.key })));
const inventoryOptions = computed(() => items.value.map((item) => ({
  value: String(item.id),
  label: item.name,
  hint: item.sku || 'Sin código'
})));
const supplierOptions = computed(() => [
  { value: '', label: 'Selecciona proveedor', hint: 'Requerido' },
  ...suppliers.value.map((supplier) => ({
    value: String(supplier.id),
    label: supplier.name,
    hint: supplier.tax_id || supplier.nrc || 'Proveedor'
  }))
]);
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
const branchOptions = computed(() => (fiscalScope.value?.sucursales ?? []).map((branch) => ({
  value: String(branch.id),
  label: `${branch.codigo || 'Sucursal'} · ${branch.nombre}`,
  hint: branch.puntos_venta?.length ? `${branch.puntos_venta.length} puntos de venta` : 'Sucursal fiscal'
})));
const branchFilterOptions = computed(() => [
  { value: '', label: 'Todas las sucursales', hint: 'Vista consolidada' },
  ...branchOptions.value
]);
const selectedBranch = computed(() => (fiscalScope.value?.sucursales ?? []).find((branch) => String(branch.id) === String(selectedBranchId.value)) ?? null);
const transferFromBranch = computed(() => (fiscalScope.value?.sucursales ?? []).find((branch) => String(branch.id) === String(transferForm.value.from_core_sucursal_id)) ?? null);
const transferToBranch = computed(() => (fiscalScope.value?.sucursales ?? []).find((branch) => String(branch.id) === String(transferForm.value.to_core_sucursal_id)) ?? null);
const branchPayload = computed(() => selectedBranch.value ? {
  core_sucursal_id: Number(selectedBranch.value.id),
  core_sucursal_code: selectedBranch.value.codigo || null,
  core_sucursal_name: selectedBranch.value.nombre || null
} : {
  core_sucursal_id: null,
  core_sucursal_code: null,
  core_sucursal_name: null
});
const visibleLots = computed(() => selectedBranch.value
  ? lots.value.filter((lot) => Number(lot.core_sucursal_id || 0) === Number(selectedBranch.value.id))
  : lots.value);
const visibleMovements = computed(() => selectedBranch.value
  ? movements.value.filter((movement) => Number(movement.core_sucursal_id || 0) === Number(selectedBranch.value.id))
  : movements.value);
const lotProductOptions = computed(() => [
  { value: '', label: 'Todos los productos', hint: 'Sin filtro' },
  ...items.value.map((item) => ({
    value: String(item.id),
    label: item.name,
    hint: item.sku || 'Sin código'
  }))
]);
const lotSupplierOptions = computed(() => [
  { value: '', label: 'Todos los proveedores', hint: 'Sin filtro' },
  ...suppliers.value.map((supplier) => ({
    value: String(supplier.id),
    label: supplier.name,
    hint: supplier.tax_id || supplier.nrc || 'Proveedor'
  }))
]);
const lotStatusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'available', label: 'Disponibles' },
  { value: 'partial', label: 'Parciales' },
  { value: 'depleted', label: 'Agotados' }
];
const purchaseModeOptions = [
  { value: '', label: 'Todos los modos' },
  { value: 'dte', label: 'DTE JSON' },
  { value: 'paper', label: 'CCF físico' }
];
const lotRows = computed(() => visibleLots.value.map((lot) => {
  const initial = Number(lot.initial_quantity || 0);
  const available = Number(lot.available_quantity || 0);
  const consumed = Math.max(0, roundQuantity(initial - available));
  const value = roundMoney(available * Number(lot.unit_cost || 0));
  const status = available <= 0 ? 'depleted' : (initial > 0 && available < initial ? 'partial' : 'available');
  const productLots = visibleLots.value
    .filter((candidate) => Number(candidate.catalog_item_id || 0) === Number(lot.catalog_item_id || 0) && Number(candidate.available_quantity || 0) > 0)
    .sort((a, b) => String(a.received_date || a.created_at || '').localeCompare(String(b.received_date || b.created_at || '')) || Number(a.id || 0) - Number(b.id || 0));
  const fifoIndex = productLots.findIndex((candidate) => Number(candidate.id) === Number(lot.id));

  return {
    ...lot,
    initial_quantity_number: initial,
    available_quantity_number: available,
    consumed_quantity: consumed,
    available_value: value,
    lot_status: status,
    fifo_position: fifoIndex >= 0 ? fifoIndex + 1 : null,
    fifo_pending_before: fifoIndex > 0 ? fifoIndex : 0,
    supplier_name: lot.supplier?.name || suppliers.value.find((supplier) => Number(supplier.id) === Number(lot.inventory_supplier_id))?.name || 'Sin proveedor'
  };
}));
const filteredLotRows = computed(() => {
  const term = lotFilters.value.q.trim().toLowerCase();

  return lotRows.value.filter((lot) => {
    const haystack = `${lot.lot_code || ''} ${lot.catalog_item?.name || ''} ${lot.catalog_item?.sku || ''} ${lot.supplier_name || ''}`.toLowerCase();
    const date = String(lot.received_date || '').slice(0, 10);

    return (!term || haystack.includes(term))
      && (!lotFilters.value.status || lot.lot_status === lotFilters.value.status)
      && (!lotFilters.value.catalog_item_id || String(lot.catalog_item_id) === String(lotFilters.value.catalog_item_id))
      && (!lotFilters.value.inventory_supplier_id || String(lot.inventory_supplier_id) === String(lotFilters.value.inventory_supplier_id))
      && (!lotFilters.value.from || date >= lotFilters.value.from)
      && (!lotFilters.value.to || date <= lotFilters.value.to);
  });
});
const lotStats = computed(() => ({
  available: filteredLotRows.value.filter((lot) => lot.lot_status === 'available').length,
  partial: filteredLotRows.value.filter((lot) => lot.lot_status === 'partial').length,
  depleted: filteredLotRows.value.filter((lot) => lot.lot_status === 'depleted').length,
  units: filteredLotRows.value.reduce((sum, lot) => sum + Number(lot.available_quantity_number || 0), 0),
  value: filteredLotRows.value.reduce((sum, lot) => sum + Number(lot.available_value || 0), 0)
}));
const selectedLotMovements = computed(() => {
  if (!selectedLot.value) return [];

  return movements.value.filter((movement) => Number(movement.inventory_lot_id || 0) === Number(selectedLot.value.id));
});
const purchaseRows = computed(() => purchases.value.map((purchase) => ({
  ...purchase,
  supplier_name: purchase.supplier?.name || purchase.supplier_snapshot?.name || 'Sin proveedor',
  branch_label: purchase.core_sucursal_code || purchase.core_sucursal_name || 'Sin sucursal',
  total_number: Number(purchase.total || purchase.document_total || 0)
})));
const filteredPurchaseRows = computed(() => {
  const term = purchaseFilters.value.q.trim().toLowerCase();

  return purchaseRows.value.filter((purchase) => {
    const date = String(purchase.purchase_date || '').slice(0, 10);
    const haystack = `${purchase.purchase_number || ''} ${purchase.document_number || ''} ${purchase.supplier_name || ''}`.toLowerCase();

    return (!term || haystack.includes(term))
      && (!purchaseFilters.value.document_mode
        || (purchaseFilters.value.document_mode === 'paper'
          ? ['manual', 'physical', 'paper'].includes(String(purchase.document_mode || ''))
          : String(purchase.document_mode || '') === purchaseFilters.value.document_mode))
      && (!purchaseFilters.value.supplier_id || String(purchase.inventory_supplier_id || '') === purchaseFilters.value.supplier_id)
      && (!purchaseFilters.value.from || date >= purchaseFilters.value.from)
      && (!purchaseFilters.value.to || date <= purchaseFilters.value.to);
  });
});
const purchaseStats = computed(() => ({
  count: filteredPurchaseRows.value.length,
  total: filteredPurchaseRows.value.reduce((sum, purchase) => sum + Number(purchase.total_number || 0), 0),
  dte: filteredPurchaseRows.value.filter((purchase) => purchase.document_mode === 'dte').length,
  manual: filteredPurchaseRows.value.filter((purchase) => purchase.document_mode !== 'dte').length
}));
const selectedPurchaseMovements = computed(() => {
  if (!selectedPurchase.value) return [];

  return movements.value.filter((movement) => movement.reference_type === 'purchase' && String(movement.reference_id || '') === String(selectedPurchase.value.id));
});
const branchStockByItem = computed(() => inventorySummary.value?.stock_by_item?.reduce((map, row) => {
  map[Number(row.catalog_item_id)] = Number(row.stock_quantity || 0);
  return map;
}, {}) ?? visibleLots.value.reduce((map, lot) => {
  const itemId = Number(lot.catalog_item_id || 0);
  map[itemId] = Number(map[itemId] || 0) + Number(lot.available_quantity || 0);
  return map;
}, {}));
const visibleItems = computed(() => {
  const term = filters.value.q.trim().toLowerCase();
  const list = items.value.map((item) => ({
    ...item,
    branch_stock_quantity: Number(branchStockByItem.value[Number(item.id)] || 0)
  }));
  if (!term) return list;

  return list.filter((item) => `${item.name} ${item.sku || ''}`.toLowerCase().includes(term));
});
const stockTotalPages = computed(() => Math.max(1, Math.ceil(visibleItems.value.length / Number(stockPageSize.value || 12))));
const stockPageStart = computed(() => visibleItems.value.length === 0 ? 0 : ((stockPage.value - 1) * Number(stockPageSize.value || 12)) + 1);
const stockPageEnd = computed(() => Math.min(visibleItems.value.length, stockPage.value * Number(stockPageSize.value || 12)));
const paginatedVisibleItems = computed(() => {
  const size = Number(stockPageSize.value || 12);
  const start = (stockPage.value - 1) * size;

  return visibleItems.value.slice(start, start + size);
});
const stockMeta = computed(() => ({
  current_page: stockPage.value,
  last_page: stockTotalPages.value,
  total: visibleItems.value.length,
  from: stockPageStart.value === 0 ? null : stockPageStart.value,
  to: stockPageEnd.value === 0 ? null : stockPageEnd.value
}));
const lowStockItems = computed(() => visibleItems.value.filter((item) => Number(item.branch_stock_quantity || 0) <= 0));
const overviewAlertCount = computed(() => Number(inventorySummary.value?.below_minimum ?? stockAlerts.value.filter((item) => Number(item.stock_quantity || 0) > 0).length));
const overviewHealthyCount = computed(() => Number(inventorySummary.value?.healthy ?? Math.max(0, stats.value.products - overviewAlertCount.value - stats.value.lowStock)));
const overviewStockSegments = computed(() => {
  const total = Math.max(1, stats.value.products);
  return [
    { key: 'ok', label: 'OK', value: overviewHealthyCount.value, class: 'bg-emerald-500 dark:bg-success' },
    { key: 'alert', label: 'Bajo mínimo', value: overviewAlertCount.value, class: 'bg-amber-500 dark:bg-warning' },
    { key: 'zero', label: 'Sin stock', value: stats.value.lowStock, class: 'bg-red-500 dark:bg-danger' },
  ].map((segment) => ({
    ...segment,
    width: `${Math.max(0, (Number(segment.value || 0) / total) * 100)}%`
  }));
});
const overviewTrend = computed(() => {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - ((6 - index) * dayMs));
    const iso = date.toISOString().slice(0, 10);

    return {
      iso,
      label: date.toLocaleDateString('es-SV', { weekday: 'short' }).replace('.', ''),
      entries: 0,
      exits: 0,
    };
  });

  for (const movement of visibleMovements.value) {
    const date = String(movement.created_at || '').slice(0, 10);
    const day = days.find((candidate) => candidate.iso === date);
    if (!day) continue;

    if (movement.movement_type === 'entry') {
      day.entries += Number(movement.quantity || 0);
    } else {
      day.exits += Number(movement.quantity || 0);
    }
  }

  const max = Math.max(1, ...days.flatMap((day) => [day.entries, day.exits]));
  const width = 360;
  const height = 140;
  const xStep = width / Math.max(1, days.length - 1);
  const pointsFor = (key) => days.map((day, index) => {
    const x = index * xStep;
    const y = height - ((Number(day[key] || 0) / max) * (height - 16)) - 8;

    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return {
    days,
    max,
    entryPoints: pointsFor('entries'),
    exitPoints: pointsFor('exits'),
  };
});
const overviewMovementBars = computed(() => {
  const entries = visibleMovements.value
    .filter((movement) => movement.movement_type === 'entry')
    .reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  const exits = visibleMovements.value
    .filter((movement) => movement.movement_type !== 'entry')
    .reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  const transfers = visibleMovements.value
    .filter((movement) => String(movement.reason || '').includes('transfer'))
    .reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  const reversals = visibleMovements.value
    .filter((movement) => movement.reason === 'reversal')
    .reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  const rows = [
    { key: 'entries', label: 'Entradas', value: entries, class: 'bg-emerald-500 dark:bg-success' },
    { key: 'exits', label: 'Salidas', value: exits, class: 'bg-sky-500 dark:bg-primary' },
    { key: 'transfers', label: 'Transferencias', value: transfers, class: 'bg-indigo-500 dark:bg-primary' },
    { key: 'reversals', label: 'Reversas', value: reversals, class: 'bg-amber-500 dark:bg-warning' },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value));

  return rows.map((row) => ({
    ...row,
    width: `${Math.max(3, (row.value / max) * 100)}%`
  }));
});
const productDetailLots = computed(() => {
  if (!productDetailItem.value) return [];

  return lots.value
    .filter((lot) => Number(lot.catalog_item_id || 0) === Number(productDetailItem.value.id))
    .sort((a, b) => String(a.received_date || a.created_at || '').localeCompare(String(b.received_date || b.created_at || '')));
});
const productDetailMovements = computed(() => {
  if (!productDetailItem.value) return [];

  return movements.value
    .filter((movement) => Number(movement.catalog_item_id || 0) === Number(productDetailItem.value.id))
    .slice(0, 12);
});
const productDetailSales = computed(() => {
  if (!productDetailItem.value) return null;

  return salesReport.value.find((row) => Number(row.catalog_item_id || 0) === Number(productDetailItem.value.id)) ?? null;
});
const productDetailMargin = computed(() => {
  if (!productDetailItem.value) return null;

  return marginReport.value.find((row) => Number(row.catalog_item_id || 0) === Number(productDetailItem.value.id)) ?? null;
});
const productDetailBranchRows = computed(() => {
  if (!productDetailItem.value) return [];

  const branchMap = new Map();
  for (const lot of productDetailLots.value) {
    const key = String(lot.core_sucursal_id || 'none');
    const current = branchMap.get(key) ?? {
      id: lot.core_sucursal_id ?? null,
      label: lot.core_sucursal_code || lot.core_sucursal_name || 'Sin sucursal',
      quantity: 0,
      value: 0,
    };
    current.quantity += Number(lot.available_quantity || 0);
    current.value += Number(lot.available_quantity || 0) * Number(lot.unit_cost || 0);
    branchMap.set(key, current);
  }

  return Array.from(branchMap.values());
});
const productDetailStats = computed(() => {
  const lotsTotal = productDetailLots.value.reduce((sum, lot) => sum + Number(lot.available_quantity || 0), 0);
  const costValue = productDetailLots.value.reduce((sum, lot) => sum + (Number(lot.available_quantity || 0) * Number(lot.unit_cost || 0)), 0);
  const saleQuantity = Number(productDetailSales.value?.quantity || 0);
  const saleTotal = Number(productDetailSales.value?.sales_total || 0);
  const marginTotal = Number(productDetailMargin.value?.margin_total || 0);

  return {
    lotsTotal,
    costValue,
    saleQuantity,
    saleTotal,
    marginTotal,
  };
});
const resumenReportes = computed(() => ({
  ventas: salesReport.value.length,
  margen: marginReport.value.length,
  kardex: visibleMovements.value.length,
  existencias: visibleItems.value.length,
  lotes: filteredLotRows.value.length,
  alertas: stockAlerts.value.length
}));
const reportScopeLabel = computed(() => selectedBranch.value
  ? `${selectedBranch.value.codigo || 'Sucursal'} · ${selectedBranch.value.nombre}`
  : 'Todas las sucursales');
const reportSummaryMetrics = computed(() => [
  { label: 'Ventas', value: resumenReportes.value.ventas },
  { label: 'Margen', value: resumenReportes.value.margen },
  { label: 'Kardex', value: resumenReportes.value.kardex },
  { label: 'Existencias', value: resumenReportes.value.existencias }
]);
const primaryReportRows = computed(() => [
  {
    key: 'ventas',
    name: 'Ventas por producto',
    detail: 'Unidades y monto vendido por producto.',
    rows: resumenReportes.value.ventas
  },
  {
    key: 'margen',
    name: 'Margen referencial',
    detail: 'Venta contra costo de referencia.',
    rows: resumenReportes.value.margen
  },
  {
    key: 'kardex',
    name: 'Kardex',
    detail: 'Entradas, salidas, ajustes y transferencias.',
    rows: resumenReportes.value.kardex
  }
]);
const secondaryReportRows = computed(() => [
  {
    key: 'existencias',
    name: 'Existencias',
    detail: 'Stock y valor referencial actual.',
    rows: resumenReportes.value.existencias
  },
  {
    key: 'lotes',
    name: 'Lotes',
    detail: 'Disponibilidad FIFO por lote.',
    rows: resumenReportes.value.lotes
  },
  {
    key: 'alertas',
    name: 'Alertas',
    detail: 'Productos bajo mínimo.',
    rows: resumenReportes.value.alertas
  }
]);
const stats = computed(() => ({
  products: Number(inventorySummary.value?.products ?? items.value.length),
  units: Number(inventorySummary.value?.units ?? visibleItems.value.reduce((sum, item) => sum + Number(item.branch_stock_quantity || 0), 0)),
  value: Number(inventorySummary.value?.inventory_value ?? visibleItems.value.reduce((sum, item) => sum + (Number(item.branch_stock_quantity || 0) * Number(item.reference_cost || 0)), 0)),
  lowStock: Number(inventorySummary.value?.out_of_stock ?? lowStockItems.value.length),
  lots: Number(inventorySummary.value?.lots ?? visibleLots.value.length),
  movements: Number(inventorySummary.value?.movements ?? visibleMovements.value.length)
}));
const countSheetRows = computed(() => visibleItems.value.map((item, index) => ({
  number: index + 1,
  sku: item.sku || '',
  name: item.name,
  unit: item.unit_name || item.unit_code || '',
  system_quantity: roundQuantity(Number(item.branch_stock_quantity || 0)),
  counted_quantity: '',
  difference: '',
  notes: ''
})));
const activeResolveLine = computed(() => {
  if (resolveLineIndex.value === null) return null;

  return compraImportada.value.lines[resolveLineIndex.value] ?? null;
});
const etiquetaDocumentoCompra = computed(() => ({
  dte_ccf: 'DTE CCF',
  dte_fcf: 'DTE FC',
  ccf: 'CCF físico',
  fcf: 'FC física',
  fse: 'FSE',
  nota_envio: 'Nota de envío'
}[compraImportada.value.document.document_type] ?? (compraImportada.value.document.document_type || 'Documento')));
const etiquetaPagoCompra = computed(() => compraImportada.value.document.payment_condition === 'credit' ? 'Crédito' : 'Contado');
const esCompraManual = computed(() => compraImportada.value.document.document_mode === 'manual');
const compraImportadaSubtotal = computed(() => {
  const dteSubtotal = Number(compraImportada.value.document.subtotal ?? 0);
  if (compraImportada.value.document.document_mode === 'dte' && dteSubtotal > 0) return dteSubtotal;

  return roundMoney(compraImportada.value.lines.reduce((sum, line) => sum + Number(line.subtotal ?? (Number(line.quantity || 0) * Number(line.unit_cost || 0))), 0));
});
const ivaCompraImportada = computed(() => {
  if (['nota_envio', 'manual'].includes(String(compraImportada.value.document.document_type || ''))) return 0;

  const dteTax = Number(compraImportada.value.document.tax_amount ?? 0);
  if (compraImportada.value.document.document_mode === 'dte') return dteTax;

  return roundMoney(compraImportadaSubtotal.value * 0.13);
});
const combustibleCompraImportada = computed(() => {
  if (!compraImportada.value.document.apply_fuel_charges) return 0;

  const quantity = compraImportada.value.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  return roundMoney(quantity * (Number(compraImportada.value.document.fovial_per_unit || 0) + Number(compraImportada.value.document.cotrans_per_unit || 0)));
});
const ivaPercibidoCompraImportada = computed(() => {
  if (!compraImportada.value.document.apply_tax_perceived) return 0;

  const detectedAmount = Number(compraImportada.value.document.tax_perceived_amount || 0);
  if (detectedAmount > 0) return detectedAmount;

  const rate = compraImportada.value.document.tax_perceived_mode === 'manual'
    ? Number(compraImportada.value.document.tax_perceived_rate || 0) / 100
    : 0.01;

  return roundMoney(compraImportadaSubtotal.value * rate);
});
const totalCalculadoCompraImportada = computed(() => roundMoney(compraImportadaSubtotal.value + ivaCompraImportada.value + combustibleCompraImportada.value + ivaPercibidoCompraImportada.value));
const totalDocumentoCompraImportada = computed(() => esCompraManual.value ? totalCalculadoCompraImportada.value : Number(compraImportada.value.document.document_total || 0));
const diferenciaCompraImportada = computed(() => esCompraManual.value ? 0 : roundMoney(Number(compraImportada.value.document.document_total || 0) - totalCalculadoCompraImportada.value));
const totalesCompraImportadaOk = computed(() => Math.abs(diferenciaCompraImportada.value) <= 0.02);
const lineasCompraImportadaResueltas = computed(() => compraImportada.value.lines.filter((line) => lineResolved(line)).length);
const compraImportadaPuedeRegistrarse = computed(() => {
  const supplierReady = compraImportada.value.create_supplier
    ? compraImportada.value.supplier.name.trim() !== ''
    : compraImportada.value.supplier_id !== '';

  return Boolean(compraImportada.value.preview)
    && supplierReady
    && compraImportada.value.lines.length > 0
    && compraImportada.value.lines.every((line) => lineResolved(line))
    && totalesCompraImportadaOk.value;
});
const processOverlayOpen = computed(() => saving.value && savingAction.value === 'compra');
let inventoryRefreshTimer = null;

watch(tenantId, () => {
  void loadInventory();
});
watch(selectedBranchId, () => {
  stockPage.value = 1;
  void loadInventory({ silent: true });
});
watch(() => filters.value.q, () => {
  stockPage.value = 1;
});
watch(stockPageSize, () => {
  stockPage.value = 1;
});
watch(() => compraImportada.value.supplier_id, (supplierId) => {
  if (!esCompraManual.value || compraImportada.value.create_supplier || !supplierId) return;

  const supplier = suppliers.value.find((candidate) => String(candidate.id) === String(supplierId));
  if (!supplier) return;

  compraImportada.value.supplier = {
    name: normalizeSupplierName(supplier.name || ''),
    tax_id: formatNit(supplier.tax_id || ''),
    nrc: formatNrc(supplier.nrc || ''),
    phone: formatPhone(supplier.phone || ''),
    email: supplier.email || '',
    address: supplier.address || ''
  };
});
watch(() => visibleItems.value.length, () => {
  if (stockPage.value > stockTotalPages.value) {
    stockPage.value = stockTotalPages.value;
  }
});
watch(activeTab, (tab) => {
  persistActiveInventoryView(tab);
  if (tab === 'kardex' && tenantId.value) {
    void loadInventory({ silent: true });
  }
});
onMounted(() => {
  activeTab.value = initialInventoryView();
  window.addEventListener(INVENTORY_CHANGED_EVENT, handleInventoryChanged);
  window.addEventListener('storage', handleInventoryStorageChanged);
  void loadInventory();
});
onBeforeUnmount(() => {
  window.removeEventListener(INVENTORY_CHANGED_EVENT, handleInventoryChanged);
  window.removeEventListener('storage', handleInventoryStorageChanged);
  if (inventoryRefreshTimer) window.clearTimeout(inventoryRefreshTimer);
});

async function loadInventory(options = { silent: false }): Promise<void> {
  if (!tenantId.value) return;

  if (!options.silent) loading.value = true;
  try {
    const [inventoryItemsResponse, catalogItemsResponse, lotResponse, movementResponse, supplierResponse, purchaseResponse, categoryResponse, fiscalScopeResponse, salesResponse, marginResponse, alertsResponse, summaryResponse] = await Promise.all([
      fetchAllCatalogItems({ status: 'active', controls_inventory: true }),
      fetchAllCatalogItems({ status: 'active' }),
      client.value.inventoryLots(tenantId.value, { available_only: false, per_page: 100 }),
      client.value.inventoryMovements(tenantId.value, { per_page: 100 }),
      client.value.inventorySuppliers(tenantId.value, { status: 'active', per_page: 100 }),
      client.value.inventoryPurchases(tenantId.value, { per_page: 100 }),
      client.value.catalogCategories(tenantId.value, { status: 'active' }),
      client.value.tenantFiscalScope(tenantId.value).catch(() => null),
      client.value.inventorySalesReport(tenantId.value, reportParams()).catch(() => ({ data: [] })),
      client.value.inventoryMarginReport(tenantId.value, reportParams()).catch(() => ({ data: [] })),
      client.value.inventoryStockAlerts(tenantId.value, branchReportParams()).catch(() => ({ data: [] })),
      client.value.inventorySummary(tenantId.value, branchReportParams()).catch(() => ({ data: null }))
    ]);
    items.value = inventoryItemsResponse;
    catalogItems.value = catalogItemsResponse;
    lots.value = lotResponse.data ?? [];
    movements.value = movementResponse.data ?? [];
    suppliers.value = supplierResponse.data ?? [];
    purchases.value = purchaseResponse.data ?? [];
    categories.value = categoryResponse.data ?? [];
    fiscalScope.value = fiscalScopeResponse;
    salesReport.value = salesResponse.data ?? [];
    marginReport.value = marginResponse.data ?? [];
    stockAlerts.value = alertsResponse.data ?? [];
    inventorySummary.value = summaryResponse.data ?? null;
  } catch (error) {
    notify('No se pudo cargar inventario', messageFromError(error), 'error');
  } finally {
    if (!options.silent) loading.value = false;
  }
}

async function fetchAllCatalogItems(params): Promise<unknown[]> {
  if (!tenantId.value) return [];

  const all = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await client.value.catalogItems(tenantId.value, { ...params, page, per_page: 100 });
    all.push(...(response.data ?? []));
    lastPage = Number(response.meta?.last_page ?? response.last_page ?? page);
    page += 1;
  } while (page <= lastPage);

  return all;
}

function reportParams() {
  return {
    ...periodReportParams(),
    ...branchReportParams()
  };
}

function periodReportParams() {
  return {
    from: reportFilters.value.from || undefined,
    to: reportFilters.value.to || undefined
  };
}

function branchReportParams() {
  return selectedBranch.value ? { core_sucursal_id: Number(selectedBranch.value.id) } : {};
}

function initialInventoryView(): string {
  if (typeof window === 'undefined') return 'overview';

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('inventory_view');
  if (fromUrl && validTabKeys.has(fromUrl)) {
    return fromUrl;
  }

  const fromStorage = window.localStorage.getItem(INVENTORY_ACTIVE_VIEW_KEY);
  if (fromStorage && validTabKeys.has(fromStorage)) {
    return fromStorage;
  }

  return 'overview';
}

function persistActiveInventoryView(tab: string): void {
  if (typeof window === 'undefined' || !validTabKeys.has(tab)) return;

  window.localStorage.setItem(INVENTORY_ACTIVE_VIEW_KEY, tab);

  const url = new URL(window.location.href);
  if (tab === 'overview') {
    url.searchParams.delete('inventory_view');
  } else {
    url.searchParams.set('inventory_view', tab);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function handleInventoryChanged(event): void {
  const detail = event?.detail ?? null;
  if (detail?.tenant_id && Number(detail.tenant_id) !== tenantId.value) return;

  scheduleInventoryRefresh();
}

function handleInventoryStorageChanged(event): void {
  if (event.key !== INVENTORY_CHANGED_EVENT || !event.newValue) return;

  try {
    const detail = JSON.parse(event.newValue);
    if (detail?.tenant_id && Number(detail.tenant_id) !== tenantId.value) return;
  } catch {
    return;
  }

  scheduleInventoryRefresh();
}

function scheduleInventoryRefresh(): void {
  if (inventoryRefreshTimer) window.clearTimeout(inventoryRefreshTimer);
  inventoryRefreshTimer = window.setTimeout(() => {
    void loadInventory({ silent: true });
  }, 120);
}

function openProductDetail(item): void {
  productDetailItem.value = item;
}

async function openPurchaseDetail(purchase): Promise<void> {
  if (!tenantId.value || !purchase?.id) return;

  selectedPurchase.value = purchase;
  try {
    const response = await client.value.inventoryPurchase(tenantId.value, Number(purchase.id));
    selectedPurchase.value = response.data;
  } catch (error) {
    notify('No se pudo cargar compra', messageFromError(error), 'error');
  }
}

function crearLineaCompraVacia(item = null) {
  return {
    description: item?.name || '',
    quantity: 1,
    unit_cost: Number(item?.reference_cost || 0),
    subtotal: Number(item?.reference_cost || 0),
    unit_code: item?.unit_code || '59',
    supplier_code: '',
    no_inventory: false,
    catalog_item_id: item?.id ? String(item.id) : '',
    create_item: !item?.id,
    new_item_name: item?.name || '',
    new_item_sku: '',
    new_item_base_price: Number(item?.base_price || 0),
    category_id: '',
    new_category_name: '',
    controls_inventory: true
  };
}

function abrirCompraManual(item = null): void {
  activeTab.value = 'entries';
  compraImportada.value.fileName = '';
  compraImportada.value.preview = { source: 'manual_ccf_paper' };
  compraImportada.value.supplier_id = '';
  compraImportada.value.create_supplier = false;
  compraImportada.value.supplier = { name: '', tax_id: '', nrc: '', phone: '', email: '', address: '' };
  compraImportada.value.document = {
    ...compraImportada.value.document,
    document_type: 'ccf',
    document_mode: 'manual',
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
  };
  compraImportada.value.lines = [crearLineaCompraVacia(item)];
  compraImportada.value.import_metadata = { source: 'manual_ccf_paper' };
}

function agregarLineaCompraManual(): void {
  compraImportada.value.lines.push(crearLineaCompraVacia());
}

function quitarLineaCompra(index: number): void {
  if (compraImportada.value.lines.length <= 1) return;
  compraImportada.value.lines.splice(index, 1);
}

function goToStockPage(page: number): void {
  stockPage.value = Math.min(Math.max(page, 1), stockTotalPages.value);
}

async function saveAdjustment(): Promise<void> {
  if (!tenantId.value || !adjustmentForm.value.catalog_item_id) return;
  if (branchOptions.value.length > 0 && !selectedBranch.value) {
    notify('Selecciona sucursal', 'El ajuste debe aplicarse a una sucursal.', 'error');
    return;
  }

  saving.value = true;
  try {
    await client.value.createInventoryAdjustment(tenantId.value, {
      catalog_item_id: Number(adjustmentForm.value.catalog_item_id),
      ...branchPayload.value,
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

async function savePhysicalCount(): Promise<void> {
  if (!tenantId.value || !countForm.value.catalog_item_id) return;
  if (branchOptions.value.length > 0 && !selectedBranch.value) {
    notify('Selecciona sucursal', 'El conteo debe aplicarse a una sucursal.', 'error');
    return;
  }

  saving.value = true;
  try {
    await client.value.createInventoryCount(tenantId.value, {
      ...branchPayload.value,
      count_date: countForm.value.count_date,
      notes: countForm.value.notes || null,
      lines: [{
        catalog_item_id: Number(countForm.value.catalog_item_id),
        counted_quantity: Number(countForm.value.counted_quantity || 0)
      }]
    });
    notify('Conteo aplicado', 'Se ajustó kardex según la diferencia física.', 'success');
    countForm.value.catalog_item_id = '';
    countForm.value.counted_quantity = 0;
    countForm.value.notes = '';
    await loadInventory();
  } catch (error) {
    notify('No se pudo aplicar conteo', messageFromError(error), 'error');
  } finally {
    saving.value = false;
  }
}

async function saveTransfer(): Promise<void> {
  if (!tenantId.value || !transferForm.value.catalog_item_id || !transferFromBranch.value || !transferToBranch.value) return;

  saving.value = true;
  try {
    await client.value.createInventoryTransfer(tenantId.value, {
      from_core_sucursal_id: Number(transferFromBranch.value.id),
      from_core_sucursal_code: transferFromBranch.value.codigo || null,
      from_core_sucursal_name: transferFromBranch.value.nombre || null,
      to_core_sucursal_id: Number(transferToBranch.value.id),
      to_core_sucursal_code: transferToBranch.value.codigo || null,
      to_core_sucursal_name: transferToBranch.value.nombre || null,
      transfer_date: new Date().toISOString().slice(0, 10),
      notes: transferForm.value.notes || null,
      lines: [{
        catalog_item_id: Number(transferForm.value.catalog_item_id),
        quantity: Number(transferForm.value.quantity || 0)
      }]
    });
    notify('Transferencia aplicada', 'Se movió stock entre sucursales y quedó en kardex.', 'success');
    transferForm.value.catalog_item_id = '';
    transferForm.value.quantity = 1;
    transferForm.value.notes = '';
    await loadInventory();
  } catch (error) {
    notify('No se pudo transferir', messageFromError(error), 'error');
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

function definicionReporteInventario(tipo: string) {
  const reportes = {
    ventas: {
      nombre: 'ventas-producto',
      titulo: 'Ventas por producto',
      columnas: [
        ['sku', 'Código'],
        ['name', 'Producto'],
        ['line_origin', 'Origen'],
        ['quantity', 'Cantidad'],
        ['sales_total', 'Venta'],
        ['reference_cost_total', 'Costo ref.']
      ],
      filas: salesReport.value
    },
    margen: {
      nombre: 'margen-producto',
      titulo: 'Margen referencial',
      columnas: [
        ['sku', 'Código'],
        ['name', 'Producto'],
        ['quantity', 'Cantidad'],
        ['sales_total', 'Venta'],
        ['reference_cost_total', 'Costo ref.'],
        ['margin_total', 'Margen'],
        ['margin_percent', 'Margen %']
      ],
      filas: marginReport.value
    },
    kardex: {
      nombre: 'kardex',
      titulo: 'Kardex',
      columnas: [
        ['created_at', 'Fecha'],
        ['producto', 'Producto'],
        ['sku', 'Código'],
        ['lote', 'Lote'],
        ['movement_type', 'Tipo'],
        ['reason', 'Motivo'],
        ['sucursal', 'Sucursal'],
        ['quantity', 'Cantidad'],
        ['unit_cost', 'Costo'],
        ['balance_after', 'Saldo'],
        ['reference_number', 'Referencia'],
        ['notes', 'Notas']
      ],
      filas: visibleMovements.value.map((movement) => ({
        ...movement,
        reason: inventoryMovementReasonLabel(movement.reason),
        producto: movement.catalog_item?.name || 'Producto',
        sku: movement.catalog_item?.sku || '',
        lote: movement.lot?.lot_code || '',
        sucursal: movement.core_sucursal_code || movement.core_sucursal_name || ''
      }))
    },
    existencias: {
      nombre: 'existencias',
      titulo: 'Existencias',
      columnas: [
        ['sku', 'Código'],
        ['name', 'Producto'],
        ['branch_stock_quantity', 'Stock sucursal'],
        ['stock_quantity', 'Stock total'],
        ['reference_cost', 'Costo ref.'],
        ['valor', 'Valor ref.']
      ],
      filas: visibleItems.value.map((item) => ({
        ...item,
        valor: roundMoney(Number(item.branch_stock_quantity || 0) * Number(item.reference_cost || 0))
      }))
    },
    lotes: {
      nombre: 'lotes',
      titulo: 'Lotes',
      columnas: [
        ['lot_code', 'Lote'],
        ['producto', 'Producto'],
        ['sku', 'Código'],
        ['supplier_name', 'Proveedor'],
        ['received_date', 'Fecha'],
        ['sucursal', 'Sucursal'],
        ['initial_quantity_number', 'Inicial'],
        ['consumed_quantity', 'Consumido'],
        ['available_quantity_number', 'Disponible'],
        ['unit_cost', 'Costo'],
        ['available_value', 'Valor'],
        ['estado', 'Estado']
      ],
      filas: filteredLotRows.value.map((lot) => ({
        ...lot,
        producto: lot.catalog_item?.name || 'Producto',
        sku: lot.catalog_item?.sku || '',
        sucursal: lot.core_sucursal_code || lot.core_sucursal_name || '',
        estado: lotStatusLabel(lot.lot_status)
      }))
    },
    alertas: {
      nombre: 'alertas-stock',
      titulo: 'Alertas de stock mínimo',
      columnas: [
        ['sku', 'Código'],
        ['name', 'Producto'],
        ['stock_quantity', 'Stock'],
        ['min_stock_quantity', 'Mínimo']
      ],
      filas: stockAlerts.value
    }
  };

  return reportes[tipo] ?? null;
}

function descargarExcelReporte(tipo: string): void {
  const reporte = definicionReporteInventario(tipo);
  if (!reporte) return;
  if (reporte.filas.length === 0) {
    notify('Sin datos', 'No hay filas para exportar con los filtros actuales.', 'info');
    return;
  }

  const contenido = documentoReporteHtml(reporte, false);
  const blob = new Blob([`\uFEFF${contenido}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  descargarBlob(blob, `${nombreArchivoReporte(reporte.nombre)}.xls`);
}

function verReporte(tipo: string): void {
  abrirUrlReporte(tipo, false);
}

function descargarPdfReporte(tipo: string): void {
  abrirUrlReporte(tipo, true);
}

function abrirUrlReporte(tipo: string, descargar = false): void {
  const url = urlReportePdf(tipo, descargar);
  const ventana = window.open(url, '_blank');

  if (!ventana) {
    notify('No se pudo abrir reporte', 'Revisa si el navegador bloqueó la ventana emergente.', 'error');
  }
}

function urlReportePdf(tipo: string, descargar = false): string {
  const params = new URLSearchParams();
  const filtros = {
    ...periodReportParams(),
    ...branchReportParams()
  };

  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  if (descargar) {
    params.set('download', '1');
  }

  const query = params.toString();
  const base = props.platformBaseUrl.replace(/\/$/, '');

  return `${base}/platform/tenants/${tenantId.value}/inventory/reports/${tipo}/pdf${query ? `?${query}` : ''}`;
}

function descargarHojaConteo(): void {
  if (countSheetRows.value.length === 0) {
    notify('Sin datos', 'No hay productos inventariables para generar la hoja de conteo.', 'info');
    return;
  }

  descargarCsv('hoja-conteo-fisico', columnasHojaConteo(), countSheetRows.value, nombreArchivoHojaConteo());
}

function imprimirHojaConteo(): void {
  if (countSheetRows.value.length === 0) {
    notify('Sin datos', 'No hay productos inventariables para imprimir.', 'info');
    return;
  }

  const ventana = window.open(urlHojaConteoPdf(false), '_blank');
  if (!ventana) {
    notify('No se pudo abrir impresión', 'Revisa si el navegador bloqueó la ventana emergente.', 'error');
  }
}

function descargarHojaConteoPdf(): void {
  if (countSheetRows.value.length === 0) {
    notify('Sin datos', 'No hay productos inventariables para generar la hoja de conteo.', 'info');
    return;
  }

  const ventana = window.open(urlHojaConteoPdf(true), '_blank');
  if (!ventana) {
    notify('No se pudo descargar PDF', 'Revisa si el navegador bloqueó la ventana emergente.', 'error');
  }
}

function urlHojaConteoPdf(descargar = false): string {
  const params = new URLSearchParams();

  if (selectedBranch.value) {
    params.set('core_sucursal_id', String(selectedBranch.value.id));
  }

  params.set('count_date', countForm.value.count_date || new Date().toISOString().slice(0, 10));

  if (descargar) {
    params.set('download', '1');
  }

  const query = params.toString();
  const base = props.platformBaseUrl.replace(/\/$/, '');

  return `${base}/platform/tenants/${tenantId.value}/inventory/reports/count-sheet/pdf${query ? `?${query}` : ''}`;
}

function columnasHojaConteo(): Array<[string, string]> {
  return [
    ['number', '#'],
    ['sku', 'Código'],
    ['name', 'Producto'],
    ['unit', 'Unidad'],
    ['system_quantity', 'Cantidad sistema'],
    ['counted_quantity', 'Conteo físico'],
    ['difference', 'Diferencia'],
    ['notes', 'Notas']
  ];
}

function nombreArchivoHojaConteo(): string {
  const empresa = String(tenantName.value || 'empresa')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'empresa';
  const sucursal = selectedBranch.value
    ? String(selectedBranch.value.codigo || selectedBranch.value.nombre || 'sucursal')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    : 'todas';
  const fecha = countForm.value.count_date || new Date().toISOString().slice(0, 10);

  return `${empresa}-hoja-conteo-${sucursal}-${fecha}`;
}

function descargarCsv(nombre: string, columnas: Array<[string, string]>, filas: Array<Record<string, unknown>>, nombreArchivo = ''): void {
  const cabecera = columnas.map(([, label]) => label);
  const cuerpo = filas.map((fila) => columnas.map(([key]) => valorCsv(fila[key])));
  const contenido = [cabecera, ...cuerpo].map((row) => row.join(';')).join('\n');
  const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, `${nombreArchivo || nombreArchivoReporte(nombre)}.csv`);
}

function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function periodoReporteLabel(): string {
  const desde = reportFilters.value.from || 'inicio';
  const hasta = reportFilters.value.to || new Date().toISOString().slice(0, 10);

  return `${desde} al ${hasta}`;
}

function valorDocumentoReporte(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  return String(value);
}

function documentoReporteHtml(reporte, imprimir = false): string {
  const encabezados = reporte.columnas.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
  const filas = reporte.filas.map((fila) => `
    <tr>
      ${reporte.columnas.map(([key]) => `<td>${escapeHtml(valorDocumentoReporte(fila[key]))}</td>`).join('')}
    </tr>
  `).join('');

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(reporte.titulo)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 24px; background: #fff; }
          header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; border-bottom: 2px solid #111827; padding-bottom: 12px; }
          h1 { font-size: 20px; margin: 0 0 6px; }
          p { margin: 2px 0; font-size: 12px; color: #475569; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
          th { background: #e2e8f0; color: #0f172a; text-transform: uppercase; font-size: 10px; text-align: left; }
          tr:nth-child(even) td { background: #f8fafc; }
          .meta { text-align: right; }
          .toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
          button { border: 0; border-radius: 6px; background: #0284c7; color: #fff; font-weight: 700; padding: 10px 14px; cursor: pointer; }
          @media print {
            body { margin: 12mm; }
            .toolbar { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Imprimir / guardar PDF</button></div>
        <header>
          <div>
            <h1>${escapeHtml(reporte.titulo)}</h1>
            <p>${escapeHtml(String(tenantName.value || 'Empresa'))}</p>
            <p>Sucursal: ${escapeHtml(reportScopeLabel.value)}</p>
          </div>
          <div class="meta">
            <p>Periodo: ${escapeHtml(periodoReporteLabel())}</p>
            <p>Filas: ${reporte.filas.length}</p>
          </div>
        </header>
        <table>
          <thead><tr>${encabezados}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
        ${imprimir ? '<script>window.addEventListener("load", () => window.print());<\/script>' : ''}
      </body>
    </html>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function valorCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const normalized = String(value).replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${normalized}"`;
}

function nombreArchivoReporte(nombre: string): string {
  const empresa = String(tenantName.value || 'empresa')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'empresa';
  const desde = reportFilters.value.from || 'inicio';
  const hasta = reportFilters.value.to || new Date().toISOString().slice(0, 10);

  return `${empresa}-${nombre}-${desde}-${hasta}`;
}

async function importarJsonCompra(event): Promise<void> {
  const file = event?.target?.files?.[0] ?? null;
  if (!tenantId.value || !file) return;

  limpiarCompraImportada();
  saving.value = true;
  try {
    const payload = JSON.parse(await file.text());
    const response = await client.value.importInventoryPurchaseDteJson(tenantId.value, payload);
    const preview = response.data;
    const supplierSource = preview.supplier.matched ?? preview.supplier.from_json;
    compraImportada.value.fileName = file.name;
    compraImportada.value.preview = preview;
    compraImportada.value.supplier_id = preview.supplier.matched ? String(preview.supplier.matched.id) : '';
    compraImportada.value.create_supplier = !preview.supplier.matched;
    compraImportada.value.supplier = {
      name: normalizeSupplierName(supplierSource.name || ''),
      tax_id: formatNit(supplierSource.tax_id || ''),
      nrc: formatNrc(supplierSource.nrc || ''),
      phone: formatPhone(preview.supplier.from_json.phone || ''),
      email: preview.supplier.from_json.email || '',
      address: preview.supplier.from_json.address || ''
    };
    compraImportada.value.document = {
      ...compraImportada.value.document,
      ...preview.document,
      is_consumable: false,
      apply_tax_perceived: Boolean(preview.document.apply_tax_perceived),
      tax_perceived_mode: preview.document.tax_perceived_mode || 'auto',
      tax_perceived_rate: Number(preview.document.tax_perceived_rate || 1),
      tax_perceived_amount: Number(preview.document.tax_perceived_amount || 0),
      fiscal_profile: '',
      fiscal_sector: ''
    };
    compraImportada.value.lines = preview.lines.map((line) => ({
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
      new_item_sku: '',
      new_item_base_price: 0,
      category_id: '',
      new_category_name: '',
      controls_inventory: !line.no_inventory
    }));
    compraImportada.value.import_metadata = preview.import_metadata;
    notify('JSON cargado', 'Revisa proveedor y líneas antes de registrar.', 'success');
  } catch (error) {
    const duplicate = Number(error?.response?.status || 0) === 409;
    limpiarCompraImportada();
    if (duplicate) {
      duplicatePurchase.value = error?.payload?.duplicate ?? {};
    } else {
      notify('No se pudo importar JSON', messageFromError(error), 'error');
    }
  } finally {
    saving.value = false;
    if (event?.target) event.target.value = '';
  }
}

async function registrarCompraImportada(): Promise<void> {
  if (!tenantId.value || !compraImportada.value.preview) return;
  if (branchOptions.value.length > 0 && !selectedBranch.value) {
    notify('Selecciona sucursal', 'La compra debe ingresar a una sucursal.', 'error');
    return;
  }

  saving.value = true;
  savingAction.value = 'compra';
  try {
    const supplierId = await resolverProveedorCompra();
    const lines = [];
    for (const line of compraImportada.value.lines) {
      const catalogItemId = await resolverItemLineaCompra(line);
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
      ...branchPayload.value,
      document_type: compraImportada.value.document.document_type || null,
      document_mode: compraImportada.value.document.document_mode || 'dte',
      document_number: compraImportada.value.document.document_number || null,
      payment_condition: compraImportada.value.document.payment_condition || 'cash',
      tax_amount: esCompraManual.value ? ivaCompraImportada.value : Number(compraImportada.value.document.tax_amount || 0),
      document_total: esCompraManual.value ? totalCalculadoCompraImportada.value : Number(compraImportada.value.document.document_total || 0),
      purchase_date: compraImportada.value.document.purchase_date,
      is_consumable: Boolean(compraImportada.value.document.is_consumable),
      apply_tax_perceived: Boolean(compraImportada.value.document.apply_tax_perceived),
      tax_perceived_mode: compraImportada.value.document.tax_perceived_mode || 'auto',
      tax_perceived_rate: Number(compraImportada.value.document.tax_perceived_rate || 1),
      tax_perceived_amount: Number(compraImportada.value.document.tax_perceived_amount || 0),
      apply_fuel_charges: Boolean(compraImportada.value.document.apply_fuel_charges),
      fovial_per_unit: Number(compraImportada.value.document.fovial_per_unit || 0),
      cotrans_per_unit: Number(compraImportada.value.document.cotrans_per_unit || 0),
      fiscal_profile: compraImportada.value.document.fiscal_profile || null,
      fiscal_sector: compraImportada.value.document.fiscal_sector ? Number(compraImportada.value.document.fiscal_sector) : null,
      supplier_snapshot: compraImportada.value.supplier,
      import_metadata: compraImportada.value.import_metadata,
      lines
    });

    notify('Compra registrada', 'Se crearon lotes y kardex para las líneas inventariables.', 'success');
    limpiarCompraImportada();
    await loadInventory();
  } catch (error) {
    notify('No se pudo registrar compra', messageFromError(error), 'error');
  } finally {
    saving.value = false;
    savingAction.value = '';
  }
}

async function resolverProveedorCompra(): Promise<number | null> {
  if (!compraImportada.value.create_supplier) {
    return compraImportada.value.supplier_id ? Number(compraImportada.value.supplier_id) : null;
  }

  if (!compraImportada.value.supplier.name.trim()) {
    throw new Error('Debes ingresar el nombre del proveedor.');
  }

  const response = await client.value.createInventorySupplier(tenantId.value, {
    name: compraImportada.value.supplier.name.trim(),
    tax_id: compraImportada.value.supplier.tax_id.trim() || null,
    nrc: compraImportada.value.supplier.nrc.trim() || null,
    phone: compraImportada.value.supplier.phone.trim() || null,
    email: compraImportada.value.supplier.email.trim() || null,
    address: compraImportada.value.supplier.address.trim() || null
  });

  return response.data.id;
}

async function resolverItemLineaCompra(line): Promise<number> {
  if (!line.create_item && line.catalog_item_id) {
    return Number(line.catalog_item_id);
  }

  const categoryId = await resolverCategoriaCompra(line);
  const response = await client.value.createCatalogItem(tenantId.value, {
    catalog_category_id: categoryId,
    sku: line.new_item_sku?.trim() || null,
    name: line.new_item_name.trim() || line.description,
    item_type: line.no_inventory ? 'service' : 'part',
    unit_code: line.unit_code || '59',
    controls_inventory: !line.no_inventory && Boolean(line.controls_inventory),
    reference_cost: Number(line.unit_cost || 0),
    base_price: Number(line.new_item_base_price || 0),
    status: 'active'
  });

  return response.data.id;
}

async function resolverCategoriaCompra(line): Promise<number | null> {
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

function limpiarCompraImportada(): void {
  compraImportada.value.fileName = '';
  compraImportada.value.preview = null;
  compraImportada.value.supplier_id = '';
  compraImportada.value.create_supplier = false;
  compraImportada.value.lines = [];
  compraImportada.value.import_metadata = null;
}

function importarOtroJsonCompra(): void {
  duplicatePurchase.value = null;
  document.getElementById('inventory-compra-json')?.click();
}

async function verCompraDuplicada(): Promise<void> {
  const purchaseId = Number(duplicatePurchase.value?.purchase_id || 0);
  if (!purchaseId) return;

  duplicatePurchase.value = null;
  await openPurchaseDetail({ id: purchaseId });
}

function openLineResolver(index: number): void {
  resolveLineIndex.value = index;
}

function closeLineResolver(): void {
  if (activeResolveLine.value) {
    const line = activeResolveLine.value;
    line.subtotal = roundMoney(Number(line.quantity || 0) * Number(line.unit_cost || 0));
    if (line.create_item && line.new_item_name?.trim()) {
      line.description = line.description || line.new_item_name.trim();
    }
    if (!line.create_item && line.catalog_item_id) {
      const itemName = lineLinkedItemName(line);
      if (itemName !== 'Pendiente') line.description = line.description || itemName;
    }
  }
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
  if (compraImportada.value.document.is_consumable || line.no_inventory) return 'No inventario';
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
  compraImportada.value.supplier.name = normalizeSupplierName(value);
}

function updateImportedSupplierNit(value: string): void {
  compraImportada.value.supplier.tax_id = formatNit(value);
}

function updateImportedSupplierNrc(value: string): void {
  compraImportada.value.supplier.nrc = formatNrc(value);
}

function updateImportedSupplierPhone(value: string): void {
  compraImportada.value.supplier.phone = formatPhone(value);
}

function formatMoney(value): string {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function roundMoney(value): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;
}

function formatQuantity(value): string {
  return new Intl.NumberFormat('es-SV', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatDateOnly(value): string {
  const text = String(value || '').trim();
  if (!text) return 'Sin fecha';

  return text.slice(0, 10);
}

function lotStatusLabel(status: string): string {
  return {
    available: 'Disponible',
    partial: 'Parcial',
    depleted: 'Agotado'
  }[status] ?? 'Disponible';
}

function lotStatusTone(status: string): string {
  return {
    available: 'success',
    partial: 'warning',
    depleted: 'neutral'
  }[status] ?? 'neutral';
}

function purchaseDocumentTypeLabel(type: string | null | undefined): string {
  return {
    ccf: 'CCF físico',
    fcf: 'FC física',
    fse: 'FSE',
    dte_ccf: 'DTE CCF',
    dte_fcf: 'DTE FC',
    nota_envio: 'Nota de envío',
    manual: 'CCF físico'
  }[String(type || '')] ?? (type || 'Documento');
}

function purchaseDocumentModeLabel(mode: string | null | undefined): string {
  return {
    dte: 'DTE JSON',
    manual: 'CCF físico',
    physical: 'CCF físico',
    paper: 'CCF físico'
  }[String(mode || '')] ?? 'CCF físico';
}

function paymentConditionLabel(condition: string | null | undefined): string {
  return ['credit', 'credito'].includes(String(condition || '').toLowerCase()) ? 'Crédito' : 'Contado';
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
    sidebar-storage-key="stelfaro:inventory-sidebar-compact"
    @select="activeTab = $event"
  >
    <BillingFloatingToastStack :toasts="toasts" />
    <BillingProcessToastOverlay
      :open="processOverlayOpen"
      title="Registrando compra"
      message="Creando proveedor, productos, lotes y kardex según corresponda."
    />

    <div class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="min-w-[240px] max-w-sm flex-1">
          <UiSelect
            v-if="branchOptions.length > 0"
            v-model="selectedBranchId"
            label="Sucursal"
            :options="branchFilterOptions"
          />
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <UiButton variant="secondary" :disabled="loading" @click="loadInventory">Actualizar</UiButton>
        </div>
      </div>

        <div v-if="loading" class="rounded-md border border-slate-200 bg-white p-10 dark:border-line dark:bg-surface">
          <UiLoadingMark label="Cargando inventario" />
        </div>

        <template v-else>
          <div v-if="activeTab === 'overview'" class="space-y-5">
            <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-line dark:bg-surface dark:hover:border-primary dark:hover:bg-primary-soft/20" @click="activeTab = 'stock'">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Productos</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.products }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">Ver existencias</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-line dark:bg-surface dark:hover:border-primary dark:hover:bg-primary-soft/20" @click="activeTab = 'stock'">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Unidades</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ formatQuantity(stats.units) }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">Stock sucursal</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-line dark:bg-surface dark:hover:border-primary dark:hover:bg-primary-soft/20" @click="activeTab = 'lots'">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Valor costo</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ formatMoney(stats.value) }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">Ver lotes</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50/60 dark:border-line dark:bg-surface dark:hover:border-warning dark:hover:bg-warning-soft/20" @click="activeTab = 'alerts'">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Alertas</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ overviewAlertCount }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ stats.lowStock }} sin stock</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-line dark:bg-surface dark:hover:border-primary dark:hover:bg-primary-soft/20" @click="activeTab = 'lots'">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Lotes</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.lots }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">FIFO disponible</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-line dark:bg-surface dark:hover:border-primary dark:hover:bg-primary-soft/20" @click="activeTab = 'kardex'">
                <p class="text-xs font-semibold uppercase text-slate-500 dark:text-soft">Movimientos</p>
                <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ stats.movements }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">Ver kardex</p>
              </button>
            </div>

            <div class="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <section class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-bold text-slate-950 dark:text-text">Tendencia de movimiento</h3>
                    <p class="mt-1 text-sm text-slate-500 dark:text-muted">Entradas y salidas de los últimos 7 días.</p>
                  </div>
                  <div class="flex gap-3 text-xs font-semibold">
                    <span class="inline-flex items-center gap-1 text-emerald-700 dark:text-success"><span class="h-2 w-2 rounded-full bg-emerald-500 dark:bg-success"></span>Entradas</span>
                    <span class="inline-flex items-center gap-1 text-sky-700 dark:text-primary"><span class="h-2 w-2 rounded-full bg-sky-500 dark:bg-primary"></span>Salidas</span>
                  </div>
                </div>
                <div class="mt-5 h-48 rounded-md bg-slate-50 px-4 py-4 dark:bg-surface-muted">
                  <svg class="h-full w-full overflow-visible" viewBox="0 0 360 160" preserveAspectRatio="none" aria-hidden="true">
                    <line x1="0" y1="152" x2="360" y2="152" class="stroke-slate-200 dark:stroke-line" stroke-width="1" />
                    <polyline :points="overviewTrend.entryPoints" fill="none" class="stroke-emerald-500 dark:stroke-success" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                    <polyline :points="overviewTrend.exitPoints" fill="none" class="stroke-sky-500 dark:stroke-primary" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  </svg>
                </div>
                <div class="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500 dark:text-soft">
                  <span v-for="day in overviewTrend.days" :key="day.iso">{{ day.label }}</span>
                </div>
              </section>

              <section class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-bold text-slate-950 dark:text-text">Salud del inventario</h3>
                    <p class="mt-1 text-sm text-slate-500 dark:text-muted">Estado operativo de productos inventariables.</p>
                  </div>
                  <UiButton size="sm" variant="secondary" @click="activeTab = 'alerts'">Ver alertas</UiButton>
                </div>
                <div class="mt-5 overflow-hidden rounded-full bg-slate-100 dark:bg-surface-muted">
                  <div class="flex h-4">
                    <span v-for="segment in overviewStockSegments" :key="segment.key" :class="segment.class" :style="{ width: segment.width }"></span>
                  </div>
                </div>
                <div class="mt-5 grid gap-3 sm:grid-cols-3">
                  <button
                    v-for="segment in overviewStockSegments"
                    :key="segment.key"
                    type="button"
                    class="rounded-md border border-slate-200 px-3 py-3 text-left transition hover:bg-slate-50 dark:border-line dark:hover:bg-surface-muted"
                    @click="segment.key === 'ok' ? activeTab = 'stock' : activeTab = 'alerts'"
                  >
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">{{ segment.label }}</p>
                    <p class="mt-1 text-xl font-black text-slate-950 dark:text-text">{{ segment.value }}</p>
                  </button>
                </div>
              </section>
            </div>

            <section class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-base font-bold text-slate-950 dark:text-text">Actividad acumulada</h3>
                  <p class="mt-1 text-sm text-slate-500 dark:text-muted">Lectura rápida por tipo de operación visible.</p>
                </div>
                <UiButton size="sm" variant="secondary" @click="activeTab = 'kardex'">Abrir kardex</UiButton>
              </div>
              <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <button
                  v-for="row in overviewMovementBars"
                  :key="row.key"
                  type="button"
                  class="rounded-md border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50 dark:border-line dark:hover:bg-surface-muted"
                  @click="activeTab = 'kardex'"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm font-bold text-slate-950 dark:text-text">{{ row.label }}</span>
                    <span class="text-sm font-black text-slate-950 dark:text-text">{{ formatQuantity(row.value) }}</span>
                  </div>
                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-surface-muted">
                    <span class="block h-full rounded-full" :class="row.class" :style="{ width: row.width }"></span>
                  </div>
                </button>
              </div>
            </section>
            </div>

          <div v-if="activeTab === 'stock'" class="space-y-4">
            <div class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
              <div class="grid gap-4 lg:grid-cols-[1fr_180px]">
                <UiSearchInput v-model="filters.q" label="Buscar producto" placeholder="Nombre o código" button-label="Filtrar" />
                <UiSelect
                  v-model="stockPageSize"
                  label="Por página"
                  :options="[
                    { value: '12', label: '12 productos' },
                    { value: '24', label: '24 productos' },
                    { value: '48', label: '48 productos' }
                  ]"
                />
              </div>
            </div>
            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div v-if="stockMeta.last_page > 1" class="border-b border-slate-200 pb-4 dark:border-line">
                <BillingPaginationBar :meta="stockMeta" @page="goToStockPage" />
              </div>

              <UiDataTable overflow="auto" min-width="min-w-[820px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3">Stock sucursal</th>
                    <th class="px-4 py-3">Stock total</th>
                    <th class="px-4 py-3">Costo prom.</th>
                    <th class="px-4 py-3">Valor</th>
                    <th class="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="item in paginatedVisibleItems" :key="item.id" class="text-sm">
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ item.name }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ item.sku || 'Sin código' }}</p>
                    </td>
                    <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ formatQuantity(item.branch_stock_quantity) }}</td>
                    <td class="px-4 py-3">{{ formatQuantity(item.stock_quantity) }}</td>
                    <td class="px-4 py-3">{{ formatMoney(item.reference_cost) }}</td>
                    <td class="px-4 py-3">{{ formatMoney(Number(item.branch_stock_quantity || 0) * Number(item.reference_cost || 0)) }}</td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end gap-2">
                        <UiButton size="sm" variant="secondary" @click="openProductDetail(item)">Detalle</UiButton>
                        <UiButton size="sm" variant="secondary" @click="abrirCompraManual(item)">Entrada</UiButton>
                        <UiButton size="sm" variant="ghost" @click="adjustmentForm.catalog_item_id = String(item.id); activeTab = 'adjustments'">Ajuste</UiButton>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedVisibleItems.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="6">Sin productos inventariables.</td>
                  </tr>
                </tbody>
              </UiDataTable>
              <div v-if="stockMeta.last_page > 1" class="mt-4 border-t border-slate-200 pt-4 dark:border-line">
                <BillingPaginationBar :meta="stockMeta" @page="goToStockPage" />
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'entries'" class="space-y-4">
            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="text-base font-bold text-slate-950 dark:text-text">Compras y entradas</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-muted">Registra un CCF físico o importa el JSON DTE recibido del proveedor.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UiFileUpload id="inventory-compra-json" label="Importar JSON" accept=".json,application/json" compact @change="importarJsonCompra" />
                  <UiButton @click="abrirCompraManual(null)">CCF físico</UiButton>
                </div>
              </div>
            </div>

            <div v-if="compraImportada.preview" class="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm shadow-blue-950/5 dark:border-line dark:bg-surface dark:shadow-none">
              <div class="border-b border-slate-200 px-5 py-4 dark:border-line">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">{{ esCompraManual ? 'CCF físico' : 'Compra importada' }}</p>
                    <h3 class="mt-1 text-xl font-black text-slate-950 dark:text-text">{{ etiquetaDocumentoCompra }}</h3>
                    <p class="mt-1 max-w-full truncate text-sm text-slate-600 dark:text-muted">{{ esCompraManual ? 'CCF físico en papel' : (compraImportada.document.document_number || 'Sin código de generación') }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UiStatusBadge :tone="totalesCompraImportadaOk ? 'success' : 'warning'">{{ totalesCompraImportadaOk ? 'Totales OK' : 'Revisar total' }}</UiStatusBadge>
                    <UiStatusBadge :tone="lineasCompraImportadaResueltas === compraImportada.lines.length ? 'success' : 'warning'">{{ lineasCompraImportadaResueltas }}/{{ compraImportada.lines.length }} líneas</UiStatusBadge>
                    <UiButton variant="ghost" @click="limpiarCompraImportada">Limpiar</UiButton>
                  </div>
                </div>

                <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Fecha</p>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ compraImportada.document.purchase_date || 'N/D' }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Condición</p>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ etiquetaPagoCompra }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">{{ esCompraManual ? 'Origen' : 'Archivo' }}</p>
                    <p class="mt-1 truncate font-semibold text-slate-950 dark:text-text">{{ esCompraManual ? 'Papel' : compraImportada.fileName }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Documento</p>
                    <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ etiquetaDocumentoCompra }}</p>
                  </div>
                  <div class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
                    <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">{{ esCompraManual ? 'Total calculado' : 'Total DTE' }}</p>
                    <p class="mt-1 text-lg font-black text-slate-950 dark:text-text">{{ formatMoney(totalDocumentoCompraImportada) }}</p>
                  </div>
                </div>
                <div v-if="esCompraManual" class="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-line dark:bg-surface-muted">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-black text-slate-950 dark:text-text">Datos del CCF físico</p>
                      <p class="mt-1 text-sm text-slate-600 dark:text-muted">Usa esta captura para compras con CCF en papel que alimentarán el anexo.</p>
                    </div>
                    <span
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white text-sm font-black text-sky-700 dark:border-primary/40 dark:bg-surface dark:text-primary"
                      title="Si recibiste un DTE, importa el JSON. Las facturas consumidor final no se capturan aquí porque no alimentan el anexo de compras."
                      aria-label="Ayuda sobre CCF físico"
                    >
                      ?
                    </span>
                  </div>
                  <div class="mt-4 grid gap-4 md:grid-cols-3">
                    <UiInput v-model="compraImportada.document.purchase_date" label="Fecha" type="date" />
                    <UiInput v-model="compraImportada.document.document_number" label="Número CCF" placeholder="Serie o correlativo" />
                    <UiSelect
                      v-model="compraImportada.document.payment_condition"
                      label="Condición"
                      :options="[
                        { value: 'cash', label: 'Contado' },
                        { value: 'credit', label: 'Crédito' }
                      ]"
                    />
                  </div>
                </div>
              </div>

              <div class="grid gap-0 lg:grid-cols-[1fr_320px]">
                <div class="min-w-0 px-5 py-5">
                  <section class="rounded-md border border-slate-200 dark:border-line">
                    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-line">
                      <div>
                        <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Proveedor</p>
                        <p class="mt-1 text-base font-bold text-slate-950 dark:text-text">{{ compraImportada.supplier.name || 'Proveedor pendiente' }}</p>
                        <p class="mt-1 text-sm text-slate-600 dark:text-muted">
                          {{ compraImportada.supplier.tax_id || 'Sin NIT' }}
                          <span v-if="compraImportada.supplier.nrc"> · NRC {{ compraImportada.supplier.nrc }}</span>
                          <span v-if="compraImportada.supplier.phone"> · {{ compraImportada.supplier.phone }}</span>
                        </p>
                      </div>
                      <UiStatusBadge :tone="compraImportada.create_supplier ? 'warning' : (compraImportada.supplier_id ? 'success' : 'neutral')">
                        {{ compraImportada.create_supplier ? 'Nuevo proveedor' : (compraImportada.supplier_id ? 'Proveedor vinculado' : 'Proveedor pendiente') }}
                      </UiStatusBadge>
                    </div>
                    <div class="px-4 py-4">
                      <div v-if="!compraImportada.create_supplier" class="space-y-3">
                        <div v-if="esCompraManual" class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                          <UiSelect v-model="compraImportada.supplier_id" label="Proveedor existente" :options="supplierOptions" />
                          <UiButton variant="secondary" @click="compraImportada.create_supplier = true">Nuevo proveedor</UiButton>
                        </div>
                        <div class="grid gap-3 md:grid-cols-3">
                          <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Nombre</p>
                            <p class="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-text">{{ compraImportada.supplier.name || 'Pendiente' }}</p>
                          </div>
                          <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">NIT / NRC</p>
                            <p class="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-text">{{ compraImportada.supplier.tax_id || 'Sin NIT' }}<span v-if="compraImportada.supplier.nrc"> · {{ compraImportada.supplier.nrc }}</span></p>
                          </div>
                          <div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Origen</p>
                            <p class="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-text">Base de proveedores</p>
                          </div>
                        </div>
                      </div>
                      <template v-if="compraImportada.create_supplier">
                        <div v-if="esCompraManual" class="mb-4 flex justify-end">
                          <UiButton variant="ghost" @click="compraImportada.create_supplier = false">Usar proveedor existente</UiButton>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                          <UiInput
                            :model-value="compraImportada.supplier.name"
                            label="Nombre proveedor"
                            @update:model-value="updateImportedSupplierName"
                          />
                          <UiInput
                            :model-value="compraImportada.supplier.tax_id"
                            label="NIT"
                            @update:model-value="updateImportedSupplierNit"
                          />
                          <UiInput
                            :model-value="compraImportada.supplier.nrc"
                            label="NRC"
                            @update:model-value="updateImportedSupplierNrc"
                          />
                          <UiInput
                            :model-value="compraImportada.supplier.phone"
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
                      <UiStatusBadge :tone="lineasCompraImportadaResueltas === compraImportada.lines.length ? 'success' : 'warning'">
                        {{ lineasCompraImportadaResueltas }} resueltas
                      </UiStatusBadge>
                      <UiButton v-if="esCompraManual" size="sm" variant="secondary" @click="agregarLineaCompraManual">Agregar línea</UiButton>
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
                        <tr v-for="(line, idx) in compraImportada.lines" :key="`${line.description}-${idx}`" class="text-sm">
                          <td class="px-4 py-3">
                            <p class="max-w-[320px] truncate font-semibold text-slate-950 dark:text-text">{{ line.description }}</p>
                            <p class="text-xs text-slate-500 dark:text-soft">Unidad {{ line.unit_code || '59' }}</p>
                          </td>
                          <td class="px-4 py-3">
                            <p class="max-w-[240px] truncate font-semibold text-slate-950 dark:text-text">{{ line.create_item ? (line.new_item_name || 'Nuevo ítem') : lineLinkedItemName(line) }}</p>
                            <p class="text-xs text-slate-500 dark:text-soft">{{ lineResolved(line) ? 'Lista para registrar' : 'Pendiente de resolver' }}</p>
                          </td>
                          <td class="px-4 py-3">
                            <UiStatusBadge :tone="line.no_inventory || compraImportada.document.is_consumable ? 'neutral' : 'success'">{{ lineModeLabel(line) }}</UiStatusBadge>
                          </td>
                          <td class="px-4 py-3 text-right font-semibold">{{ formatQuantity(line.quantity) }}</td>
                          <td class="px-4 py-3 text-right">{{ formatMoney(line.unit_cost) }}</td>
                          <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(Number(line.quantity || 0) * Number(line.unit_cost || 0)) }}</td>
                          <td class="px-4 py-3 text-right">
                            <div class="flex justify-end gap-2">
                              <UiButton size="sm" variant="secondary" @click="openLineResolver(idx)">{{ esCompraManual ? 'Editar' : 'Resolver' }}</UiButton>
                              <UiButton v-if="esCompraManual && compraImportada.lines.length > 1" size="sm" variant="ghost" @click="quitarLineaCompra(idx)">Quitar</UiButton>
                            </div>
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
                        <strong>{{ formatMoney(compraImportadaSubtotal) }}</strong>
                      </div>
                      <div class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">IVA estimado</span>
                        <strong>{{ formatMoney(ivaCompraImportada) }}</strong>
                      </div>
                      <div v-if="compraImportada.document.apply_tax_perceived" class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">IVA percibido</span>
                        <strong>{{ formatMoney(ivaPercibidoCompraImportada) }}</strong>
                      </div>
                      <div v-if="compraImportada.document.apply_fuel_charges" class="flex justify-between gap-4">
                        <span class="text-slate-600 dark:text-muted">FOVIAL/COTRANS</span>
                        <strong>{{ formatMoney(combustibleCompraImportada) }}</strong>
                      </div>
                      <div class="border-t border-slate-200 pt-3 dark:border-line">
                        <div class="flex justify-between gap-4">
                          <span class="font-bold text-slate-950 dark:text-text">Calculado</span>
                          <strong>{{ formatMoney(totalCalculadoCompraImportada) }}</strong>
                        </div>
                        <div class="mt-2 flex justify-between gap-4">
                          <span class="font-bold text-slate-950 dark:text-text">{{ esCompraManual ? 'Total compra' : 'Total DTE' }}</span>
                          <strong>{{ formatMoney(totalDocumentoCompraImportada) }}</strong>
                        </div>
                        <div class="mt-2 flex justify-between gap-4" :class="totalesCompraImportadaOk ? 'text-emerald-700 dark:text-success' : 'text-amber-700 dark:text-warning'">
                          <span class="font-bold">Diferencia</span>
                          <strong>{{ formatMoney(diferenciaCompraImportada) }}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 rounded-md border border-slate-200 p-4 dark:border-line">
                    <p class="text-sm font-black text-slate-950 dark:text-text">Ajustes</p>
                    <div class="mt-3 space-y-3">
                      <UiCheckbox v-model="compraImportada.document.is_consumable" label="Compra consumible" />
                      <div v-if="Number(compraImportada.document.tax_perceived_amount || 0) > 0" class="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-success/50 dark:bg-surface-2">
                        <span class="font-semibold text-slate-800 dark:text-text">IVA percibido detectado</span>
                        <span class="shrink-0 rounded bg-emerald-100 px-2 py-1 font-black text-emerald-800 dark:bg-success-soft dark:text-success">{{ formatMoney(compraImportada.document.tax_perceived_amount) }}</span>
                      </div>
                      <UiCheckbox v-else v-model="compraImportada.document.apply_tax_perceived" label="IVA percibido" />
                      <UiCheckbox v-model="compraImportada.document.apply_fuel_charges" label="FOVIAL/COTRANS" />
                    </div>
                  </div>

                  <div class="mt-4 flex flex-col gap-2">
                    <UiButton :disabled="saving || !compraImportadaPuedeRegistrarse" @click="registrarCompraImportada">Registrar compra</UiButton>
                    <p v-if="!compraImportadaPuedeRegistrarse" class="text-xs text-slate-500 dark:text-soft">Resuelve proveedor, líneas y diferencia de totales antes de registrar.</p>
                  </div>
                </aside>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'purchases'" class="space-y-4">
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Compras filtradas</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ purchaseStats.count }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Total</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(purchaseStats.total) }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">DTE JSON</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ purchaseStats.dte }}</p>
              </div>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">CCF físico</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ purchaseStats.manual }}</p>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr] xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                <UiSearchInput v-model="purchaseFilters.q" label="Buscar" placeholder="Buscar proveedor, documento o número interno" />
                <UiSelect v-model="purchaseFilters.document_mode" label="Modo" :options="purchaseModeOptions" />
                <UiSelect v-model="purchaseFilters.supplier_id" label="Proveedor" :options="lotSupplierOptions" />
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <UiInput v-model="purchaseFilters.from" label="Desde" type="date" />
                  <UiInput v-model="purchaseFilters.to" label="Hasta" type="date" />
                </div>
                <div class="flex items-end">
                  <UiButton variant="ghost" @click="purchaseFilters = { q: '', document_mode: '', supplier_id: '', from: '', to: '' }">Limpiar</UiButton>
                </div>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <UiDataTable overflow="auto" min-width="min-w-[1040px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Compra</th>
                    <th class="px-4 py-3">Proveedor</th>
                    <th class="px-4 py-3">Documento</th>
                    <th class="px-4 py-3">Fecha</th>
                    <th class="px-4 py-3">Sucursal</th>
                    <th class="px-4 py-3 text-right">Líneas</th>
                    <th class="px-4 py-3 text-right">Total</th>
                    <th class="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="purchase in filteredPurchaseRows" :key="purchase.id" class="text-sm">
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-950 dark:text-text">#{{ purchase.purchase_number || purchase.id }}</p>
                      <UiStatusBadge :tone="purchase.status === 'registered' ? 'success' : 'neutral'">{{ purchase.status || 'Registrada' }}</UiStatusBadge>
                    </td>
                    <td class="px-4 py-3">
                      <p class="max-w-[240px] truncate font-semibold text-slate-950 dark:text-text">{{ purchase.supplier_name }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ purchase.supplier?.tax_id || purchase.supplier_snapshot?.tax_id || 'Sin NIT' }}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ purchaseDocumentTypeLabel(purchase.document_type) }}</p>
                      <p class="max-w-[220px] truncate text-xs text-slate-500 dark:text-soft">{{ purchase.document_number || 'Sin número' }} · {{ purchaseDocumentModeLabel(purchase.document_mode) }}</p>
                    </td>
                    <td class="px-4 py-3">{{ formatDateOnly(purchase.purchase_date) }}</td>
                    <td class="px-4 py-3">{{ purchase.branch_label }}</td>
                    <td class="px-4 py-3 text-right">{{ purchase.lines_count || purchase.lines?.length || 0 }}</td>
                    <td class="px-4 py-3 text-right font-semibold text-slate-950 dark:text-text">{{ formatMoney(purchase.total_number) }}</td>
                    <td class="px-4 py-3 text-right">
                      <UiButton size="sm" @click="openPurchaseDetail(purchase)">Ver</UiButton>
                    </td>
                  </tr>
                  <tr v-if="filteredPurchaseRows.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="8">Sin compras para los filtros seleccionados.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </div>
          </div>

          <div v-if="activeTab === 'lots'" class="space-y-4">
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left dark:border-line dark:bg-surface" @click="lotFilters.status = ''">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Lotes filtrados</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ filteredLotRows.length }}</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left dark:border-line dark:bg-surface" @click="lotFilters.status = 'available'">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Disponibles</p>
                <p class="mt-1 text-2xl font-black text-emerald-700 dark:text-success">{{ lotStats.available }}</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left dark:border-line dark:bg-surface" @click="lotFilters.status = 'partial'">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Parciales</p>
                <p class="mt-1 text-2xl font-black text-amber-700 dark:text-warning">{{ lotStats.partial }}</p>
              </button>
              <button type="button" class="rounded-md border border-slate-200 bg-white px-4 py-3 text-left dark:border-line dark:bg-surface" @click="lotFilters.status = 'depleted'">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Agotados</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ lotStats.depleted }}</p>
              </button>
              <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Valor disponible</p>
                <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(lotStats.value) }}</p>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr] xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
                <UiSearchInput v-model="lotFilters.q" label="Buscar" placeholder="Buscar lote, producto, SKU o proveedor" />
                <UiSelect v-model="lotFilters.status" label="Estado" :options="lotStatusOptions" />
                <UiSelect v-model="lotFilters.catalog_item_id" label="Producto" :options="lotProductOptions" />
                <UiSelect v-model="lotFilters.inventory_supplier_id" label="Proveedor" :options="lotSupplierOptions" />
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <UiInput v-model="lotFilters.from" label="Desde" type="date" />
                  <UiInput v-model="lotFilters.to" label="Hasta" type="date" />
                </div>
                <div class="flex items-end">
                  <UiButton variant="ghost" @click="lotFilters = { q: '', status: '', catalog_item_id: '', inventory_supplier_id: '', from: '', to: '' }">Limpiar</UiButton>
                </div>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <UiDataTable overflow="auto" min-width="min-w-[1080px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Lote</th>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3">Proveedor</th>
                    <th class="px-4 py-3">Fecha</th>
                    <th class="px-4 py-3">Sucursal</th>
                    <th class="px-4 py-3 text-right">Inicial</th>
                    <th class="px-4 py-3 text-right">Consumido</th>
                    <th class="px-4 py-3 text-right">Disponible</th>
                    <th class="px-4 py-3 text-right">Valor</th>
                    <th class="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="lot in filteredLotRows" :key="lot.id" class="text-sm">
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ lot.lot_code }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ lot.inventory_purchase_id ? `Compra #${lot.inventory_purchase_id}` : 'Sin compra' }}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="max-w-[260px] truncate font-semibold text-slate-950 dark:text-text">{{ lot.catalog_item?.name ?? 'Producto' }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ lot.catalog_item?.sku || 'Sin código' }}</p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="max-w-[180px] truncate text-slate-700 dark:text-muted">{{ lot.supplier_name }}</p>
                    </td>
                    <td class="px-4 py-3">{{ lot.received_date || 'Sin fecha' }}</td>
                    <td class="px-4 py-3">{{ lot.core_sucursal_code || lot.core_sucursal_name || 'Sin asignar' }}</td>
                    <td class="px-4 py-3 text-right">{{ formatQuantity(lot.initial_quantity_number) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatQuantity(lot.consumed_quantity) }}</td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex flex-col items-end gap-1">
                        <UiStatusBadge :tone="lotStatusTone(lot.lot_status)">{{ lotStatusLabel(lot.lot_status) }}</UiStatusBadge>
                        <span class="font-semibold text-slate-950 dark:text-text">{{ formatQuantity(lot.available_quantity_number) }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ formatMoney(lot.available_value) }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ formatMoney(lot.unit_cost) }} c/u</p>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <UiButton size="sm" variant="secondary" @click="selectedLot = lot">Detalle</UiButton>
                    </td>
                  </tr>
                  <tr v-if="filteredLotRows.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="10">Sin lotes para los filtros seleccionados.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </div>
          </div>

          <div v-if="activeTab === 'kardex'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <UiDataTable overflow="auto" min-width="min-w-[900px]">
              <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                <tr>
                  <th class="px-4 py-3">Producto</th>
                  <th class="px-4 py-3">Tipo</th>
                  <th class="px-4 py-3">Motivo</th>
                  <th class="px-4 py-3">Sucursal</th>
                  <th class="px-4 py-3">Cantidad</th>
                  <th class="px-4 py-3">Costo</th>
                  <th class="px-4 py-3">Referencia</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-line">
                <tr v-for="movement in visibleMovements" :key="movement.id" class="text-sm">
                  <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ movement.catalog_item?.name ?? 'Producto' }}</td>
                  <td class="px-4 py-3"><UiStatusBadge :tone="movementTone(movement.movement_type)">{{ movement.movement_type === 'entry' ? 'Entrada' : 'Salida' }}</UiStatusBadge></td>
                  <td class="px-4 py-3">{{ inventoryMovementReasonLabel(movement.reason) }}</td>
                  <td class="px-4 py-3">{{ movement.core_sucursal_code || movement.core_sucursal_name || 'Sin asignar' }}</td>
                  <td class="px-4 py-3">{{ formatQuantity(movement.quantity) }}</td>
                  <td class="px-4 py-3">{{ movement.unit_cost === null ? 'N/D' : formatMoney(movement.unit_cost) }}</td>
                  <td class="px-4 py-3">{{ movement.reference_number || movement.reference_id || movement.created_at }}</td>
                </tr>
                <tr v-if="visibleMovements.length === 0">
                  <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="7">Sin movimientos registrados.</td>
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

          <div v-if="activeTab === 'counts'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <div class="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-line lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 class="text-base font-bold text-slate-950 dark:text-text">Hoja de conteo físico</h3>
                <p class="mt-1 text-sm text-slate-500 dark:text-muted">
                  Genera una hoja con el stock del sistema y columnas vacías para anotar el conteo real.
                </p>
                <p class="mt-2 text-xs font-semibold uppercase text-slate-500 dark:text-soft">
                  {{ selectedBranch ? `${selectedBranch.codigo || 'Sucursal'} · ${selectedBranch.nombre}` : 'Todas las sucursales' }} · {{ countSheetRows.length }} productos
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <UiButton variant="secondary" type="button" @click="imprimirHojaConteo">Ver PDF</UiButton>
                <UiButton type="button" @click="descargarHojaConteoPdf">Descargar PDF</UiButton>
                <UiButton variant="ghost" type="button" @click="descargarHojaConteo">CSV</UiButton>
              </div>
            </div>

            <form class="grid gap-4 lg:grid-cols-2" @submit.prevent="savePhysicalCount">
              <UiSelect v-model="countForm.catalog_item_id" label="Producto" :options="inventoryOptions" />
              <UiInput v-model="countForm.counted_quantity" label="Cantidad física" type="number" min="0" step="0.001" />
              <UiInput v-model="countForm.count_date" label="Fecha conteo" type="date" />
              <UiInput v-model="countForm.notes" label="Notas" placeholder="Referencia del conteo" />
              <div class="flex justify-end lg:col-span-2">
                <UiButton type="submit" :disabled="saving || !countForm.catalog_item_id">Aplicar conteo</UiButton>
              </div>
            </form>
          </div>

          <div v-if="activeTab === 'transfers'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <form class="grid gap-4 lg:grid-cols-2" @submit.prevent="saveTransfer">
              <UiSelect v-model="transferForm.from_core_sucursal_id" label="Sucursal origen" :options="branchOptions" />
              <UiSelect v-model="transferForm.to_core_sucursal_id" label="Sucursal destino" :options="branchOptions" />
              <UiSelect v-model="transferForm.catalog_item_id" label="Producto" :options="inventoryOptions" />
              <UiInput v-model="transferForm.quantity" label="Cantidad" type="number" min="0.001" step="0.001" />
              <div class="lg:col-span-2">
                <UiInput v-model="transferForm.notes" label="Notas" placeholder="Referencia interna" />
              </div>
              <div class="flex justify-end lg:col-span-2">
                <UiButton type="submit" :disabled="saving || !transferForm.catalog_item_id || !transferFromBranch || !transferToBranch">Transferir</UiButton>
              </div>
            </form>
          </div>

          <div v-if="activeTab === 'reports'" class="space-y-5">
            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h3 class="text-base font-bold text-slate-950 dark:text-text">Reportes operativos</h3>
                  <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-soft">{{ reportScopeLabel }}</p>
                </div>
                <div class="grid w-full gap-4 md:w-auto md:grid-cols-[160px_160px_auto]">
                  <UiInput v-model="reportFilters.from" label="Desde" type="date" />
                  <UiInput v-model="reportFilters.to" label="Hasta" type="date" />
                  <div class="flex items-end">
                    <UiButton variant="secondary" @click="loadInventory({ silent: true })">Actualizar</UiButton>
                  </div>
                </div>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div
                  v-for="metric in reportSummaryMetrics"
                  :key="metric.label"
                  class="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 dark:border-line dark:bg-panel"
                >
                  <p class="text-[11px] font-bold uppercase text-slate-500 dark:text-soft">{{ metric.label }}</p>
                  <p class="mt-1 text-xl font-black text-slate-950 dark:text-text">{{ metric.value }}</p>
                </div>
              </div>
            </div>

            <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
              <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <h3 class="text-base font-bold text-slate-950 dark:text-text">Descargas principales</h3>
                  <span class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Acciones</span>
                </div>
                <UiDataTable class="mt-4" overflow="visible">
                  <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                    <tr>
                      <th class="px-4 py-3">Reporte</th>
                      <th class="px-4 py-3 text-right">Filas</th>
                      <th class="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-line">
                    <tr v-for="report in primaryReportRows" :key="report.key" class="text-sm">
                      <td class="px-4 py-3">
                        <p class="font-semibold text-slate-950 dark:text-text">{{ report.name }}</p>
                        <p class="text-xs text-slate-500 dark:text-soft">{{ report.detail }}</p>
                      </td>
                      <td class="px-4 py-3 text-right font-semibold text-slate-950 dark:text-text">{{ report.rows }}</td>
                      <td class="px-4 py-3 text-right">
                        <UiActionDropdown :label="`Abrir acciones de ${report.name}`" menu-width="w-48">
                          <UiActionMenuItem :disabled="report.rows === 0" @select="verReporte(report.key)">Ver</UiActionMenuItem>
                          <UiActionMenuItem :disabled="report.rows === 0" @select="descargarExcelReporte(report.key)">Descargar Excel</UiActionMenuItem>
                          <UiActionMenuItem :disabled="report.rows === 0" @select="descargarPdfReporte(report.key)">Descargar PDF</UiActionMenuItem>
                        </UiActionDropdown>
                      </td>
                    </tr>
                  </tbody>
                </UiDataTable>
              </div>

              <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
                <h3 class="text-base font-bold text-slate-950 dark:text-text">Secundarios</h3>
                <div class="mt-4 divide-y divide-slate-100 dark:divide-line">
                  <div v-for="report in secondaryReportRows" :key="report.key" class="flex items-center justify-between gap-4 py-3">
                    <div class="min-w-0">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ report.name }}</p>
                      <p class="truncate text-xs text-slate-500 dark:text-soft">{{ report.detail }}</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-3">
                      <span class="text-sm font-bold text-slate-950 dark:text-text">{{ report.rows }}</span>
                      <UiActionDropdown :label="`Abrir acciones de ${report.name}`" menu-width="w-48">
                        <UiActionMenuItem :disabled="report.rows === 0" @select="verReporte(report.key)">Ver</UiActionMenuItem>
                        <UiActionMenuItem :disabled="report.rows === 0" @select="descargarExcelReporte(report.key)">Descargar Excel</UiActionMenuItem>
                        <UiActionMenuItem :disabled="report.rows === 0" @select="descargarPdfReporte(report.key)">Descargar PDF</UiActionMenuItem>
                      </UiActionDropdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Ventas por producto</h3>
              <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[760px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3">Origen</th>
                    <th class="px-4 py-3 text-right">Cantidad</th>
                    <th class="px-4 py-3 text-right">Venta</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="row in salesReport" :key="`${row.catalog_item_id || row.name}-${row.line_origin}`" class="text-sm">
                    <td class="px-4 py-3">
                      <p class="font-semibold text-slate-950 dark:text-text">{{ row.name }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ row.sku || 'Sin código' }}</p>
                    </td>
                    <td class="px-4 py-3">{{ row.line_origin }}</td>
                    <td class="px-4 py-3 text-right">{{ formatQuantity(row.quantity) }}</td>
                    <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(row.sales_total) }}</td>
                  </tr>
                  <tr v-if="salesReport.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="4">Sin ventas registradas en el período.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </div>
            <div class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Margen referencial</h3>
              <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[820px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3 text-right">Venta</th>
                    <th class="px-4 py-3 text-right">Costo ref.</th>
                    <th class="px-4 py-3 text-right">Margen</th>
                    <th class="px-4 py-3 text-right">%</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="row in marginReport" :key="`${row.catalog_item_id || row.name}-margin`" class="text-sm">
                    <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ row.name }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(row.sales_total) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(row.reference_cost_total) }}</td>
                    <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(row.margin_total) }}</td>
                    <td class="px-4 py-3 text-right">{{ Number(row.margin_percent || 0).toFixed(2) }}%</td>
                  </tr>
                  <tr v-if="marginReport.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin margen para mostrar.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </div>
          </div>

          <div v-if="activeTab === 'alerts'" class="rounded-md border border-slate-200 bg-white p-5 dark:border-line dark:bg-surface">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Alertas de stock mínimo</h3>
              <UiButton variant="secondary" @click="loadInventory({ silent: true })">Actualizar</UiButton>
            </div>
            <div class="mt-4 divide-y divide-slate-100 dark:divide-line">
              <div v-for="item in stockAlerts" :key="item.id" class="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p class="font-semibold text-slate-950 dark:text-text">{{ item.name }}</p>
                  <p class="text-xs text-slate-500 dark:text-soft">{{ item.sku || 'Sin código' }}</p>
                </div>
                <div class="text-right">
                  <UiStatusBadge tone="warning">Bajo mínimo</UiStatusBadge>
                  <p class="mt-1 text-xs text-slate-500 dark:text-soft">{{ formatQuantity(item.stock_quantity) }} / mínimo {{ formatQuantity(item.min_stock_quantity) }}</p>
                </div>
              </div>
              <p v-if="stockAlerts.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-muted">Sin alertas activas.</p>
            </div>
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
      :open="Boolean(productDetailItem)"
      :title="productDetailItem?.name || 'Producto'"
      :description="productDetailItem?.sku || 'Sin código'"
      max-width="max-w-6xl"
      @close="productDetailItem = null"
    >
      <div v-if="productDetailItem" class="space-y-5">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Stock total</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatQuantity(productDetailStats.lotsTotal) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Valor costo</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(productDetailStats.costValue) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Costo ref.</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(productDetailItem.reference_cost) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Vendido</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatQuantity(productDetailStats.saleQuantity) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Margen</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(productDetailStats.marginTotal) }}</p>
          </div>
        </div>

        <div class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Stock por sucursal</h3>
              <UiStatusBadge :tone="productDetailStats.lotsTotal > 0 ? 'success' : 'warning'">{{ productDetailStats.lotsTotal > 0 ? 'Disponible' : 'Sin stock' }}</UiStatusBadge>
            </div>
            <div class="mt-4 divide-y divide-slate-100 dark:divide-line">
              <div v-for="branch in productDetailBranchRows" :key="branch.id || branch.label" class="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p class="font-semibold text-slate-950 dark:text-text">{{ branch.label }}</p>
                  <p class="text-xs text-slate-500 dark:text-soft">{{ formatMoney(branch.value) }} a costo de lote</p>
                </div>
                <p class="font-black text-slate-950 dark:text-text">{{ formatQuantity(branch.quantity) }}</p>
              </div>
              <p v-if="productDetailBranchRows.length === 0" class="py-8 text-center text-sm text-slate-500 dark:text-muted">Sin existencias por sucursal.</p>
            </div>
          </section>

          <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <h3 class="text-base font-bold text-slate-950 dark:text-text">Lotes disponibles</h3>
            <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[640px]">
              <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                <tr>
                  <th class="px-4 py-3">Lote</th>
                  <th class="px-4 py-3">Sucursal</th>
                  <th class="px-4 py-3">Fecha</th>
                  <th class="px-4 py-3 text-right">Disponible</th>
                  <th class="px-4 py-3 text-right">Costo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-line">
                <tr v-for="lot in productDetailLots" :key="lot.id" class="text-sm">
                  <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ lot.lot_code }}</td>
                  <td class="px-4 py-3">{{ lot.core_sucursal_code || lot.core_sucursal_name || 'Sin asignar' }}</td>
                  <td class="px-4 py-3">{{ lot.received_date || 'Sin fecha' }}</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ formatQuantity(lot.available_quantity) }}</td>
                  <td class="px-4 py-3 text-right">{{ formatMoney(lot.unit_cost) }}</td>
                </tr>
                <tr v-if="productDetailLots.length === 0">
                  <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin lotes para este producto.</td>
                </tr>
              </tbody>
            </UiDataTable>
          </section>
        </div>

        <div class="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <h3 class="text-base font-bold text-slate-950 dark:text-text">Kardex reciente</h3>
            <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[720px]">
              <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                <tr>
                  <th class="px-4 py-3">Tipo</th>
                  <th class="px-4 py-3">Motivo</th>
                  <th class="px-4 py-3">Sucursal</th>
                  <th class="px-4 py-3 text-right">Cantidad</th>
                  <th class="px-4 py-3">Referencia</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-line">
                <tr v-for="movement in productDetailMovements" :key="movement.id" class="text-sm">
                  <td class="px-4 py-3"><UiStatusBadge :tone="movementTone(movement.movement_type)">{{ movement.movement_type === 'entry' ? 'Entrada' : 'Salida' }}</UiStatusBadge></td>
                  <td class="px-4 py-3">{{ inventoryMovementReasonLabel(movement.reason) }}</td>
                  <td class="px-4 py-3">{{ movement.core_sucursal_code || movement.core_sucursal_name || 'Sin asignar' }}</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ formatQuantity(movement.quantity) }}</td>
                  <td class="px-4 py-3">{{ movement.reference_number || movement.reference_id || movement.created_at }}</td>
                </tr>
                <tr v-if="productDetailMovements.length === 0">
                  <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin movimientos recientes.</td>
                </tr>
              </tbody>
            </UiDataTable>
          </section>

          <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <h3 class="text-base font-bold text-slate-950 dark:text-text">Ventas y margen</h3>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Unidades vendidas</span>
                <strong class="text-slate-950 dark:text-text">{{ formatQuantity(productDetailStats.saleQuantity) }}</strong>
              </div>
              <div class="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Venta acumulada</span>
                <strong class="text-slate-950 dark:text-text">{{ formatMoney(productDetailStats.saleTotal) }}</strong>
              </div>
              <div class="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Costo referencial</span>
                <strong class="text-slate-950 dark:text-text">{{ formatMoney(productDetailMargin?.reference_cost_total || 0) }}</strong>
              </div>
              <div class="flex items-center justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Margen referencial</span>
                <strong class="text-slate-950 dark:text-text">{{ formatMoney(productDetailStats.marginTotal) }}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </UiModalShell>

    <UiModalShell
      :open="Boolean(duplicatePurchase)"
      title="Compra ya registrada"
      :description="duplicatePurchase?.document_number || 'DTE existente'"
      max-width="max-w-lg"
      @close="duplicatePurchase = null"
    >
      <div class="space-y-4">
        <div class="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-success/30 dark:bg-success-soft">
          <UiStatusBadge tone="success">Registrada</UiStatusBadge>
          <div class="min-w-0">
            <p class="font-bold text-slate-950 dark:text-text">Este DTE ya forma parte de tus compras.</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-muted">No realizamos ningún cambio en inventario. Puedes revisar la compra existente o seleccionar otro archivo.</p>
          </div>
        </div>

        <div v-if="duplicatePurchase?.purchase_date" class="rounded-md border border-slate-200 px-4 py-3 dark:border-line">
          <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Fecha de compra</p>
          <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ formatDateOnly(duplicatePurchase.purchase_date) }}</p>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="duplicatePurchase = null">Cerrar</UiButton>
        <UiButton variant="secondary" @click="importarOtroJsonCompra">Importar otro JSON</UiButton>
        <UiButton v-if="duplicatePurchase?.purchase_id" @click="verCompraDuplicada">Ver compra</UiButton>
      </template>
    </UiModalShell>

    <UiModalShell
      :open="Boolean(selectedPurchase)"
      :title="selectedPurchase ? `Compra #${selectedPurchase.purchase_number || selectedPurchase.id}` : 'Compra'"
      :description="selectedPurchase?.document_number || 'Detalle de compra'"
      max-width="max-w-6xl"
      @close="selectedPurchase = null"
    >
      <div v-if="selectedPurchase" class="min-w-0 space-y-5">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div class="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Fecha</p>
            <p class="mt-2 text-lg font-black text-slate-950 dark:text-text">{{ formatDateOnly(selectedPurchase.purchase_date) }}</p>
          </div>
          <div class="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Documento</p>
            <p class="mt-2 font-black text-slate-950 dark:text-text">{{ purchaseDocumentTypeLabel(selectedPurchase.document_type) }}</p>
            <p class="mt-1 truncate text-xs text-slate-500 dark:text-soft">{{ selectedPurchase.document_number || 'Sin número' }}</p>
          </div>
          <div class="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Modo</p>
            <p class="mt-2 font-black text-slate-950 dark:text-text">{{ purchaseDocumentModeLabel(selectedPurchase.document_mode) }}</p>
          </div>
          <div class="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Condición</p>
            <p class="mt-2 font-black text-slate-950 dark:text-text">{{ paymentConditionLabel(selectedPurchase.payment_condition) }}</p>
          </div>
          <div class="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Total</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(selectedPurchase.total) }}</p>
          </div>
        </div>

        <div class="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
          <div class="min-w-0 space-y-5">
            <section class="min-w-0 rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Proveedor</p>
                  <h3 class="mt-1 text-lg font-black text-slate-950 dark:text-text">{{ selectedPurchase.supplier?.name || selectedPurchase.supplier_snapshot?.name || 'Sin proveedor' }}</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-muted">
                    {{ selectedPurchase.supplier?.tax_id || selectedPurchase.supplier_snapshot?.tax_id || 'Sin NIT' }}
                    <span v-if="selectedPurchase.supplier?.nrc || selectedPurchase.supplier_snapshot?.nrc"> · NRC {{ selectedPurchase.supplier?.nrc || selectedPurchase.supplier_snapshot?.nrc }}</span>
                  </p>
                </div>
                <UiStatusBadge :tone="selectedPurchase.status === 'registered' ? 'success' : 'neutral'">{{ selectedPurchase.status || 'Registrada' }}</UiStatusBadge>
              </div>
            </section>

            <section class="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Líneas compradas</h3>
              <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[940px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3">Modo</th>
                    <th class="px-4 py-3 text-right">Cantidad</th>
                    <th class="px-4 py-3 text-right">Costo base</th>
                    <th class="px-4 py-3 text-right">IVA</th>
                    <th class="px-4 py-3 text-right">Total</th>
                    <th class="px-4 py-3">Lotes</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="line in selectedPurchase.lines || []" :key="line.id" class="text-sm">
                    <td class="px-4 py-3">
                      <p class="max-w-[260px] truncate font-semibold text-slate-950 dark:text-text">{{ line.catalog_item?.name || line.description_snapshot || 'Producto' }}</p>
                      <p class="text-xs text-slate-500 dark:text-soft">{{ line.catalog_item?.sku || 'Sin código' }} · Unidad {{ line.unit_name || line.unit_code || '59' }}</p>
                    </td>
                    <td class="px-4 py-3">
                      <UiStatusBadge :tone="line.no_inventory ? 'neutral' : 'success'">{{ line.no_inventory ? 'No inventario' : 'Inventario' }}</UiStatusBadge>
                    </td>
                    <td class="px-4 py-3 text-right">{{ formatQuantity(line.quantity) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(line.base_unit_cost) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(line.tax_amount) }}</td>
                    <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(line.line_total) }}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-1">
                        <UiStatusBadge v-for="lot in line.lots || []" :key="lot.id" tone="neutral">{{ lot.lot_code }}</UiStatusBadge>
                        <span v-if="!line.lots || line.lots.length === 0" class="text-xs text-slate-500 dark:text-soft">Sin lote</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!selectedPurchase.lines || selectedPurchase.lines.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="7">Cargando líneas o sin detalle registrado.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </section>

            <section class="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Kardex asociado</h3>
              <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[760px]">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
                  <tr>
                    <th class="px-4 py-3">Producto</th>
                    <th class="px-4 py-3">Tipo</th>
                    <th class="px-4 py-3">Lote</th>
                    <th class="px-4 py-3 text-right">Cantidad</th>
                    <th class="px-4 py-3 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-line">
                  <tr v-for="movement in selectedPurchaseMovements" :key="movement.id" class="text-sm">
                    <td class="px-4 py-3 font-semibold text-slate-950 dark:text-text">{{ movement.catalog_item?.name || 'Producto' }}</td>
                    <td class="px-4 py-3"><UiStatusBadge :tone="movementTone(movement.movement_type)">{{ movement.movement_type === 'entry' ? 'Entrada' : 'Salida' }}</UiStatusBadge></td>
                    <td class="px-4 py-3">{{ movement.lot?.lot_code || 'Sin lote' }}</td>
                    <td class="px-4 py-3 text-right">{{ formatQuantity(movement.quantity) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(movement.unit_cost) }}</td>
                  </tr>
                  <tr v-if="selectedPurchaseMovements.length === 0">
                    <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin movimientos asociados en la carga actual.</td>
                  </tr>
                </tbody>
              </UiDataTable>
            </section>
          </div>

          <aside class="min-w-0 rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <h3 class="text-base font-bold text-slate-950 dark:text-text">Resumen</h3>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-4">
                <span class="text-slate-600 dark:text-muted">Subtotal</span>
                <strong>{{ formatMoney(selectedPurchase.subtotal) }}</strong>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-slate-600 dark:text-muted">IVA</span>
                <strong>{{ formatMoney(selectedPurchase.tax_amount) }}</strong>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-slate-600 dark:text-muted">IVA percibido</span>
                <strong>{{ formatMoney(selectedPurchase.tax_perceived) }}</strong>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-slate-600 dark:text-muted">No afecto</span>
                <strong>{{ formatMoney(selectedPurchase.other_non_taxable_total) }}</strong>
              </div>
              <div class="border-t border-slate-200 pt-3 dark:border-line">
                <div class="flex justify-between gap-4">
                  <span class="font-bold text-slate-950 dark:text-text">Total</span>
                  <strong>{{ formatMoney(selectedPurchase.total) }}</strong>
                </div>
              </div>
              <div class="border-t border-slate-200 pt-3 dark:border-line">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Sucursal</p>
                <p class="mt-1 font-semibold text-slate-950 dark:text-text">{{ selectedPurchase.core_sucursal_code || selectedPurchase.core_sucursal_name || 'Sin sucursal' }}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </UiModalShell>

    <UiModalShell
      :open="Boolean(selectedLot)"
      :title="selectedLot?.lot_code || 'Lote'"
      :description="selectedLot?.catalog_item?.name || 'Detalle de lote'"
      max-width="max-w-5xl"
      @close="selectedLot = null"
    >
      <div v-if="selectedLot" class="space-y-5">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Estado</p>
            <div class="mt-2">
              <UiStatusBadge :tone="lotStatusTone(selectedLot.lot_status)">{{ lotStatusLabel(selectedLot.lot_status) }}</UiStatusBadge>
            </div>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Inicial</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatQuantity(selectedLot.initial_quantity_number) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Consumido</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatQuantity(selectedLot.consumed_quantity) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Disponible</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatQuantity(selectedLot.available_quantity_number) }}</p>
          </div>
          <div class="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-line dark:bg-surface">
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Valor</p>
            <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ formatMoney(selectedLot.available_value) }}</p>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <h3 class="text-base font-bold text-slate-950 dark:text-text">Origen</h3>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Producto</span>
                <strong class="max-w-[260px] truncate text-slate-950 dark:text-text">{{ selectedLot.catalog_item?.name || 'Producto' }}</strong>
              </div>
              <div class="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Código</span>
                <strong class="text-slate-950 dark:text-text">{{ selectedLot.catalog_item?.sku || 'Sin código' }}</strong>
              </div>
              <div class="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Proveedor</span>
                <strong class="max-w-[260px] truncate text-slate-950 dark:text-text">{{ selectedLot.supplier_name }}</strong>
              </div>
              <div class="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Compra</span>
                <strong class="text-slate-950 dark:text-text">{{ selectedLot.inventory_purchase_id ? `#${selectedLot.inventory_purchase_id}` : 'Sin referencia' }}</strong>
              </div>
              <div class="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Fecha</span>
                <strong class="text-slate-950 dark:text-text">{{ selectedLot.received_date || 'Sin fecha' }}</strong>
              </div>
              <div class="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2 dark:bg-surface-muted">
                <span class="text-slate-600 dark:text-muted">Sucursal</span>
                <strong class="max-w-[260px] truncate text-slate-950 dark:text-text">{{ selectedLot.core_sucursal_code || selectedLot.core_sucursal_name || 'Sin asignar' }}</strong>
              </div>
            </div>
          </section>

          <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <h3 class="text-base font-bold text-slate-950 dark:text-text">Lectura FIFO</h3>
              <UiStatusBadge :tone="selectedLot.fifo_position === 1 ? 'success' : 'neutral'">
                {{ selectedLot.fifo_position === 1 ? 'Próximo en salir' : 'En cola FIFO' }}
              </UiStatusBadge>
            </div>
            <div class="mt-4 rounded-md bg-slate-50 p-4 dark:bg-surface-muted">
              <p class="text-sm font-semibold text-slate-950 dark:text-text">
                <template v-if="selectedLot.fifo_position === 1">
                  Este lote es el primero disponible para este producto en la sucursal filtrada.
                </template>
                <template v-else-if="selectedLot.fifo_position">
                  Hay {{ selectedLot.fifo_pending_before }} lote(s) disponible(s) antes de este según FIFO.
                </template>
                <template v-else>
                  Este lote no participa en salidas FIFO porque está agotado.
                </template>
              </p>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-md border border-slate-200 px-3 py-2 dark:border-line">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Costo unitario</p>
                <p class="mt-1 font-black text-slate-950 dark:text-text">{{ formatMoney(selectedLot.unit_cost) }}</p>
              </div>
              <div class="rounded-md border border-slate-200 px-3 py-2 dark:border-line">
                <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Unidad</p>
                <p class="mt-1 font-black text-slate-950 dark:text-text">{{ selectedLot.catalog_item?.unit_name || selectedLot.catalog_item?.unit_code || 'Unidad' }}</p>
              </div>
            </div>
          </section>
        </div>

        <section class="rounded-md border border-slate-200 bg-white p-4 dark:border-line dark:bg-surface">
          <h3 class="text-base font-bold text-slate-950 dark:text-text">Kardex del lote</h3>
          <UiDataTable class="mt-4" overflow="auto" min-width="min-w-[760px]">
            <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-line dark:text-soft">
              <tr>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Motivo</th>
                <th class="px-4 py-3 text-right">Cantidad</th>
                <th class="px-4 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-line">
              <tr v-for="movement in selectedLotMovements" :key="movement.id" class="text-sm">
                <td class="px-4 py-3">{{ String(movement.created_at || '').slice(0, 10) || 'Sin fecha' }}</td>
                <td class="px-4 py-3"><UiStatusBadge :tone="movementTone(movement.movement_type)">{{ movement.movement_type === 'entry' ? 'Entrada' : 'Salida' }}</UiStatusBadge></td>
                <td class="px-4 py-3">{{ inventoryMovementReasonLabel(movement.reason) }}</td>
                <td class="px-4 py-3 text-right font-semibold">{{ formatQuantity(movement.quantity) }}</td>
                <td class="px-4 py-3">{{ movement.reference_number || movement.reference_id || 'Sin referencia' }}</td>
              </tr>
              <tr v-if="selectedLotMovements.length === 0">
                <td class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted" colspan="5">Sin movimientos asociados al lote.</td>
              </tr>
            </tbody>
          </UiDataTable>
        </section>
      </div>
    </UiModalShell>

    <UiModalShell
      :open="Boolean(activeResolveLine)"
      title="Resolver línea"
      :description="activeResolveLine?.description || ''"
      max-width="max-w-2xl"
      @close="closeLineResolver"
    >
      <div v-if="activeResolveLine" class="space-y-5">
        <div class="rounded-md border border-slate-200 p-4 dark:border-line">
          <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">{{ esCompraManual ? 'Línea de compra' : 'Línea DTE' }}</p>
          <UiInput v-if="esCompraManual" v-model="activeResolveLine.description" class="mt-3" label="Descripción" placeholder="Producto comprado" />
          <p v-else class="mt-1 font-semibold text-slate-950 dark:text-text">{{ activeResolveLine.description }}</p>
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
            <UiCheckbox v-model="activeResolveLine.create_item" label="Crear ítem" />
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
              <UiInput v-model="activeResolveLine.new_item_sku" label="Código/SKU" placeholder="Opcional" />
              <UiInput v-model="activeResolveLine.new_item_base_price" label="Precio de venta" type="number" min="0" step="0.01" />
              <UiSelect v-model="activeResolveLine.category_id" label="Categoría" :options="categoryOptions" />
              <UiInput v-model="activeResolveLine.new_category_name" label="Nueva categoría" placeholder="Opcional" />
              <UiCheckbox v-model="activeResolveLine.controls_inventory" label="Afecta inventario" :disabled="activeResolveLine.no_inventory" />
            </template>

            <UiCheckbox v-model="activeResolveLine.no_inventory" label="No ingresa a inventario" />
          </div>
        </div>

        <div class="flex justify-end">
          <UiButton :disabled="!lineResolved(activeResolveLine)" @click="closeLineResolver">Aplicar</UiButton>
        </div>
      </div>
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
