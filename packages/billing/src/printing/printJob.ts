import { loadPrinterSettings, requestPrintAgent } from './printerSettings';

export type PrintOperation = { name: string; args: unknown[] };

export async function sendSilentPrint(operations: PrintOperation[]): Promise<'printed' | 'disabled'> {
  const settings = loadPrinterSettings();
  if (!settings.enabled || !settings.printer) return 'disabled';
  await requestPrintAgent(settings, '/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: settings.printer, operations }),
  });
  return 'printed';
}
