import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { CoreDteClient, type AuthUser } from '@stelfaro/api-client';

const legacyStorageKey = 'stelfaro.billing.token';
const storageKey = 'stelfaro.billing.session';
const intendedPathKey = 'stelfaro.billing.intended_path';
const coreUrl = '/api/v1';
const inactivityTimeoutMs = 120 * 60 * 1000;
const refreshCooldownMs = 5 * 60 * 1000;

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

function normalizedRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

export const useAuthStore = defineStore('auth', () => {
  const storedSession = readStoredSession();
  const token = ref<string | null>(storedSession?.token ?? null);
  const expiresAt = ref<string | null>(storedSession?.expires_at ?? null);
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const initialized = ref(false);
  let inactivityTimer: ReturnType<typeof window.setTimeout> | null = null;
  let lastRefreshAt = 0;
  let listenersStarted = false;

  const client = computed(() => new CoreDteClient(coreUrl, {
    authToken: token.value,
    onSessionRefresh: refreshSessionExpiration
  }));
  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const isBackoffice = computed(() => Boolean(user.value?.is_backoffice));
  const canManageFiscalSettings = computed(() => ['super_admin', 'admin_fiscal', 'company_admin'].includes(normalizedRole(user.value?.role)));

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
      startActivityTracking();
      resetInactivityTimer();
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
      startActivityTracking();
      resetInactivityTimer();
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
    if (inactivityTimer) {
      window.clearTimeout(inactivityTimer);
      inactivityTimer = null;
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

  function refreshSessionExpiration(value: string | null): void {
    expiresAt.value = value;
    persistSession();
  }

  function resetInactivityTimer(): void {
    if (!token.value) return;

    if (inactivityTimer) {
      window.clearTimeout(inactivityTimer);
    }

    inactivityTimer = window.setTimeout(() => {
      clearSession();
    }, inactivityTimeoutMs);
  }

  function startActivityTracking(): void {
    if (listenersStarted) return;
    listenersStarted = true;

    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
  }

  function handleActivity(): void {
    if (!token.value) return;

    resetInactivityTimer();
    const now = Date.now();
    if (now - lastRefreshAt < refreshCooldownMs) {
      return;
    }

    lastRefreshAt = now;
    void client.value.me().catch(() => clearSession());
  }

  function setIntendedPath(path: string): void {
    sessionStorage.setItem(intendedPathKey, path);
  }

  function consumeIntendedPath(fallback: string): string {
    const path = sessionStorage.getItem(intendedPathKey);
    sessionStorage.removeItem(intendedPathKey);

    return path && path.startsWith('/') ? path : fallback;
  }

  return {
    token,
    expiresAt,
    user,
    loading,
    initialized,
    isAuthenticated,
    isBackoffice,
    canManageFiscalSettings,
    initialize,
    login,
    logout,
    setIntendedPath,
    consumeIntendedPath
  };
});
