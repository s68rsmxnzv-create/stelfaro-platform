import { describe, expect, it } from 'vitest';
import { canAccessBillingModule, moduleAccess } from '../../../packages/billing/src/moduleAccess';

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
