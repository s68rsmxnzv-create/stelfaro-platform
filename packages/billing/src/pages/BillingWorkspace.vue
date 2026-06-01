<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { buildFacturaRequest, CoreDteClient, type DteDraftSummary, type DteHistoryEntry, type DtePreviewResponse } from '@stelfaro/api-client';
import { currency, type BillingItem } from '@stelfaro/shared';
import { UiButton, UiCard, UiInput, UiTextarea } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
}>(), {
  coreBaseUrl: 'http://127.0.0.1:8000/api/v1'
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl));
const loading = ref(false);
const error = ref<string | null>(null);
const preview = ref<DtePreviewResponse | null>(null);
const draft = ref<DteDraftSummary | null>(null);
const history = ref<DteHistoryEntry[]>([]);

const form = reactive({
  documentType: '01' as const,
  customerName: 'Cliente Demo',
  customerDocument: '00000000-0',
  customerEmail: 'cliente@example.test',
  itemDescription: 'Servicio demo',
  itemQuantity: 1,
  itemUnitPrice: 10
});

const items = computed<BillingItem[]>(() => [
  {
    description: form.itemDescription,
    quantity: Number(form.itemQuantity),
    unitPrice: Number(form.itemUnitPrice)
  }
]);

const total = computed(() => items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
const requestPayload = computed(() => buildFacturaRequest({
  documentType: form.documentType,
  customerName: form.customerName,
  customerDocument: form.customerDocument,
  customerEmail: form.customerEmail || null,
  items: items.value
}));
const previewJson = computed(() => JSON.stringify(preview.value?.payload ?? requestPayload.value, null, 2));

async function run<T>(task: () => Promise<T>): Promise<T | null> {
  loading.value = true;
  error.value = null;

  try {
    return await task();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Error inesperado';
    return null;
  } finally {
    loading.value = false;
  }
}

async function previewDocument(): Promise<void> {
  const result = await run(() => client.value.preview(requestPayload.value));
  if (result) {
    preview.value = result;
  }
}

async function createDraft(): Promise<void> {
  const result = await run(() => client.value.createDraft(requestPayload.value));
  if (result) {
    draft.value = result;
    history.value = [];
  }
}

async function transition(action: 'ready' | 'sign' | 'send' | 'receive'): Promise<void> {
  if (!draft.value) {
    return;
  }

  const id = draft.value.id;
  const result = await run(() => {
    if (action === 'ready') return client.value.readyToSign(id);
    if (action === 'sign') return client.value.signDraft(id);
    if (action === 'send') return client.value.sendDraft(id);
    return client.value.receiveDraft(id);
  });

  if (result) {
    draft.value = result;
    await loadHistory();
  }
}

async function loadHistory(): Promise<void> {
  if (!draft.value) {
    return;
  }

  const result = await run(() => client.value.history(draft.value!.id));
  if (result) {
    history.value = result;
  }
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <UiCard>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Billing transversal</p>
          <h1 class="mt-1 text-2xl font-bold text-slate-950">Factura electronica</h1>
          <p class="mt-1 text-sm text-slate-500">Primer flujo reusable consumiendo Core DTE.</p>
        </div>
        <div class="rounded-md bg-slate-100 px-3 py-2 text-right">
          <p class="text-xs text-slate-500">Total</p>
          <p class="font-bold text-slate-950">{{ currency(total) }}</p>
        </div>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-2">
        <UiInput v-model="form.customerName" label="Cliente" />
        <UiInput v-model="form.customerDocument" label="Documento" />
        <UiInput v-model="form.customerEmail" label="Correo" />
        <UiInput v-model="form.itemDescription" label="Servicio o producto" />
        <UiInput v-model="form.itemQuantity" label="Cantidad" type="number" />
        <UiInput v-model="form.itemUnitPrice" label="Precio unitario" type="number" />
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <UiButton :disabled="loading" @click="previewDocument">Preview</UiButton>
        <UiButton variant="secondary" :disabled="loading" @click="createDraft">Crear draft</UiButton>
      </div>

      <div v-if="draft" class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm text-slate-500">Draft #{{ draft.id }}</p>
            <p class="font-semibold text-slate-950">{{ draft.numeroControl }}</p>
          </div>
          <span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">{{ draft.estado }}</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <UiButton variant="secondary" :disabled="loading" @click="transition('ready')">Ready</UiButton>
          <UiButton variant="secondary" :disabled="loading" @click="transition('sign')">Firmar</UiButton>
          <UiButton variant="secondary" :disabled="loading" @click="transition('send')">Transmitir</UiButton>
          <UiButton variant="secondary" :disabled="loading" @click="transition('receive')">Aceptar sandbox</UiButton>
          <UiButton variant="ghost" :disabled="loading" @click="loadHistory">Historial</UiButton>
        </div>
      </div>

      <p v-if="error" class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    </UiCard>

    <div class="grid gap-6">
      <UiCard>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold text-slate-950">JSON DTE</h2>
          <span v-if="preview" class="rounded-full px-3 py-1 text-xs font-semibold" :class="preview.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">
            {{ preview.valid ? 'Valido' : 'Invalido' }}
          </span>
        </div>
        <UiTextarea label="Payload" :model-value="previewJson" :rows="18" readonly />
      </UiCard>

      <UiCard>
        <h2 class="font-semibold text-slate-950">Historial</h2>
        <div v-if="history.length === 0" class="mt-3 text-sm text-slate-500">Sin eventos cargados todavia.</div>
        <ol v-else class="mt-4 space-y-3">
          <li v-for="entry in history" :key="`${entry.event}-${entry.created_at}`" class="rounded-md border border-slate-200 p-3">
            <p class="font-medium text-slate-900">{{ entry.event }}</p>
            <p class="text-xs text-slate-500">{{ entry.created_at }}</p>
          </li>
        </ol>
      </UiCard>
    </div>
  </div>
</template>
