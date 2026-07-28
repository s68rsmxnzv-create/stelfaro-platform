import type { PrintOperation } from './printJob';

const ANDROID_PRINT_CONTEXT_KEY = 'stelfaro:android-print:context:v1';

export type AndroidPrintContext = {
  tenantId: number;
  platformBaseUrl: string;
  agentId: number;
};

export function isAndroidDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function saveAndroidPrintContext(context: AndroidPrintContext): void {
  window.localStorage.setItem(ANDROID_PRINT_CONTEXT_KEY, JSON.stringify({
    ...context,
    platformBaseUrl: context.platformBaseUrl.replace(/\/+$/, ''),
  }));
}

export function loadAndroidPrintContext(): AndroidPrintContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(ANDROID_PRINT_CONTEXT_KEY) || 'null');
    const tenantId = Number(value?.tenantId);
    const agentId = Number(value?.agentId);
    if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(agentId) || agentId <= 0) return null;
    return {
      tenantId,
      agentId,
      platformBaseUrl: String(value?.platformBaseUrl || '/api/v1').replace(/\/+$/, ''),
    };
  } catch {
    return null;
  }
}

export async function enqueueAndroidPrint(
  context: AndroidPrintContext,
  paperWidth: '58' | '80',
  operations: PrintOperation[],
  openDrawer = false,
): Promise<void> {
  const response = await fetch(
    `${context.platformBaseUrl}/platform/tenants/${context.tenantId}/android-print/jobs`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        agent_id: context.agentId,
        paperWidth,
        operations,
        openDrawer,
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().find(value => typeof value === 'string')
      : null;
    throw new Error(String(validationMessage || data?.message || `No se pudo enviar la impresión Android (HTTP ${response.status}).`));
  }
}
