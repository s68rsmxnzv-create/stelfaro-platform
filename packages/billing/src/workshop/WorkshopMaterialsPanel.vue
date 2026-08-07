<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArchiveRestore, Check, PackagePlus, Search, Undo2, X } from 'lucide-vue-next';
import { PlatformClient, type PlatformCatalogItem, type WorkshopMaterial, type WorkshopOrder } from '@stelfaro/api-client';
import { UiButton, UiInput, UiStatusBadge } from '@stelfaro/ui';

const props = defineProps<{
  tenantId: number;
  platformBaseUrl: string;
  order: WorkshopOrder;
}>();

const client = new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' });
const materials = ref<WorkshopMaterial[]>([]);
const results = ref<PlatformCatalogItem[]>([]);
const query = ref('');
const quantity = ref<number | string>(1);
const loading = ref(false);
const searching = ref(false);
const actionId = ref<number | null>(null);
const error = ref('');
const returnId = ref<number | null>(null);
const returnNotes = ref('');
let searchTimer: number | undefined;

const activeMaterials = computed(() => materials.value.filter((material) => ['reserved', 'confirmed'].includes(material.status)));
const historyMaterials = computed(() => materials.value.filter((material) => ['released', 'reversed'].includes(material.status)));
const canEdit = computed(() => !['delivered', 'cancelled'].includes(props.order.status) && props.order.financial.status !== 'settled');
const internalCost = computed(() => activeMaterials.value.reduce((sum, material) => sum + Number(material.total_cost || 0), 0));
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
const statusLabel: Record<string, string> = { reserved: 'Reservado', confirmed: 'Instalado', released: 'Liberado', reversed: 'Devuelto' };

function message(exception: unknown, fallback: string): string {
  if (exception instanceof Error && exception.message) return exception.message;
  return fallback;
}

async function loadMaterials() {
  loading.value = true;
  error.value = '';
  try {
    materials.value = (await client.workshopMaterials(props.tenantId, props.order.id)).data;
  } catch (exception) {
    error.value = message(exception, 'No fue posible consultar los repuestos de la orden.');
  } finally {
    loading.value = false;
  }
}

async function searchItems() {
  const term = query.value.trim();
  if (term.length < 2 || !props.order.branch?.id) {
    results.value = [];
    return;
  }
  searching.value = true;
  error.value = '';
  try {
    const response = await client.catalogItems(props.tenantId, {
      q: term,
      status: 'active',
      controls_inventory: true,
      core_sucursal_id: props.order.branch.id,
      per_page: 10,
    });
    results.value = response.data;
  } catch (exception) {
    error.value = message(exception, 'No fue posible consultar el inventario.');
  } finally {
    searching.value = false;
  }
}

watch(query, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(searchItems, 250);
});
watch(() => props.order.id, () => {
  query.value = '';
  results.value = [];
  void loadMaterials();
});

async function reserve(item: PlatformCatalogItem) {
  const requested = Number(quantity.value);
  if (!Number.isFinite(requested) || requested <= 0) {
    error.value = 'Indica una cantidad válida.';
    return;
  }
  actionId.value = item.id;
  error.value = '';
  try {
    await client.reserveWorkshopMaterial(props.tenantId, props.order.id, {
      catalog_item_id: item.id,
      quantity: requested,
    });
    query.value = '';
    results.value = [];
    quantity.value = 1;
    await loadMaterials();
  } catch (exception) {
    error.value = message(exception, 'No fue posible reservar el repuesto.');
  } finally {
    actionId.value = null;
  }
}

async function runAction(material: WorkshopMaterial, action: 'consume' | 'release') {
  actionId.value = material.id;
  error.value = '';
  try {
    if (action === 'consume') await client.consumeWorkshopMaterial(props.tenantId, props.order.id, material.id);
    else await client.releaseWorkshopMaterial(props.tenantId, props.order.id, material.id);
    await loadMaterials();
  } catch (exception) {
    error.value = message(exception, 'No fue posible actualizar el repuesto.');
  } finally {
    actionId.value = null;
  }
}

async function returnToStock(material: WorkshopMaterial) {
  if (!returnNotes.value.trim()) {
    error.value = 'Indica por qué se devuelve el repuesto al inventario.';
    return;
  }
  actionId.value = material.id;
  error.value = '';
  try {
    await client.returnWorkshopMaterial(props.tenantId, props.order.id, material.id, returnNotes.value.trim());
    returnId.value = null;
    returnNotes.value = '';
    await loadMaterials();
  } catch (exception) {
    error.value = message(exception, 'No fue posible devolver el repuesto.');
  } finally {
    actionId.value = null;
  }
}

onMounted(loadMaterials);
</script>

<template>
  <section class="mt-5 border-t border-line pt-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <PackagePlus class="h-5 w-5 text-primary" />
          <h3 class="font-semibold text-text">Repuestos del inventario</h3>
        </div>
        <p class="mt-1 text-sm text-muted">Uso interno de la orden. El cliente seguirá viendo un solo trabajo.</p>
      </div>
      <div v-if="activeMaterials.length" class="shrink-0 text-right">
        <p class="text-xs text-muted">Costo interno</p>
        <p class="font-bold text-text">{{ money(internalCost) }}</p>
      </div>
    </div>

    <div v-if="canEdit && order.branch?.id" class="mt-4 rounded-xl border border-line bg-surface-muted p-3">
      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-4 h-4 w-4 text-muted" />
          <UiInput v-model="query" class="[&_input]:pl-10" hide-label label="Buscar repuesto" placeholder="Buscar por nombre o código" autocomplete="off" />
        </div>
        <UiInput v-model="quantity" label="Cantidad" hide-label type="number" min="0.001" step="0.001" />
      </div>
      <p v-if="searching" class="mt-2 text-sm text-muted">Buscando existencias…</p>
      <div v-else-if="results.length" class="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        <div v-for="item in results" :key="item.id" class="flex items-center gap-3 p-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-text">{{ item.name }}</p>
            <p class="mt-0.5 text-xs text-muted">{{ item.sku || 'Sin código' }} · {{ Number(item.branch_stock_quantity || 0) }} disponibles</p>
          </div>
          <UiButton size="sm" :disabled="actionId === item.id || Number(item.branch_stock_quantity || 0) < Number(quantity || 0)" @click="reserve(item)">Reservar</UiButton>
        </div>
      </div>
      <p v-else-if="query.trim().length >= 2" class="mt-2 text-sm text-muted">No hay repuestos con existencia en esta sucursal.</p>
    </div>
    <p v-else-if="canEdit" class="mt-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">Asigna una sucursal a la orden para usar su inventario.</p>

    <div v-if="loading" class="mt-4 text-sm text-muted">Cargando repuestos…</div>
    <div v-else-if="activeMaterials.length" class="mt-4 grid gap-2">
      <article v-for="material in activeMaterials" :key="material.id" class="rounded-xl border border-line bg-surface p-3">
        <div class="flex flex-wrap items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-semibold text-text">{{ material.item?.name || material.description }}</p>
              <UiStatusBadge :tone="material.status === 'confirmed' ? 'success' : 'warning'">{{ statusLabel[material.status] || material.status }}</UiStatusBadge>
            </div>
            <p class="mt-1 text-sm text-muted">{{ material.quantity }} {{ material.item?.unit_name || 'unidad(es)' }} · costo {{ money(material.total_cost) }}</p>
          </div>
          <div v-if="canEdit && material.status === 'reserved'" class="flex gap-2">
            <UiButton size="sm" variant="secondary" :disabled="actionId === material.id" @click="runAction(material, 'release')"><X class="h-4 w-4" />Liberar</UiButton>
            <UiButton size="sm" :disabled="actionId === material.id" @click="runAction(material, 'consume')"><Check class="h-4 w-4" />Instalado</UiButton>
          </div>
          <UiButton v-else-if="canEdit && material.status === 'confirmed' && returnId !== material.id" size="sm" variant="secondary" @click="returnId = material.id"><Undo2 class="h-4 w-4" />Devolver</UiButton>
        </div>
        <div v-if="returnId === material.id" class="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
          <UiInput v-model="returnNotes" class="min-w-0 flex-1" label="Motivo de devolución" hide-label placeholder="Motivo de devolución al inventario" />
          <UiButton size="sm" variant="secondary" @click="returnId = null; returnNotes = ''">Cancelar</UiButton>
          <UiButton size="sm" :disabled="actionId === material.id || !returnNotes.trim()" @click="returnToStock(material)"><ArchiveRestore class="h-4 w-4" />Devolver al stock</UiButton>
        </div>
      </article>
    </div>
    <p v-else-if="!loading" class="mt-4 text-sm text-muted">Todavía no se han asignado repuestos de inventario.</p>

    <details v-if="historyMaterials.length" class="mt-3 text-sm">
      <summary class="cursor-pointer font-medium text-muted">Ver movimientos anteriores ({{ historyMaterials.length }})</summary>
      <div class="mt-2 grid gap-2">
        <div v-for="material in historyMaterials" :key="material.id" class="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-muted">
          <span>{{ material.item?.name || material.description }} · {{ material.quantity }}</span>
          <span>{{ statusLabel[material.status] || material.status }}</span>
        </div>
      </div>
    </details>
    <p v-if="error" class="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{{ error }}</p>
  </section>
</template>
