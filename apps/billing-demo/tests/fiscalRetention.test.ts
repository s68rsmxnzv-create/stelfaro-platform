import { describe, expect, it } from 'vitest';
import { canApplyIvaRetention } from '../../../packages/billing/src/support/fiscalRetention';

describe('canApplyIvaRetention', () => {
  it('rechaza montos gravados menores a cien dólares', () => {
    expect(canApplyIvaRetention(99.99)).toBe(false);
  });

  it('acepta el límite exacto y montos superiores', () => {
    expect(canApplyIvaRetention(100)).toBe(true);
    expect(canApplyIvaRetention(100.01)).toBe(true);
  });

  it('evalúa el total acumulado de todas las líneas', () => {
    const taxableTotal = [25, 25, 50].reduce((total, line) => total + line, 0);

    expect(canApplyIvaRetention(taxableTotal)).toBe(true);
  });
});
