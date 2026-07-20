import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkshopOrder } from '@stelfaro/api-client';
import { workshopReceptionTicket } from '../../../packages/billing/src/workshop/workshopReceptionTicket';

describe('workshopReceptionTicket', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds a complete reception ticket and applies the configured QR size', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify({ showLogo: true, qrWidth: 280, cutLines: 6 }),
      },
    });
    const order = {
      id: 12,
      ticket: 'T-000012',
      status: 'received',
      priority: 'normal',
      reported_fault: 'No carga',
      physical_condition: null,
      physical_conditions: ['Rayones leves'],
      accessories: ['Protector'],
      diagnosis: null,
      estimated_total: 35,
      paid_total: 10,
      refunded_total: 0,
      balance: 25,
      received_at: '2026-07-20T10:30:00-06:00',
      photo_count: 0,
      financial: { status: 'pending', final_total: null, closed_at: null },
      billing: { status: 'unbilled', dte_type: null, core_document_id: null, number: null, generation_code: null, invoiced_at: null },
      approval: { decision: null, method: null, notes: null, decided_at: null },
      customer: { id: 1, name: 'Andrea Hernández', phone: '7000-0000' },
      device: { id: 2, type: 'Celular', brand: 'Demo', model: '2026', color: null, imei: '123456789012347', serial_number: null, identifier_not_visible: false, power_status: 'on', functional_tests: {}, is_locked: true, access_type: 'pattern', has_access_secret: true },
    } satisfies WorkshopOrder;

    const operations = await workshopReceptionTicket(
      order,
      null,
      { receipt_copies: 2, print_equipment_label: true, terms: 'El diagnóstico debe aprobarse.\n\nConserve su comprobante.' },
      { url: 'https://example.test/device', pin: '654321' },
      { width: 240, height: 80, data: 'AA==' },
    );
    const text = operations.filter(({ name }) => name === 'text').flatMap(({ args }) => args).join('');

    expect(text).toContain('COMPROBANTE DE RECEPCIÓN');
    expect(text).toContain('Andrea Hernández');
    expect(text).toContain('No carga');
    expect(text).toContain('Anticipo recibido: $10.00');
    expect(text).toContain('COPIA CLIENTE');
    expect(text).toContain('COPIA TALLER');
    expect(text).toContain('PIN TALLER: 654321');
    expect(text).toContain('TÉRMINOS Y CONDICIONES');
    expect(text).toContain('ETIQUETA DEL EQUIPO');
    expect(text).not.toContain('pattern');
    expect(text).not.toContain('Agregar fotografías del equipo');
    expect(operations.filter(({ name }) => name === 'qr')).toEqual([{ name: 'qr', args: ['https://example.test/device', 280, 1, 0] }]);
    expect(operations.filter(({ name }) => name === 'imageRaster')).toHaveLength(2);
    expect(operations.filter(({ name }) => name === 'cut').every(({ args }) => args[0] === 6)).toBe(true);

    const footerIndexes = operations.flatMap((operation, index) => operation.name === 'text' && String(operation.args[0]).includes('Conserve este comprobante') ? [index] : []);
    expect(footerIndexes).toHaveLength(2);
    footerIndexes.forEach((index) => {
      expect(operations[index - 1]).toEqual({ name: 'bold', args: [true] });
      expect(operations[index + 1]).toEqual({ name: 'bold', args: [false] });
      expect(operations.slice(index + 1).find(({ name }) => name === 'cut')).toBeTruthy();
    });
  });
});
