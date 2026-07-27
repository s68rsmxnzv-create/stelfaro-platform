import { loadPrinterSettings, requestPrintAgent } from './printerSettings';
import type { PrinterSettings } from './printerSettings';
import { prepare58MmQrOperations } from './qrRaster';

export type PrintOperation = { name: string; args: unknown[]; section?: string };

const PORTABLE_RASTER_PAUSE_MS = 300;

export function withoutUnsupportedFont(
  operations: PrintOperation[],
  error: unknown,
): PrintOperation[] | null {
  const message = error instanceof Error ? error.message : String(error);
  if (!/operaci[oó]n no soportada:\s*font/i.test(message)) return null;
  return operations.filter(operation => operation.name !== 'font');
}

export function partitionPortableRasterJob(
  settings: Pick<PrinterSettings, 'paperWidth'>,
  operations: PrintOperation[],
): PrintOperation[][] {
  if (settings.paperWidth !== '58') return [operations];

  const jobs: PrintOperation[][] = [];
  let pending: PrintOperation[] = [];

  for (const operation of operations) {
    const isQrBand = operation.name === 'imageRaster'
      && Boolean(operation.section?.startsWith('qr'));
    if (!isQrBand) {
      pending.push(operation);
      continue;
    }

    if (pending.length) jobs.push(pending);
    jobs.push([operation]);
    pending = [];
  }

  if (pending.length) jobs.push(pending);
  return jobs.length ? jobs : [operations];
}

export async function sendPrintOperations(
  settings: PrinterSettings,
  operations: PrintOperation[],
): Promise<void> {
  const preparedOperations = prepare58MmQrOperations(settings.paperWidth, operations);
  const jobs = partitionPortableRasterJob(settings, preparedOperations);
  for (let index = 0; index < jobs.length; index += 1) {
    try {
      await requestPrintAgent(settings, '/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer: settings.printer, operations: jobs[index] }),
      });
    } catch (error) {
      const compatibleOperations = withoutUnsupportedFont(jobs[index], error);
      if (!compatibleOperations) throw error;
      await requestPrintAgent(settings, '/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer: settings.printer, operations: compatibleOperations }),
      });
    }
    if (jobs.length > 1 && index < jobs.length - 1) {
      await new Promise(resolve => window.setTimeout(resolve, PORTABLE_RASTER_PAUSE_MS));
    }
  }
}

export async function sendSilentPrint(operations: PrintOperation[]): Promise<'printed' | 'disabled'> {
  const settings = loadPrinterSettings();
  if (!settings.enabled || !settings.printer) return 'disabled';
  await sendPrintOperations(settings, operations);
  return 'printed';
}
