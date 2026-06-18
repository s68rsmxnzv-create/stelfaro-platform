<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CoreDteClient, type CoreHealth, type DteMetadata } from '@stelfaro/api-client';
import { UiCard } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  coreBaseUrl?: string;
  authToken?: string | null;
}>(), {
  coreBaseUrl: '/api/v1',
  authToken: null
});

const client = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const health = ref<CoreHealth | null>(null);
const metadata = ref<DteMetadata[]>([]);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await client.value.health();
    metadata.value = await Promise.all([
      client.value.metadata('01'),
      client.value.metadata('03'),
      client.value.metadata('05'),
      client.value.metadata('06')
    ]);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible conectar con Core DTE';
  }
});
</script>

<template>
  <div class="grid gap-6">
    <UiCard>
      <p class="text-sm font-semibold uppercase tracking-wide text-sky-700">Dashboard</p>
      <h2 class="mt-1 text-2xl font-bold">Estado del servicio</h2>
      <p class="mt-2 text-sm text-slate-500">{{ coreBaseUrl }}</p>

      <div v-if="error" class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
      <div v-else-if="health" class="mt-6 grid gap-4 md:grid-cols-4">
        <div class="rounded-md bg-slate-50 p-4">
          <p class="text-xs text-slate-500">Estado</p>
          <p class="mt-1 font-semibold text-emerald-700">{{ health.status }}</p>
        </div>
        <div class="rounded-md bg-slate-50 p-4">
          <p class="text-xs text-slate-500">Servicio</p>
          <p class="mt-1 font-semibold">{{ health.service }}</p>
        </div>
        <div class="rounded-md bg-slate-50 p-4">
          <p class="text-xs text-slate-500">Ambiente</p>
          <p class="mt-1 font-semibold">{{ health.environment }}</p>
        </div>
        <div class="rounded-md bg-slate-50 p-4">
          <p class="text-xs text-slate-500">Laravel</p>
          <p class="mt-1 font-semibold">{{ health.version }}</p>
        </div>
      </div>
      <div v-else class="mt-4 text-sm text-slate-500">Conectando...</div>
    </UiCard>

    <UiCard>
      <h2 class="font-semibold">Documentos disponibles</h2>
      <div class="mt-4 overflow-hidden rounded-md border border-slate-200">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Version</th>
              <th class="px-4 py-3">Perfil</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="item in metadata" :key="item.tipo_dte">
              <td class="px-4 py-3 font-semibold">{{ item.tipo_dte }}</td>
              <td class="px-4 py-3">{{ item.nombre }}</td>
              <td class="px-4 py-3">v{{ item.version }}</td>
              <td class="px-4 py-3">{{ item.profile }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>
