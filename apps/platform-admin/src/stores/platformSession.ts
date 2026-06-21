import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { PlatformClient } from '@stelfaro/api-client';

type PlatformSession = {
  user: {
    id: number;
    name: string;
    email: string;
  };
  tenant: unknown | null;
  apps: unknown[];
  default_app: unknown | null;
  redirect_url: string | null;
  can_access_platform_admin: boolean;
  platform_admin_url: string;
};

const loginUrl = 'https://platform.stelfaro.com/login';
const platformApiBaseUrl = import.meta.env.VITE_PLATFORM_API_BASE_URL || 'https://platform.stelfaro.com/api/v1';

export const usePlatformSessionStore = defineStore('platform-session', () => {
  const session = ref<PlatformSession | null>(null);
  const loading = ref(true);
  const lastError = ref<string | null>(null);
  const authenticated = computed(() => Boolean(session.value?.user));
  const canAccessAdmin = computed(() => Boolean(session.value?.can_access_platform_admin));
  const client = computed(() => new PlatformClient(platformApiBaseUrl, {
    credentials: 'include'
  }));

  async function initialize(): Promise<void> {
    loading.value = true;
    lastError.value = null;

    try {
      const response = await fetch(`${platformApiBaseUrl}/me`, {
        headers: { Accept: 'application/json' },
        credentials: 'include'
      });

      if (response.status === 401 || response.redirected) {
        window.location.assign(loginUrl);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      session.value = await response.json() as PlatformSession;
    } catch (error) {
      session.value = null;
      lastError.value = error instanceof Error ? error.message : 'No fue posible validar la sesion de plataforma.';
    } finally {
      loading.value = false;
    }
  }

  return {
    session,
    loading,
    lastError,
    authenticated,
    canAccessAdmin,
    client,
    loginUrl,
    platformApiBaseUrl,
    initialize
  };
});
