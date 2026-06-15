<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CoreDteClient } from '@stelfaro/api-client';
import { UiButton, UiLoadingMark } from '@stelfaro/ui';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const auth = useAuthStore();
const loading = ref(false);
const error = ref<string | null>(null);
const pdfUrl = ref<string | null>(null);
const documentId = computed(() => Number(route.params.id));
const client = computed(() => new CoreDteClient('/api/v1', { authToken: auth.token }));

onMounted(() => {
  void loadPdf();
});

watch(documentId, () => {
  void loadPdf();
});

onBeforeUnmount(() => {
  revokePdfUrl();
});

async function loadPdf(): Promise<void> {
  if (!Number.isFinite(documentId.value) || documentId.value <= 0) {
    error.value = 'Comprobante no valido.';
    return;
  }

  loading.value = true;
  error.value = null;
  revokePdfUrl();

  try {
    const pdf = await client.value.graphicRepresentationPdf(documentId.value);
    pdfUrl.value = URL.createObjectURL(pdf);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el PDF.';
  } finally {
    loading.value = false;
  }
}

function revokePdfUrl(): void {
  if (!pdfUrl.value) return;
  URL.revokeObjectURL(pdfUrl.value);
  pdfUrl.value = null;
}
</script>

<template>
  <main class="min-h-screen bg-slate-100">
    <div v-if="loading" class="flex min-h-screen items-center justify-center">
      <div class="rounded-lg bg-white px-6 py-5 shadow-sm">
        <UiLoadingMark label="Cargando PDF" />
      </div>
    </div>

    <div v-else-if="error" class="flex min-h-screen items-center justify-center p-6">
      <div class="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <p class="text-lg font-bold text-slate-950">No fue posible abrir el comprobante</p>
        <p class="mt-2 text-slate-600">{{ error }}</p>
        <UiButton class="mt-5" @click="loadPdf">Reintentar</UiButton>
      </div>
    </div>

    <iframe
      v-else-if="pdfUrl"
      :src="pdfUrl"
      title="Comprobante PDF"
      class="h-screen w-full border-0"
    />
  </main>
</template>
