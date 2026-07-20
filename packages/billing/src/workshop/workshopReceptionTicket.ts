import type { BillingEmpresa, WorkshopOrder } from '@stelfaro/api-client';
import { loadPrinterSettings } from '../printing/printerSettings';
import type { PrintOperation } from '../printing/printJob';

const money = (value: number | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

export async function workshopReceptionTicket(
  order: WorkshopOrder,
  company?: BillingEmpresa | null,
  photoUrl?: string | null,
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
  const operations: PrintOperation[] = [
    { name: 'init', args: [] },
    { name: 'align', args: ['center'] },
  ];

  if (settings.showLogo && company?.logo_url) {
    const logo = await rasterizeLogo(company.logo_url, settings.paperWidth === '58' ? 240 : 320).catch(() => null);
    if (logo) operations.push(logo);
  }

  if (settings.showIssuerDetails && company) {
    operations.push(
      { name: 'bold', args: [true] },
      { name: 'text', args: [`${company.nombre_comercial || company.razon_social}\n`] },
      { name: 'bold', args: [false] },
      { name: 'text', args: [
        `${company.desc_actividad || ''}\nNIT: ${formatIdentity(company.nit)}\n${company.nrc ? `NRC: ${formatNrc(company.nrc)}\n` : ''}${branch?.direccion ? `${branch.direccion}\n` : ''}${branch?.telefono ? `Tel: ${branch.telefono}\n` : ''}${branch?.email ? `${branch.email}\n` : ''}`,
      ] },
    );
  }

  operations.push(
    { name: 'text', args: [`${separator}\n`] },
    { name: 'bold', args: [true] },
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

  if (settings.qrEnabled && photoUrl) {
    operations.push(
      { name: 'text', args: ['\nAgregar fotografías del equipo\n'] },
      { name: 'qr', args: [photoUrl, settings.qrWidth, 1, 0] },
    );
  }

  operations.push(
    { name: 'text', args: ['\nConserve este comprobante de recepción.\n'] },
    { name: 'cut', args: [settings.cutLines] },
  );
  return operations;
}

async function rasterizeLogo(url: string, maxWidth: number): Promise<PrintOperation> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('No fue posible cargar el logo.');
  const bitmap = await createImageBitmap(await response.blob());
  const width = Math.max(8, Math.floor(Math.min(maxWidth, bitmap.width) / 8) * 8);
  const height = Math.max(1, Math.round(bitmap.height * (width / bitmap.width)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No fue posible preparar el logo.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  const bytes = new Uint8Array((width / 8) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const luminance = pixels[pixel] * 0.299 + pixels[pixel + 1] * 0.587 + pixels[pixel + 2] * 0.114;
      if (pixels[pixel + 3] > 32 && luminance < 175) bytes[y * (width / 8) + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { name: 'imageRaster', args: [width, height, window.btoa(binary), 0] };
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
