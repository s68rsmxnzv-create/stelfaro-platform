import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DteThermalArtifact } from '@stelfaro/api-client';
import { dteFiscalTicketFromArtifact } from '../../../packages/billing/src/printing/dteFiscalTicket';

describe('dteFiscalTicketFromArtifact', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prints the conserved fiscal representation instead of a workshop closure receipt', () => {
    const artifact = {
      format: 'stelfaro-dte-thermal',
      version: 1,
      documentId: 730,
      numeroControl: 'DTE-01-M001P001-000000000000175',
      codigoGeneracion: '0CFBC22C-D7A8-4EFC-A9D2-1B3ECB33F547',
      profiles: {
        '58': { paperWidth: 58, widthChars: 32, operations: [{ name: 'text', args: ['FACTURA ELECTRONICA\nJosé Hernández\nTOTAL $75.00\n'] }] },
        '80': { paperWidth: 80, widthChars: 48, operations: [{ name: 'imageRaster', args: [8, 1, 'AA==', 0], section: 'logo' }, { name: 'text', args: ['EMPRESA DE PRUEBA\n'], section: 'issuer' }, { name: 'text', args: ['FACTURA ELECTRONICA\nJosé Hernández\nTOTAL $75.00\nRepresentacion grafica de DTE.\n'] }, { name: 'qr', args: ['https://example.test/dte', 252, 1, 0] }] },
      },
    } satisfies DteThermalArtifact;

    const operations = dteFiscalTicketFromArtifact(artifact);
    const printedText = operations.filter(({ name }) => name === 'text').flatMap(({ args }) => args).join('');

    expect(printedText).toContain('FACTURA ELECTRONICA');
    expect(printedText).toContain('José Hernández');
    expect(printedText).toContain('TOTAL $75.00');
    expect(printedText).toContain('EMPRESA DE PRUEBA');
    expect(printedText).not.toContain('ORDEN CERRADA');
    expect(printedText).not.toContain('Representacion grafica de DTE');
    expect(operations.some(({ name }) => name === 'imageRaster')).toBe(false);
    expect(operations.find(({ name }) => name === 'qr')?.args[1]).toBe(252);
    expect(operations.at(-1)).toMatchObject({ name: 'cut' });
  });

  it('splits only the 58 mm fiscal QR raster into buffer-safe bands', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify({ paperWidth: '58' }),
      },
    });
    const width = 376;
    const height = 180;
    const data = btoa('\0'.repeat((width / 8) * height));
    const artifact = {
      format: 'stelfaro-dte-thermal',
      version: 2,
      documentId: 731,
      numeroControl: 'DTE-01-M001P001-000000000000176',
      codigoGeneracion: 'D0403216-CEED-4612-B312-FC7CA319B6E9',
      profiles: {
        '58': { paperWidth: 58, widthChars: 32, operations: [{ name: 'imageRaster', args: [width, height, data, 0], section: 'qr_pair' }] },
        '80': { paperWidth: 80, widthChars: 48, operations: [] },
      },
    } satisfies DteThermalArtifact;

    const operations = dteFiscalTicketFromArtifact(artifact);
    const bands = operations.filter(({ name }) => name === 'imageRaster');

    expect(bands).toHaveLength(8);
    expect(bands.reduce((rows, { args }) => rows + Number(args[1]), 0)).toBe(height);
    expect(bands.every(({ args }) => args[0] === width && Number(args[1]) <= 24)).toBe(true);
  });
});
