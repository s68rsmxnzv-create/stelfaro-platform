<script setup lang="ts">
import { computed, ref } from 'vue';
import { UiLoadingMark, UiModalShell } from '@stelfaro/ui';
import type { WorkshopOrderPayload } from '@stelfaro/api-client';
import type { WorkshopOrder } from '@stelfaro/api-client';
import { useWorkshop } from './useWorkshop';
import WorkshopReceptionForm from './WorkshopReceptionForm.vue';
import WorkshopOrdersList from './WorkshopOrdersList.vue';
import WorkshopDiagnosisBoard from './WorkshopDiagnosisBoard.vue';
import WorkshopReceptionComplete from './WorkshopReceptionComplete.vue';
import WorkshopOrderDetail from './WorkshopOrderDetail.vue';
import WorkshopPhotoSessionModal from './WorkshopPhotoSessionModal.vue';
import WorkshopSettlementModal from './WorkshopSettlementModal.vue';
const props = defineProps<{ view: 'reception'|'orders'; coreBaseUrl: string; platformBaseUrl: string; authToken: string|null; tenantId: number }>();
const notice = ref('');
const completed = ref<{order: WorkshopOrder; url: string; expires_at: string}|null>(null);
const selectedOrder = ref<WorkshopOrder|null>(null);
const workOrderId = ref<number|null>(null);
const settlementOrderId = ref<number|null>(null);
const photoSessionOrder = ref<WorkshopOrder|null>(null);
const photoSession = ref<{url:string; expires_at:string}|null>(null);
const photoSessionLoading = ref(false);
const photoSessionError = ref('');
const workshop = useWorkshop(props.coreBaseUrl, props.platformBaseUrl, props.authToken, props.tenantId, props.view === 'orders' ? 15 : 100);
const workOrder = computed(() => workshop.orders.value.find(order => order.id === workOrderId.value) || null);
const settlementOrder = computed(() => workshop.orders.value.find(order => order.id === settlementOrderId.value) || null);
async function create(payload: WorkshopOrderPayload) { const order = await workshop.createOrder(payload); try { const session = await workshop.createPhotoSession(order.id); completed.value = { order, ...session }; } catch { completed.value = { order, url: '', expires_at: '' }; } await workshop.loadPhotos(order.id); notice.value = ''; }
async function openOrder(order: WorkshopOrder) { selectedOrder.value = order; await workshop.loadPhotos(order.id); }
async function openPhotoSession(order: WorkshopOrder) { photoSessionOrder.value = order; photoSession.value = null; photoSessionError.value = ''; photoSessionLoading.value = true; try { photoSession.value = await workshop.createPhotoSession(order.id); } catch (reason) { photoSessionError.value = reason instanceof Error ? reason.message : 'No fue posible generar el QR.'; } finally { photoSessionLoading.value = false; } }
function closePhotoSession() { photoSessionOrder.value = null; photoSession.value = null; photoSessionError.value = ''; }
async function updateWorkOrder(id: number, payload: Record<string, unknown>) { const updated = await workshop.updateOrder(id, payload as any); if (updated && ['ready','cancelled'].includes(updated.status)) workOrderId.value = null; }
async function settleOrder(id: number, payload: Parameters<typeof workshop.settleOrder>[1]) { await workshop.settleOrder(id, payload); settlementOrderId.value = null; notice.value = 'Orden cerrada correctamente. La facturación permanece como una acción independiente.'; }
</script>
<template><section class="mx-auto max-w-7xl px-5 py-6"><p v-if="notice" class="mb-4 rounded-md border border-success bg-success-soft px-4 py-3 text-sm text-success">{{ notice }}</p><p v-if="workshop.error.value" class="mb-4 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ workshop.error.value }}</p><UiLoadingMark v-if="workshop.loading.value && view !== 'orders'" label="Cargando taller" /><WorkshopReceptionComplete v-else-if="view === 'reception' && completed" :order="completed.order" :photos="workshop.photos.value" :photo-loading="workshop.photoLoading.value" :photo-url="completed.url" :expires-at="completed.expires_at" @refresh-photos="workshop.loadPhotos(completed.order.id)" @reset="completed = null" /><WorkshopReceptionForm v-else-if="view === 'reception'" :customers="workshop.customers.value" :customer-loading="workshop.customerLoading.value" :on-create-customer="workshop.createCustomer" :on-save="create" @search="workshop.searchCustomers" /><template v-else><WorkshopOrdersList :orders="workshop.orders.value" :stats="workshop.orderStats.value" :meta="workshop.orderMeta.value" :loading="workshop.loading.value" @search="workshop.loadOrders" @select="openOrder" @diagnose="workOrderId = $event.id" @settle="settlementOrderId = $event.id" @add-photos="openPhotoSession" /><UiModalShell :open="Boolean(workOrder)" :title="workOrder ? `Trabajo técnico · ${workOrder.ticket}` : 'Trabajo técnico'" :description="workOrder ? `${workOrder.device.brand} ${workOrder.device.model} · ${workOrder.customer.name}` : null" max-width="max-w-4xl" @close="workOrderId = null"><WorkshopDiagnosisBoard v-if="workOrder" :orders="[workOrder]" @update="updateWorkOrder" /></UiModalShell><WorkshopSettlementModal :order="settlementOrder" @settle="settleOrder" @close="settlementOrderId = null" /><WorkshopOrderDetail :order="selectedOrder" :photos="workshop.photos.value" :photo-loading="workshop.photoLoading.value" @add-photos="selectedOrder && openPhotoSession(selectedOrder)" @refresh-photos="selectedOrder && workshop.loadPhotos(selectedOrder.id)" @close="selectedOrder = null" /><WorkshopPhotoSessionModal :order="photoSessionOrder" :session="photoSession" :loading="photoSessionLoading" :error="photoSessionError" @close="closePhotoSession" /></template></section></template>
