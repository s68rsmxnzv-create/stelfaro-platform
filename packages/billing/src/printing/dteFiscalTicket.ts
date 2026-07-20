import type { DteDraftSummary } from '@stelfaro/api-client';
import { loadPrinterSettings } from './printerSettings';
import type { PrintOperation } from './printJob';

type JsonRecord = Record<string, unknown>;

const documentLabels: Record<string, string> = {
  '01': 'FACTURA ELECTRONICA',
  '03': 'COMPROBANTE DE CREDITO FISCAL',
  '05': 'NOTA DE CREDITO',
  '06': 'NOTA DE DEBITO',
  '14': 'FACTURA DE SUJETO EXCLUIDO',
};

const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const list = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.map(record) : [];
const text = (value: unknown): string => value === null || value === undefined ? '' : String(value).trim();
const number = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value: unknown): string => `$${number(value).toFixed(2)}`;

export function dteFiscalTicket(document: DteDraftSummary, openDrawer = false): PrintOperation[] {
  const settings = loadPrinterSettings();
  const payload = record(document.dte_json ?? document.payload);
  const identification = record(payload.identificacion);
  const issuer = record(payload.emisor);
  const receiver = record(payload.receptor ?? payload.sujetoExcluido);
  const summary = record(payload.resumen);
  const items = list(payload.cuerpoDocumento);
  const date = text(identification.fecEmi) || formatDate(document.processed_at ?? document.created_at);
  const time = text(identification.horEmi);
  const documentType = text(identification.tipoDte) || document.tipoDte;
  const numberControl = document.numeroControl || text(identification.numeroControl);
  const generationCode = document.codigoGeneracion || text(identification.codigoGeneracion);
  const seal = document.selloRecibido || text(document.transmission?.receipt_stamp);
  const total = summary.totalPagar ?? document.totalPagar ?? 0;
  const operations: PrintOperation[] = [
    { name: 'init', args: [] },
    { name: 'align', args: ['center'] },
    { name: 'bold', args: [true] },
    { name: 'size', args: [2, 2] },
    { name: 'text', args: [`${text(issuer.nombreComercial) || text(issuer.nombre) || document.empresa?.nombre_comercial || 'COMPROBANTE'}\n`] },
    { name: 'size', args: [1, 1] },
    { name: 'text', args: [`${documentLabels[documentType] || `DTE ${documentType}`}\n`] },
    { name: 'bold', args: [false] },
    { name: 'text', args: [`${numberControl}\n`] },
    { name: 'text', args: [`Fecha: ${date}${time ? ` ${time}` : ''}\n`] },
    { name: 'text', args: ['--------------------------------\n'] },
    { name: 'align', args: ['left'] },
  ];

  if (text(receiver.nombre)) operations.push({ name: 'text', args: [`Cliente: ${text(receiver.nombre)}\n`] });
  const receiverDocument = text(receiver.numDocumento) || text(receiver.nit);
  if (receiverDocument) operations.push({ name: 'text', args: [`Documento: ${receiverDocument}\n`] });
  operations.push({ name: 'text', args: ['--------------------------------\n'] });

  for (const item of items) {
    const quantity = number(item.cantidad);
    const description = text(item.descripcion);
    const lineTotal = number(item.ventaGravada) + number(item.ventaExenta) + number(item.ventaNoSuj) + number(item.noGravado);
    operations.push({ name: 'text', args: [`${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} x ${description}\n`] });
    operations.push({ name: 'align', args: ['right'] });
    operations.push({ name: 'text', args: [`${money(lineTotal || quantity * number(item.precioUni))}\n`] });
    operations.push({ name: 'align', args: ['left'] });
  }

  operations.push(
    { name: 'text', args: ['--------------------------------\n'] },
    { name: 'align', args: ['right'] },
    { name: 'bold', args: [true] },
    { name: 'size', args: [2, 2] },
    { name: 'text', args: [`TOTAL ${money(total)}\n`] },
    { name: 'size', args: [1, 1] },
    { name: 'bold', args: [false] },
    { name: 'align', args: ['center'] },
    { name: 'text', args: ['Codigo de generacion:\n'] },
    { name: 'text', args: [`${generationCode}\n`] },
    { name: 'text', args: ['Sello de recepcion MH:\n'] },
    { name: 'text', args: [`${seal}\n`] },
  );

  const queryUrl = publicQueryUrl(document, identification, date);
  if (settings.qrEnabled && queryUrl) {
    operations.push({ name: 'qr', args: [queryUrl, settings.qrWidth, 1, 0] });
  }
  operations.push({ name: 'text', args: ['Documento Tributario Electronico\nConserve este comprobante.\n'] });
  if (openDrawer && settings.openDrawer) operations.push({ name: 'openDrawer', args: [0, 25, 250] });
  operations.push({ name: 'cut', args: [settings.cutLines] });

  return operations;
}

function publicQueryUrl(document: DteDraftSummary, identification: JsonRecord, date: string): string {
  const generationCode = document.codigoGeneracion || text(identification.codigoGeneracion);
  if (!generationCode || !date) return '';
  const params = new URLSearchParams({
    ambiente: text(identification.ambiente) || document.ambiente,
    codGen: generationCode.toUpperCase(),
    fechaEmi: date,
  });
  return `https://admin.factura.gob.sv/consultaPublica?${params.toString()}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });
}
