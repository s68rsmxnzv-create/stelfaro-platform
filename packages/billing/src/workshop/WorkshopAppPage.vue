<script setup lang="ts">
import { computed, ref } from 'vue';
import { ClipboardList, Microscope, PackagePlus } from 'lucide-vue-next';
import { UiButton, UiLoadingMark } from '@stelfaro/ui';
import type { WorkshopOrderPayload } from '@stelfaro/api-client';
import type { WorkshopOrder } from '@stelfaro/api-client';
import { useWorkshop } from './useWorkshop';
import WorkshopReceptionForm from './WorkshopReceptionForm.vue';
import WorkshopOrdersList from './WorkshopOrdersList.vue';
import WorkshopDiagnosisBoard from './WorkshopDiagnosisBoard.vue';
import WorkshopReceptionComplete from './WorkshopReceptionComplete.vue';
const props = defineProps<{ view: 'reception'|'diagnosis'|'orders'; coreBaseUrl: string; platformBaseUrl: string; authToken: string|null; tenantId: number }>();
const notice = ref('');
const completed = ref<{order: WorkshopOrder; url: string; expires_at: string}|null>(null);
const workshop = useWorkshop(props.coreBaseUrl, props.platformBaseUrl, props.authToken, props.tenantId);
const pendingDiagnosis = computed(() => workshop.openOrders.value.filter(order => ['received','diagnosing','awaiting_approval','approved','repairing'].includes(order.status)));
async function create(payload: WorkshopOrderPayload) { const order = await workshop.createOrder(payload); try { const session = await workshop.createPhotoSession(order.id); completed.value = { order, ...session }; } catch { completed.value = { order, url: '', expires_at: '' }; } notice.value = ''; }
</script>
<template><section class="mx-auto max-w-7xl px-5 py-6"><nav class="mb-5 flex flex-wrap justify-end gap-2"><a href="/recepcion"><UiButton :variant="view === 'reception' ? 'primary' : 'secondary'"><PackagePlus class="mr-2 h-4 w-4" />Recepción</UiButton></a><a href="/diagnostico"><UiButton :variant="view === 'diagnosis' ? 'primary' : 'secondary'"><Microscope class="mr-2 h-4 w-4" />Diagnóstico</UiButton></a><a href="/ordenes"><UiButton :variant="view === 'orders' ? 'primary' : 'secondary'"><ClipboardList class="mr-2 h-4 w-4" />Órdenes</UiButton></a></nav><p v-if="notice" class="mb-4 rounded-md border border-success bg-success-soft px-4 py-3 text-sm text-success">{{ notice }}</p><p v-if="workshop.error.value" class="mb-4 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ workshop.error.value }}</p><UiLoadingMark v-if="workshop.loading.value" label="Cargando taller" /><WorkshopReceptionComplete v-else-if="view === 'reception' && completed" :order="completed.order" :photo-url="completed.url" :expires-at="completed.expires_at" @reset="completed = null" /><WorkshopReceptionForm v-else-if="view === 'reception'" :customers="workshop.customers.value" :customer-loading="workshop.customerLoading.value" :on-create-customer="workshop.createCustomer" :on-save="create" @search="workshop.searchCustomers" /><WorkshopDiagnosisBoard v-else-if="view === 'diagnosis'" :orders="pendingDiagnosis" @update="workshop.updateOrder" /><WorkshopOrdersList v-else :orders="workshop.orders.value" /></section></template>
