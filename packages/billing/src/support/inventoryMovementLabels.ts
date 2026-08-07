const INVENTORY_MOVEMENT_REASON_LABELS: Record<string, string> = {
  purchase: 'Compra',
  sale: 'Venta',
  reversal: 'Reversión',
  manual_adjustment: 'Ajuste manual',
  physical_count: 'Conteo físico',
  transfer_out: 'Transferencia de salida',
  transfer_in: 'Transferencia de entrada',
  workshop_consumption: 'Consumo en taller',
  workshop_return: 'Devolución de taller',
  migration_reconciliation: 'Conciliación de migración',
  legacy_import: 'Importación histórica',
  legacy_sale: 'Venta histórica',
  legacy_purchase: 'Compra histórica',
  legacy_reversal: 'Reversión histórica',
  legacy_adjustment: 'Ajuste histórico',
};

export function inventoryMovementReasonLabel(reason: unknown): string {
  const value = String(reason ?? '').trim();

  if (!value) return 'Sin motivo';

  return INVENTORY_MOVEMENT_REASON_LABELS[value] ?? value;
}
