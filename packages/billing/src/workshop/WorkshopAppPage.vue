<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { UiLoadingMark, UiModalShell } from "@stelfaro/ui";
import {
  CoreDteClient,
  PlatformClient,
  type BillingCatalogs,
  type BillingEmpresa,
  type WorkshopOrder,
  type WorkshopOrderPayload,
  type WorkshopTicketSettings,
} from "@stelfaro/api-client";
import { sendSilentPrint } from "../printing/printJob";
import { loadPrinterSettings } from "../printing/printerSettings";
import { dteFiscalTicketFromArtifact } from "../printing/dteFiscalTicket";
import BillingFloatingToastStack, {
  type BillingFloatingToast,
} from "../components/BillingFloatingToastStack.vue";
import {
  getBillingCatalogs,
  peekBillingCatalogs,
} from "../support/billingDataCache";
import { useWorkshop } from "./useWorkshop";
import { workshopClosedTicket } from "./workshopClosedTicket";
import { workshopReceptionTicket } from "./workshopReceptionTicket";
import WorkshopReceptionForm from "./WorkshopReceptionForm.vue";
import WorkshopOrdersList from "./WorkshopOrdersList.vue";
import WorkshopDiagnosisBoard from "./WorkshopDiagnosisBoard.vue";
import WorkshopReceptionComplete from "./WorkshopReceptionComplete.vue";
import WorkshopOrderDetail from "./WorkshopOrderDetail.vue";
import WorkshopPhotoSessionModal from "./WorkshopPhotoSessionModal.vue";
import WorkshopSettlementModal from "./WorkshopSettlementModal.vue";
import WorkshopInvoiceTypeModal from "./WorkshopInvoiceTypeModal.vue";
import WorkshopPaymentModal from "./WorkshopPaymentModal.vue";

const props = withDefaults(
  defineProps<{
    view: "reception" | "orders";
    coreBaseUrl: string;
    platformBaseUrl: string;
    authToken: string | null;
    tenantId: number;
    company?: BillingEmpresa | null;
    appBaseUrl?: string;
    billingBasePath?: string;
  }>(),
  {
    appBaseUrl: "/taller",
    billingBasePath: "/facturacion",
  },
);
const catalogs = ref<BillingCatalogs | null>(
  peekBillingCatalogs(props.coreBaseUrl),
);
const floatingToasts = ref<BillingFloatingToast[]>([]);
let floatingToastId = 0;
const floatingToastTimers: number[] = [];
const receptionPrinting = ref(false);
const completed = ref<{
  order: WorkshopOrder;
  orders: WorkshopOrder[];
  url: string;
  expires_at: string;
} | null>(null);
const continuation = ref<{
  receptionId: number;
  customer: WorkshopOrder["customer"];
  branchId?: number | null;
} | null>(null);
const selectedOrder = ref<WorkshopOrder | null>(null);
const workOrderId = ref<number | null>(null);
const settlementOrderId = ref<number | null>(null);
const invoiceOrderId = ref<number | null>(null);
const paymentOrderId = ref<number | null>(null);
const photoSessionOrder = ref<WorkshopOrder | null>(null);
const photoSession = ref<{ url: string; expires_at: string } | null>(null);
const photoSessionLoading = ref(false);
const photoSessionError = ref("");
const workshop = useWorkshop(
  props.coreBaseUrl,
  props.platformBaseUrl,
  props.authToken,
  props.tenantId,
  props.view === "orders" ? 15 : 100,
);
const core = new CoreDteClient(props.coreBaseUrl, {
  authToken: props.authToken,
});
const platform = new PlatformClient(props.platformBaseUrl, {
  credentials: "same-origin",
});
const workOrder = computed(
  () =>
    workshop.orders.value.find((order) => order.id === workOrderId.value) ||
    null,
);
const settlementOrder = computed(
  () =>
    workshop.orders.value.find(
      (order) => order.id === settlementOrderId.value,
    ) || null,
);
const pendingInvoiceOrder = computed(
  () =>
    workshop.orders.value.find((order) => order.id === invoiceOrderId.value) ||
    null,
);
const paymentOrder = computed(
  () =>
    workshop.orders.value.find((order) => order.id === paymentOrderId.value) ||
    null,
);
watch(
  () => props.authToken,
  async (token) => {
    if (!token) return;
    try {
      catalogs.value = await getBillingCatalogs(core, props.coreBaseUrl);
    } catch {
      catalogs.value = null;
    }
  },
  { immediate: true },
);
async function create(payload: WorkshopOrderPayload) {
  const order = await workshop.createOrder(payload);
  const orders = (
    await platform.workshopReception(props.tenantId, order.reception.id)
  ).data.orders;
  try {
    const session = await workshop.createPhotoSession(order.id);
    completed.value = { order, orders, ...session };
  } catch {
    completed.value = { order, orders, url: "", expires_at: "" };
  }
  continuation.value = null;
  setCompletedOrderInUrl(order.id);
  await workshop.loadPhotos(order.id);
}
function setCompletedOrderInUrl(orderId: number | null) {
  const url = new URL(window.location.href);
  if (orderId) url.searchParams.set("confirmacion", String(orderId));
  else url.searchParams.delete("confirmacion");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
async function restoreCompletedReception() {
  if (props.view !== "reception") return;
  const orderId = Number(new URLSearchParams(window.location.search).get("confirmacion") || 0);
  if (!orderId) return;
  try {
    const [{ data: order }, session] = await Promise.all([
      platform.workshopOrder(props.tenantId, orderId),
      workshop.createPhotoSession(orderId),
    ]);
    const [{ data: reception }, { data: deviceAccess }] = await Promise.all([
      platform.workshopReception(props.tenantId, order.reception.id),
      platform.workshopDeviceAccess(props.tenantId, orderId),
    ]);
    order.device_access = deviceAccess;
    completed.value = { order, orders: reception.orders, ...session };
    await workshop.loadPhotos(orderId);
  } catch (reason) {
    setCompletedOrderInUrl(null);
    workshop.error.value = reason instanceof Error ? reason.message : "No fue posible recuperar la confirmación de recepción.";
  }
}
function addAnotherEquipment() {
  if (!completed.value) return;
  continuation.value = {
    receptionId: completed.value.order.reception.id,
    customer: completed.value.order.customer,
    branchId: completed.value.order.branch?.id ?? null,
  };
  completed.value = null;
  setCompletedOrderInUrl(null);
}
function finishReception() {
  completed.value = null;
  continuation.value = null;
  setCompletedOrderInUrl(null);
}
async function openOrder(order: WorkshopOrder) {
  selectedOrder.value = order;
  await workshop.loadPhotos(order.id);
}
async function openPhotoSession(order: WorkshopOrder) {
  photoSessionOrder.value = order;
  photoSession.value = null;
  photoSessionError.value = "";
  photoSessionLoading.value = true;
  try {
    photoSession.value = await workshop.createPhotoSession(order.id);
  } catch (reason) {
    photoSessionError.value =
      reason instanceof Error
        ? reason.message
        : "No fue posible generar el QR.";
  } finally {
    photoSessionLoading.value = false;
  }
}
function closePhotoSession() {
  photoSessionOrder.value = null;
  photoSession.value = null;
  photoSessionError.value = "";
}
async function updateWorkOrder(id: number, payload: Record<string, unknown>) {
  const updated = await workshop.updateOrder(id, payload as any);
  if (updated && selectedOrder.value?.id === id) selectedOrder.value = updated;
  if (updated && ["ready", "cancelled"].includes(updated.status))
    workOrderId.value = null;
  if (updated?.status === "cancelled" && !updated.financial.closed_at)
    settlementOrderId.value = updated.id;
}
async function cancelOrder(order: WorkshopOrder) {
  const updated = await workshop.updateOrder(order.id, { status: "cancelled" });
  settlementOrderId.value = updated.id;
}
function invoiceOrder(
  order: WorkshopOrder,
  type: "01" | "03",
  opensDrawer = false,
) {
  const params = new URLSearchParams({ workshop_order: String(order.id) });
  if (opensDrawer) params.set("open_drawer", "1");
  const billingBase =
    `${props.appBaseUrl.replace(/\/$/, "")}${props.billingBasePath}`.replace(
      /\/$/,
      "",
    );
  window.location.href = `${billingBase}/${type === "03" ? "ccf" : "fe"}?${params.toString()}`;
}
function chooseInvoiceType(type: "01" | "03") {
  if (pendingInvoiceOrder.value) invoiceOrder(pendingInvoiceOrder.value, type);
}
function pushFloatingToast(toast: Omit<BillingFloatingToast, "id">) {
  const id = ++floatingToastId;
  floatingToasts.value = [...floatingToasts.value, { id, ...toast }];
  const timer = window.setTimeout(
    () => {
      floatingToasts.value = floatingToasts.value.filter(
        (item) => item.id !== id,
      );
    },
    toast.variant === "success" || !toast.variant ? 4000 : 4300,
  );
  floatingToastTimers.push(timer);
}
async function printClosedOrder(order: WorkshopOrder, opensDrawer = false) {
  try {
    const result = await sendSilentPrint(
      workshopClosedTicket(order, opensDrawer),
    );
    pushFloatingToast(
      result === "printed"
        ? {
            title: "Orden impresa",
            message: `${order.ticket} fue enviada a la impresora.`,
            variant: "success",
          }
        : {
            title: "Orden guardada",
            message:
              "Activa la impresión silenciosa y selecciona una impresora para imprimirla.",
            variant: "info",
          },
    );
  } catch (reason) {
    pushFloatingToast({
      title: "No se pudo imprimir",
      message:
        reason instanceof Error
          ? reason.message
          : "Revisa la conexión con la impresora.",
      variant: "error",
    });
  }
}
async function printReception(order: WorkshopOrder) {
  if (receptionPrinting.value) return;
  receptionPrinting.value = true;
  try {
    const printerSettings = loadPrinterSettings();
    const receptionPromise = platform.workshopReception(
      props.tenantId,
      order.reception.id,
    );
    const ticketSettingsPromise = platform.workshopTicketSettings(
      props.tenantId,
    );
    const logoPromise =
      printerSettings.showLogo && props.company?.logo_url
        ? core.companyThermalLogo(
            props.company.id,
            printerSettings.paperWidth === "58" ? 240 : 320,
          )
        : Promise.resolve({ logo: null });
    const [receptionResult, ticketSettingsResult, logoResult] =
      await Promise.all([receptionPromise, ticketSettingsPromise, logoPromise]);
    const orders = receptionResult.data.orders;
    const accessEntries = await Promise.all(
      orders.map(
        async (item) =>
          [
            item.id,
            item.device_access ||
              (await platform.workshopDeviceAccess(props.tenantId, item.id))
                .data,
          ] as const,
      ),
    );
    const accesses = Object.fromEntries(accessEntries);
    if (printerSettings.showLogo && props.company?.logo_url && !logoResult.logo)
      throw new Error("No fue posible preparar el logo para la impresora.");
    const ticketSettings: WorkshopTicketSettings = ticketSettingsResult.data;
    const result = await sendSilentPrint(
      await workshopReceptionTicket(
        orders,
        props.company,
        ticketSettings,
        accesses,
        logoResult.logo,
      ),
    );
    pushFloatingToast(
      result === "printed"
        ? {
            title: "Recepción impresa",
            message: `${order.ticket} fue enviada con ${orders.length} ${orders.length === 1 ? "equipo" : "equipos"} y ${ticketSettings.receipt_copies} ${ticketSettings.receipt_copies === 1 ? "copia" : "copias"}.`,
            variant: "success",
          }
        : {
            title: "Recepción lista",
            message:
              "Activa la impresión silenciosa y selecciona una impresora para imprimirla.",
            variant: "info",
          },
    );
  } catch (reason) {
    pushFloatingToast({
      title: "No se pudo imprimir",
      message:
        reason instanceof Error
          ? reason.message
          : "Revisa la conexión con la impresora.",
      variant: "error",
    });
  } finally {
    receptionPrinting.value = false;
  }
}
async function printOrderDocument(order: WorkshopOrder) {
  if (order.billing.status !== "invoiced" || !order.billing.core_document_id) {
    await printClosedOrder(order);
    return;
  }
  try {
    const thermal = await core.thermalArtifact(order.billing.core_document_id);
    const result = await sendSilentPrint(dteFiscalTicketFromArtifact(thermal));
    pushFloatingToast(
      result === "printed"
        ? {
            title: "DTE impreso",
            message: `${order.billing.number || order.ticket} fue enviado a la impresora.`,
            variant: "success",
          }
        : {
            title: "DTE listo",
            message:
              "Activa la impresión silenciosa y selecciona una impresora para imprimirlo.",
            variant: "info",
          },
    );
  } catch (reason) {
    pushFloatingToast({
      title: "No se pudo imprimir el DTE",
      message:
        reason instanceof Error
          ? reason.message
          : "Revisa la conexión con la impresora.",
      variant: "error",
    });
  }
}
async function settleOrder(
  id: number,
  payload: Parameters<typeof workshop.settleOrder>[1],
) {
  const updated = await workshop.settleOrder(id, payload);
  settlementOrderId.value = null;
  if (payload.document_choice === "dte") {
    invoiceOrder(
      updated,
      payload.dte_type || "01",
      payload.payment_timing === "paid_now",
    );
    return;
  }
  await printClosedOrder(updated, payload.payment_timing === "paid_now");
}
async function recordPayment(
  id: number,
  payload: Parameters<typeof workshop.recordPayment>[1],
) {
  const updated = await workshop.recordPayment(id, payload);
  if (completed.value) {
    completed.value.orders = completed.value.orders.map((order) =>
      order.id === id ? updated : order,
    );
    if (completed.value.order.id === id) completed.value.order = updated;
  }
  paymentOrderId.value = null;
  pushFloatingToast({
    title:
      completed.value && !updated.financial.closed_at
        ? "Anticipo registrado"
        : "Pago registrado",
    message:
      updated.balance > 0
        ? `Saldo pendiente: $${updated.balance.toFixed(2)}.`
        : "La orden quedó saldada.",
    variant: "success",
  });
}
onUnmounted(() =>
  floatingToastTimers.forEach((timer) => window.clearTimeout(timer)),
);
onMounted(restoreCompletedReception);
</script>

<template>
  <section class="mx-auto max-w-7xl px-0 py-0 md:px-5 md:py-6">
    <BillingFloatingToastStack :toasts="floatingToasts" />
    <p
      v-if="workshop.error.value"
      class="mb-4 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {{ workshop.error.value }}
    </p>
    <UiLoadingMark
      v-if="workshop.loading.value && view !== 'orders'"
      label="Cargando taller"
    />
    <WorkshopReceptionComplete
      v-else-if="view === 'reception' && completed"
      :order="completed.order"
      :orders="completed.orders"
      :photos="workshop.photos.value"
      :photo-loading="workshop.photoLoading.value"
      :photo-url="completed.url"
      :expires-at="completed.expires_at"
      :printing="receptionPrinting"
      @refresh-photos="workshop.loadPhotos(completed.order.id)"
      @print="printReception(completed.order)"
      @advance="paymentOrderId = $event.id"
      @add-another="addAnotherEquipment"
      @finish="finishReception"
    />
    <WorkshopReceptionForm
      v-else-if="view === 'reception'"
      :customers="workshop.customers.value"
      :branches="company?.sucursales || []"
      :catalogs="catalogs"
      :customer-loading="workshop.customerLoading.value"
      :continuation="continuation"
      :on-create-customer="workshop.createCustomer"
      :on-save="create"
      @search="workshop.searchCustomers"
    />
    <template v-else>
      <WorkshopOrdersList
        :orders="workshop.orders.value"
        :stats="workshop.orderStats.value"
        :meta="workshop.orderMeta.value"
        :loading="workshop.loading.value"
        @search="workshop.loadOrders"
        @select="openOrder"
        @diagnose="workOrderId = $event.id"
        @cancel="cancelOrder"
        @settle="settlementOrderId = $event.id"
        @invoice="invoiceOrderId = $event.id"
        @pay="paymentOrderId = $event.id"
        @print="printOrderDocument"
        @print-reception="printReception"
        @add-photos="openPhotoSession"
      />
      <UiModalShell
        mobile-fullscreen
        :open="Boolean(workOrder)"
        :title="
          workOrder
            ? `Trabajo técnico · ${workOrder.ticket}`
            : 'Trabajo técnico'
        "
        :description="
          workOrder
            ? `${workOrder.device.brand} ${workOrder.device.model} · ${workOrder.customer.name}`
            : null
        "
        max-width="max-w-4xl"
        @close="workOrderId = null"
        ><WorkshopDiagnosisBoard
          v-if="workOrder"
          :orders="[workOrder]"
          :tenant-id="tenantId"
          :platform-base-url="platformBaseUrl"
          @update="updateWorkOrder"
      /></UiModalShell>
      <WorkshopSettlementModal
        :order="settlementOrder"
        @settle="settleOrder"
        @close="settlementOrderId = null"
      />
      <WorkshopInvoiceTypeModal
        :order="pendingInvoiceOrder"
        @choose="chooseInvoiceType"
        @close="invoiceOrderId = null"
      />
      <WorkshopOrderDetail
        :order="selectedOrder"
        :photos="workshop.photos.value"
        :tenant-id="tenantId"
        :platform-base-url="platformBaseUrl"
        :photo-loading="workshop.photoLoading.value"
        @update="updateWorkOrder"
        @add-photos="selectedOrder && openPhotoSession(selectedOrder)"
        @refresh-photos="selectedOrder && workshop.loadPhotos(selectedOrder.id)"
        @close="selectedOrder = null"
      />
      <WorkshopPhotoSessionModal
        :order="photoSessionOrder"
        :session="photoSession"
        :loading="photoSessionLoading"
        :error="photoSessionError"
        @close="closePhotoSession"
      />
    </template>
    <WorkshopPaymentModal
      :order="paymentOrder"
      @pay="recordPayment"
      @close="paymentOrderId = null"
    />
  </section>
</template>
