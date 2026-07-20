import type { DteThermalArtifact } from '@stelfaro/api-client';
import { loadPrinterSettings } from './printerSettings';
import type { PrintOperation } from './printJob';

export function dteFiscalTicketFromArtifact(artifact: DteThermalArtifact, openDrawer = false): PrintOperation[] {
  const settings = loadPrinterSettings();
  const profile = artifact.profiles[settings.paperWidth] ?? artifact.profiles['80'] ?? artifact.profiles['58'];
  if (!profile) throw new Error('El comprobante no contiene una plantilla térmica compatible.');

  const operations = profile.operations
    .filter(({ name, section }) => (settings.qrEnabled || name !== 'qr')
      && (settings.showLogo || section !== 'logo')
      && (settings.showIssuerDetails || section !== 'issuer'))
    .map(({ name, args }) => ({
      name,
      args: name === 'qr' ? [args[0], settings.qrWidth, args[2] ?? 1, args[3] ?? 0] : [...args]
    }));
  if (openDrawer && settings.openDrawer) operations.push({ name: 'openDrawer', args: [0, 25, 250] });
  operations.push({ name: 'cut', args: [settings.cutLines] });

  return operations;
}
