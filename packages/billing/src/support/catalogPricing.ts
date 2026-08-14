import type { PlatformCatalogItem } from '@stelfaro/api-client';

export type CatalogPriceMode = 'final_with_tax' | 'before_tax' | 'exempt';
export type CatalogPriceOperation = 'percentage' | 'fixed' | 'set' | 'margin';
export type CatalogPriceRounding = 'none' | 'whole' | 'half' | 'ninety_nine';

export function catalogPriceMode(item: Pick<PlatformCatalogItem, 'taxable' | 'base_price_includes_tax'>): CatalogPriceMode {
  if (!item.taxable) return 'exempt';

  return item.base_price_includes_tax ? 'final_with_tax' : 'before_tax';
}

export function catalogPriceFlags(mode: CatalogPriceMode): { taxable: boolean; basePriceIncludesTax: boolean } {
  return {
    taxable: mode !== 'exempt',
    basePriceIncludesTax: mode !== 'before_tax'
  };
}

export function catalogPriceBreakdown(price: number, mode: CatalogPriceMode, cost: number | null = null) {
  const normalizedPrice = Math.max(0, Number(price || 0));
  const net = mode === 'final_with_tax' ? normalizedPrice / 1.13 : normalizedPrice;
  const tax = mode === 'before_tax'
    ? normalizedPrice * 0.13
    : mode === 'final_with_tax'
      ? normalizedPrice - net
      : 0;
  const total = mode === 'before_tax' ? normalizedPrice + tax : normalizedPrice;
  const normalizedCost = cost === null ? null : Math.max(0, Number(cost || 0));
  const profit = normalizedCost === null ? null : net - normalizedCost;

  return {
    net: roundMoney(net),
    tax: roundMoney(tax),
    total: roundMoney(total),
    profit: profit === null ? null : roundMoney(profit),
    marginPercent: profit === null || net <= 0 ? null : roundPercent((profit / net) * 100),
    markupPercent: profit === null || normalizedCost === null || normalizedCost <= 0
      ? null
      : roundPercent((profit / normalizedCost) * 100)
  };
}

export function priceForTargetMargin(cost: number, marginPercent: number, mode: CatalogPriceMode): number | null {
  const normalizedCost = Number(cost);
  const margin = Number(marginPercent);
  if (!Number.isFinite(normalizedCost) || normalizedCost < 0 || !Number.isFinite(margin) || margin < 0 || margin >= 100) {
    return null;
  }

  const netPrice = normalizedCost / (1 - margin / 100);

  return roundMoney(mode === 'final_with_tax' ? netPrice * 1.13 : netPrice);
}

export function adjustedCatalogPrice(
  item: Pick<PlatformCatalogItem, 'base_price' | 'taxable' | 'base_price_includes_tax' | 'reference_cost'>,
  operation: CatalogPriceOperation,
  value: number,
  rounding: CatalogPriceRounding
): number | null {
  const current = Math.max(0, Number(item.base_price || 0));
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  let price: number | null;
  if (operation === 'percentage') price = current * (1 + amount / 100);
  else if (operation === 'fixed') price = current + amount;
  else if (operation === 'set') price = amount;
  else if (item.reference_cost === null) price = null;
  else price = priceForTargetMargin(Number(item.reference_cost), amount, catalogPriceMode(item));

  if (price === null) return null;

  return roundCatalogPrice(Math.max(0, price), rounding);
}

export function roundCatalogPrice(value: number, rounding: CatalogPriceRounding): number {
  const normalized = Math.max(0, Number(value || 0));
  if (rounding === 'whole') return Math.ceil(normalized);
  if (rounding === 'half') return roundMoney(Math.ceil(normalized * 2) / 2);
  if (rounding === 'ninety_nine') {
    if (normalized === 0) return 0;
    const floor = Math.floor(normalized);
    const candidate = floor + 0.99;

    return roundMoney(candidate + Number.EPSILON >= normalized ? candidate : candidate + 1);
  }

  return roundMoney(normalized);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
