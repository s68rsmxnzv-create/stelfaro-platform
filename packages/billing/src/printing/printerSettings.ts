export const PRINTER_SETTINGS_STORAGE_KEY = "stelfaro:print-agent:settings:v1";

export type PrinterSettings = {
  enabled: boolean;
  autoPrintAfterIssue: boolean;
  agentUrl: string;
  printer: string;
  paperWidth: "58" | "80";
  cutLines: number;
  qrEnabled: boolean;
  openDrawer: boolean;
  showLogo: boolean;
  showIssuerDetails: boolean;
  showBusinessName: boolean;
};

export const defaultPrinterSettings = (): PrinterSettings => ({
  enabled: false,
  autoPrintAfterIssue: false,
  agentUrl: "http://localhost:8711",
  printer: "",
  paperWidth: "80",
  cutLines: 6,
  qrEnabled: true,
  openDrawer: false,
  showLogo: false,
  showIssuerDetails: true,
  showBusinessName: true,
});

export function loadPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return defaultPrinterSettings();
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY) || "{}",
    );
    delete saved.qrWidth;
    return {
      ...defaultPrinterSettings(),
      ...saved,
      agentUrl: normalizeAgentUrl(saved.agentUrl),
      cutLines: clamp(saved.cutLines, 1, 12, 6),
    };
  } catch {
    return defaultPrinterSettings();
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  window.localStorage.setItem(
    PRINTER_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...settings,
      agentUrl: normalizeAgentUrl(settings.agentUrl),
      cutLines: clamp(settings.cutLines, 1, 12, 6),
    }),
  );
}

export function fixedQrWidth(
  paperWidth: PrinterSettings["paperWidth"],
): number {
  return paperWidth === "58" ? 200 : 280;
}

export function receptionLogoWidth(
  paperWidth: PrinterSettings["paperWidth"],
): number {
  return paperWidth === "58" ? 128 : 184;
}

export function normalizeAgentUrl(value: unknown): string {
  return String(value || "http://localhost:8711")
    .trim()
    .replace(/\/+$/, "");
}

export async function requestPrintAgent<T>(
  settings: PrinterSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(
      `${normalizeAgentUrl(settings.agentUrl)}${path}${separator}_=${Date.now()}`,
      {
        ...init,
        cache: "no-store",
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false)
      throw new Error(
        data.message || `El agente respondió HTTP ${response.status}.`,
      );
    return data as T;
  } catch (error) {
    if (error instanceof TypeError) {
      const mobile = /Android|iPhone|iPad|iPod/i.test(
        window.navigator.userAgent,
      );
      throw new Error(
        mobile
          ? "No encontramos un agente en este dispositivo. En móvil necesitaremos el agente Android o la dirección de un agente accesible en la red local."
          : "No encontramos el agente local. Verifica que esté iniciado y que puedas abrir su página de salud.",
      );
    }
    throw error;
  }
}

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(min, Math.min(max, numeric))
    : fallback;
}
