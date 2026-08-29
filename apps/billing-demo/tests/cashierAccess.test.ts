import { describe, expect, it } from 'vitest';
import { allowedSections, canAccessBillingModule, moduleAccess } from '../../../packages/billing/src/moduleAccess';

describe('cashier module access', () => {
  it('limits the cashier to emission, customers, catalog, inventory and receipts', () => {
    expect(moduleAccess.cashier).toEqual(['billing', 'customers', 'catalog', 'inventory', 'artifacts']);
    expect(canAccessBillingModule('cashier', 'billing')).toBe(true);
    expect(canAccessBillingModule('cashier', 'customers')).toBe(true);
    expect(canAccessBillingModule('cashier', 'artifacts')).toBe(true);
  });

  it('blocks the cashier from MH events, annexes, dashboard and settings', () => {
    expect(canAccessBillingModule('cashier', 'mh-events')).toBe(false);
    expect(canAccessBillingModule('cashier', 'annexes')).toBe(false);
    expect(canAccessBillingModule('cashier', 'dashboard')).toBe(false);
    expect(canAccessBillingModule('cashier', 'settings')).toBe(false);
  });

  it('keeps full access for roles without a restricted map', () => {
    expect(canAccessBillingModule('company_admin', 'settings')).toBe(true);
    expect(canAccessBillingModule('billing_user', 'billing')).toBe(true);
    expect(canAccessBillingModule(null, 'settings')).toBe(true);
  });
});

describe('cashier section access', () => {
  it('limits Configuración to profile, security, printer, downloads and support', () => {
    expect(allowedSections('cashier', 'settings')).toEqual(['profile', 'security', 'printer', 'downloads', 'support']);
  });

  it('does not gate inventory by section (that is a dedicated component)', () => {
    expect(allowedSections('cashier', 'inventory')).toBeNull();
  });

  it('returns null (no restriction) for unrestricted roles or missing role', () => {
    expect(allowedSections('company_admin', 'settings')).toBeNull();
    expect(allowedSections(null, 'settings')).toBeNull();
  });
});
