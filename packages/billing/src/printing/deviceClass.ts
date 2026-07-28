export type DeviceSignals = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  coarsePointer?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
};

export function isMobilePrintingDevice(signals: DeviceSignals): boolean {
  const userAgent = signals.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(userAgent)) return true;

  const isIPadDesktopMode = signals.platform === 'MacIntel' && (signals.maxTouchPoints ?? 0) > 1;
  if (isIPadDesktopMode) return true;

  const longestViewportSide = Math.max(signals.viewportWidth ?? 0, signals.viewportHeight ?? 0);
  return Boolean(signals.coarsePointer)
    && (signals.maxTouchPoints ?? 0) > 0
    && longestViewportSide > 0
    && longestViewportSide <= 1366;
}

export function detectMobilePrintingDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  return isMobilePrintingDevice({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
}

export function detectAndroidPrintingDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}
