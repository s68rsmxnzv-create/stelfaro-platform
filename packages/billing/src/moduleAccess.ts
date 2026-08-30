// Módulos del facturador que cada rol fiscal puede abrir. Un rol ausente de este
// mapa no tiene restricción (acceso total). El cajero (`cashier`) trabaja con la
// emisión de FC/CCF, clientes, existencias (vista de solo lectura), sus
// comprobantes, la caja (apertura/cierre/movimientos) y su perfil/impresora en
// Configuración. El catálogo (gestión de precios/costos), eventos MH, anexos,
// libros de IVA, auditoría y dashboard fiscal quedan fuera. Dentro de
// Configuración, `sectionAccess` acota además las secciones visibles. El bloqueo
// real vive en la API (dte-core y platform-api → 403).
export const moduleAccess: Record<string, readonly string[]> = {
  cashier: ['billing', 'customers', 'inventory', 'artifacts', 'cash', 'settings'],
};

export function canAccessBillingModule(role: string | null | undefined, module: string): boolean {
  if (!role) return true;
  const allowed = moduleAccess[role];
  return allowed ? allowed.includes(module) : true;
}

// Secciones (pestañas / vistas internas) permitidas por rol dentro de un módulo.
// Un módulo ausente del mapa de un rol = sin restricción de sección para ese
// módulo. El gating de inventario para el cajero es por componente dedicado, no
// por sección, así que no aparece aquí.
export const sectionAccess: Record<string, Record<string, readonly string[]>> = {
  cashier: {
    settings: ['profile', 'security', 'printer', 'downloads', 'support'],
  },
};

/** `null` = sin restricción de sección; un array = lista blanca de secciones. */
export function allowedSections(
  role: string | null | undefined,
  module: string,
): readonly string[] | null {
  if (!role) return null;
  return sectionAccess[role]?.[module] ?? null;
}
