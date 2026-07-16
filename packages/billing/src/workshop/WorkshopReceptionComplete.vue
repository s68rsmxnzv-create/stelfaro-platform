<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import QRCode from 'qrcode';
import { Camera, MessageCircle, Printer, RotateCcw } from 'lucide-vue-next';
import { UiButton, UiCard } from '@stelfaro/ui';
import type { WorkshopOrder, WorkshopOrderPhoto } from '@stelfaro/api-client';
import WorkshopPhotoGallery from './WorkshopPhotoGallery.vue';

const props = defineProps<{ order: WorkshopOrder; photos: WorkshopOrderPhoto[]; photoLoading?: boolean; photoUrl?: string; expiresAt?: string }>();
defineEmits<{ reset: []; refreshPhotos: [] }>();
const qr = ref('');
const ticketMessage = ref('');
const conditionLabels: Record<string, string> = { scratches: 'Rayones', dents: 'Golpes', cracked: 'Quebraduras', missing_parts: 'Piezas faltantes', moisture: 'Humedad visible', opened: 'Abierto previamente', tampered_screws: 'Tornillos manipulados', no_accessories: 'Sin accesorios' };
const powerLabels: Record<string, string> = { on: 'Enciende', off: 'No enciende', not_tested: 'No comprobado' };
const deviceLabels: Record<string, string> = { phone: 'Celular', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Computadora', console: 'Consola', controller: 'Mando', instrument: 'Instrumento', tv: 'Televisor', audio: 'Equipo de audio', other: 'Equipo electrónico' };
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
const emoji = { greeting: '\u{1F44B}', receipt: '\u{1F527}', ticket: '\u{1F3AB}', calendar: '\u{1F4C5}', device: '\u{1F4F1}', fault: '\u{1F6E0}\u{FE0F}', condition: '\u{1F50D}', accessories: '\u{1F392}', money: '\u{1F4B5}', status: '\u{1F4CC}' };
const whatsappUrl = computed(() => {
  let phone = (props.order.customer.phone || '').replace(/\D/g, '');
  if (phone.length === 8) phone = `503${phone}`;
  const identifier = props.order.device.imei ? `IMEI: ${props.order.device.imei}` : props.order.device.serial_number ? `Serie: ${props.order.device.serial_number}` : 'Sin identificador visible';
  const conditions = props.order.physical_conditions.map(condition => conditionLabels[condition] || condition);
  if (props.order.physical_condition) conditions.push(props.order.physical_condition);
  const lines = [
    `Hola *${props.order.customer.name}* ${emoji.greeting}`,
    '',
    `${emoji.receipt} *COMPROBANTE DE RECEPCIÓN*`,
    `${emoji.ticket} *Orden:* ${props.order.ticket}`,
    `${emoji.calendar} *Fecha:* ${new Date(props.order.received_at).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })}`,
    '',
    `${emoji.device} *EQUIPO RECIBIDO*`,
    `• ${deviceLabels[props.order.device.type] || props.order.device.type}: ${props.order.device.brand} ${props.order.device.model}`,
    `• ${identifier}`,
    `• Encendido: ${powerLabels[props.order.device.power_status] || props.order.device.power_status}`,
    '',
    `${emoji.fault} *FALLA REPORTADA*`,
    props.order.reported_fault,
    ...(conditions.length ? ['', `${emoji.condition} *CONDICIÓN AL RECIBIR*`, conditions.join(' · ')] : []),
    ...(props.order.accessories.length ? ['', `${emoji.accessories} *ACCESORIOS RECIBIDOS*`, props.order.accessories.join(', ')] : []),
    '',
    `${emoji.money} *VALORES REGISTRADOS*`,
    props.order.estimated_total !== null ? `• Monto estimado: ${money(props.order.estimated_total)}` : '• Monto estimado: Pendiente de diagnóstico',
    `• Anticipo recibido: ${money(props.order.paid_total)}`,
    ...(props.order.estimated_total !== null ? [`• Saldo estimado: ${money(props.order.balance)}`] : []),
    '',
    `${emoji.status} El equipo quedó registrado y pendiente de revisión técnica.`,
    'Conserva este mensaje como constancia de recepción. El diagnóstico y el valor final serán confirmados antes de realizar trabajos adicionales.',
  ];
  const message = lines.join('\n');
  return phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}` : '';
});
onMounted(async () => { if (props.photoUrl) qr.value = await QRCode.toDataURL(props.photoUrl, { width: 280, margin: 1, errorCorrectionLevel: 'M' }); });
</script>
<template><UiCard class="w-full overflow-hidden p-6 sm:p-8"><div class="text-center"><div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft"><Camera class="h-7 w-7 text-success" /></div><h2 class="mt-4 text-2xl font-bold text-text">{{ order.ticket }} registrada</h2><p class="mt-2 text-sm text-muted">El equipo quedó listo para agregar fotografías y entregar la constancia al cliente.</p></div><div class="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]"><div class="rounded-lg border border-line bg-white p-4 text-center"><img v-if="qr" :src="qr" class="mx-auto h-64 w-64" alt="QR temporal para subir fotos"><p v-if="expiresAt" class="mt-2 text-xs text-slate-500">QR válido hasta {{ new Date(expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }}</p><p v-else class="py-20 text-sm text-slate-500">No fue posible generar el QR. La orden sí quedó registrada.</p></div><div class="grid content-start gap-3"><a v-if="photoUrl" :href="photoUrl" target="_blank" rel="noopener"><UiButton class="w-full justify-start"><Camera class="mr-2 h-5 w-5" />Abrir carga de fotos</UiButton></a><a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener"><UiButton class="w-full justify-start" variant="success"><MessageCircle class="mr-2 h-5 w-5" />Enviar por WhatsApp</UiButton></a><UiButton class="w-full justify-start" variant="secondary" @click="ticketMessage = 'La impresión del ticket se habilitará en el siguiente incremento.'"><Printer class="mr-2 h-5 w-5" />Imprimir ticket</UiButton><p v-if="!whatsappUrl" class="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">El cliente no tiene teléfono para abrir WhatsApp.</p><p v-if="ticketMessage" class="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted">{{ ticketMessage }}</p><div class="mt-2 rounded-md border border-line bg-surface-muted p-4 text-sm"><p class="font-semibold text-text">{{ order.customer.name }}</p><p class="mt-1 text-muted">{{ order.device.brand }} {{ order.device.model }} · {{ order.ticket }}</p></div><UiButton class="mt-2 w-full justify-start" variant="ghost" @click="$emit('reset')"><RotateCcw class="mr-2 h-5 w-5" />Registrar otro equipo</UiButton></div></div><WorkshopPhotoGallery :photos="photos" :loading="photoLoading" @refresh="$emit('refreshPhotos')" /></UiCard></template>
