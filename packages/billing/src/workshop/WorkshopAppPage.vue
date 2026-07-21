<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { UiLoadingMark, UiModalShell } from '@stelfaro/ui';
import { CoreDteClient, PlatformClient, type BillingCatalogs, type BillingEmpresa, type WorkshopOrder, type WorkshopOrderPayload, type WorkshopTicketSettings } from '@stelfaro/api-client';
import { sendSilentPrint } from '../printing/printJob';
import { loadPrinterSettings } from '../printing/printerSettings';
import { dteFiscalTicketFromArtifact } from '../printing/dteFiscalTicket';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';
import { getBillingCatalogs, peekBillingCatalogs } from '../support/billingDataCache';
import { useWorkshop } from './useWorkshop';
import { workshopClosedTicket } from './workshopClosedTicket';
import { workshopReceptionTicket } from './workshopReceptionTicket';
import WorkshopReceptionForm from './WorkshopReceptionForm.vue';
import WorkshopOrdersList from './WorkshopOrdersList.vue';
import WorkshopDiagnosisBoard from './WorkshopDiagnosisBoard.vue';
import WorkshopReceptionComplete from './WorkshopReceptionComplete.vue';
import WorkshopOrderDetail from './WorkshopOrderDetail.vue';
import WorkshopPhotoSessionModal from './WorkshopPhotoSessionModal.vue';
import WorkshopSettlementModal from './WorkshopSettlementModal.vue';
import WorkshopInvoiceTypeModal from './WorkshopInvoiceTypeModal.vue';
import WorkshopPaymentModal from './WorkshopPaymentModal.vue';

const props = defineProps<{ view: 'reception'|'orders'; coreBaseUrl: string; platformBaseUrl: string; authToken: string|null; tenantId: number; company?: BillingEmpresa | null }>();
const catalogs = ref<BillingCatalogs | null>(peekBillingCatalogs(props.coreBaseUrl));
const floatingToasts = ref<BillingFloatingToast[]>([]); let floatingToastId = 0; const floatingToastTimers: number[] = [];
const receptionPrinting = ref(false);
const completed = ref<{order: WorkshopOrder; url: string; expires_at: string}|null>(null); const selectedOrder = ref<WorkshopOrder|null>(null); const workOrderId = ref<number|null>(null); const settlementOrderId = ref<number|null>(null); const invoiceOrderId = ref<number|null>(null); const paymentOrderId = ref<number|null>(null); const photoSessionOrder = ref<WorkshopOrder|null>(null); const photoSession = ref<{url:string; expires_at:string}|null>(null); const photoSessionLoading = ref(false); const photoSessionError = ref('');
const workshop = useWorkshop(props.coreBaseUrl, props.platformBaseUrl, props.authToken, props.tenantId, props.view === 'orders' ? 15 : 100);
const core = new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken });
const platform = new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' });
const workOrder = computed(() => workshop.orders.value.find(order => order.id === workOrderId.value) || null); const settlementOrder = computed(() => workshop.orders.value.find(order => order.id === settlementOrderId.value) || null); const pendingInvoiceOrder = computed(() => workshop.orders.value.find(order => order.id === invoiceOrderId.value) || null); const paymentOrder = computed(() => workshop.orders.value.find(order => order.id === paymentOrderId.value) || null);
watch(() => props.authToken, async (token) => { if (!token) return; try { catalogs.value = await getBillingCatalogs(core, props.coreBaseUrl); } catch { catalogs.value = null; } }, { immediate: true });
async function create(payload: WorkshopOrderPayload) { const order = await workshop.createOrder(payload); try { const session = await workshop.createPhotoSession(order.id); completed.value = { order, ...session }; } catch { completed.value = { order, url: '', expires_at: '' }; } await workshop.loadPhotos(order.id); }
async function openOrder(order: WorkshopOrder) { selectedOrder.value = order; await workshop.loadPhotos(order.id); }
async function openPhotoSession(order: WorkshopOrder) { photoSessionOrder.value = order; photoSession.value = null; photoSessionError.value = ''; photoSessionLoading.value = true; try { photoSession.value = await workshop.createPhotoSession(order.id); } catch (reason) { photoSessionError.value = reason instanceof Error ? reason.message : 'No fue posible generar el QR.'; } finally { photoSessionLoading.value = false; } }
function closePhotoSession() { photoSessionOrder.value = null; photoSession.value = null; photoSessionError.value = ''; }
async function updateWorkOrder(id: number, payload: Record<string, unknown>) { const updated = await workshop.updateOrder(id, payload as any); if (updated && ['ready','cancelled'].includes(updated.status)) workOrderId.value = null; }
function invoiceOrder(order: WorkshopOrder, type: '01'|'03', opensDrawer = false) { const params = new URLSearchParams({ workshop_order: String(order.id) }); if (opensDrawer) params.set('open_drawer', '1'); window.location.href = `/facturacion/${type === '03' ? 'ccf' : 'fe'}?${params.toString()}`; }
function chooseInvoiceType(type: '01'|'03') { if (pendingInvoiceOrder.value) invoiceOrder(pendingInvoiceOrder.value, type); }
function pushFloatingToast(toast: Omit<BillingFloatingToast, 'id'>) { const id = ++floatingToastId; floatingToasts.value = [...floatingToasts.value, { id, ...toast }]; const timer = window.setTimeout(() => { floatingToasts.value = floatingToasts.value.filter(item => item.id !== id); }, toast.variant === 'success' || !toast.variant ? 4000 : 4300); floatingToastTimers.push(timer); }
async function printClosedOrder(order: WorkshopOrder, opensDrawer = false) { try { const result = await sendSilentPrint(workshopClosedTicket(order, opensDrawer)); pushFloatingToast(result === 'printed' ? { title: 'Orden impresa', message: `${order.ticket} fue enviada a la impresora.`, variant: 'success' } : { title: 'Orden guardada', message: 'Activa la impresión silenciosa y selecciona una impresora para imprimirla.', variant: 'info' }); } catch (reason) { pushFloatingToast({ title: 'No se pudo imprimir', message: reason instanceof Error ? reason.message : 'Revisa la conexión con la impresora.', variant: 'error' }); } }
async function printReception(order: WorkshopOrder) { if (receptionPrinting.value) return; receptionPrinting.value = true; try { const printerSettings = loadPrinterSettings(); const ticketSettingsPromise = platform.workshopTicketSettings(props.tenantId); const accessPromise = order.device_access ? Promise.resolve({ data: order.device_access }) : platform.workshopDeviceAccess(props.tenantId, order.id); const logoPromise = printerSettings.showLogo && props.company?.logo_url ? core.companyThermalLogo(props.company.id, printerSettings.paperWidth === '58' ? 240 : 320) : Promise.resolve({ logo: null }); const [ticketSettingsResult, accessResult, logoResult] = await Promise.all([ticketSettingsPromise, accessPromise, logoPromise]); if (printerSettings.showLogo && props.company?.logo_url && !logoResult.logo) throw new Error('No fue posible preparar el logo para la impresora.'); const ticketSettings: WorkshopTicketSettings = ticketSettingsResult.data; const result = await sendSilentPrint(await workshopReceptionTicket(order, props.company, ticketSettings, accessResult.data, logoResult.logo)); pushFloatingToast(result === 'printed' ? { title: 'Recepción impresa', message: `${order.ticket} fue enviada con ${ticketSettings.receipt_copies} ${ticketSettings.receipt_copies === 1 ? 'copia' : 'copias'}${ticketSettings.print_equipment_label ? ' y etiqueta QR' : ''}.`, variant: 'success' } : { title: 'Recepción lista', message: 'Activa la impresión silenciosa y selecciona una impresora para imprimirla.', variant: 'info' }); } catch (reason) { pushFloatingToast({ title: 'No se pudo imprimir', message: reason instanceof Error ? reason.message : 'Revisa la conexión con la impresora.', variant: 'error' }); } finally { receptionPrinting.value = false; } }
async function printOrderDocument(order: WorkshopOrder) { if (order.billing.status !== 'invoiced' || !order.billing.core_document_id) { await printClosedOrder(order); return; } try { const thermal = await core.thermalArtifact(order.billing.core_document_id); const result = await sendSilentPrint(dteFiscalTicketFromArtifact(thermal)); pushFloatingToast(result === 'printed' ? { title: 'DTE impreso', message: `${order.billing.number || order.ticket} fue enviado a la impresora.`, variant: 'success' } : { title: 'DTE listo', message: 'Activa la impresión silenciosa y selecciona una impresora para imprimirlo.', variant: 'info' }); } catch (reason) { pushFloatingToast({ title: 'No se pudo imprimir el DTE', message: reason instanceof Error ? reason.message : 'Revisa la conexión con la impresora.', variant: 'error' }); } }
async function settleOrder(id: number, payload: Parameters<typeof workshop.settleOrder>[1]) { const updated = await workshop.settleOrder(id, payload); settlementOrderId.value = null; if (payload.document_choice === 'dte') { invoiceOrder(updated, payload.dte_type || '01', payload.payment_timing === 'paid_now'); return; } await printClosedOrder(updated, payload.payment_timing === 'paid_now'); }
async function recordPayment(id: number, payload: Parameters<typeof workshop.recordPayment>[1]) { const updated = await workshop.recordPayment(id, payload); paymentOrderId.value = null; pushFloatingToast({ title: 'Pago registrado', message: updated.balance > 0 ? `Saldo pendiente: $${updated.balance.toFixed(2)}.` : 'La orden quedó saldada.', variant: 'success' }); }
onUnmounted(() => floatingToastTimers.forEach(timer => window.clearTimeout(timer)));
</script>

<template>
  <section class="mx-auto max-w-7xl px-5 py-6">
    <BillingFloatingToastStack :toasts="floatingToasts" />
    <p v-if="workshop.error.value" class="mb-4 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ workshop.error.value }}</p>
    <UiLoadingMark v-if="workshop.loading.value && view !== 'orders'" label="Cargando taller" />
    <WorkshopReceptionComplete v-else-if="view === 'reception' && completed" :order="completed.order" :photos="workshop.photos.value" :photo-loading="workshop.photoLoading.value" :photo-url="completed.url" :expires-at="completed.expires_at" :printing="receptionPrinting" @refresh-photos="workshop.loadPhotos(completed.order.id)" @print="printReception(completed.order)" @reset="completed = null" />
    <WorkshopReceptionForm v-else-if="view === 'reception'" :customers="workshop.customers.value" :branches="company?.sucursales || []" :catalogs="catalogs" :customer-loading="workshop.customerLoading.value" :on-create-customer="workshop.createCustomer" :on-save="create" @search="workshop.searchCustomers" />
    <template v-else>
      <WorkshopOrdersList :orders="workshop.orders.value" :stats="workshop.orderStats.value" :meta="workshop.orderMeta.value" :loading="workshop.loading.value" @search="workshop.loadOrders" @select="openOrder" @diagnose="workOrderId = $event.id" @settle="settlementOrderId = $event.id" @invoice="invoiceOrderId = $event.id" @pay="paymentOrderId = $event.id" @print="printOrderDocument" @print-reception="printReception" @add-photos="openPhotoSession" />
      <UiModalShell :open="Boolean(workOrder)" :title="workOrder ? `Trabajo técnico · ${workOrder.ticket}` : 'Trabajo técnico'" :description="workOrder ? `${workOrder.device.brand} ${workOrder.device.model} · ${workOrder.customer.name}` : null" max-width="max-w-4xl" @close="workOrderId = null"><WorkshopDiagnosisBoard v-if="workOrder" :orders="[workOrder]" @update="updateWorkOrder" /></UiModalShell>
      <WorkshopSettlementModal :order="settlementOrder" @settle="settleOrder" @close="settlementOrderId = null" />
      <WorkshopPaymentModal :order="paymentOrder" @pay="recordPayment" @close="paymentOrderId = null" />
      <WorkshopInvoiceTypeModal :order="pendingInvoiceOrder" @choose="chooseInvoiceType" @close="invoiceOrderId = null" />
      <WorkshopOrderDetail :order="selectedOrder" :photos="workshop.photos.value" :photo-loading="workshop.photoLoading.value" @add-photos="selectedOrder && openPhotoSession(selectedOrder)" @refresh-photos="selectedOrder && workshop.loadPhotos(selectedOrder.id)" @close="selectedOrder = null" />
      <WorkshopPhotoSessionModal :order="photoSessionOrder" :session="photoSession" :loading="photoSessionLoading" :error="photoSessionError" @close="closePhotoSession" />
    </template>
  </section>
</template>
