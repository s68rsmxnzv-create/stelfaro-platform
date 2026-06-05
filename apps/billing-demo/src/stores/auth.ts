import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { CoreDteClient, type AuthUser } from '@stelfaro/api-client';

const legacyStorageKey = 'stelfaro.billing.token';
const storageKey = 'stelfaro.billing.session';
const coreUrl = '/api/v1';

type StoredSession = {
  token: string;
  expires_at: string | null;
};

function readStoredSession(): StoredSession | null {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredSession;
      if (parsed.token) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  const legacyToken = localStorage.getItem(legacyStorageKey);
  return legacyToken ? { token: legacyToken, expires_at: null } : null;
}

function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

export const useAuthStore = defineStore('auth', () => {
  const storedSession = readStoredSession();
  const token = ref<string | null>(storedSession?.token ?? null);
  const expiresAt = ref<string | null>(storedSession?.expires_at ?? null);
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const initialized = ref(false);
  let expirationTimer: ReturnType<typeof window.setTimeout> | null = null;

  const client = computed(() => new CoreDteClient(coreUrl, { authToken: token.value }));
  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const isBackoffice = computed(() => Boolean(user.value?.is_backoffice));

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }

    initialized.value = true;
    if (!token.value) {
      return;
    }

    if (isExpired(expiresAt.value)) {
      clearSession();
      return;
    }

    try {
      const response = await client.value.me();
      user.value = response.user;
      expiresAt.value = response.expires_at;
      persistSession();
      scheduleExpiration();
    } catch {
      clearSession();
    }
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    try {
      const response = await new CoreDteClient(coreUrl).login({
        email,
        password,
        device_name: 'billing-web'
      });
      token.value = response.token;
      expiresAt.value = response.expires_at;
      user.value = response.user;
      persistSession();
      scheduleExpiration();
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) {
        await client.value.logout();
      }
    } finally {
      clearSession();
    }
  }

  function clearSession(): void {
    if (expirationTimer) {
      window.clearTimeout(expirationTimer);
      expirationTimer = null;
    }
    token.value = null;
    expiresAt.value = null;
    user.value = null;
    localStorage.removeItem(storageKey);
    localStorage.removeItem(legacyStorageKey);
  }

  function persistSession(): void {
    if (!token.value) {
      clearSession();
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify({
      token: token.value,
      expires_at: expiresAt.value
    }));
    localStorage.removeItem(legacyStorageKey);
  }

  function scheduleExpiration(): void {
    if (expirationTimer) {
      window.clearTimeout(expirationTimer);
      expirationTimer = null;
    }

    if (!expiresAt.value) {
      return;
    }

    const delay = new Date(expiresAt.value).getTime() - Date.now();
    if (delay <= 0) {
      clearSession();
      return;
    }

    expirationTimer = window.setTimeout(() => {
      clearSession();
    }, delay);
  }

  return {
    token,
    expiresAt,
    user,
    loading,
    initialized,
    isAuthenticated,
    isBackoffice,
    initialize,
    login,
    logout
  };
});
