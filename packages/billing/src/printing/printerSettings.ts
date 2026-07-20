export const PRINTER_SETTINGS_STORAGE_KEY = 'stelfaro:print-agent:settings:v1';

export type PrinterSettings = {
  enabled: boolean;
  agentUrl: string;
  printer: string;
  paperWidth: '58' | '80';
  cutLines: number;
  qrEnabled: boolean;
  qrWidth: number;
  openDrawer: boolean;
  showLogo: boolean;
  showIssuerDetails: boolean;
};

export const defaultPrinterSettings = (): PrinterSettings => ({
  enabled: false,
  agentUrl: 'http://localhost:8711',
  printer: '',
  paperWidth: '80',
  cutLines: 6,
  qrEnabled: true,
  qrWidth: 280,
  openDrawer: false,
  showLogo: false,
  showIssuerDetails: true,
});

export function loadPrinterSettings(): PrinterSettings {
  if (typeof window === 'undefined') return defaultPrinterSettings();
  try {
    const saved = JSON.parse(window.localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY) || '{}');
    return { ...defaultPrinterSettings(), ...saved, agentUrl: normalizeAgentUrl(saved.agentUrl), cutLines: clamp(saved.cutLines, 1, 12, 6), qrWidth: clamp(saved.qrWidth, 120, 420, 280) };
  } catch {
    return defaultPrinterSettings();
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  window.localStorage.setItem(PRINTER_SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings, agentUrl: normalizeAgentUrl(settings.agentUrl), cutLines: clamp(settings.cutLines, 1, 12, 6), qrWidth: clamp(settings.qrWidth, 120, 420, 280) }));
}

export function normalizeAgentUrl(value: unknown): string {
  return String(value || 'http://localhost:8711').trim().replace(/\/+$/, '');
}

export async function requestPrintAgent<T>(settings: PrinterSettings, path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${normalizeAgentUrl(settings.agentUrl)}${path}`, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || `El agente respondió HTTP ${response.status}.`);
    return data as T;
  } catch (error) {
    if (error instanceof TypeError) {
      const mobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
      throw new Error(mobile
        ? 'No encontramos un agente en este dispositivo. En móvil necesitaremos el agente Android o la dirección de un agente accesible en la red local.'
        : 'No encontramos el agente local. Verifica que esté iniciado y que puedas abrir su página de salud.');
    }
    throw error;
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}
