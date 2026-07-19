import type { DteDraftSummary, PlatformInventorySaleFulfillment } from '@stelfaro/api-client';

export type BillingReplacementLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountPercent: number;
  catalogItemId: number | null;
  catalogSku: string | null;
  catalogName: string | null;
  lineOrigin: 'free' | 'catalog' | 'inventory';
  unitCode: string;
  taxable: boolean;
  controlsInventory: boolean;
  itemPriceIncludesIva: boolean;
  inventoryGlobalStock: number | null;
  inheritedFromSaleLineId: number | null;
  inheritedInventoryQuantity: number;
};

export type BillingReplacementPayment = {
  codigo: string;
  montoPago: number;
  referencia: string;
  plazo: string;
  periodo: number | null;
};

export type BillingReplacementDraft = {
  branchId: number | null;
  pointCode: string | null;
  customer: {
    name: string;
    documentType: string;
    document: string;
    nrc: string;
    activityCode: string;
    activityDescription: string;
    commercialName: string;
    department: string;
    municipality: string;
    district: string;
    address: string;
    phone: string;
    email: string;
  };
  lines: BillingReplacementLine[];
  paymentCondition: 1 | 2 | 3;
  payments: BillingReplacementPayment[];
};

export function buildBillingReplacementDraft(
  document: DteDraftSummary,
  fulfillment: PlatformInventorySaleFulfillment,
): BillingReplacementDraft {
  const payload = documentPayload(document);
  const receptor = record(payload.receptor);
  const address = record(receptor.direccion);
  const fiscalLines = Array.isArray(payload.cuerpoDocumento) ? payload.cuerpoDocumento.map(record) : [];
  const reservationByItem = new Map<number, number>();

  for (const line of fulfillment.reservation?.lines ?? []) {
    const itemId = Number(line.catalog_item_id);
    reservationByItem.set(itemId, roundStock(Number(reservationByItem.get(itemId) ?? 0) + Number(line.quantity || 0)));
  }

  const lines = fulfillment.sale.lines.map((saleLine, index): BillingReplacementLine => {
    const fiscalLine = fiscalLines[index] ?? {};
    const catalogItem = saleLine.catalog_item ?? null;
    const quantity = Number(saleLine.quantity || fiscalLine.cantidad || 1);
    const unitPrice = Number(saleLine.unit_price || fiscalLine.precioUni || 0);
    const gross = Math.max(0, quantity * unitPrice);
    const discount = Number(saleLine.discount_amount || 0);
    const canInherit = saleLine.line_origin === 'inventory'
      && Number(saleLine.catalog_item_id || 0) > 0
      && Number(reservationByItem.get(Number(saleLine.catalog_item_id)) ?? 0) >= quantity;

    return {
      description: String(saleLine.description_snapshot ?? fiscalLine.descripcion ?? `Linea ${index + 1}`),
      quantity,
      unitPrice,
      discount,
      discountPercent: gross > 0 ? Math.min(100, discount * 100 / gross) : 0,
      catalogItemId: saleLine.catalog_item_id,
      catalogSku: catalogItem?.sku ?? null,
      catalogName: catalogItem?.name ?? saleLine.description_snapshot,
      lineOrigin: saleLine.line_origin === 'inventory' || saleLine.line_origin === 'catalog' ? saleLine.line_origin : 'free',
      unitCode: String(fiscalLine.uniMedida ?? catalogItem?.unit_code ?? '59'),
      taxable: catalogItem?.taxable ?? true,
      controlsInventory: catalogItem?.controls_inventory ?? saleLine.line_origin === 'inventory',
      itemPriceIncludesIva: document.tipoDte === '03' ? true : Boolean(catalogItem?.base_price_includes_tax),
      inventoryGlobalStock: catalogItem ? Number(catalogItem.stock_quantity || 0) : null,
      inheritedFromSaleLineId: canInherit ? saleLine.id : null,
      inheritedInventoryQuantity: canInherit ? quantity : 0,
    };
  });

  const summary = record(payload.resumen);
  const condition = Number(summary.condicionOperacion || 1);
  const payments = Array.isArray(summary.pagos) ? summary.pagos.map((payment) => {
    const value = record(payment);
    return {
      codigo: String(value.codigo ?? '01'),
      montoPago: Number(value.montoPago ?? 0),
      referencia: String(value.referencia ?? ''),
      plazo: String(value.plazo ?? ''),
      periodo: value.periodo === null || value.periodo === undefined ? null : Number(value.periodo),
    };
  }) : [];

  return {
    branchId: fulfillment.sale.core_sucursal_id,
    pointCode: String(document.numeroControl).match(/M\d{3}(P\d{3})/i)?.[1]?.toUpperCase() ?? null,
    customer: {
      name: String(receptor.nombre ?? ''),
      documentType: String(receptor.tipoDocumento ?? (receptor.nit ? '36' : '')),
      document: digits(receptor.numDocumento ?? receptor.nit),
      nrc: digits(receptor.nrc),
      activityCode: String(receptor.codActividad ?? ''),
      activityDescription: String(receptor.descActividad ?? ''),
      commercialName: String(receptor.nombreComercial ?? receptor.nombre ?? ''),
      department: String(address.departamento ?? ''),
      municipality: String(address.municipio ?? ''),
      district: String(address.distrito ?? ''),
      address: String(address.complemento ?? ''),
      phone: String(receptor.telefono ?? ''),
      email: String(receptor.correo ?? ''),
    },
    lines,
    paymentCondition: [1, 2, 3].includes(condition) ? condition as 1 | 2 | 3 : 1,
    payments,
  };
}

function documentPayload(document: DteDraftSummary): Record<string, unknown> {
  return record(document.payload ?? document.dte_json);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D+/g, '');
}

function roundStock(value: number): number {
  return Math.round(value * 1000) / 1000;
}
