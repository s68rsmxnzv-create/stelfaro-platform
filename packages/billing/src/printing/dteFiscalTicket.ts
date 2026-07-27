import type { DteThermalArtifact } from '@stelfaro/api-client';
import { loadPrinterSettings } from './printerSettings';
import type { PrintOperation } from './printJob';
import { splitRasterIntoBands } from './rasterBands';

export function dteFiscalTicketFromArtifact(artifact: DteThermalArtifact, openDrawer = false): PrintOperation[] {
  const settings = loadPrinterSettings();
  const profile = artifact.profiles[settings.paperWidth] ?? artifact.profiles['80'] ?? artifact.profiles['58'];
  if (!profile) throw new Error('El comprobante no contiene una plantilla térmica compatible.');

  const operations = profile.operations
    .filter(({ name, section }) => (settings.qrEnabled || (name !== 'qr' && section !== 'qr_pair'))
      && (settings.showLogo || section !== 'logo')
      && (settings.showIssuerDetails || section !== 'issuer'))
    .flatMap(({ name, args, section }) => {
      const operation = {
        name,
        args: name === 'text'
          ? args.map(value => typeof value === 'string' ? value.replace(/Representaci[oó]n gr[aá]fica de DTE\.?\n?/giu, '') : value)
          : [...args],
        ...(section ? { section } : {}),
      } as PrintOperation;

      const rasterBytes = name === 'imageRaster' ? atob(String(operation.args[2] || '')).length : 0;
      return settings.paperWidth === '58' && name === 'imageRaster' && section === 'qr_pair' && rasterBytes > 4096
        ? splitRasterIntoBands(operation)
        : [operation];
    });
  if (openDrawer && settings.openDrawer) operations.push({ name: 'openDrawer', args: [0, 25, 250] });
  operations.push({ name: 'cut', args: [settings.cutLines] });

  return operations;
}
