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
});
