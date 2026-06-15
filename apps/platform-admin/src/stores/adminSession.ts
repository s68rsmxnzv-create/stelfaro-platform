import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { NotificationsClient } from '@stelfaro/api-client';

const storageKey = 'stelfaro.platform_admin.notifications_session';
const defaultBaseUrl = import.meta.env.VITE_NOTIFICATIONS_API_BASE_URL || '/notifications-api/v1';

type StoredSession = {
  baseUrl: string;
  token: string;
};

function readStoredSession(): StoredSession | null {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as StoredSession;
    return parsed.baseUrl && parsed.token ? parsed : null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export const useAdminSessionStore = defineStore('admin-session', () => {
  const stored = readStoredSession();
  const baseUrl = ref(stored?.baseUrl ?? defaultBaseUrl);
  const token = ref(stored?.token ?? '');
  const serviceName = ref<string | null>(null);
  const loading = ref(false);
  const lastError = ref<string | null>(null);

  const isConnected = computed(() => Boolean(token.value && serviceName.value));
  const client = computed(() => new NotificationsClient(baseUrl.value, {
    authToken: () => token.value
  }));

  async function connect(nextBaseUrl: string, nextToken: string): Promise<void> {
    loading.value = true;
    lastError.value = null;
    try {
      baseUrl.value = nextBaseUrl.trim() || defaultBaseUrl;
      token.value = nextToken.trim();
      const health = await client.value.health();
      serviceName.value = health.service;
      persist();
    } catch (error) {
      serviceName.value = null;
      lastError.value = error instanceof Error ? error.message : 'No fue posible conectar con notifications.';
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function initialize(): Promise<void> {
    if (!token.value) return;

    try {
      const health = await client.value.health();
      serviceName.value = health.service;
    } catch {
      serviceName.value = null;
    }
  }

  function disconnect(): void {
    token.value = '';
    serviceName.value = null;
    localStorage.removeItem(storageKey);
  }

  function persist(): void {
    localStorage.setItem(storageKey, JSON.stringify({
      baseUrl: baseUrl.value,
      token: token.value
    }));
  }

  return {
    baseUrl,
    token,
    serviceName,
    loading,
    lastError,
    isConnected,
    client,
    connect,
    initialize,
    disconnect
  };
});
