<script setup lang="ts">
import {
  CoreDteClient,
  PlatformClient,
  type BillingCustomer,
  type BillingCatalogs,
  type BillingEmpresa,
  type PlatformQuotation,
  type PlatformReceivable,
  type PlatformSalesOrder,
  type PlatformWorkLine,
} from "@stelfaro/api-client";
import {
  UiActionDropdown,
  UiActionMenuItem,
  UiButton,
  UiCard,
  UiInput,
  UiModalShell,
  UiSelect,
  UiStatusBadge,
  UiTextarea,
} from "@stelfaro/ui";
import {
  ArrowRightCircle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  MessageCircle,
  PackageCheck,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  Truck,
  XCircle,
} from "lucide-vue-next";
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
import CommercialDocumentLinesEditor from "../components/CommercialDocumentLinesEditor.vue";

const props = withDefaults(
  defineProps<{
    platformBaseUrl?: string;
    coreBaseUrl?: string;
    authToken?: string | null;
    tenantId: number;
    appBaseUrl?: string;
    company?: BillingEmpresa | null;
  }>(),
  {
    platformBaseUrl: "/api/v1",
    coreBaseUrl: "/core-api/v1",
    authToken: null,
    appBaseUrl: "/facturacion",
    company: null,
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
const tab = ref<"orders" | "quotes" | "receivables">("orders");
const orders = ref<PlatformSalesOrder[]>([]);
const quotations = ref<PlatformQuotation[]>([]);
const receivables = ref<PlatformReceivable[]>([]);
const receivableTotal = ref(0);
const receivableOverdue = ref(0);
const receivableAging = ref<"" | "current" | "overdue" | "30" | "60" | "90">(
  "",
);
const loading = ref(false);
const modal = ref<
  | "order"
  | "payment"
  | "receivable-payment"
  | "cancel"
  | "convert"
  | "approval"
  | "detail"
  | null
>(null);
const selectedOrder = ref<PlatformSalesOrder | null>(null);
const selectedReceivable = ref<PlatformReceivable | null>(null);
const selectedQuotation = ref<PlatformQuotation | null>(null);
const editingOrderId = ref<number | null>(null);
const customerResults = ref<BillingCustomer[]>([]);
const customerSearch = ref("");
const customerSearchLoading = ref(false);
const customerSearchError = ref("");
const customerCreateOpen = ref(false);
const customerCreateLoading = ref(false);
const catalogs = ref<BillingCatalogs | null>(null);
const customerDepartamento = ref("");
const customerMunicipio = ref("");
let customerSearchTimer: ReturnType<typeof window.setTimeout> | null = null;
let customerSearchVersion = 0;
const approvalForm = reactive({ method: "whatsapp", note: "" });
const toasts = ref<any[]>([]);
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
const orderForm = reactive({
  title: "",
  customer_id: null as number | null,
  customer_name: "",
  customer_phone: "",
  notes: "",
  due_at: "",
  branch_id: 0,
  deposit_amount: 0,
  deposit_method: "cash",
  lines: [] as PlatformWorkLine[],
});
const paymentForm = reactive({ amount: 0, method: "cash", reference: "" });
const cancelForm = reactive({
  reason: "",
  retained_amount: 0,
  method: "cash",
  reference: "",
});
const methods = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "other", label: "Otro" },
];
const money = (value: number) =>
  new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(
    value || 0,
  );
const orderTotal = computed(() =>
  orderForm.lines.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        item.quantity * item.unit_price - Number(item.discount_amount || 0),
      ),
    0,
  ),
);
const orderBalancePreview = computed(() =>
  Math.max(0, orderTotal.value - Number(orderForm.deposit_amount || 0)),
);
const orderDepositInvalid = computed(
  () => Number(orderForm.deposit_amount || 0) > orderTotal.value,
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
async function load() {
  loading.value = true;
  try {
    const [orderResponse, quoteResponse, receivableResponse] =
      await Promise.all([
        client.value.salesOrders(props.tenantId, { per_page: 100 }),
        client.value.quotations(props.tenantId),
        client.value.receivables(props.tenantId, {
          aging: receivableAging.value || undefined,
        }),
      ]);
    orders.value = orderResponse.data;
    quotations.value = quoteResponse.data;
    receivables.value = receivableResponse.data;
    receivableTotal.value = receivableResponse.summary.open;
    receivableOverdue.value = receivableResponse.summary.overdue;
  } catch (error) {
    notify("No pudimos cargar la operación", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
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
function resetOrder() {
  editingOrderId.value = null;
  customerSearch.value = "";
  customerResults.value = [];
  Object.assign(orderForm, {
    title: "",
    customer_id: null,
    customer_name: "",
    customer_phone: "",
    notes: "",
    due_at: "",
    branch_id: defaultBranchId.value,
    deposit_amount: 0,
    deposit_method: "cash",
    lines: [],
  });
  modal.value = "order";
}
function editOrder(order: PlatformSalesOrder) {
  editingOrderId.value = order.id;
  customerSearch.value = order.customer.name;
  customerResults.value = [];
  Object.assign(orderForm, {
    title: order.title,
    customer_id: order.customer.id || null,
    customer_name: order.customer.name,
    customer_phone: order.customer.phone || "",
    notes: order.notes || "",
    due_at: order.due_at?.slice(0, 10) || "",
    branch_id: Number(order.branch?.id || defaultBranchId.value),
    deposit_amount: 0,
    lines: order.lines.map((item) => ({
      catalog_item_id: item.catalog_item_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount || 0,
    })),
  });
  modal.value = "order";
}
async function createOrder() {
  loading.value = true;
  try {
    const payload = {
      idempotency_key: editingOrderId.value ? undefined : crypto.randomUUID(),
      title: orderForm.title,
      customer: {
        id: orderForm.customer_id,
        name: orderForm.customer_name,
        phone: orderForm.customer_phone || null,
      },
      due_at: orderForm.due_at || null,
      ...branchPayload(orderForm.branch_id),
      notes: orderForm.notes || null,
      lines: orderForm.lines,
      deposit:
        !editingOrderId.value && orderForm.deposit_amount > 0
          ? {
              amount: orderForm.deposit_amount,
              method: orderForm.deposit_method,
            }
          : undefined,
    };
    if (editingOrderId.value)
      await client.value.updateSalesOrder(
        props.tenantId,
        editingOrderId.value,
        payload,
      );
    else await client.value.createSalesOrder(props.tenantId, payload);
    modal.value = null;
    notify(
      editingOrderId.value ? "Orden actualizada" : "Orden creada",
      "La operación y su cuenta por cobrar quedaron sincronizadas.",
    );
    await load();
  } catch (error) {
    notify("No se pudo guardar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
async function setOrderStatus(order: PlatformSalesOrder, status: string) {
  loading.value = true;
  try {
    await client.value.updateSalesOrder(props.tenantId, order.id, {
      status,
      transition_note: `Cambio realizado desde la aplicación.`,
    });
    notify("Orden actualizada");
    await load();
  } catch (error) {
    notify("No se pudo actualizar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
function openPayment(order: PlatformSalesOrder) {
  selectedOrder.value = order;
  Object.assign(paymentForm, {
    amount: order.balance,
    method: "cash",
    reference: "",
  });
  modal.value = "payment";
}
async function savePayment() {
  if (!selectedOrder.value) return;
  loading.value = true;
  try {
    await client.value.paySalesOrder(props.tenantId, selectedOrder.value.id, {
      ...paymentForm,
      idempotency_key: crypto.randomUUID(),
    });
    modal.value = null;
    notify("Pago registrado", "Caja y cuenta por cobrar fueron actualizadas.");
    await load();
  } catch (error) {
    notify("No se pudo cobrar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
function openReceivablePayment(account: PlatformReceivable) {
  selectedReceivable.value = account;
  selectedOrder.value = null;
  Object.assign(paymentForm, {
    amount: account.balance,
    method: "cash",
    reference: "",
  });
  modal.value = "receivable-payment";
}
async function saveReceivablePayment() {
  if (!selectedReceivable.value) return;
  loading.value = true;
  try {
    const account = selectedReceivable.value;
    const payload = {
      amount: paymentForm.amount,
      method: paymentForm.method as "cash" | "card" | "transfer" | "other",
      reference: paymentForm.reference || null,
    };
    if (account.source_type === "workshop_order")
      await client.value.recordWorkshopOrderPayment(
        props.tenantId,
        account.collection_id,
        payload,
      );
    else if (account.source_type === "sales_order")
      await client.value.paySalesOrder(props.tenantId, account.collection_id, {
        ...payload,
        idempotency_key: crypto.randomUUID(),
      });
    else if (account.source_type === "dte")
      await client.value.recordCommercialSalePayment(
        props.tenantId,
        account.collection_id,
        {
          ...payload,
          idempotency_key:
            crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        },
      );
    else throw new Error("Este origen todavía no admite cobros.");
    modal.value = null;
    selectedReceivable.value = null;
    notify("Pago registrado", "Caja y cuenta por cobrar fueron actualizadas.");
    await load();
  } catch (error) {
    notify("No se pudo cobrar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
function openCancel(order: PlatformSalesOrder) {
  selectedOrder.value = order;
  Object.assign(cancelForm, {
    reason: "",
    retained_amount: 0,
    method: "cash",
    reference: "",
  });
  modal.value = "cancel";
}
async function cancelOrder() {
  if (!selectedOrder.value) return;
  loading.value = true;
  try {
    await client.value.cancelSalesOrder(
      props.tenantId,
      selectedOrder.value.id,
      cancelForm,
    );
    modal.value = null;
    notify(
      "Orden cancelada",
      "El saldo fue anulado y la devolución quedó registrada.",
    );
    await load();
  } catch (error) {
    notify("No se pudo cancelar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
async function setQuoteStatus(quote: PlatformQuotation, status: string) {
  loading.value = true;
  try {
    await client.value.updateQuotationStatus(props.tenantId, quote.id, status);
    await load();
  } catch (error) {
    notify("No se pudo actualizar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
function openApproval(quote: PlatformQuotation) {
  selectedQuotation.value = quote;
  Object.assign(approvalForm, { method: "whatsapp", note: "" });
  modal.value = "approval";
}
async function approveQuote() {
  if (!selectedQuotation.value) return;
  loading.value = true;
  try {
    await client.value.updateQuotationStatus(
      props.tenantId,
      selectedQuotation.value.id,
      "accepted",
      approvalForm,
    );
    modal.value = null;
    await load();
  } catch (error) {
    notify("No se pudo aprobar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
async function duplicateQuote(quote: PlatformQuotation) {
  loading.value = true;
  try {
    await client.value.duplicateQuotation(props.tenantId, quote.id);
    notify("Cotización duplicada", "Se creó una nueva versión en borrador.");
    await load();
  } catch (error) {
    notify("No se pudo duplicar", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
function shareQuote(quote: PlatformQuotation) {
  if (!quote.public_url) return;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(`Cotización ${quote.number}: ${quote.public_url}`)}`,
    "_blank",
    "noopener",
  );
}
async function searchCustomers() {
  const query = customerSearch.value.trim();
  const version = ++customerSearchVersion;
  if (
    !props.company?.id ||
    query.length < 2 ||
    (orderForm.customer_id && query === orderForm.customer_name)
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
  orderForm.customer_id = customer.id;
  orderForm.customer_name = customer.name;
  orderForm.customer_phone = customer.phone || "";
  customerSearch.value = customer.name;
  customerResults.value = [];
}
function openCustomerCreate() {
  customerCreateOpen.value = true;
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
    notify("Cliente creado", "Quedó seleccionado para esta orden.");
  } catch (error) {
    notify("No se pudo crear el cliente", errorMessage(error), "error");
  } finally {
    customerCreateLoading.value = false;
  }
}
watch(customerSearch, (value) => {
  if (orderForm.customer_id && value.trim() !== orderForm.customer_name)
    orderForm.customer_id = null;
  if (customerSearchTimer) window.clearTimeout(customerSearchTimer);
  customerSearchTimer = window.setTimeout(searchCustomers, 250);
});
function openConvert(quote: PlatformQuotation) {
  selectedQuotation.value = quote;
  Object.assign(paymentForm, {
    amount: quote.requested_deposit,
    method: "cash",
    reference: "",
  });
  modal.value = "convert";
}
async function convertQuote() {
  if (!selectedQuotation.value) return;
  loading.value = true;
  try {
    const response = await client.value.convertQuotation(
      props.tenantId,
      selectedQuotation.value.id,
      {
        deposit:
          paymentForm.amount > 0
            ? {
                amount: paymentForm.amount,
                method: paymentForm.method,
                reference: paymentForm.reference || null,
              }
            : undefined,
      },
    );
    modal.value = null;
    tab.value = "orders";
    notify("Orden creada", response.data.order_number);
    await load();
  } catch (error) {
    notify("No se pudo convertir", errorMessage(error), "error");
  } finally {
    loading.value = false;
  }
}
function navigateTo(url: string, newTab = false) {
  if (!url) return;
  if (newTab) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}
function invoiceHref(order: PlatformSalesOrder) {
  const base = props.appBaseUrl.replace(/\/$/, "");
  const billingBase = base.endsWith("/taller") ? `${base}/facturacion` : base;
  return `${billingBase}/fe?sales_order=${order.id}`;
}
function tone(status: string) {
  if (["settled", "accepted", "converted", "delivered"].includes(status))
    return "success";
  if (["cancelled", "rejected"].includes(status)) return "danger";
  if (["partial", "sent", "ready"].includes(status)) return "warning";
  return "info";
}
const statusLabels: Record<string, string> = {
  open: "Abierta",
  approved: "Aprobada",
  in_progress: "En proceso",
  ready: "Lista",
  delivered: "Entregada",
  cancelled: "Cancelada",
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
  converted: "Convertida",
  partial: "Parcial",
  settled: "Saldada",
  pending: "Pendiente",
};
function statusLabel(status: string): string {
  return statusLabels[status] || status;
}
onMounted(() => {
  if (new URLSearchParams(window.location.search).get("tab") === "receivables")
    tab.value = "receivables";
  void load();
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
  <div class="space-y-4">
    <BillingFloatingToastStack :toasts="toasts" />
    <section class="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-primary">
            Operación comercial
          </p>
          <h2 class="mt-1 text-xl font-bold text-text">Trabajos por encargo</h2>
          <p class="mt-1 text-sm text-muted">
            Cotiza, recibe anticipos y controla lo pendiente sin duplicar la
            venta.
          </p>
        </div>
        <UiButton
          variant="ghost"
          :disabled="loading"
          aria-label="Actualizar"
          @click="load"
          ><RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''"
        /></UiButton>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2">
        <button
          class="rounded-lg px-2 py-3 text-sm font-bold"
          :class="
            tab === 'orders'
              ? 'bg-primary text-primary-contrast'
              : 'bg-surface-muted text-muted'
          "
          @click="tab = 'orders'"
        >
          <ClipboardList class="mx-auto mb-1 h-5 w-5" />Órdenes</button
        ><button
          class="rounded-lg px-2 py-3 text-sm font-bold"
          :class="
            tab === 'quotes'
              ? 'bg-primary text-primary-contrast'
              : 'bg-surface-muted text-muted'
          "
          @click="tab = 'quotes'"
        >
          <FileText class="mx-auto mb-1 h-5 w-5" />Cotizaciones</button
        ><button
          class="rounded-lg px-2 py-3 text-sm font-bold"
          :class="
            tab === 'receivables'
              ? 'bg-primary text-primary-contrast'
              : 'bg-surface-muted text-muted'
          "
          @click="tab = 'receivables'"
        >
          <ReceiptText class="mx-auto mb-1 h-5 w-5" />Por cobrar
        </button>
      </div>
    </section>

    <template v-if="tab === 'orders'">
      <div class="flex items-center justify-between">
        <div>
          <strong class="text-text">{{ orders.length }} órdenes</strong>
          <p class="text-sm text-muted">
            {{ money(receivableTotal) }} pendiente por cobrar
          </p>
        </div>
        <UiButton @click="resetOrder"
          ><Plus class="h-4 w-4" />Nueva orden</UiButton
        >
      </div>
      <UiCard v-for="order in orders" :key="order.id" class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-bold text-primary">{{ order.number }}</p>
            <h3 class="truncate font-bold text-text">{{ order.title }}</h3>
            <p class="truncate text-sm text-muted">{{ order.customer.name }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UiStatusBadge :tone="tone(order.status)">{{
              statusLabel(order.status)
            }}</UiStatusBadge>
            <UiActionDropdown :label="`Acciones de ${order.number}`">
              <UiActionMenuItem
                @select="
                  selectedOrder = order;
                  modal = 'detail';
                "
                ><template #icon><Eye class="h-4 w-4" /></template>Ver
                detalle</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="
                  ['open', 'approved'].includes(order.status) &&
                  order.billing.status !== 'invoiced'
                "
                @select="editOrder(order)"
                ><template #icon><Pencil class="h-4 w-4" /></template
                >Editar</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="order.balance > 0 && order.status !== 'cancelled'"
                @select="openPayment(order)"
                ><template #icon><Banknote class="h-4 w-4" /></template
                >Cobrar</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="order.status === 'open'"
                @select="setOrderStatus(order, 'approved')"
                ><template #icon><CheckCircle2 class="h-4 w-4" /></template
                >Aprobar</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="order.status === 'approved'"
                @select="setOrderStatus(order, 'in_progress')"
                ><template #icon><Play class="h-4 w-4" /></template
                >Iniciar</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="order.status === 'in_progress'"
                @select="setOrderStatus(order, 'ready')"
                ><template #icon><PackageCheck class="h-4 w-4" /></template
                >Marcar lista</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="order.status === 'ready'"
                @select="setOrderStatus(order, 'delivered')"
                ><template #icon><Truck class="h-4 w-4" /></template
                >Entregar</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="
                  order.status !== 'cancelled' &&
                  order.billing.status !== 'invoiced'
                "
                @select="navigateTo(invoiceHref(order))"
                ><template #icon><FileCheck2 class="h-4 w-4" /></template
                >Facturar</UiActionMenuItem
              >
              <UiActionMenuItem
                v-if="
                  !['cancelled', 'delivered'].includes(order.status) &&
                  order.billing.status !== 'invoiced'
                "
                @select="openCancel(order)"
                ><template #icon><XCircle class="h-4 w-4" /></template
                >Cancelar</UiActionMenuItem
              >
            </UiActionDropdown>
          </div>
        </div>
        <div
          class="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface-muted py-3 text-center"
        >
          <div>
            <small class="text-muted">Total</small
            ><strong class="block text-text">{{ money(order.total) }}</strong>
          </div>
          <div>
            <small class="text-muted">Recibido</small
            ><strong class="block text-success">{{
              money(order.paid_total)
            }}</strong>
          </div>
          <div>
            <small class="text-muted">Por cobrar</small
            ><strong
              class="block"
              :class="order.balance ? 'text-warning' : 'text-success'"
              >{{ money(order.balance) }}</strong
            >
          </div>
        </div>
      </UiCard>
      <p
        v-if="!orders.length"
        class="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted"
      >
        Todavía no hay órdenes comerciales.
      </p>
    </template>

    <template v-else-if="tab === 'quotes'">
      <div class="flex items-center justify-between">
        <strong class="text-text">{{ quotations.length }} cotizaciones</strong
        ><a
          :href="`${appBaseUrl.replace(/\/$/, '')}/ordenes-trabajo/cotizaciones/nueva`"
          class="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-contrast"
          ><Plus class="h-4 w-4" />Nueva cotización</a
        >
      </div>
      <UiCard v-for="quote in quotations" :key="quote.id" class="space-y-3"
        ><div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold text-primary">
              {{ quote.number }} · V{{ quote.version || 1 }}
            </p>
            <h3 class="font-bold text-text">{{ quote.title }}</h3>
            <p class="text-sm text-muted">{{ quote.customer.name }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UiStatusBadge :tone="tone(quote.status)">{{
              statusLabel(quote.status)
            }}</UiStatusBadge>
            <UiActionDropdown :label="`Acciones de ${quote.number}`">
            <UiActionMenuItem
              v-if="['draft', 'sent'].includes(quote.status)"
              @select="
                navigateTo(
                  `${appBaseUrl.replace(/\/$/, '')}/ordenes-trabajo/cotizaciones/${quote.id}/editar`,
                )
              "
              ><template #icon><Pencil class="h-4 w-4" /></template
              >Editar</UiActionMenuItem
            >
            <UiActionMenuItem
              v-if="quote.public_url"
              @select="navigateTo(quote.public_url, true)"
              ><template #icon><FileText class="h-4 w-4" /></template>Ver /
              PDF</UiActionMenuItem
            >
            <UiActionMenuItem
              v-if="quote.public_url"
              @select="shareQuote(quote)"
              ><template #icon><MessageCircle class="h-4 w-4" /></template
              >WhatsApp</UiActionMenuItem
            >
            <UiActionMenuItem @select="duplicateQuote(quote)"
              ><template #icon><Copy class="h-4 w-4" /></template
              >Duplicar</UiActionMenuItem
            >
            <UiActionMenuItem
              v-if="quote.status === 'draft'"
              @select="setQuoteStatus(quote, 'sent')"
              ><template #icon><Send class="h-4 w-4" /></template>Marcar
              enviada</UiActionMenuItem
            >
            <UiActionMenuItem
              v-if="['draft', 'sent'].includes(quote.status)"
              @select="openApproval(quote)"
              ><template #icon><CheckCircle2 class="h-4 w-4" /></template
              >Registrar aprobación</UiActionMenuItem
            >
            <UiActionMenuItem
              v-if="['sent', 'accepted'].includes(quote.status)"
              @select="openConvert(quote)"
              ><template #icon><ArrowRightCircle class="h-4 w-4" /></template
              >Convertir en orden</UiActionMenuItem
            >
            </UiActionDropdown>
          </div>
        </div>
        <div
          class="flex items-end justify-between rounded-lg bg-surface-muted p-3"
        >
          <div>
            <small class="text-muted">Total cotizado</small
            ><strong class="block text-xl text-text">{{
              money(quote.total)
            }}</strong>
          </div>
          <div class="text-right">
            <small class="text-muted">Anticipo sugerido</small
            ><strong class="block text-text">{{
              money(quote.requested_deposit)
            }}</strong>
          </div>
        </div></UiCard
      >
    </template>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <UiSelect
          v-model="receivableAging"
          label="Antigüedad de saldo"
          :options="[
            { value: '', label: 'Todas las cuentas activas' },
            { value: 'current', label: 'Al día' },
            { value: 'overdue', label: 'Todas las vencidas' },
            { value: '30', label: 'Vencidas de 30 a 59 días' },
            { value: '60', label: 'Vencidas de 60 a 89 días' },
            { value: '90', label: 'Vencidas hace 90 días o más' },
          ]"
          @update:model-value="load"
        />
        <p
          v-if="receivableOverdue"
          class="pb-3 text-sm font-semibold text-danger"
        >
          {{ money(receivableOverdue) }} vencido
        </p>
      </div>
      <UiCard class="bg-primary-soft"
        ><p class="text-sm text-muted">Cuentas por cobrar activas</p>
        <p class="mt-1 text-3xl font-black text-text">
          {{ money(receivableTotal) }}
        </p>
        <p class="text-sm text-muted">
          {{
            receivables.filter((item) =>
              ["open", "partial"].includes(item.status),
            ).length
          }}
          cuentas pendientes
        </p></UiCard
      >
      <UiCard v-for="account in receivables" :key="account.id"
        ><div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-bold text-primary">
              {{ account.source_number }}
            </p>
            <strong class="text-text">{{ account.customer.name }}</strong>
            <p class="text-sm text-muted">
              Recibido {{ money(account.paid_amount) }} de
              {{ money(account.original_amount) }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{
                account.source_type === "dte"
                  ? "Facturación DTE"
                  : account.source_type === "workshop_order"
                    ? "Orden de taller"
                    : "Orden de trabajo"
              }}
            </p>
            <p
              v-if="account.due_at"
              class="mt-1 text-xs"
              :class="
                account.days_overdue
                  ? 'font-semibold text-danger'
                  : 'text-muted'
              "
            >
              {{
                account.days_overdue
                  ? `Vencida hace ${account.days_overdue} días`
                  : `Vence ${new Date(account.due_at).toLocaleDateString("es-SV")}`
              }}
            </p>
          </div>
          <div class="text-right">
            <UiStatusBadge :tone="tone(account.status)">{{
              statusLabel(account.status)
            }}</UiStatusBadge
            ><strong
              class="mt-2 block text-lg"
              :class="account.balance ? 'text-warning' : 'text-success'"
              >{{ money(account.balance) }}</strong
            >
          </div>
        </div>
        <div
          v-if="
            account.balance > 0 && ['open', 'partial'].includes(account.status)
          "
          class="mt-3 flex justify-end"
        >
          <UiButton size="sm" @click="openReceivablePayment(account)"
            ><Banknote class="h-4 w-4" />Cobrar</UiButton
          >
        </div>
        <details
          v-if="account.entries?.length"
          class="mt-3 border-t border-line pt-3 text-sm"
        >
          <summary class="cursor-pointer font-semibold text-primary">
            Ver historial de movimientos
          </summary>
          <div
            v-for="entry in account.entries"
            :key="entry.id"
            class="mt-2 flex justify-between gap-3 text-muted"
          >
            <span
              >{{ entry.type }} ·
              {{ entry.reference || "Sin referencia" }}</span
            ><strong class="text-text">{{ money(entry.amount) }}</strong>
          </div>
        </details></UiCard
      >
    </template>

    <UiModalShell
      :open="modal === 'order'"
      :title="editingOrderId ? 'Editar orden' : 'Nueva orden de trabajo'"
      description="El saldo se controlará automáticamente en cuentas por cobrar."
      max-width="max-w-5xl"
      mobile-fullscreen
      @close="modal = null"
      ><div
        class="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-6"
      >
        <section class="space-y-4 lg:border-r lg:border-line lg:pr-6">
          <UiInput
            v-model="orderForm.title"
            label="Trabajo solicitado"
            placeholder="Ej. Ventana francesa"
          />
          <div>
            <div class="mb-1 flex items-center justify-between gap-3">
              <span class="text-sm font-semibold text-text">Cliente</span>
              <button
                type="button"
                class="text-sm font-bold text-primary hover:text-primary-hover"
                @click="openCustomerCreate()"
              >
                <Plus class="inline h-4 w-4" /> Nuevo cliente
              </button>
            </div>
            <div class="relative">
              <UiInput
                v-model="customerSearch"
                placeholder="Buscar por nombre, documento o teléfono"
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
          <UiInput
            v-model="orderForm.customer_name"
            label="Nombre en la orden"
            :disabled="Boolean(orderForm.customer_id)"
          />
          <div class="grid grid-cols-2 gap-3">
            <UiInput
              v-model="orderForm.customer_phone"
              label="Teléfono opcional"
            /><UiInput
              v-model="orderForm.due_at"
              type="date"
              label="Vencimiento"
            />
          </div>
          <UiSelect
            v-if="branchOptions.length"
            v-model.number="orderForm.branch_id"
            label="Sucursal"
            :options="branchOptions"
          />
          <UiTextarea v-model="orderForm.notes" label="Notas" />
        </section>
        <section class="space-y-4">
          <CommercialDocumentLinesEditor
            v-model="orderForm.lines"
            :tenant-id="tenantId"
            :platform-base-url="platformBaseUrl"
            :auth-token="authToken"
            total-label="Total del trabajo"
          />
          <div v-if="!editingOrderId" class="grid grid-cols-2 gap-3">
            <UiInput
              v-model.number="orderForm.deposit_amount"
              type="number"
              label="Anticipo"
            /><UiSelect
              v-model="orderForm.deposit_method"
              label="Forma"
              :options="methods"
            />
          </div>
          <div
            v-if="!editingOrderId"
            class="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-muted p-3 text-sm"
          >
            <div>
              <span class="text-muted">Se recibe ahora</span
              ><strong class="mt-1 block text-text">{{
                money(orderForm.deposit_amount)
              }}</strong>
            </div>
            <div>
              <span class="text-muted">Queda por cobrar</span
              ><strong
                class="mt-1 block"
                :class="orderBalancePreview ? 'text-warning' : 'text-success'"
                >{{ money(orderBalancePreview) }}</strong
              >
            </div>
            <p v-if="orderDepositInvalid" class="col-span-2 text-danger">
              El anticipo no puede superar el total.
            </p>
          </div>
        </section>
      </div>
      <template #footer
        ><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton
        ><UiButton
          :disabled="
            loading ||
            !orderForm.title ||
            !orderForm.customer_name ||
            orderTotal <= 0 ||
            orderDepositInvalid
          "
          @click="createOrder"
          >{{ editingOrderId ? "Guardar cambios" : "Crear orden" }}</UiButton
        ></template
      ></UiModalShell
    >
    <BillingCustomerModal
      :open="customerCreateOpen"
      mode="new"
      :loading="customerCreateLoading"
      :allow-optional-address="Boolean(catalogs)"
      :actividad-options="actividadOptions"
      :departamento-options="departamentoOptions"
      :municipio-options="municipioOptions"
      :distrito-options="distritoOptions"
      @close="customerCreateOpen = false"
      @save="createCustomer"
      @update:departamento="customerDepartamento = $event"
      @update:municipio="customerMunicipio = $event"
    />
    <UiModalShell
      :open="modal === 'payment'"
      title="Registrar pago"
      :description="
        selectedOrder
          ? `${selectedOrder.number} · saldo ${money(selectedOrder.balance)}`
          : ''
      "
      @close="modal = null"
      ><div class="space-y-4">
        <UiInput
          v-model.number="paymentForm.amount"
          type="number"
          label="Monto recibido"
        /><UiSelect
          v-model="paymentForm.method"
          label="Forma de pago"
          :options="methods"
        /><UiInput
          v-model="paymentForm.reference"
          label="Referencia opcional"
        />
      </div>
      <template #footer
        ><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton
        ><UiButton
          :disabled="loading || paymentForm.amount <= 0"
          @click="savePayment"
          >Registrar</UiButton
        ></template
      ></UiModalShell
    >
    <UiModalShell
      :open="modal === 'receivable-payment'"
      title="Registrar cobro"
      :description="
        selectedReceivable
          ? `${selectedReceivable.source_number} · saldo ${money(selectedReceivable.balance)}`
          : ''
      "
      @close="modal = null"
      ><div class="space-y-4">
        <UiInput
          v-model.number="paymentForm.amount"
          type="number"
          label="Monto recibido"
        /><UiSelect
          v-model="paymentForm.method"
          label="Forma de pago"
          :options="methods"
        /><UiInput
          v-model="paymentForm.reference"
          label="Referencia opcional"
        />
      </div>
      <template #footer
        ><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton
        ><UiButton
          :disabled="
            loading ||
            paymentForm.amount <= 0 ||
            paymentForm.amount > (selectedReceivable?.balance || 0)
          "
          @click="saveReceivablePayment"
          >Registrar cobro</UiButton
        ></template
      ></UiModalShell
    >
    <UiModalShell
      :open="modal === 'cancel'"
      title="Cancelar orden"
      description="El saldo por cobrar será anulado y el anticipo no retenido se devolverá."
      @close="modal = null"
      ><div class="space-y-4">
        <UiTextarea v-model="cancelForm.reason" label="Motivo" /><UiInput
          v-model.number="cancelForm.retained_amount"
          type="number"
          label="Monto que se retiene"
        /><UiSelect
          v-model="cancelForm.method"
          label="Forma de devolución"
          :options="methods"
        /><UiInput v-model="cancelForm.reference" label="Referencia opcional" />
      </div>
      <template #footer
        ><UiButton variant="ghost" @click="modal = null">Volver</UiButton
        ><UiButton
          variant="danger"
          :disabled="loading || !cancelForm.reason"
          @click="cancelOrder"
          >Cancelar y resolver</UiButton
        ></template
      ></UiModalShell
    >
    <UiModalShell
      :open="modal === 'convert'"
      title="Convertir en orden"
      :description="
        selectedQuotation
          ? `${selectedQuotation.number} · ${money(selectedQuotation.total)}`
          : ''
      "
      @close="modal = null"
      ><div class="space-y-4">
        <UiInput
          v-model.number="paymentForm.amount"
          type="number"
          label="Anticipo recibido"
        /><UiSelect
          v-model="paymentForm.method"
          label="Forma de pago"
          :options="methods"
        /><UiInput
          v-model="paymentForm.reference"
          label="Referencia opcional"
        />
      </div>
      <template #footer
        ><UiButton variant="ghost" @click="modal = null">Cancelar</UiButton
        ><UiButton :disabled="loading" @click="convertQuote"
          >Crear orden</UiButton
        ></template
      ></UiModalShell
    >
    <UiModalShell
      :open="modal === 'approval'"
      title="Registrar aprobación"
      :description="selectedQuotation?.number || ''"
      @close="modal = null"
      ><div class="space-y-4">
        <UiSelect
          v-model="approvalForm.method"
          label="Cómo confirmó el cliente"
          :options="[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Correo' },
            { value: 'phone', label: 'Llamada' },
            { value: 'in_person', label: 'En persona' },
          ]"
        /><UiTextarea v-model="approvalForm.note" label="Nota o referencia" />
      </div>
      <template #footer
        ><UiButton variant="ghost" @click="modal = null">Volver</UiButton
        ><UiButton :disabled="loading" @click="approveQuote"
          >Confirmar aprobación</UiButton
        ></template
      ></UiModalShell
    >
    <UiModalShell
      :open="modal === 'detail'"
      :title="selectedOrder?.number || 'Orden'"
      :description="selectedOrder?.title || ''"
      @close="modal = null"
      ><div v-if="selectedOrder" class="space-y-4">
        <div
          class="grid grid-cols-3 gap-2 rounded-lg bg-surface-muted p-3 text-center"
        >
          <div>
            <small>Total</small
            ><strong class="block">{{ money(selectedOrder.total) }}</strong>
          </div>
          <div>
            <small>Recibido</small
            ><strong class="block text-success">{{
              money(selectedOrder.paid_total)
            }}</strong>
          </div>
          <div>
            <small>Saldo</small
            ><strong class="block text-warning">{{
              money(selectedOrder.balance)
            }}</strong>
          </div>
        </div>
        <div>
          <h4 class="font-bold">Detalle</h4>
          <div
            v-for="item in selectedOrder.lines"
            :key="item.id"
            class="flex justify-between border-b border-line py-2 text-sm"
          >
            <span>{{ item.quantity }} × {{ item.description }}</span
            ><strong>{{ money(item.total || 0) }}</strong>
          </div>
        </div>
        <div>
          <h4 class="font-bold">Historial</h4>
          <div
            v-for="event in selectedOrder.timeline || []"
            :key="event.id"
            class="relative ml-2 border-l border-primary/30 py-2 pl-4"
          >
            <span
              class="absolute -left-1 top-4 h-2 w-2 rounded-full bg-primary"
            ></span
            ><strong class="text-sm">{{ statusLabel(event.to) }}</strong>
            <p class="text-xs text-muted">
              {{ event.note || "Estado actualizado" }} ·
              {{ new Date(event.occurred_at).toLocaleString("es-SV") }}
            </p>
          </div>
        </div>
      </div></UiModalShell
    >
  </div>
</template>
