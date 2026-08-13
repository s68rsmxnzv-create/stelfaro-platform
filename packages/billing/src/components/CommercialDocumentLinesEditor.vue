<script setup lang="ts">
import {
  PlatformClient,
  type PlatformCatalogItem,
  type PlatformWorkLine,
} from "@stelfaro/api-client";
import { UiAutocompleteInput, UiButton, UiInput, UiToggle } from "@stelfaro/ui";
import { computed, onBeforeUnmount, reactive, ref } from "vue";

const props = withDefaults(
  defineProps<{
    tenantId: number;
    platformBaseUrl?: string;
    authToken?: string | null;
    totalLabel?: string;
    showTotal?: boolean;
    showTax?: boolean;
  }>(),
  {
    platformBaseUrl: "/api/v1",
    authToken: null,
    totalLabel: "Total",
    showTotal: true,
    showTax: false,
  },
);

const lines = defineModel<PlatformWorkLine[]>({ required: true });
const client = computed(
  () =>
    new PlatformClient(props.platformBaseUrl, {
      authToken: props.authToken,
      credentials: "include",
    }),
);
const draft = reactive({
  catalog_item_id: null as number | null,
  catalog_name: "",
  description: "",
  quantity: 0,
  unit_price: 0,
  discount_percent: 0,
  price_includes_tax: true,
});
const suggestions = ref<PlatformCatalogItem[]>([]);
const suggestionsOpen = ref(false);
const searching = ref(false);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
let searchVersion = 0;

const draftGross = computed(
  () =>
    Math.max(0, Number(draft.quantity || 0)) *
    Math.max(0, Number(draft.unit_price || 0)),
);
const draftDiscount = computed(() =>
  Math.min(
    draftGross.value,
    draftGross.value *
      (Math.min(100, Math.max(0, Number(draft.discount_percent || 0))) / 100),
  ),
);
const draftNet = computed(() => draftGross.value - draftDiscount.value);
const draftTaxAmount = computed(() =>
  draft.price_includes_tax
    ? draftNet.value - draftNet.value / 1.13
    : draftNet.value * 0.13,
);
const draftLineTotal = computed(() =>
  draft.price_includes_tax
    ? draftNet.value
    : draftNet.value + draftTaxAmount.value,
);
const documentTotal = computed(() =>
  lines.value.reduce((sum, item) => sum + lineTotal(item), 0),
);
const canAdd = computed(
  () =>
    draft.description.trim().length > 0 &&
    Number(draft.quantity) > 0 &&
    Number(draft.unit_price) >= 0,
);

function money(value: number): string {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function updateDescription(value: string): void {
  draft.description = value;
  if (
    draft.catalog_item_id &&
    normalized(value) !== normalized(draft.catalog_name)
  ) {
    draft.catalog_item_id = null;
    draft.catalog_name = "";
  }
  scheduleSearch(value);
}

function scheduleSearch(value: string): void {
  if (searchTimer) window.clearTimeout(searchTimer);
  const query = value.trim();
  if (query.length < 2) {
    suggestions.value = [];
    suggestionsOpen.value = false;
    searching.value = false;
    return;
  }
  const version = ++searchVersion;
  searchTimer = window.setTimeout(
    () => void searchCatalog(query, version),
    220,
  );
}

async function searchCatalog(query: string, version: number): Promise<void> {
  searching.value = true;
  try {
    const response = await client.value.catalogItems(props.tenantId, {
      q: query,
      status: "active",
      per_page: 8,
    });
    if (version !== searchVersion) return;
    suggestions.value = response.data;
    suggestionsOpen.value = true;
  } catch {
    if (version === searchVersion) {
      suggestions.value = [];
      suggestionsOpen.value = true;
    }
  } finally {
    if (version === searchVersion) searching.value = false;
  }
}

function selectCatalogItem(item: PlatformCatalogItem): void {
  draft.catalog_item_id = item.id;
  draft.catalog_name = item.name;
  draft.description = item.name;
  draft.unit_price = Number(item.base_price || 0);
  draft.discount_percent = 0;
  suggestions.value = [];
  suggestionsOpen.value = false;
}

function closeSuggestions(): void {
  window.setTimeout(() => (suggestionsOpen.value = false), 140);
}

function addLine(): void {
  if (!canAdd.value) return;
  lines.value = [
    ...lines.value,
    {
      catalog_item_id: draft.catalog_item_id,
      description: draft.description.trim(),
      quantity: Number(draft.quantity),
      unit_price: Number(draft.unit_price),
      price_includes_tax: draft.price_includes_tax,
      discount_amount: Math.round(draftDiscount.value * 100) / 100,
    },
  ];
  Object.assign(draft, {
    catalog_item_id: null,
    catalog_name: "",
    description: "",
    quantity: 0,
    unit_price: 0,
    discount_percent: 0,
    price_includes_tax: true,
  });
  suggestions.value = [];
  suggestionsOpen.value = false;
}

function removeLine(index: number): void {
  lines.value = lines.value.filter((_, lineIndex) => lineIndex !== index);
}

function lineNet(item: PlatformWorkLine): number {
  return Math.max(
    0,
    Number(item.quantity || 0) * Number(item.unit_price || 0) -
      Number(item.discount_amount || 0),
  );
}

function lineTaxAmount(item: PlatformWorkLine): number {
  const net = lineNet(item);

  return item.price_includes_tax === false ? net * 0.13 : net - net / 1.13;
}

function lineTotal(item: PlatformWorkLine): number {
  const net = lineNet(item);

  return item.price_includes_tax === false ? net + lineTaxAmount(item) : net;
}

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
});
</script>

<template>
  <div class="space-y-3">
    <div>
      <h3 class="font-bold text-text">Detalle</h3>
      <p class="text-sm text-muted">
        Productos, servicios y valores acordados.
      </p>
    </div>

    <div
      class="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-muted/40 p-3"
    >
      <div class="min-w-[220px] flex-1">
        <UiAutocompleteInput
          :model-value="draft.description"
          :options="suggestions"
          :open="suggestionsOpen"
          :loading="searching"
          inline-empty
          :show-suffix="false"
          label="Descripción"
          placeholder="Buscar catálogo o escribir descripción libre"
          empty-text="Sin resultados. Se agregará como descripción libre."
          @blur="closeSuggestions"
          @focus="scheduleSearch(draft.description)"
          @select="selectCatalogItem"
          @update:model-value="updateDescription"
        >
          <template #option="{ option: item }">
            <span class="block font-semibold text-text">{{ item.name }}</span>
            <span class="mt-0.5 block text-xs text-muted">
              {{ item.sku || "Sin código" }} · {{ money(item.base_price) }}
            </span>
          </template>
        </UiAutocompleteInput>
      </div>
      <UiInput
        class="w-24"
        v-model.number="draft.quantity"
        label="Cantidad"
        placeholder="Cant. 1"
        min="0.01"
        step="0.01"
        type="number"
      />
      <UiInput
        class="w-28"
        v-model.number="draft.unit_price"
        label="Precio"
        min="0"
        step="0.01"
        type="number"
      />
      <UiInput
        class="w-24"
        v-model.number="draft.discount_percent"
        label="Desc. %"
        min="0"
        max="100"
        step="0.01"
        type="number"
      />
      <div v-if="showTax" class="flex shrink-0 flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-muted"
          >Incluye IVA</span
        >
        <UiToggle
          v-model="draft.price_includes_tax"
          aria-label="El precio digitado incluye IVA"
        />
      </div>
      <div class="w-28 shrink-0">
        <p class="text-xs font-semibold uppercase text-muted">Neto</p>
        <p class="mt-1 font-bold text-text">{{ money(draftLineTotal) }}</p>
      </div>
      <UiButton class="shrink-0" :disabled="!canAdd" @click="addLine">
        Agregar
      </UiButton>
    </div>

    <div
      v-if="lines.length"
      class="overflow-hidden rounded-lg border border-line"
    >
      <div
        v-for="(item, index) in lines"
        :key="`${item.id || 'new'}-${index}`"
        class="border-b border-line p-3 last:border-b-0"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="break-words font-semibold text-text">
              {{ item.description }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ Number(item.quantity) }} × {{ money(Number(item.unit_price)) }}
              <template v-if="Number(item.discount_amount || 0) > 0">
                · Descuento {{ money(Number(item.discount_amount)) }}
              </template>
              <template v-if="showTax">
                ·
                {{
                  item.price_includes_tax === false
                    ? `+ IVA ${money(lineTaxAmount(item))}`
                    : "IVA incluido"
                }}
              </template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <strong class="text-text">{{ money(lineTotal(item)) }}</strong>
            <UiButton variant="ghost" size="sm" @click="removeLine(index)">
              Quitar
            </UiButton>
          </div>
        </div>
      </div>
    </div>
    <p
      v-else
      class="rounded-lg bg-surface-muted px-3 py-3 text-center text-xs text-muted"
    >
      Agrega el primer producto o servicio.
    </p>

    <div
      v-if="showTotal"
      class="flex items-center justify-between rounded-lg bg-surface-muted p-3"
    >
      <span class="text-sm text-muted">{{ totalLabel }}</span>
      <strong class="text-xl text-text">{{ money(documentTotal) }}</strong>
    </div>
  </div>
</template>
