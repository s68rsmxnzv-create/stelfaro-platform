import type { WorkshopOrder } from '@stelfaro/api-client';
import { loadPrinterSettings } from '../printing/printerSettings';
import type { PrintOperation } from '../printing/printJob';

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;
export function workshopClosedTicket(order: WorkshopOrder, openDrawer = false): PrintOperation[] {
  const settings = loadPrinterSettings(); const total = order.financial.final_total ?? order.estimated_total ?? 0; const paid = order.paid_total - order.refunded_total; const pending = Math.max(0, order.balance);
  const operations: PrintOperation[] = [
    { name: 'init', args: [] }, { name: 'align', args: ['center'] }, { name: 'bold', args: [true] }, { name: 'size', args: [2, 2] }, { name: 'text', args: ['ORDEN CERRADA\n'] }, { name: 'size', args: [1, 1] }, { name: 'text', args: [`${order.ticket}\n`] }, { name: 'bold', args: [false] }, { name: 'text', args: ['COMPROBANTE COMERCIAL NO FISCAL\n--------------------------------\n'] }, { name: 'align', args: ['left'] },
    { name: 'text', args: [`Cliente: ${order.customer.name}\nEquipo: ${order.device.type} ${order.device.brand} ${order.device.model}\nFalla: ${order.reported_fault}\nCierre: ${new Date(order.financial.closed_at || Date.now()).toLocaleString('es-SV')}\n--------------------------------\n`] }, { name: 'bold', args: [true] }, { name: 'text', args: [`TOTAL: ${money(total)}\nRECIBIDO: ${money(paid)}\nSALDO PENDIENTE: ${money(pending)}\n`] }, { name: 'bold', args: [false] }, { name: 'align', args: ['center'] }, { name: 'text', args: [pending > 0 ? 'ENTREGADO CON SALDO PENDIENTE\n' : 'PAGADO\n'] }, { name: 'text', args: ['Conserve este comprobante.\n'] },
  ];
  if (openDrawer && settings.openDrawer) operations.push({ name: 'openDrawer', args: [0, 25, 250] });
  operations.push({ name: 'cut', args: [settings.cutLines] }); return operations;
}
