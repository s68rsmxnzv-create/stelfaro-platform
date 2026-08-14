import { describe, expect, it } from 'vitest';
import {
  adjustedCatalogPrice,
  catalogPriceBreakdown,
  priceForTargetMargin,
  roundCatalogPrice,
} from '../../../packages/billing/src/support/catalogPricing';

describe('catalogPricing', () => {
  it('explains a final price that includes IVA', () => {
    expect(catalogPriceBreakdown(113, 'final_with_tax', 60)).toEqual({
      net: 100,
      tax: 13,
      total: 113,
      profit: 40,
      marginPercent: 40,
      markupPercent: 66.7,
    });
  });

  it('calculates a target margin without confusing it with markup', () => {
    expect(priceForTargetMargin(10, 30, 'before_tax')).toBe(14.29);
    expect(priceForTargetMargin(10, 30, 'final_with_tax')).toBe(16.14);
  });

  it('applies bulk changes and upward commercial rounding', () => {
    const item = {
      base_price: 10,
      taxable: true,
      base_price_includes_tax: true,
      reference_cost: 5,
    };

    expect(adjustedCatalogPrice(item, 'percentage', 10, 'ninety_nine')).toBe(11.99);
    expect(roundCatalogPrice(12.01, 'half')).toBe(12.5);
    expect(roundCatalogPrice(12.99, 'ninety_nine')).toBe(12.99);
  });

  it('does not invent a margin price when cost is missing', () => {
    expect(adjustedCatalogPrice({
      base_price: 10,
      taxable: false,
      base_price_includes_tax: true,
      reference_cost: null,
    }, 'margin', 35, 'none')).toBeNull();
  });
});
