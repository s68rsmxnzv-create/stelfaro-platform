import { describe, expect, it } from 'vitest';
import type { DteDraftSummary } from '@stelfaro/api-client';
import { dteFiscalTicket } from '../../../packages/billing/src/printing/dteFiscalTicket';

describe('dteFiscalTicket', () => {
  it('prints the accepted fiscal document instead of a workshop closure receipt', () => {
    const document = {
      id: 730,
      estado: 'accepted',
      tipoDte: '01',
      ambiente: '00',
      numeroControl: 'DTE-01-M001P001-000000000000175',
      codigoGeneracion: '0CFBC22C-D7A8-4EFC-A9D2-1B3ECB33F547',
      selloRecibido: 'SELLO-MH',
      totalPagar: 75,
      dte_json: {
        identificacion: { tipoDte: '01', ambiente: '00', fecEmi: '2026-07-20', horEmi: '12:45:38' },
        emisor: { nombreComercial: 'SERVICIO TECNICO EL FARO' },
        receptor: { nombre: 'Cliente de prueba', numDocumento: '01234567-8' },
        cuerpoDocumento: [{ cantidad: 1, descripcion: 'Cambio de pantalla - Samsung A14', ventaGravada: 75 }],
        resumen: { totalPagar: 75 },
      },
    } satisfies DteDraftSummary;

    const operations = dteFiscalTicket(document);
    const printedText = operations.filter(({ name }) => name === 'text').flatMap(({ args }) => args).join('');
    const qr = operations.find(({ name }) => name === 'qr');

    expect(printedText).toContain('FACTURA ELECTRONICA');
    expect(printedText).toContain(document.numeroControl);
    expect(printedText).toContain('Cambio de pantalla - Samsung A14');
    expect(printedText).toContain('TOTAL $75.00');
    expect(printedText).toContain('SELLO-MH');
    expect(printedText).not.toContain('ORDEN CERRADA');
    expect(qr?.args[0]).toContain(encodeURIComponent(document.codigoGeneracion));
  });
});
