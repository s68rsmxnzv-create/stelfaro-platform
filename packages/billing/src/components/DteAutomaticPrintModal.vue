<script setup lang="ts">
import { UiButton } from '@stelfaro/ui';
import { MailCheck, Printer } from 'lucide-vue-next';
import BillingModalShell from './BillingModalShell.vue';

defineProps<{
  open: boolean;
  documentNumber: string;
  recipientEmail: string;
  printing?: boolean;
}>();

defineEmits<{
  close: [];
  print: [];
}>();
</script>

<template>
  <BillingModalShell
    :open="open"
    title="¿Imprimir también el ticket?"
    description="El comprobante fue recibido por Hacienda y tiene un correo de entrega."
    max-width="max-w-lg"
    :close-disabled="printing"
    @close="$emit('close')"
  >
    <div class="flex gap-4 rounded-md border border-line bg-surface-muted p-4">
      <MailCheck class="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
      <div class="min-w-0">
        <p class="font-semibold text-text">Se enviará a {{ recipientEmail }}</p>
        <p class="mt-1 break-all text-sm text-muted">{{ documentNumber }}</p>
      </div>
    </div>

    <p class="mt-4 text-sm text-muted">
      Puedes omitir el papel porque el cliente ya recibirá su comprobante digital.
    </p>

    <template #footer>
      <UiButton type="button" variant="secondary" :disabled="printing" @click="$emit('close')">No imprimir</UiButton>
      <UiButton type="button" :disabled="printing" @click="$emit('print')">
        <Printer class="h-4 w-4" />
        {{ printing ? 'Imprimiendo…' : 'Imprimir ticket' }}
      </UiButton>
    </template>
  </BillingModalShell>
</template>
