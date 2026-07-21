import type { BillingEmpresa, ThermalLogoRaster, WorkshopOrder, WorkshopTicketSettings } from '@stelfaro/api-client';
import { fixedQrWidth, loadPrinterSettings } from '../printing/printerSettings';
import type { PrintOperation } from '../printing/printJob';

const money = (value: number | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

export async function workshopReceptionTicket(
  orders: WorkshopOrder[],
  company?: BillingEmpresa | null,
  ticketSettings: WorkshopTicketSettings = { receipt_copies: 2, print_equipment_label: true, terms: '' },
  deviceAccesses: Record<number, { url: string; pin: string } | null> = {},
  preparedLogo?: ThermalLogoRaster | null,
): Promise<PrintOperation[]> {
  if (!orders.length) return [];
  const settings = loadPrinterSettings();
  const separator = '-'.repeat(settings.paperWidth === '58' ? 32 : 48);
  const primary = orders[0];
  const branch = company?.sucursales?.find(item => item.id === primary.branch?.id) ?? company?.sucursales?.[0];
  const logo = settings.showLogo && preparedLogo
    ? { name: 'imageRaster', args: [preparedLogo.width, preparedLogo.height, preparedLogo.data, 0] } satisfies PrintOperation
    : null;
  const copies = ticketSettings.receipt_copies === 1 ? ['COPIA CLIENTE'] : ['COPIA CLIENTE', 'COPIA TALLER'];
  const operations: PrintOperation[] = [];

  for (const copyLabel of copies) {
    operations.push(...receptionCopy({ orders, company, branch, copyLabel, separator, terms: ticketSettings.terms, deviceAccesses: copyLabel === 'COPIA TALLER' ? deviceAccesses : {}, logo, showIssuerDetails: settings.showIssuerDetails }));
    operations.push({ name: 'cut', args: [settings.cutLines] });
  }

  if (ticketSettings.print_equipment_label) {
    for (const order of orders) {
      const access = deviceAccesses[order.id];
      if (!access?.url) continue;
      const identifiers = identifiersFor(order);
      operations.push(
        { name: 'init', args: [] },
        { name: 'align', args: ['center'] },
        { name: 'bold', args: [true] },
        { name: 'text', args: ['ETIQUETA DEL EQUIPO\n'] },
        { name: 'size', args: [2, 2] },
        { name: 'text', args: [`${order.ticket}\n`] },
        { name: 'size', args: [1, 1] },
        { name: 'bold', args: [true] },
        { name: 'text', args: [`${order.reception.equipment_label.toUpperCase()}\n`] },
        { name: 'bold', args: [false] },
        { name: 'text', args: [`${order.device.brand} ${order.device.model}\n${identifiers[0] || 'Sin identificador visible'}\n`] },
        { name: 'qr', args: [access.url, fixedQrWidth(settings.paperWidth), 1, 0] },
        { name: 'text', args: [`\nAcceso móvil seguro del taller\n${ticketSettings.receipt_copies === 2 ? 'El PIN se encuentra en la copia del taller.' : 'El PIN está disponible en la recepción.'}\n`] },
        { name: 'cut', args: [settings.cutLines] },
      );
    }
  }

  return operations;
}

type CopyContext = {
  orders: WorkshopOrder[];
  company?: BillingEmpresa | null;
  branch?: BillingEmpresa['sucursales'][number];
  copyLabel: string;
  separator: string;
  terms: string;
  deviceAccesses: Record<number, { url: string; pin: string } | null>;
  logo: PrintOperation | null;
  showIssuerDetails: boolean;
};

function receptionCopy(context: CopyContext): PrintOperation[] {
  const { orders, company, branch, copyLabel, separator, terms, deviceAccesses, logo, showIssuerDetails } = context;
  const primary = orders[0];
  const estimate = orders.reduce((total, order) => total + Number(order.estimated_total || 0), 0);
  const advance = orders.reduce((total, order) => total + Math.max(0, Number(order.paid_total || 0) - Number(order.refunded_total || 0)), 0);
  const operations: PrintOperation[] = [{ name: 'init', args: [] }, { name: 'align', args: ['center'] }];
  if (logo) operations.push({ name: logo.name, args: [...logo.args] }, { name: 'text', args: ['\n'] });
  if (showIssuerDetails && company) {
    operations.push(
      { name: 'bold', args: [true] },
      { name: 'text', args: [`${company.nombre_comercial || company.razon_social}\n`] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [`${company.desc_actividad || ''}\nNIT: ${formatIdentity(company.nit)}\n${company.nrc ? `NRC: ${formatNrc(company.nrc)}\n` : ''}${branch?.direccion ? `${branch.direccion}\n` : ''}${branch?.telefono ? `Tel: ${branch.telefono}\n` : ''}${branch?.email ? `${branch.email}\n` : ''}`] },
    );
  }
  operations.push(
    { name: 'text', args: [`${separator}\n`] },
    { name: 'bold', args: [true] },
    { name: 'text', args: [`${copyLabel}\n`] },
    { name: 'text', args: ['COMPROBANTE DE RECEPCIÓN\n'] },
    { name: 'size', args: [2, 2] },
    { name: 'text', args: [`${primary.ticket}\n`] },
    { name: 'size', args: [1, 1] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`Ingreso: ${formatDate(primary.received_at)}\nEquipos recibidos: ${orders.length}\n${separator}\n`] },
    { name: 'align', args: ['left'] },
    { name: 'bold', args: [true] },
    { name: 'text', args: ['CLIENTE\n'] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`${primary.customer.name}\n${primary.customer.phone ? `Tel: ${primary.customer.phone}\n` : ''}${separator}\n`] },
  );

  for (const order of orders) {
    const identifiers = identifiersFor(order);
    const condition = [order.physical_condition, ...(order.physical_conditions || []), ...(order.accessories || [])].filter(Boolean).join(' · ');
    const functionalTests = Object.entries(order.device.functional_tests || {}).map(([test, result]) => `${testLabel(test)}: ${resultLabel(result)}`);
    operations.push(
      { name: 'bold', args: [true] },
      { name: 'text', args: [`${order.reception.equipment_label.toUpperCase()}\n`] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [`${deviceTypeLabel(order.device.type)} · ${order.device.brand} ${order.device.model}\n${order.device.color ? `Color: ${order.device.color}\n` : ''}${identifiers.length ? `${identifiers.join('\n')}\n` : 'Identificador: No visible\n'}Encendido: ${powerLabel(order.device.power_status)}\n${functionalTests.length ? `${functionalTests.join('\n')}\n` : ''}`] },
      { name: 'bold', args: [true] },
      { name: 'text', args: ['Falla reportada: '] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [`${order.reported_fault}\n`] },
      { name: 'text', args: [`${condition ? `Condición: ${condition}\n` : ''}Acceso registrado: ${order.device.has_access_secret ? 'Sí' : 'No'}\nEstimado: ${money(order.estimated_total)} · Anticipo: ${money(Math.max(0, Number(order.paid_total || 0) - Number(order.refunded_total || 0)))}\n${separator}\n`] },
    );
  }

  operations.push(
    { name: 'bold', args: [true] },
    { name: 'text', args: ['VALORES REGISTRADOS\n'] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`Monto estimado: ${money(estimate)}\nAnticipo recibido: ${money(advance)}\nSaldo estimado: ${money(Math.max(0, estimate - advance))}\n${separator}\n`] },
    { name: 'align', args: ['center'] },
    { name: 'text', args: ['El diagnóstico y el valor final serán confirmados antes de realizar trabajos adicionales.\n'] },
  );

  const termsList = terms.split(/\n\s*\n/).map(term => term.trim()).filter(Boolean);
  if (termsList.length) {
    operations.push(
      { name: 'align', args: ['left'] },
      { name: 'text', args: [`${separator}\n`] },
      { name: 'bold', args: [true] },
      { name: 'text', args: ['TÉRMINOS Y CONDICIONES\n'] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [termsList.map((term, index) => `${index + 1}. ${term}`).join('\n') + '\n'] },
    );
  }

  operations.push({ name: 'align', args: ['center'] }, { name: 'text', args: ['\nFIRMA: ___________________________\n'] });

  const pins = orders.map(order => deviceAccesses[order.id]?.pin ? `${order.reception.equipment_label}: ${deviceAccesses[order.id]?.pin}` : '').filter(Boolean);
  if (pins.length) {
    operations.push(
      { name: 'text', args: [`${separator}\n`] },
      { name: 'bold', args: [true] },
      { name: 'text', args: [`PINES DEL TALLER\n${pins.join('\n')}\n`] },
      { name: 'bold', args: [false] },
      { name: 'text', args: ['Requerido para el acceso móvil seguro.\n'] },
    );
  }

  operations.push(
    { name: 'bold', args: [true] },
    { name: 'text', args: ['\nConserve este comprobante de recepción.\n'] },
    { name: 'bold', args: [false] },
  );
  return operations;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' });
}

function identifiersFor(order: WorkshopOrder): string[] {
  return [order.device.imei ? `IMEI: ${order.device.imei}` : '', order.device.serial_number ? `Serie: ${order.device.serial_number}` : ''].filter(Boolean);
}

function powerLabel(value: string): string {
  return ({ on: 'Enciende', off: 'No enciende', not_tested: 'No comprobado', unknown: 'No comprobado' } as Record<string, string>)[value] || value || 'No comprobado';
}

function deviceTypeLabel(value: string): string {
  return ({ phone: 'Celular', tablet: 'Tablet', console: 'Consola', laptop: 'Laptop', controller: 'Mando', instrument: 'Instrumento' } as Record<string, string>)[value] || value;
}

function testLabel(value: string): string {
  return ({ display: 'Imagen', touch: 'Touch / controles', charging: 'Carga', cameras: 'Cámaras', audio: 'Audio', microphone: 'Micrófono' } as Record<string, string>)[value] || value;
}

function resultLabel(value: string): string {
  return ({ passed: 'Funciona', failed: 'Falla', not_tested: 'No probado' } as Record<string, string>)[value] || value;
}

function formatIdentity(value: string): string {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.length === 14 ? `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}` : value;
}

function formatNrc(value: string): string {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.length >= 2 ? `${digits.slice(0, -1)}-${digits.slice(-1)}` : value;
}
