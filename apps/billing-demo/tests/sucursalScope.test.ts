import { describe, expect, it } from 'vitest';
import { canScopeBySucursal } from '../../../packages/billing/src/support/sucursalScope';

describe('canScopeBySucursal', () => {
  it('allows owner and company_admin', () => {
    expect(canScopeBySucursal('owner')).toBe(true);
    expect(canScopeBySucursal('company_admin')).toBe(true);
  });

  it('denies everyone else', () => {
    expect(canScopeBySucursal('billing_admin')).toBe(false);
    expect(canScopeBySucursal('billing_user')).toBe(false);
    expect(canScopeBySucursal('seller')).toBe(false);
    expect(canScopeBySucursal('viewer')).toBe(false);
    expect(canScopeBySucursal('')).toBe(false);
    expect(canScopeBySucursal(null)).toBe(false);
    expect(canScopeBySucursal(undefined)).toBe(false);
  });
});
