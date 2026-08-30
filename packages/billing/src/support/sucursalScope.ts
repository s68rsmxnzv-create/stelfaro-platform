// Quién puede acotar Comprobantes / Respuestas / Eventos MH por sucursal para
// dar soporte: sólo los roles de tenant con vista de toda la empresa que además
// son administradores (owner, company_admin). admin_fiscal / billing_admin ven
// todos los DTE pero no el filtro (decisión de producto, 2026-08-29).
export function canScopeBySucursal(tenantRole: string | null | undefined): boolean {
  return tenantRole === 'owner' || tenantRole === 'company_admin';
}
