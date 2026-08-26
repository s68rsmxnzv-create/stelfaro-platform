<script setup lang="ts">
import {
  CoreDteClient,
  PlatformClient,
  type BillingCatalogs,
  type BillingCustomer,
  type BillingEmpresa,
  type PlatformWorkLine,
} from "@stelfaro/api-client";
import { UiCard, UiInput, UiSelect, UiTextarea } from "@stelfaro/ui";
import { ArrowLeft, FileText, Plus, ShieldCheck } from "lucide-vue-next";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import BillingFloatingToastStack from "../components/BillingFloatingToastStack.vue";
import BillingCustomerModal, {
  type BillingCustomerModalPayload,
} from "../components/BillingCustomerModal.vue";
import BillingQuoteSummaryBar from "../components/BillingQuoteSummaryBar.vue";
import CommercialDocumentLinesEditor from "../components/CommercialDocumentLinesEditor.vue";

const props = withDefaults(
  defineProps<{
    platformBaseUrl?: string;
    coreBaseUrl?: string;
    authToken?: string | null;
    tenantId: number;
    appBaseUrl?: string;
    company?: BillingEmpresa | null;
    quotationId?: number | null;
  }>(),
  {
    platformBaseUrl: "/api/v1",
    coreBaseUrl: "/core-api/v1",
    authToken: null,
    appBaseUrl: "/facturacion",
    company: null,
    quotationId: null,
  },
);

const client = computed(
  () =>
    new PlatformClient(props.platformBaseUrl, {
      authToken: props.authToken,
      credentials: "include",
    }),
);
const core = computed(
  () => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }),
);

const backUrl = computed(
  () => `${props.appBaseUrl.replace(/\/$/, "")}/ordenes-trabajo?tab=quotes`,
);
const isEditing = computed(() => Boolean(props.quotationId));
const quoteNumber = ref("");
const loadingQuote = ref(Boolean(props.quotationId));
const loadError = ref("");
const saving = ref(false);
const toasts = ref<any[]>([]);
const catalogs = ref<BillingCatalogs | null>(null);
const customerDepartamento = ref("");
const customerMunicipio = ref("");
const customerResults = ref<BillingCustomer[]>([]);
const customerSearch = ref("");
const customerSearchLoading = ref(false);
const customerSearchError = ref("");
const customerCreateOpen = ref(false);
const customerCreateLoading = ref(false);
let customerSearchTimer: ReturnType<typeof window.setTimeout> | null = null;
let customerSearchVersion = 0;

const branchOptions = computed(() =>
  (props.company?.sucursales || []).map((branch) => ({
    value: branch.id,
    label: `${branch.codigo} · ${branch.nombre}`,
  })),
);
const defaultBranchId = computed(() =>
  Number(props.company?.sucursales?.[0]?.id || 0),
);
const departamentoOptions = computed(() =>
  (catalogs.value?.departamentos || []).map((item) => ({
    value: item.code,
    label: item.label,
    hint: item.code,
  })),
);
const municipioOptions = computed(() =>
  (catalogs.value?.municipios || [])
    .filter(
      (item) =>
        String(item.departamento).replace(/\D+/g, "").padStart(2, "0") ===
        customerDepartamento.value.replace(/\D+/g, "").padStart(2, "0"),
    )
    .map((item) => ({ value: item.code, label: item.label, hint: item.code })),
);
const distritoOptions = computed(() =>
  (catalogs.value?.distritos || [])
    .filter(
      (item) =>
        String(item.departamento).replace(/\D+/g, "").padStart(2, "0") ===
          customerDepartamento.value.replace(/\D+/g, "").padStart(2, "0") &&
        String(item.municipio) === customerMunicipio.value,
    )
    .map((item) => ({
      value: item.code,
      label: item.label.replace(/^Distrito\s+/i, ""),
      hint: item.code,
    })),
);
const actividadOptions = computed(() =>
  (catalogs.value?.actividadesEconomicas || []).map((item) => ({
    value: item.code,
    label: item.label,
    hint: item.code,
  })),
);

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const form = reactive({
  title: "",
  customer_id: null as number | null,
  customer_name: "",
  customer_phone: "",
  branch_id: 0,
  valid_until: addDays(15),
  requested_deposit: 0,
  terms: "",
  notes: "",
  lines: [] as PlatformWorkLine[],
});

const validityOptions = [
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
  { value: "60", label: "60 días" },
  { value: "indefinite", label: "Indefinida" },
];
const validityOption = ref<"15" | "30" | "60" | "indefinite">("15");
let suppressValidityWatch = false;
function inferValidityOption(
  validUntil: string,
): "15" | "30" | "60" | "indefinite" {
  if (!validUntil) return "indefinite";
  const days = Math.round(
    (new Date(`${validUntil}T00:00:00`).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24),
  );
  if (days <= 20) return "15";
  if (days <= 45) return "30";
  return "60";
}
watch(validityOption, (value) => {
  if (suppressValidityWatch) return;
  form.valid_until = value === "indefinite" ? "" : addDays(Number(value));
});
const validityHint = computed(() =>
  form.valid_until
    ? `Vence el ${new Date(`${form.valid_until}T00:00:00`).toLocaleDateString("es-SV")}`
    : "Sin fecha límite",
);

function lineNet(item: PlatformWorkLine): number {
  return Math.max(
    0,
    item.quantity * item.unit_price - Number(item.discount_amount || 0),
  );
}
function lineTax(item: PlatformWorkLine): number {
  const net = lineNet(item);

  return item.price_includes_tax === false ? net * 0.13 : net - net / 1.13;
}
function lineChargedTotal(item: PlatformWorkLine): number {
  const net = lineNet(item);

  return item.price_includes_tax === false ? net + lineTax(item) : net;
}
const total = computed(() =>
  form.lines.reduce((sum, item) => sum + lineChargedTotal(item), 0),
);
const taxTotal = computed(() =>
  form.lines.reduce((sum, item) => sum + lineTax(item), 0),
);
const depositInvalid = computed(
  () => Number(form.requested_deposit || 0) > total.value,
);
const canSave = computed(
  () =>
    !saving.value &&
    !loadingQuote.value &&
    Boolean(form.title) &&
    Boolean(form.customer_name) &&
    total.value > 0 &&
    !depositInvalid.value,
);

function notify(title: string, message = "", variant = "success") {
  const id = `${Date.now()}-${Math.random()}`;
  toasts.value.push({ id, title, message, variant });
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }, 4300);
}
function errorMessage(error: any) {
  return error?.message || "Revisa los datos e intenta nuevamente.";
}
function branchPayload(id: number) {
  const branch = props.company?.sucursales?.find(
    (item) => Number(item.id) === Number(id),
  );
  return {
    core_sucursal_id: branch?.id || null,
    core_sucursal_code: branch?.codigo || null,
    core_sucursal_name: branch?.nombre || null,
  };
}

async function loadQuotation() {
  if (!props.quotationId) {
    form.branch_id = defaultBranchId.value;
    return;
  }
  loadingQuote.value = true;
  loadError.value = "";
  try {
    const response = await client.value.quotations(props.tenantId);
    const quote = response.data.find((item) => item.id === props.quotationId);
    if (!quote) throw new Error("No encontramos esta cotización.");
    quoteNumber.value = quote.number;
    customerSearch.value = quote.customer.name;
    Object.assign(form, {
      title: quote.title,
      customer_id: quote.customer.id || null,
      customer_name: quote.customer.name,
      customer_phone: quote.customer.phone || "",
      branch_id: Number(quote.branch?.id || defaultBranchId.value),
      valid_until: quote.valid_until || "",
      requested_deposit: quote.requested_deposit,
      terms: quote.terms || "",
      notes: quote.notes || "",
      lines: quote.lines.map((item) => ({
        catalog_item_id: item.catalog_item_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        price_includes_tax: item.price_includes_tax ?? true,
        discount_amount: item.discount_amount || 0,
      })),
    });
    suppressValidityWatch = true;
    validityOption.value = inferValidityOption(form.valid_until);
    suppressValidityWatch = false;
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loadingQuote.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const payload = {
      idempotency_key: isEditing.value ? undefined : crypto.randomUUID(),
      title: form.title,
      customer: {
        id: form.customer_id,
        name: form.customer_name,
        phone: form.customer_phone || null,
      },
      ...branchPayload(form.branch_id),
      valid_until: form.valid_until || null,
      requested_deposit: form.requested_deposit,
      terms: form.terms || null,
      notes: form.notes || null,
      lines: form.lines,
    };
    if (isEditing.value && props.quotationId)
      await client.value.updateQuotation(
        props.tenantId,
        props.quotationId,
        payload,
      );
    else await client.value.createQuotation(props.tenantId, payload);
    window.location.href = `${backUrl.value}&saved=1`;
  } catch (error) {
    notify("No se pudo guardar", errorMessage(error), "error");
    saving.value = false;
  }
}

async function searchCustomers() {
  const query = customerSearch.value.trim();
  const version = ++customerSearchVersion;
  if (
    !props.company?.id ||
    query.length < 2 ||
    (form.customer_id && query === form.customer_name)
  ) {
    customerResults.value = [];
    customerSearchLoading.value = false;
    customerSearchError.value = "";
    return;
  }
  customerSearchLoading.value = true;
  customerSearchError.value = "";
  try {
    const results = (
      await core.value.customers({
        empresa_id: Number(props.company.id),
        q: query,
        per_page: 10,
      })
    ).data;
    if (version === customerSearchVersion) customerResults.value = results;
  } catch (error) {
    if (version === customerSearchVersion) {
      customerResults.value = [];
      customerSearchError.value = errorMessage(error);
    }
  } finally {
    if (version === customerSearchVersion) customerSearchLoading.value = false;
  }
}
function selectCustomer(customer: BillingCustomer) {
  form.customer_id = customer.id;
  form.customer_name = customer.name;
  form.customer_phone = customer.phone || "";
  customerSearch.value = customer.name;
  customerResults.value = [];
}
function checkCustomerDocument(
  documentType: string,
  documentNumber: string,
): Promise<BillingCustomer | null> {
  if (!props.company?.id) return Promise.resolve(null);
  return core.value
    .checkCustomerDocument({
      empresa_id: Number(props.company.id),
      document_type: documentType || undefined,
      document_number: documentNumber,
    })
    .then((response) => response.customer);
}

function useExistingCustomer(customer: BillingCustomer): void {
  selectCustomer(customer);
  customerCreateOpen.value = false;
  notify("Cliente existente seleccionado", `Se usó ${customer.name} para esta cotización.`);
}
async function createCustomer(payload: BillingCustomerModalPayload) {
  if (!props.company?.id) return;
  customerCreateLoading.value = true;
  try {
    const response = await core.value.saveCustomer({
      empresa_id: Number(props.company.id),
      ...payload,
      allowed_dte_codes: payload.allowed_dte_codes?.length
        ? payload.allowed_dte_codes
        : ["01"],
    });
    selectCustomer(response.customer);
    customerCreateOpen.value = false;
    notify("Cliente creado", "Quedó seleccionado para esta cotización.");
  } catch (error) {
    notify("No se pudo crear el cliente", errorMessage(error), "error");
  } finally {
    customerCreateLoading.value = false;
  }
}

function onCustomerSearchInput(value: string) {
  customerSearch.value = value;
  if (form.customer_id && value.trim() !== form.customer_name)
    form.customer_id = null;
  if (customerSearchTimer) window.clearTimeout(customerSearchTimer);
  customerSearchTimer = window.setTimeout(searchCustomers, 250);
}

onMounted(() => {
  void loadQuotation();
  core.value
    .billingCatalogs()
    .then((value) => {
      catalogs.value = value;
    })
    .catch(() => {
      catalogs.value = null;
    });
});
onBeforeUnmount(() => {
  if (customerSearchTimer) window.clearTimeout(customerSearchTimer);
});
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5 pb-28">
    <BillingFloatingToastStack :toasts="toasts" />

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <a
          :href="backUrl"
          class="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-surface-muted hover:text-text"
          aria-label="Volver a cotizaciones"
        >
          <ArrowLeft class="h-4 w-4" />
        </a>
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-primary">
            Propuesta comercial
          </p>
          <h1 class="mt-1 flex items-center gap-2 text-2xl font-bold text-text">
            <FileText class="h-6 w-6 text-primary" />
            {{ isEditing ? "Editar cotización" : "Nueva cotización" }}
            <span v-if="quoteNumber" class="text-lg font-semibold text-muted"
              >· {{ quoteNumber }}</span
            >
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-muted">
            Es una propuesta comercial: no mueve caja, no registra venta y no
            crea cuenta por cobrar.
          </p>
        </div>
      </div>
    </div>

    <p
      v-if="loadError"
      class="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {{ loadError }}
    </p>

    <div v-else class="space-y-5">
      <UiCard class="space-y-4 p-5 sm:p-6">
        <div class="flex items-center gap-2 border-b border-line pb-3">
          <ShieldCheck class="h-5 w-5 text-primary" />
          <h2 class="font-semibold text-text">Datos de la cotización</h2>
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="space-y-4">
            <UiInput
              v-model="form.title"
              label="Proyecto o trabajo"
              placeholder="Ej. Fabricación de ventana francesa"
            />
            <div>
              <div class="mb-1 flex items-center justify-between gap-3">
                <span class="text-sm font-semibold text-text">Cliente</span>
                <button
                  type="button"
                  class="text-sm font-bold text-primary hover:text-primary-hover"
                  @click="customerCreateOpen = true"
                >
                  <Plus class="inline h-4 w-4" /> Nuevo cliente
                </button>
              </div>
              <div class="relative">
                <UiInput
                  :model-value="customerSearch"
                  placeholder="Buscar por nombre, documento o teléfono"
                  @update:model-value="onCustomerSearchInput"
                />
                <div
                  v-if="
                    customerSearchLoading ||
                    customerResults.length ||
                    customerSearchError
                  "
                  class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl"
                >
                  <p
                    v-if="customerSearchLoading"
                    class="px-3 py-2 text-sm text-muted"
                  >
                    Buscando clientes…
                  </p>
                  <button
                    v-for="customer in customerResults"
                    :key="customer.id"
                    type="button"
                    class="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted"
                    @click="selectCustomer(customer)"
                  >
                    <strong class="block">{{ customer.name }}</strong>
                    <span class="text-xs text-muted">{{
                      customer.document_number ||
                      customer.phone ||
                      "Cliente registrado"
                    }}</span>
                  </button>
                  <p
                    v-if="customerSearchError"
                    class="px-3 py-2 text-sm text-danger"
                  >
                    {{ customerSearchError }}
                  </p>
                </div>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <UiInput
                v-model="form.customer_name"
                label="Nombre en la cotización"
                :disabled="Boolean(form.customer_id)"
              />
              <UiInput
                v-model="form.customer_phone"
                label="Teléfono opcional"
              />
            </div>
          </div>
          <div class="space-y-4">
            <UiSelect
              v-if="branchOptions.length"
              v-model.number="form.branch_id"
              label="Sucursal"
              :options="branchOptions"
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <UiSelect
                  v-model="validityOption"
                  label="Vigencia"
                  :options="validityOptions"
                />
                <p class="mt-1 text-xs text-muted">
                  {{ validityHint }}
                </p>
              </div>
              <UiInput
                v-model.number="form.requested_deposit"
                type="number"
                label="Anticipo sugerido"
              />
            </div>
            <p class="rounded-lg bg-primary-soft px-3 py-2 text-xs text-muted">
              El anticipo sugerido es únicamente informativo. Solo se
              registra dinero si la cotización se convierte en orden y se
              confirma un pago.
            </p>
            <p v-if="depositInvalid" class="text-sm text-danger">
              El anticipo sugerido no puede superar el total cotizado.
            </p>
          </div>
        </div>
      </UiCard>

      <UiCard class="space-y-4 p-5 sm:p-6">
        <div class="flex items-center gap-2 border-b border-line pb-3">
          <FileText class="h-5 w-5 text-primary" />
          <h2 class="font-semibold text-text">Líneas de la cotización</h2>
        </div>
        <CommercialDocumentLinesEditor
          v-model="form.lines"
          :tenant-id="tenantId"
          :platform-base-url="platformBaseUrl"
          :auth-token="authToken"
          :show-total="false"
          :show-tax="true"
        />
      </UiCard>

      <UiCard class="space-y-4 p-5 sm:p-6">
        <div class="flex items-center gap-2 border-b border-line pb-3">
          <ShieldCheck class="h-5 w-5 text-primary" />
          <h2 class="font-semibold text-text">Condiciones y notas</h2>
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <UiTextarea
            v-model="form.terms"
            label="Condiciones"
            placeholder="Vigencia, forma de pago, garantía, tiempos de entrega…"
            :rows="5"
          />
          <UiTextarea
            v-model="form.notes"
            label="Notas internas"
            placeholder="Solo visibles para tu equipo, no se imprimen en la cotización."
            :rows="5"
          />
        </div>
      </UiCard>
    </div>

    <BillingQuoteSummaryBar
      v-if="!loadError"
      :line-count="form.lines.length"
      :total="total"
      :tax-total="taxTotal"
      :deposit-amount="form.requested_deposit"
      :save-disabled="!canSave"
      :saving="saving"
      :is-editing="isEditing"
      :cancel-href="backUrl"
      @save="save"
    />

    <BillingCustomerModal
      :open="customerCreateOpen"
      mode="new"
      :loading="customerCreateLoading"
      :allow-optional-address="Boolean(catalogs)"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      :on-check-document="checkCustomerDocument"
      @close="customerCreateOpen = false"
      @save="createCustomer"
      @use-existing="useExistingCustomer"
      @update:departamento="customerDepartamento = $event"
      @update:municipio="customerMunicipio = $event"
    />
  </div>
</template>
