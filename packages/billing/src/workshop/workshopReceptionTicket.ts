import type { BillingEmpresa, ThermalLogoRaster, WorkshopOrder, WorkshopTicketSettings } from '@stelfaro/api-client';
import { loadPrinterSettings } from '../printing/printerSettings';
import type { PrintOperation } from '../printing/printJob';

const money = (value: number | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

export async function workshopReceptionTicket(
  order: WorkshopOrder,
  company?: BillingEmpresa | null,
  ticketSettings: WorkshopTicketSettings = { receipt_copies: 2, print_equipment_label: true, terms: '' },
  deviceAccess?: { url: string; pin: string } | null,
  preparedLogo?: ThermalLogoRaster | null,
): Promise<PrintOperation[]> {
  const settings = loadPrinterSettings();
  const separator = '-'.repeat(settings.paperWidth === '58' ? 32 : 48);
  const branch = company?.sucursales?.[0];
  const estimate = Number(order.estimated_total || 0);
  const advance = Math.max(0, Number(order.paid_total || 0) - Number(order.refunded_total || 0));
  const identifiers = [
    order.device.imei ? `IMEI: ${order.device.imei}` : '',
    order.device.serial_number ? `Serie: ${order.device.serial_number}` : '',
  ].filter(Boolean);
  const condition = [order.physical_condition, ...(order.physical_conditions || []), ...(order.accessories || [])].filter(Boolean).join(' · ');
  const functionalTests = Object.entries(order.device.functional_tests || {}).map(([test, result]) => `${testLabel(test)}: ${resultLabel(result)}`);
  const logo = settings.showLogo && preparedLogo
    ? { name: 'imageRaster', args: [preparedLogo.width, preparedLogo.height, preparedLogo.data, 0] } satisfies PrintOperation
    : null;
  const copies = ticketSettings.receipt_copies === 1 ? ['COPIA CLIENTE'] : ['COPIA CLIENTE', 'COPIA TALLER'];
  const operations: PrintOperation[] = [];

  for (const copyLabel of copies) {
    operations.push(...receptionCopy({ order, company, branch, copyLabel, separator, estimate, advance, identifiers, condition, functionalTests, terms: ticketSettings.terms, workshopPin: copyLabel === 'COPIA TALLER' ? deviceAccess?.pin : null, logo, showIssuerDetails: settings.showIssuerDetails }));
    operations.push({ name: 'cut', args: [settings.cutLines] });
  }

  if (ticketSettings.print_equipment_label && deviceAccess?.url) {
    operations.push(
      { name: 'init', args: [] },
      { name: 'align', args: ['center'] },
      { name: 'bold', args: [true] },
      { name: 'text', args: ['ETIQUETA DEL EQUIPO\n'] },
      { name: 'size', args: [2, 2] },
      { name: 'text', args: [`${order.ticket}\n`] },
      { name: 'size', args: [1, 1] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [`${order.device.brand} ${order.device.model}\n${identifiers[0] || 'Sin identificador visible'}\n`] },
      { name: 'qr', args: [deviceAccess.url, settings.qrWidth, 1, 0] },
      { name: 'text', args: [`\nAcceso móvil seguro del taller\n${ticketSettings.receipt_copies === 2 ? 'El PIN se encuentra en la copia del taller.' : 'El PIN está disponible en la recepción.'}\n`] },
      { name: 'cut', args: [settings.cutLines] },
    );
  }

  return operations;
}

type CopyContext = {
  order: WorkshopOrder;
  company?: BillingEmpresa | null;
  branch?: BillingEmpresa['sucursales'][number];
  copyLabel: string;
  separator: string;
  estimate: number;
  advance: number;
  identifiers: string[];
  condition: string;
  functionalTests: string[];
  terms: string;
  workshopPin?: string | null;
  logo: PrintOperation | null;
  showIssuerDetails: boolean;
};

function receptionCopy(context: CopyContext): PrintOperation[] {
  const { order, company, branch, copyLabel, separator, estimate, advance, identifiers, condition, functionalTests, terms, workshopPin, logo, showIssuerDetails } = context;
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
    { name: 'text', args: [`${order.ticket}\n`] },
    { name: 'size', args: [1, 1] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`Ingreso: ${formatDate(order.received_at)}\n${separator}\n`] },
    { name: 'align', args: ['left'] },
    { name: 'bold', args: [true] },
    { name: 'text', args: ['CLIENTE\n'] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`${order.customer.name}\n${order.customer.phone ? `Tel: ${order.customer.phone}\n` : ''}${separator}\n`] },
    { name: 'bold', args: [true] },
    { name: 'text', args: ['EQUIPO RECIBIDO\n'] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`${deviceTypeLabel(order.device.type)} · ${order.device.brand} ${order.device.model}\n${order.device.color ? `Color: ${order.device.color}\n` : ''}${identifiers.length ? `${identifiers.join('\n')}\n` : 'Identificador: No visible\n'}Encendido: ${powerLabel(order.device.power_status)}\n${functionalTests.length ? `${functionalTests.join('\n')}\n` : ''}${separator}\n`] },
    { name: 'bold', args: [true] },
    { name: 'text', args: ['FALLA REPORTADA\n'] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`${order.reported_fault}\n${separator}\n`] },
  );

  if (condition || order.device.has_access_secret) {
    operations.push(
      { name: 'bold', args: [true] },
      { name: 'text', args: ['CONDICIÓN Y ACCESORIOS\n'] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [`${condition || 'Sin detalles adicionales.'}\nAcceso registrado para revisión: ${order.device.has_access_secret ? 'Sí' : 'No'}\n${separator}\n`] },
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

  if (workshopPin) {
    operations.push(
      { name: 'text', args: [`${separator}\n`] },
      { name: 'bold', args: [true] },
      { name: 'text', args: [`PIN TALLER: ${workshopPin}\n`] },
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
