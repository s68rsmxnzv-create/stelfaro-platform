import { describe, expect, it } from 'vitest';
import type { WorkshopOrder } from '@stelfaro/api-client';
import { workshopReceptionTicket } from '../../../packages/billing/src/workshop/workshopReceptionTicket';

describe('workshopReceptionTicket', () => {
  it('builds a complete reception ticket and applies the configured QR size', async () => {
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

    const operations = await workshopReceptionTicket(order, null, 'https://example.test/photos');
    const text = operations.filter(({ name }) => name === 'text').flatMap(({ args }) => args).join('');

    expect(text).toContain('COMPROBANTE DE RECEPCIÓN');
    expect(text).toContain('Andrea Hernández');
    expect(text).toContain('No carga');
    expect(text).toContain('Anticipo recibido: $10.00');
    expect(text).not.toContain('pattern');
    expect(operations.find(({ name }) => name === 'qr')?.args).toEqual(['https://example.test/photos', 280, 1, 0]);
  });
});
