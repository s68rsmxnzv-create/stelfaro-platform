import { describe, expect, it } from 'vitest';
import { inventoryMovementReasonLabel } from '../../../packages/billing/src/support/inventoryMovementLabels';

describe('inventoryMovementReasonLabel', () => {
  it.each([
    ['workshop_consumption', 'Consumo en taller'],
    ['migration_reconciliation', 'Conciliación de migración'],
    ['legacy_sale', 'Venta histórica'],
    ['legacy_purchase', 'Compra histórica'],
    ['manual_adjustment', 'Ajuste manual'],
    ['physical_count', 'Conteo físico'],
    ['transfer_out', 'Transferencia de salida'],
  ])('traduce %s como %s', (reason, label) => {
    expect(inventoryMovementReasonLabel(reason)).toBe(label);
  });

  it('conserva motivos escritos libremente y resuelve valores vacíos', () => {
    expect(inventoryMovementReasonLabel('Corrección autorizada')).toBe('Corrección autorizada');
    expect(inventoryMovementReasonLabel(null)).toBe('Sin motivo');
  });
});
