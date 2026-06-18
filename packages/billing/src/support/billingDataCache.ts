import { CoreDteClient, type BillingCatalogs, type BillingContext } from '@stelfaro/api-client';

const ttlMs = 5 * 60 * 1000;

type CacheRecord<T> = {
  expiresAt: number;
  value: T;
};

const memory = new Map<string, CacheRecord<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function storageKey(key: string): string {
  return `stelfaro.billing.cache.${encodeURIComponent(key)}`;
}

function read<T>(key: string): T | null {
  const now = Date.now();
  const cached = memory.get(key) as CacheRecord<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached) {
    memory.delete(key);
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheRecord<T>;
    if (parsed.expiresAt <= now) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }

    memory.set(key, parsed as CacheRecord<unknown>);
    return parsed.value;
  } catch {
    window.sessionStorage.removeItem(storageKey(key));
    return null;
  }
}

function write<T>(key: string, value: T): T {
  const record: CacheRecord<T> = {
    expiresAt: Date.now() + ttlMs,
    value
  };

  memory.set(key, record as CacheRecord<unknown>);

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(record));
  }

  return value;
}

function cacheKey(coreBaseUrl: string, scope: string, resource: string): string {
  return `${resource}:${scope}:${coreBaseUrl}`;
}

async function remember<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
  if (!force) {
    const cached = read<T>(key);
    if (cached) return cached;

    const inflight = pending.get(key) as Promise<T> | undefined;
    if (inflight) return inflight;
  }

  const request = loader()
    .then((value) => write(key, value))
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

export function peekBillingContext(coreBaseUrl: string, scope = 'default'): BillingContext | null {
  return read<BillingContext>(cacheKey(coreBaseUrl, scope, 'context'));
}

export function peekBillingCatalogs(coreBaseUrl: string, scope = 'default'): BillingCatalogs | null {
  return read<BillingCatalogs>(cacheKey(coreBaseUrl, scope, 'catalogs'));
}

export function getBillingContext(
  client: CoreDteClient,
  coreBaseUrl: string,
  scope = 'default',
  force = false
): Promise<BillingContext> {
  return remember(cacheKey(coreBaseUrl, scope, 'context'), () => client.billingContext(), force);
}

export function getBillingCatalogs(
  client: CoreDteClient,
  coreBaseUrl: string,
  scope = 'default',
  force = false
): Promise<BillingCatalogs> {
  return remember(cacheKey(coreBaseUrl, scope, 'catalogs'), () => client.billingCatalogs(), force);
}

export function clearBillingDataCache(coreBaseUrl: string, scope = 'default'): void {
  for (const resource of ['context', 'catalogs']) {
    const key = cacheKey(coreBaseUrl, scope, resource);
    memory.delete(key);
    pending.delete(key);

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(storageKey(key));
    }
  }
}
