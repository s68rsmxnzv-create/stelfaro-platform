import { describe, expect, it } from 'vitest';
import type { DteThermalArtifact } from '@stelfaro/api-client';
import { dteFiscalTicketFromArtifact } from '../../../packages/billing/src/printing/dteFiscalTicket';

describe('dteFiscalTicketFromArtifact', () => {
  it('prints the conserved fiscal representation instead of a workshop closure receipt', () => {
    const artifact = {
      format: 'stelfaro-dte-thermal',
      version: 1,
      documentId: 730,
      numeroControl: 'DTE-01-M001P001-000000000000175',
      codigoGeneracion: '0CFBC22C-D7A8-4EFC-A9D2-1B3ECB33F547',
      profiles: {
        '58': { paperWidth: 58, widthChars: 32, operations: [{ name: 'text', args: ['FACTURA ELECTRONICA\nJosé Hernández\nTOTAL $75.00\n'] }] },
        '80': { paperWidth: 80, widthChars: 48, operations: [{ name: 'text', args: ['FACTURA ELECTRONICA\nJosé Hernández\nTOTAL $75.00\n'] }, { name: 'qr', args: ['https://example.test/dte', 280, 1, 0] }] },
      },
    } satisfies DteThermalArtifact;

    const operations = dteFiscalTicketFromArtifact(artifact);
    const printedText = operations.filter(({ name }) => name === 'text').flatMap(({ args }) => args).join('');

    expect(printedText).toContain('FACTURA ELECTRONICA');
    expect(printedText).toContain('José Hernández');
    expect(printedText).toContain('TOTAL $75.00');
    expect(printedText).not.toContain('ORDEN CERRADA');
    expect(operations.at(-1)).toMatchObject({ name: 'cut' });
  });
});
