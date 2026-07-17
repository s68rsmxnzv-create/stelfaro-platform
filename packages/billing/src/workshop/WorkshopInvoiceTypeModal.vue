<script setup lang="ts">
import { FileText } from 'lucide-vue-next';
import { UiModalShell } from '@stelfaro/ui';
import type { WorkshopOrder } from '@stelfaro/api-client';
defineProps<{ order: WorkshopOrder | null }>();
defineEmits<{ close: []; choose: [type: '01'|'03'] }>();
</script>
<template><UiModalShell :open="Boolean(order)" title="Facturar orden" :description="order ? `${order.ticket} · ${order.customer.name}` : null" max-width="max-w-lg" @close="$emit('close')"><div class="grid gap-3 sm:grid-cols-2"><button type="button" class="rounded-lg border border-line bg-surface p-4 text-left transition hover:border-primary hover:bg-primary-soft" @click="$emit('choose', '01')"><FileText class="h-5 w-5 text-primary" /><strong class="mt-3 block text-text">Factura electrónica</strong><p class="mt-1 text-sm text-muted">Venta a consumidor final.</p></button><button type="button" class="rounded-lg border border-line bg-surface p-4 text-left transition hover:border-primary hover:bg-primary-soft" @click="$emit('choose', '03')"><FileText class="h-5 w-5 text-primary" /><strong class="mt-3 block text-text">Crédito fiscal</strong><p class="mt-1 text-sm text-muted">Validará NRC, actividad y dirección fiscal.</p></button></div></UiModalShell></template>
