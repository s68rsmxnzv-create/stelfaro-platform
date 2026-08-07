export const IVA_RETENTION_MINIMUM_TAXABLE_AMOUNT = 100;

export const IVA_RETENTION_REQUIREMENT_MESSAGE =
  'La retención de IVA del 1% aplica únicamente cuando el comprador es Gran Contribuyente y el monto gravado, sin IVA, es igual o mayor a $100.00.';

export function canApplyIvaRetention(taxableAmount: unknown): boolean {
  const amount = Number(taxableAmount);

  return Number.isFinite(amount) && Math.round(amount * 100) / 100 >= IVA_RETENTION_MINIMUM_TAXABLE_AMOUNT;
}
