import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { NotificationsClient } from '@stelfaro/api-client';

const platformApiBaseUrl = import.meta.env.VITE_PLATFORM_API_BASE_URL || '/platform-api/v1';
const defaultBaseUrl = import.meta.env.VITE_NOTIFICATIONS_API_BASE_URL || `${platformApiBaseUrl}/admin/notifications`;

export const useAdminSessionStore = defineStore('admin-session', () => {
  const baseUrl = ref(defaultBaseUrl);
  const serviceName = ref<string | null>(null);
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  const isConnected = computed(() => Boolean(serviceName.value));
  const client = computed(() => new NotificationsClient(baseUrl.value, {
    credentials: 'include'
  }));

  async function initialize(): Promise<void> {
    loading.value = true;
    lastError.value = null;

    try {
      const health = await client.value.health();
      serviceName.value = health.service;
    } catch (error) {
      serviceName.value = null;
      lastError.value = error instanceof Error ? error.message : 'No fue posible conectar con notifications.';
      throw error;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    serviceName.value = null;
  }

  return {
    baseUrl,
    serviceName,
    loading,
    lastError,
    isConnected,
    client,
    initialize,
    reset
  };
});
