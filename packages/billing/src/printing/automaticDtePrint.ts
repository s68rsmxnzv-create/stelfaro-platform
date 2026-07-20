import type { DteDraftSummary } from '@stelfaro/api-client';
import type { PrinterSettings } from './printerSettings';

export type AutomaticDtePrintDecision = {
  action: 'disabled' | 'print' | 'confirm';
  recipientEmail: string | null;
};

export function automaticDtePrintDecision(
  settings: PrinterSettings,
  document: DteDraftSummary,
  fallbackRecipientEmail?: string | null,
): AutomaticDtePrintDecision {
  if (!settings.enabled || !settings.printer || !settings.autoPrintAfterIssue || !isAcceptedByMh(document)) {
    return { action: 'disabled', recipientEmail: null };
  }

  const recipientEmail = dteRecipientEmail(document, fallbackRecipientEmail);
  return {
    action: recipientEmail ? 'confirm' : 'print',
    recipientEmail,
  };
}

export function dteRecipientEmail(document: DteDraftSummary, fallback?: string | null): string | null {
  const metadata = asRecord((document as DteDraftSummary & { metadata?: unknown }).metadata);
  const metadataNotifications = asRecord(metadata.notifications);
  const metadataDelivery = asRecord(metadataNotifications.dte_delivery);
  const payloadReceptor = asRecord(asRecord(document.payload).receptor);
  const jsonReceptor = asRecord(asRecord(document.dte_json).receptor);
  const candidates = [
    document.notifications?.dte_delivery?.recipient_email,
    metadataDelivery.recipient_email,
    jsonReceptor.correo,
    payloadReceptor.correo,
    fallback,
  ];

  for (const candidate of candidates) {
    const email = String(candidate ?? '').trim();
    if (email) return email;
  }

  return null;
}

function isAcceptedByMh(document: DteDraftSummary): boolean {
  return ['accepted', 'received_by_mh'].includes(String(document.estado).toLowerCase())
    && Boolean(document.selloRecibido);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
