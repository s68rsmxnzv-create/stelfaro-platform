// @ts-nocheck
/**
 * Pure builder for the mobile app shell navigation model.
 *
 * `BillingAppPage` owns the business rules (which modules the tenant has,
 * which document types are enabled) and feeds them in here; the shell
 * components only paint whatever this returns. Keeping it a plain function
 * makes the tab/action logic testable without a DOM.
 */

const DOCUMENT_TAB_MODULES = ['artifacts', 'mh-responses', 'mh-event-responses'];
const MANAGEMENT_MODULES = [
  'customers',
  'catalog',
  'inventory',
  'cash',
  'commercial-orders',
  'quote-builder',
  'follow-ups',
];

const PRIMARY_EMIT_CODES = ['01', '03'];

export function buildMobileNavModel({
  module,
  dashboardHref,
  hrefFor,
  extraNavItems = [],
  billingOptions = [],
  hasEvents = false,
}) {
  const hasWorkshop = extraNavItems.length > 0;

  const tabs = [
    {
      key: 'dashboard',
      kind: 'link',
      label: 'Inicio',
      iconName: 'home',
      href: dashboardHref,
      active: module === 'dashboard',
    },
    {
      key: 'documents',
      kind: 'link',
      label: 'Documentos',
      iconName: 'documents',
      href: hrefFor('/comprobantes/dte'),
      active: DOCUMENT_TAB_MODULES.includes(module),
    },
    {
      key: 'action',
      kind: 'fab',
      label: 'Crear',
      iconName: 'plus',
    },
    buildSlotFour({ module, hrefFor, extraNavItems, hasWorkshop }),
    {
      key: 'more',
      kind: 'sheet',
      sheet: 'more',
      label: 'Más',
      iconName: 'more',
      active: false,
    },
  ];

  const management = hasWorkshop ? null : buildManagementItems(hrefFor);

  return {
    tabs,
    actions: buildActions({ hrefFor, billingOptions, hasWorkshop, hasEvents }),
    management,
  };
}

function buildSlotFour({ module, hrefFor, extraNavItems, hasWorkshop }) {
  if (hasWorkshop) {
    return {
      key: 'workshop',
      kind: 'link',
      label: extraNavItems[0].label,
      iconName: 'workshop',
      href: extraNavItems[0].href,
      active: extraNavItems.some((item) => item.active),
    };
  }

  return {
    key: 'management',
    kind: 'sheet',
    sheet: 'management',
    label: 'Gestión',
    iconName: 'management',
    active: MANAGEMENT_MODULES.includes(module),
  };
}

function buildManagementItems(hrefFor) {
  return [
    { key: 'commercial-orders', label: 'Órdenes y cotizaciones', iconName: 'documents', href: hrefFor('/ordenes-trabajo') },
    { key: 'cash', label: 'Caja', iconName: 'cash', href: hrefFor('/caja') },
    { key: 'follow-ups', label: 'Pendientes', iconName: 'more', href: hrefFor('/pendientes') },
    { key: 'customers', label: 'Clientes', iconName: 'customers', href: hrefFor('/clientes') },
    { key: 'catalog', label: 'Catálogo', iconName: 'catalog', href: hrefFor('/catalogo') },
    { key: 'inventory', label: 'Inventario', iconName: 'inventory', href: hrefFor('/inventario'), newTab: true },
  ];
}

function buildActions({ hrefFor, billingOptions, hasWorkshop, hasEvents }) {
  const actions = [];

  const primary = billingOptions.filter((option) => PRIMARY_EMIT_CODES.includes(option.code));
  const secondary = billingOptions.filter((option) => !PRIMARY_EMIT_CODES.includes(option.code));

  for (const option of [...primary, ...secondary]) {
    actions.push({
      key: `emit-${option.code}`,
      label: option.label,
      iconName: 'documents',
      href: option.href,
      enabled: Boolean(option.enabled),
    });
  }

  if (hasWorkshop) {
    actions.push({
      key: 'workshop-order',
      label: 'Nueva orden de taller',
      iconName: 'workshop',
      href: hrefFor('/ordenes-trabajo'),
      enabled: true,
    });
  }

  actions.push({
    key: 'new-customer',
    label: 'Nuevo cliente',
    iconName: 'customers',
    href: hrefFor('/clientes'),
    enabled: true,
  });

  if (hasEvents) {
    actions.push({
      key: 'event-mh',
      label: 'Evento MH',
      iconName: 'event',
      href: hrefFor('/eventos-mh/invalidacion'),
      enabled: true,
    });
  }

  return actions;
}
