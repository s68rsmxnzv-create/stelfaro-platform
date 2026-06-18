import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { CoreDteClient } from '@stelfaro/api-client';

const platformApiBaseUrl = import.meta.env.VITE_PLATFORM_API_BASE_URL || 'https://platform.stelfaro.com/api/v1';
const defaultBaseUrl = import.meta.env.VITE_CORE_API_BASE_URL || `${platformApiBaseUrl}/admin/core`;

export const useCoreSessionStore = defineStore('core-session', () => {
  const baseUrl = ref(defaultBaseUrl);
  const token = ref('');
  const serviceName = ref<string | null>(null);
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  const isConnected = computed(() => Boolean(serviceName.value));
  const client = computed(() => new CoreDteClient(baseUrl.value, {
    authToken: () => token.value,
    credentials: 'include'
  }));

  async function initialize(): Promise<void> {
    loading.value = true;
    lastError.value = null;

    try {
      const health = await client.value.health();
      serviceName.value = health.service;
    } catch (error) {
      token.value = '';
      serviceName.value = null;
      lastError.value = error instanceof Error ? error.message : 'No fue posible conectar con dte-core.';
      throw error;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    token.value = '';
    serviceName.value = null;
  }

  return {
    baseUrl,
    token,
    serviceName,
    loading,
    lastError,
    isConnected,
    client,
    initialize,
    reset
  };
});
