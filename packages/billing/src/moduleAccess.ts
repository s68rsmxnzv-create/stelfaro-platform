// Módulos del facturador que cada rol fiscal puede abrir. Un rol ausente de este
// mapa no tiene restricción (acceso total). El cajero (`cashier`) sólo trabaja
// con la emisión de FC/CCF, clientes, catálogo, inventario y sus comprobantes;
// eventos MH, anexos, libros de IVA, auditoría, dashboard fiscal y configuración
// quedan fuera. El bloqueo real vive además en la API de dte-core (403).
export const moduleAccess: Record<string, readonly string[]> = {
  cashier: ['billing', 'customers', 'catalog', 'inventory', 'artifacts'],
};

export function canAccessBillingModule(role: string | null | undefined, module: string): boolean {
  if (!role) return true;
  const allowed = moduleAccess[role];
  return allowed ? allowed.includes(module) : true;
}
