import { describe, expect, it } from 'vitest';
import { buildMobileNavModel } from '../../../packages/billing/src/components/mobile/mobileNavModel';

const hrefFor = (path: string) => `/app${path}`;

const baseInput = {
  module: 'billing',
  dashboardHref: '/app/dashboard',
  hrefFor,
  extraNavItems: [] as Array<{ href: string; label: string; active?: boolean }>,
  billingOptions: [
    { code: '01', label: 'Consumidor final', slug: 'fe', href: '/app/fe', enabled: true },
    { code: '03', label: 'Credito fiscal', slug: 'ccf', href: '/app/ccf', enabled: true },
    { code: '05', label: 'Nota de credito', slug: 'nc', href: '/app/nc', enabled: false },
  ],
  hasEvents: true,
};

describe('buildMobileNavModel', () => {
  it('places the workshop tab in slot 4 when the tenant has workshop items', () => {
    const model = buildMobileNavModel({
      ...baseInput,
      extraNavItems: [{ href: '/app/recepcion', label: 'Taller', active: true }],
    });

    const slot4 = model.tabs[3];
    expect(slot4.key).toBe('workshop');
    expect(slot4.label).toBe('Taller');
    expect(slot4.href).toBe('/app/recepcion');
    expect(slot4.kind).toBe('link');
    expect(slot4.active).toBe(true);
  });

  it('falls back to a management sheet tab in slot 4 when there is no workshop', () => {
    const model = buildMobileNavModel(baseInput);

    const slot4 = model.tabs[3];
    expect(slot4.key).toBe('management');
    expect(slot4.kind).toBe('sheet');
    expect(slot4.sheet).toBe('management');
    expect(model.management).not.toBeNull();
    expect(model.management!.some((item) => item.href === hrefFor('/caja'))).toBe(true);
  });

  it('omits the management payload when the workshop tab is used', () => {
    const model = buildMobileNavModel({
      ...baseInput,
      extraNavItems: [{ href: '/app/recepcion', label: 'Taller' }],
    });

    expect(model.management).toBeNull();
  });

  it('marks the documents tab active on MH response modules', () => {
    const model = buildMobileNavModel({ ...baseInput, module: 'mh-responses' });

    expect(model.tabs[1].key).toBe('documents');
    expect(model.tabs[1].active).toBe(true);
  });

  it('builds emit actions filtered by enabled flag', () => {
    const model = buildMobileNavModel(baseInput);

    const invoice = model.actions.find((action) => action.key === 'emit-01');
    const creditNote = model.actions.find((action) => action.key === 'emit-05');
    expect(invoice?.enabled).toBe(true);
    expect(creditNote?.enabled).toBe(false);
  });

  it('hides the MH event action when the tenant has no events enabled', () => {
    const withEvents = buildMobileNavModel(baseInput);
    const withoutEvents = buildMobileNavModel({ ...baseInput, hasEvents: false });

    expect(withEvents.actions.some((action) => action.key === 'event-mh')).toBe(true);
    expect(withoutEvents.actions.some((action) => action.key === 'event-mh')).toBe(false);
  });

  it('adds a workshop order action only when workshop is available', () => {
    const withoutWorkshop = buildMobileNavModel(baseInput);
    const withWorkshop = buildMobileNavModel({
      ...baseInput,
      extraNavItems: [{ href: '/app/recepcion', label: 'Taller' }],
    });

    expect(withoutWorkshop.actions.some((action) => action.key === 'workshop-order')).toBe(false);
    expect(withWorkshop.actions.some((action) => action.key === 'workshop-order')).toBe(true);
  });

  it('always exposes exactly five tab slots with the FAB in the centre', () => {
    const model = buildMobileNavModel(baseInput);

    expect(model.tabs).toHaveLength(5);
    expect(model.tabs[2].kind).toBe('fab');
  });
});
