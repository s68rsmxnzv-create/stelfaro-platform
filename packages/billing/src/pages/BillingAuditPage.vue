<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, PlatformClient, type DteDraftSummary, type MhFiscalEventSummary, type PlatformAuditLog } from '@stelfaro/api-client';
import { UiDataTable, UiInput, UiModalShell, UiPanel, UiRefreshButton, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, FileText, ScrollText, ShieldCheck } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { getBillingContext, peekBillingContext } from '../support/billingDataCache';

type DetailItem = { label: string; value: string };
type PageItem = number | 'ellipsis';

type AuditRow = {
  id: string;
  source: 'platform' | 'dte' | 'event';
  created_at: string | null;
  action: string;
  actor: string;
  actor_detail: string;
  context: string;
  result: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  summary: DetailItem[];
  technical: DetailItem[];
};

const props = withDefaults(defineProps<{
  authToken?: string | null;
  coreBaseUrl?: string;
  platformBaseUrl?: string;
  platformSession?: Record<string, unknown> | null;
  billingContextCacheScope?: string;
}>(), {
  authToken: null,
  coreBaseUrl: '/api/v1',
  platformBaseUrl: '/api/v1',
  platformSession: null,
  billingContextCacheScope: 'default'
});

const core = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const platform = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const tenantId = computed(() => Number(props.platformSession?.tenant?.id || 0));
const context = ref(peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope));
const selectedEmpresaId = ref<number | null>(null);
const platformLogs = ref<PlatformAuditLog[]>([]);
const documents = ref<DteDraftSummary[]>([]);
const events = ref<MhFiscalEventSummary[]>([]);
const selected = ref<AuditRow | null>(null);
const showDetailModal = ref(false);
const showTechnical = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
// Topes maximos aceptados por cada endpoint de origen (ver validacion en
// PlatformAuditLogController::tenant, DteDraftController::index y MhFiscalEventController::index).
const PLATFORM_LIMIT = 200;
const DOCUMENT_LIMIT = 75;
const EVENT_LIMIT = 100;

const filters = reactive({
  source: 'all',
  q: '',
  result: '',
  dateFrom: '',
  dateTo: ''
});

const sourceOptions = [
  { value: 'all', label: 'Todo' },
  { value: 'platform', label: 'Actividad' },
  { value: 'dte', label: 'DTE' },
  { value: 'event', label: 'Eventos' }
];

const resultOptions = [
  { value: '', label: 'Todos' },
  { value: 'success', label: 'Exitosos' },
  { value: 'failed', label: 'Fallidos' }
];

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => Number(empresa.id) === Number(selectedEmpresaId.value)) ?? empresas.value[0] ?? null);

const rows = computed<AuditRow[]>(() => {
  const query = fold(filters.q.trim());
  const source = filters.source;
  const result = filters.result;

  return [
    ...platformLogs.value.map(platformRow),
    ...documents.value.map(documentRow),
    ...events.value.map(eventRow)
  ]
    .filter((row) => source === 'all' || row.source === source)
    .filter((row) => !result || resultMatches(row, result))
    .filter((row) => withinDates(row.created_at))
    .filter((row) => !query || fold([row.action, row.actor, row.actor_detail, row.context, row.result].join(' ')).includes(query))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
});

const counts = computed(() => ({
  platform: rows.value.filter((row) => row.source === 'platform').length,
  dte: rows.value.filter((row) => row.source === 'dte').length,
  event: rows.value.filter((row) => row.source === 'event').length,
  failed: rows.value.filter((row) => row.tone === 'danger' || row.tone === 'warning').length
}));

const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)));

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize;

  return rows.value.slice(start, start + pageSize);
});

const paginationItems = computed<PageItem[]>(() => pageItems(totalPages.value, page.value));

watch(() => props.authToken, () => {
  void initialize();
}, { immediate: true });

watch(selectedEmpresaId, () => {
  void load();
});

watch(() => [filters.source, filters.result, filters.q, filters.dateFrom, filters.dateTo], () => {
  page.value = 1;
});

watch(totalPages, (value) => {
  if (page.value > value) page.value = value;
});

watch(selected, () => {
  showTechnical.value = false;
});

function openDetail(row: AuditRow): void {
  selected.value = row;
  showDetailModal.value = true;
}

function goToPage(target: number): void {
  page.value = Math.min(Math.max(target, 1), totalPages.value);
}

function pageItems(lastPage: number, current: number): PageItem[] {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages = new Set([1, 2, lastPage - 1, lastPage, current - 1, current, current + 1]);
  const visible = [...pages]
    .filter((item) => item >= 1 && item <= lastPage)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];

  for (const item of visible) {
    const previous = items[items.length - 1];
    if (typeof previous === 'number' && item - previous > 1) {
      items.push('ellipsis');
    }
    items.push(item);
  }

  return items;
}

async function initialize(): Promise<void> {
  if (!props.authToken) return;

  try {
    context.value = await getBillingContext(core.value, props.coreBaseUrl, props.billingContextCacheScope);
    selectedEmpresaId.value = selectedEmpresaId.value || context.value.empresas[0]?.id || null;
    await load();
  } catch (caught) {
    error.value = messageFromError(caught);
  }
}

async function load(): Promise<void> {
  if (!props.authToken || !tenantId.value || !selectedEmpresa.value) return;

  loading.value = true;
  error.value = null;

  try {
    const [platformResponse, documentResponse, eventResponse] = await Promise.all([
      platform.value.tenantAuditLogs(tenantId.value, {
        q: filters.q.trim() || undefined,
        result: filters.result || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        limit: PLATFORM_LIMIT
      }),
      core.value.documents({
        empresa_id: selectedEmpresa.value.id,
        q: filters.q.trim() || undefined,
        limit: DOCUMENT_LIMIT,
        include_audit: false
      }),
      core.value.mhEvents({
        empresa_id: selectedEmpresa.value.id,
        q: filters.q.trim() || undefined,
        limit: EVENT_LIMIT
      })
    ]);

    platformLogs.value = platformResponse.data;
    documents.value = documentResponse.data;
    events.value = eventResponse.data;
    page.value = 1;
  } catch (caught) {
    platformLogs.value = [];
    documents.value = [];
    events.value = [];
    error.value = messageFromError(caught);
  } finally {
    loading.value = false;
  }
}

// Acciones que ya llegan con un nombre de negocio claro (ver PlatformAuditLogger::record
// llamado explicitamente desde los controladores), en vez del nombre tecnico de ruta.
const EXPLICIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Inició sesión',
  'auth.logout': 'Cerró sesión',
  'auth.login_failed': 'Intentó iniciar sesión sin éxito',
  'auth.login_lockout': 'Se bloqueó su acceso por intentos fallidos',
  'catalog.prices.bulk_updated': 'Actualizó precios en lote del catálogo',
  'follow_up_note.created': 'Creó una nota de seguimiento',
  'follow_up_note.updated': 'Actualizó una nota de seguimiento',
  'follow_up_note.resolved': 'Resolvió una nota de seguimiento',
  'follow_up_note.discarded': 'Descartó una nota de seguimiento',
  'cash.session.opened': 'Abrió una sesión de caja',
  'cash.session.closed': 'Cerró una sesión de caja',
  'cash.movement.created': 'Registró un movimiento de caja',
  'cash.movement.reversed': 'Revirtió un movimiento de caja',
  'cash.expense.reconciled': 'Concilió un gasto de caja',
  'cash.settings.updated': 'Actualizó la configuración de caja',
  'commercial_sale.payment_recorded': 'Registró un pago de venta'
};

// Traduce las rutas de la API (sin nombre de ruta asignado) a una frase legible.
// La llave es "METODO patron/con/:id/en/vez/de/numeros" tras quitar el prefijo
// api/v1/platform/tenants/{tenant}. Debe reflejar routes/api.php.
const PATH_ACTION_TABLE: Record<string, string> = {
  'post:notifications/read-all': 'Marcó todas las notificaciones como leídas',
  'post:notifications/:id/read': 'Marcó una notificación como leída',
  'delete:notifications/:id': 'Eliminó una notificación',
  'patch:me/profile': 'Actualizó su perfil',
  'put:me/password': 'Cambió su contraseña',
  'delete:me/security/sessions/:id': 'Cerró una sesión activa',
  'post:me/security/sessions/revoke-others': 'Cerró sus demás sesiones activas',
  'patch:me/active-membership/:id': 'Cambió de sucursal activa',
  'post:tenants/:id/requests': 'Creó una solicitud',
  'post:tenants/:id/requests/:id/credentials': 'Reveló credenciales de una solicitud',
  'post:tenants/:id/android-print/pairing-codes': 'Generó un código para emparejar una impresora Android',
  'delete:tenants/:id/android-print/agents/:id': 'Revocó una impresora Android',
  'post:tenants/:id/android-print/jobs': 'Envió un trabajo de impresión',
  'post:tenants/:id/catalog/categories': 'Creó una categoría de catálogo',
  'patch:tenants/:id/catalog/categories/:id': 'Actualizó una categoría de catálogo',
  'delete:tenants/:id/catalog/categories/:id': 'Eliminó una categoría de catálogo',
  'post:tenants/:id/catalog/items': 'Creó un artículo de catálogo',
  'patch:tenants/:id/catalog/items/prices/bulk': 'Actualizó precios en lote del catálogo',
  'patch:tenants/:id/catalog/items/:id': 'Actualizó un artículo de catálogo',
  'delete:tenants/:id/catalog/items/:id': 'Eliminó un artículo de catálogo',
  'post:tenants/:id/fiscal-sync/dte-issues': 'Preparó la emisión de un documento fiscal',
  'post:tenants/:id/fiscal-sync/invalidations': 'Preparó la invalidación de un documento fiscal',
  'post:tenants/:id/fiscal-sync/operations/:id/attach': 'Adjuntó un archivo a una operación fiscal',
  'post:tenants/:id/fiscal-sync/operations/:id/complete': 'Completó una operación fiscal',
  'post:tenants/:id/sales-orders': 'Creó una orden de venta',
  'patch:tenants/:id/sales-orders/:id': 'Actualizó una orden de venta',
  'post:tenants/:id/sales-orders/:id/payments': 'Registró un pago en una orden de venta',
  'post:tenants/:id/sales-orders/:id/cancel': 'Canceló una orden de venta',
  'post:tenants/:id/sales-orders/:id/invoice-link': 'Vinculó una factura a una orden de venta',
  'post:tenants/:id/quotations': 'Creó una cotización',
  'put:tenants/:id/quotations/:id': 'Actualizó una cotización',
  'patch:tenants/:id/quotations/:id/status': 'Cambió el estado de una cotización',
  'post:tenants/:id/quotations/:id/duplicate': 'Duplicó una cotización',
  'post:tenants/:id/quotations/:id/convert': 'Convirtió una cotización en orden',
  'post:tenants/:id/follow-up-notes': 'Creó una nota de seguimiento',
  'put:tenants/:id/follow-up-notes/:id': 'Actualizó una nota de seguimiento',
  'post:tenants/:id/follow-up-notes/:id/resolve': 'Resolvió una nota de seguimiento',
  'post:tenants/:id/follow-up-notes/:id/discard': 'Descartó una nota de seguimiento',
  'post:tenants/:id/cash/settings': 'Configuró la caja',
  'put:tenants/:id/cash/settings/:id': 'Actualizó la configuración de caja',
  'post:tenants/:id/cash/sessions': 'Abrió una sesión de caja',
  'post:tenants/:id/cash/sessions/:id/close': 'Cerró una sesión de caja',
  'post:tenants/:id/cash/movements': 'Registró un movimiento de caja',
  'post:tenants/:id/cash/movements/:id/reverse': 'Revirtió un movimiento de caja',
  'post:tenants/:id/cash/expenses/:id/reconcile': 'Concilió un gasto de caja',
  'post:tenants/:id/cash/sales/:id/payments': 'Registró un pago de venta en caja',
  'patch:tenants/:id/workshop/ticket-settings': 'Actualizó la configuración de tickets del taller',
  'post:tenants/:id/workshop/orders': 'Creó una orden de taller',
  'patch:tenants/:id/workshop/orders/:id': 'Actualizó una orden de taller',
  'post:tenants/:id/workshop/orders/:id/materials': 'Agregó un material a una orden de taller',
  'post:tenants/:id/workshop/orders/:id/materials/:id/consume': 'Consumió un material de una orden de taller',
  'post:tenants/:id/workshop/orders/:id/materials/:id/release': 'Liberó un material reservado de una orden de taller',
  'post:tenants/:id/workshop/orders/:id/materials/:id/return': 'Devolvió un material al inventario de una orden de taller',
  'post:tenants/:id/workshop/orders/:id/settlement': 'Liquidó una orden de taller',
  'post:tenants/:id/workshop/orders/:id/payments': 'Registró un pago en una orden de taller',
  'post:tenants/:id/workshop/orders/:id/invoice-link': 'Vinculó una factura a una orden de taller',
  'post:tenants/:id/workshop/orders/:id/photo-session': 'Abrió una sesión de fotos para una orden de taller',
  'post:tenants/:id/workshop/orders/:id/device-access': 'Generó acceso desde dispositivo para una orden de taller',
  'post:tenants/:id/inventory/suppliers': 'Creó un proveedor',
  'patch:tenants/:id/inventory/suppliers/:id': 'Actualizó un proveedor',
  'post:tenants/:id/inventory/purchases': 'Registró una compra de inventario',
  'post:tenants/:id/inventory/purchases/import-dte-json': 'Importó una compra desde un DTE',
  'post:tenants/:id/inventory/adjustments': 'Ajustó el inventario',
  'post:tenants/:id/inventory/sales': 'Registró una venta de inventario',
  'post:tenants/:id/inventory/sales/supersede-by-source': 'Reemplazó una venta de inventario',
  'post:tenants/:id/inventory/sales/reverse-by-source': 'Revirtió una venta de inventario',
  'post:tenants/:id/inventory/counts': 'Registró un conteo de inventario',
  'post:tenants/:id/inventory/transfers': 'Registró un traslado de inventario',
  'post:tenants/:id/inventory/reservations': 'Reservó inventario',
  'post:tenants/:id/inventory/reservations/:id/confirm': 'Confirmó una reserva de inventario',
  'post:tenants/:id/inventory/reservations/:id/release': 'Liberó una reserva de inventario',
  'post:tenants/:id/inventory/reservations/:id/reverse': 'Revirtió una reserva de inventario',
  'post:tenants/:id/users': 'Agregó un usuario',
  'post:tenants/:id/invitations': 'Envió una invitación',
  'post:invitations/:id/accept': 'Aceptó una invitación',
  'post:invitations/:id/resend': 'Reenvió una invitación',
  'patch:memberships/:id/role': 'Cambió el rol de un usuario',
  'post:memberships/:id/temporary-password': 'Restableció la contraseña temporal de un usuario',
  'put:memberships/:id/fiscal-assignments': 'Actualizó la asignación fiscal de un usuario',
  'patch:memberships/:id/suspend': 'Suspendió a un usuario',
  'patch:memberships/:id/reactivate': 'Reactivó a un usuario',
  'delete:memberships/:id': 'Eliminó a un usuario de la empresa'
};

const RESOURCE_NOUNS: Record<string, string> = {
  WorkshopOrder: 'la orden de taller',
  SalesOrder: 'la orden de venta',
  Quotation: 'la cotización',
  FollowUpNote: 'la nota de seguimiento',
  CashSession: 'la sesión de caja',
  CashMovement: 'el movimiento de caja',
  CashExpense: 'el gasto de caja',
  CashRegister: 'la caja',
  CatalogItem: 'el artículo de catálogo',
  CatalogCategory: 'la categoría de catálogo',
  InventorySupplier: 'el proveedor',
  InventoryPurchase: 'la compra de inventario',
  InventorySale: 'la venta de inventario',
  InventoryReservation: 'la reserva de inventario',
  UserTenantMembership: 'el usuario',
  UserInvitation: 'la invitación',
  FiscalSyncOperation: 'la operación fiscal',
  TenantRequest: 'la solicitud',
  Receivable: 'la cuenta por cobrar'
};

const TIPO_DTE_LABELS: Record<string, string> = {
  '01': 'Factura',
  '03': 'Crédito fiscal',
  '05': 'Nota de crédito',
  '06': 'Nota de débito',
  '07': 'Comprobante de retención',
  '11': 'Factura de exportación',
  '14': 'Sujeto excluido'
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  invalidation: 'Invalidación',
  contingency: 'Contingencia',
  correction: 'Corrección',
  batch: 'Envío por lote'
};

function platformRow(log: PlatformAuditLog): AuditRow {
  const resourceLabel = friendlyResource(log.resource_type, log.resource_id);

  return {
    id: log.id,
    source: 'platform',
    created_at: log.created_at,
    action: humanizeAction(log),
    actor: log.user?.name ?? 'Sin usuario',
    actor_detail: log.user?.email ?? log.ip_address ?? '-',
    context: log.tenant?.name ?? '-',
    result: log.result === 'success' ? 'Exitoso' : (log.result === 'failed' ? 'Fallido' : log.result ?? '-'),
    tone: log.result === 'success' ? 'success' : 'danger',
    summary: [
      { label: 'Sobre', value: resourceLabel ?? 'Actividad general de la cuenta' },
      { label: 'Resultado', value: log.status_code ? `${log.result === 'success' ? 'Exitoso' : 'Fallido'} (código ${log.status_code})` : (log.result ?? '-') }
    ],
    technical: [
      { label: 'Método', value: log.method ?? '-' },
      { label: 'Ruta', value: log.metadata?.path ?? log.url ?? '-' },
      { label: 'Nombre interno de la acción', value: log.action },
      { label: 'Referido desde', value: (log.metadata?.referer as string) ?? '-' },
      { label: 'Campos enviados', value: Array.isArray(log.metadata?.input_keys) ? (log.metadata.input_keys as string[]).join(', ') || '-' : '-' },
      { label: 'Dirección IP', value: log.ip_address ?? '-' },
      { label: 'Dispositivo/navegador', value: log.user_agent ?? '-' }
    ]
  };
}

function documentRow(document: DteDraftSummary): AuditRow {
  const actor = document.performed_by;
  const accepted = ['accepted', 'received', 'received_by_mh'].includes(String(document.estado));
  const tipoLabel = TIPO_DTE_LABELS[document.tipoDte] ?? `DTE ${document.tipoDte}`;

  return {
    id: `dte-${document.id}`,
    source: 'dte',
    created_at: document.processed_at ?? document.created_at ?? null,
    action: `Emitió ${tipoLabel.charAt(0).toLowerCase()}${tipoLabel.slice(1)} ${document.numeroControl}`,
    actor: actor?.name ?? 'Sin usuario',
    actor_detail: actor?.email ?? (actor?.platform_user_id ? `Usuario plataforma ${actor.platform_user_id}` : '-'),
    context: document.empresa?.nombre_comercial ?? document.empresa?.razon_social ?? '-',
    result: statusLabel(document.estado),
    tone: document.estado === 'rejected' ? 'danger' : (accepted ? 'success' : 'info'),
    summary: [
      { label: 'Tipo de comprobante', value: tipoLabel },
      { label: 'Número de control', value: document.numeroControl ?? '-' },
      { label: 'Total a pagar', value: document.totalPagar != null ? currency(document.totalPagar) : '-' },
      { label: 'Sello recibido por Hacienda', value: document.selloRecibido ?? 'Aún no recibido' },
      ...(document.errorMessage ? [{ label: 'Motivo del rechazo', value: document.errorMessage }] : [])
    ],
    technical: [
      { label: 'Código de generación', value: document.codigoGeneracion ?? '-' }
    ]
  };
}

function eventRow(event: MhFiscalEventSummary): AuditRow {
  const actor = event.transmitted_by ?? event.performed_by;
  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? capitalize(event.eventType.replace(/[_-]/g, ' '));

  return {
    id: `event-${event.id}`,
    source: 'event',
    created_at: event.processed_at ?? event.transmitted_at ?? event.created_at ?? null,
    action: `${typeLabel} ante Hacienda`,
    actor: actor?.name ?? 'Sin usuario',
    actor_detail: actor?.email ?? (actor?.platform_user_id ? `Usuario plataforma ${actor.platform_user_id}` : '-'),
    context: event.empresa?.nombre_comercial ?? event.empresa?.razon_social ?? '-',
    result: statusLabel(event.estado),
    tone: event.estado === 'rejected' ? 'danger' : (event.estado === 'accepted' ? 'success' : 'info'),
    summary: [
      { label: 'Tipo de evento', value: typeLabel },
      { label: 'Número de control', value: event.numeroControl ?? '-' },
      { label: 'Sello recibido por Hacienda', value: event.selloRecibido ?? 'Aún no recibido' },
      ...(event.errorMessage ? [{ label: 'Motivo del rechazo', value: event.errorMessage }] : [])
    ],
    technical: [
      { label: 'Código de generación', value: event.codigoGeneracion ?? '-' }
    ]
  };
}

function humanizeAction(log: PlatformAuditLog): string {
  const idSuffix = log.resource_id && /^\d+$/.test(String(log.resource_id)) ? ` #${log.resource_id}` : '';

  const explicit = EXPLICIT_ACTION_LABELS[log.action];
  if (explicit) return `${explicit}${idSuffix}`;

  const rawPath = (log.metadata?.path as string) ?? log.url ?? '';
  const { pattern } = normalizedPath(rawPath);
  const key = `${(log.method ?? '').toLowerCase()}:${pattern}`;
  const template = PATH_ACTION_TABLE[key];
  if (template) return `${template}${idSuffix}`;

  const resourceLabel = friendlyResource(log.resource_type, log.resource_id);
  if (resourceLabel) return `${methodVerb(log.method)} ${resourceLabel}`;

  const lastSegment = pattern.split('/').filter((segment) => segment && segment !== ':id').pop();
  const noun = lastSegment ? lastSegment.replace(/-/g, ' ') : 'un registro';

  return `${methodVerb(log.method)} ${noun}`;
}

function normalizedPath(path: string): { pattern: string; ids: string[] } {
  const segments = path.split('?')[0].replace(/^\/+/, '').split('/').filter(Boolean);
  while (segments[0] === 'api' || segments[0] === 'v1') segments.shift();
  if (segments[0] === 'platform') segments.shift();

  const ids: string[] = [];
  const pattern = segments
    .map((segment) => {
      if (/^\d+$/.test(segment)) {
        ids.push(segment);
        return ':id';
      }

      return segment;
    })
    .join('/');

  return { pattern, ids };
}

function friendlyResource(resourceType: string | null, resourceId: string | null): string | null {
  if (!resourceType || !resourceId) return null;

  const basename = resourceType.includes('\\') ? resourceType.split('\\').pop() ?? resourceType : resourceType;
  const noun = RESOURCE_NOUNS[basename];

  return noun ? `${noun} #${resourceId}` : null;
}

function methodVerb(method: string | null): string {
  switch (method) {
    case 'POST':
      return 'Registró actividad en';
    case 'PUT':
    case 'PATCH':
      return 'Actualizó';
    case 'DELETE':
      return 'Eliminó';
    default:
      return 'Realizó una acción en';
  }
}

function resultMatches(row: AuditRow, result: string): boolean {
  return result === 'success'
    ? row.tone === 'success'
    : row.tone === 'danger' || row.tone === 'warning';
}

function withinDates(value: string | null): boolean {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (filters.dateFrom && time < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
  if (filters.dateTo && time > new Date(`${filters.dateTo}T23:59:59`).getTime()) return false;

  return true;
}

function sourceLabel(source: AuditRow['source']): string {
  if (source === 'dte') return 'DTE';
  if (source === 'event') return 'Evento';

  return 'Actividad';
}

function sourceTone(source: AuditRow['source']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (source === 'dte') return 'success';
  if (source === 'event') return 'warning';

  return 'info';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    ready_to_sign: 'Listo para firma',
    signed: 'Firmado',
    sent: 'Transmitido',
    accepted: 'Aceptado',
    received: 'Aceptado',
    received_by_mh: 'Aceptado',
    rejected: 'Rechazado'
  };

  return labels[status] ?? status;
}

function currency(value: number): string {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string | null): string {
  if (!value) return '-';

  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function messageFromError(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'No fue posible cargar auditoría.';
}
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-primary">Empresa</p>
        <h2 class="mt-1 text-2xl font-bold text-text">Auditoría operativa</h2>
        <p class="mt-1 text-sm text-muted">Quién hizo qué en tu cuenta, en lenguaje sencillo.</p>
      </div>
      <UiRefreshButton :loading="loading" @click="load" />
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <Activity class="h-6 w-6 text-primary" />
          <div>
            <p class="text-xs font-bold uppercase text-soft">Actividad</p>
            <p class="text-2xl font-black text-text">{{ counts.platform }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <FileText class="h-6 w-6 text-success" />
          <div>
            <p class="text-xs font-bold uppercase text-soft">DTE</p>
            <p class="text-2xl font-black text-text">{{ counts.dte }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <ScrollText class="h-6 w-6 text-warning" />
          <div>
            <p class="text-xs font-bold uppercase text-soft">Eventos</p>
            <p class="text-2xl font-black text-text">{{ counts.event }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <ShieldCheck class="h-6 w-6 text-danger" />
          <div>
            <p class="text-xs font-bold uppercase text-soft">Atención</p>
            <p class="text-2xl font-black text-text">{{ counts.failed }}</p>
          </div>
        </div>
      </UiPanel>
    </div>

    <UiPanel variant="raised">
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_0.75fr] lg:items-end">
        <UiSearchInput v-model="filters.q" label="Buscar" placeholder="Usuario, correo o documento" @keyup.enter="load" />
        <UiSelect v-model="filters.source" label="Origen" :options="sourceOptions" />
        <UiSelect v-model="filters.result" label="Resultado" :options="resultOptions" />
        <UiInput v-model="filters.dateFrom" label="Desde" type="date" />
        <UiInput v-model="filters.dateTo" label="Hasta" type="date" />
      </div>
    </UiPanel>

    <p v-if="error" class="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <UiPanel variant="raised">
      <div class="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-muted">{{ rows.length }} {{ rows.length === 1 ? 'registro' : 'registros' }}</p>
        <nav v-if="totalPages > 1" class="flex items-center gap-1" aria-label="Paginación superior">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page <= 1 || loading"
            aria-label="Página anterior"
            @click="goToPage(page - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <template v-for="(item, index) in paginationItems" :key="`top-${item}-${index}`">
            <span v-if="item === 'ellipsis'" class="px-1 text-sm text-soft">…</span>
            <button
              v-else
              type="button"
              class="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold"
              :class="item === page ? 'bg-primary text-primary-contrast' : 'text-muted hover:bg-surface-muted'"
              :disabled="loading"
              @click="goToPage(item)"
            >
              {{ item }}
            </button>
          </template>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page >= totalPages || loading"
            aria-label="Página siguiente"
            @click="goToPage(page + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </nav>
      </div>

      <UiDataTable overflow="auto" min-width="min-w-[960px]">
        <thead class="bg-surface-muted text-xs font-bold uppercase tracking-wide text-soft">
          <tr>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Origen</th>
            <th class="px-4 py-3">Qué pasó</th>
            <th class="px-4 py-3">Usuario</th>
            <th class="px-4 py-3">Empresa</th>
            <th class="px-4 py-3">Resultado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-if="loading">
            <td class="px-4 py-6 text-muted" colspan="6">Cargando auditoría...</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td class="px-4 py-6 text-muted" colspan="6">No hay registros para estos filtros.</td>
          </tr>
          <tr
            v-for="row in pagedRows"
            v-else
            :key="row.id"
            class="cursor-pointer hover:bg-surface-muted"
            @click="openDetail(row)"
          >
            <td class="whitespace-nowrap px-4 py-4 text-sm text-muted">{{ formatDate(row.created_at) }}</td>
            <td class="px-4 py-4"><UiStatusBadge :tone="sourceTone(row.source)">{{ sourceLabel(row.source) }}</UiStatusBadge></td>
            <td class="px-4 py-4 font-bold text-text">{{ row.action }}</td>
            <td class="px-4 py-4">
              <p class="font-semibold text-text">{{ row.actor }}</p>
              <p class="mt-1 text-xs text-muted">{{ row.actor_detail }}</p>
            </td>
            <td class="px-4 py-4 text-sm text-muted">{{ row.context }}</td>
            <td class="px-4 py-4"><UiStatusBadge :tone="row.tone">{{ row.result }}</UiStatusBadge></td>
          </tr>
        </tbody>
      </UiDataTable>

      <div v-if="totalPages > 1" class="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-muted">Página {{ page }} de {{ totalPages }}</p>
        <nav class="flex items-center gap-1" aria-label="Paginación inferior">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page <= 1 || loading"
            aria-label="Página anterior"
            @click="goToPage(page - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <template v-for="(item, index) in paginationItems" :key="`bottom-${item}-${index}`">
            <span v-if="item === 'ellipsis'" class="px-1 text-sm text-soft">…</span>
            <button
              v-else
              type="button"
              class="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold"
              :class="item === page ? 'bg-primary text-primary-contrast' : 'text-muted hover:bg-surface-muted'"
              :disabled="loading"
              @click="goToPage(item)"
            >
              {{ item }}
            </button>
          </template>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page >= totalPages || loading"
            aria-label="Página siguiente"
            @click="goToPage(page + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </nav>
      </div>
    </UiPanel>

    <UiModalShell
      :open="showDetailModal && Boolean(selected)"
      :title="selected?.action ?? 'Detalle'"
      max-width="max-w-lg"
      @close="showDetailModal = false"
    >
      <template v-if="selected">
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="font-bold text-soft">Usuario</dt>
            <dd class="mt-1 text-text">{{ selected.actor }} · {{ selected.actor_detail }}</dd>
          </div>
          <div>
            <dt class="font-bold text-soft">Fecha</dt>
            <dd class="mt-1 text-text">{{ formatDate(selected.created_at) }}</dd>
          </div>
          <div>
            <dt class="font-bold text-soft">Empresa</dt>
            <dd class="mt-1 text-text">{{ selected.context }}</dd>
          </div>
          <div v-for="item in selected.summary" :key="item.label">
            <dt class="font-bold text-soft">{{ item.label }}</dt>
            <dd class="mt-1 text-text">{{ item.value }}</dd>
          </div>
        </dl>

        <div v-if="selected.technical.length" class="mt-5 border-t border-line pt-3">
          <button
            type="button"
            class="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-soft hover:text-text"
            @click="showTechnical = !showTechnical"
          >
            Detalles técnicos
            <ChevronDown class="h-4 w-4 transition-transform" :class="showTechnical ? 'rotate-180' : ''" />
          </button>
          <dl v-if="showTechnical" class="mt-3 space-y-2 text-xs">
            <div v-for="item in selected.technical" :key="item.label" class="flex flex-col gap-0.5">
              <dt class="font-semibold text-soft">{{ item.label }}</dt>
              <dd class="break-words text-muted">{{ item.value }}</dd>
            </div>
          </dl>
        </div>
      </template>
    </UiModalShell>
  </section>
</template>
