import ky, { type KyInstance } from 'ky';
import type { BillingItem, DocumentType } from '@stelfaro/shared';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin_fiscal' | 'company_admin' | 'billing_user' | 'viewer' | string;
  is_backoffice: boolean;
  empresas: Array<{
    id: number;
    nombre_comercial: string;
    razon_social: string;
  }>;
};

export type LoginResponse = {
  token: string;
  token_type: 'Bearer';
  expires_at: string | null;
  user: AuthUser;
};

export type CoreDteClientOptions = {
  authToken?: string | null | (() => string | null | undefined);
  onSessionRefresh?: (expiresAt: string | null) => void;
  credentials?: RequestCredentials;
};

export type NotificationsClientOptions = {
  authToken?: string | null | (() => string | null | undefined);
  credentials?: RequestCredentials;
};

export type PlatformClientOptions = {
  authToken?: string | null | (() => string | null | undefined);
  credentials?: RequestCredentials;
};

export type PlatformTenantMembership = {
  id: number;
  tenant_id: number;
  tenant_name: string | null;
  role: string;
  status: string;
  is_default: boolean;
};

export type PlatformGlobalUser = {
  id: number;
  name: string;
  email: string;
  platform_role: string | null;
  memberships: PlatformTenantMembership[];
};

export type PlatformTenantLookup = {
  id: number;
  slug: string;
  name: string;
  status: string;
  core_empresa_id: number;
};

export type PlatformTenantUserMembership = {
  id: number;
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
  };
  role: string;
  status: string;
  is_default: boolean;
};

export type PlatformUserInvitation = {
  id: number;
  tenant_id: number;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | string;
  expires_at: string | null;
  accepted_at: string | null;
  invited_by: {
    id: number;
    name: string;
    email: string;
  } | null;
};

export type PlatformInvitationDeliveryResponse = {
  invitation: Pick<PlatformUserInvitation, 'id' | 'tenant_id' | 'email' | 'role' | 'status'>;
  notification: {
    id: number | string | null;
    status: string | null;
    recipient_email: string | null;
    attempts: number | null;
    last_error: string | null;
    sent_at: string | null;
  } | null;
};

export type PlatformTenantUsersResponse = {
  tenant: {
    id: number;
    slug: string;
    name: string;
    status: string;
  };
  memberships: PlatformTenantUserMembership[];
  invitations: PlatformUserInvitation[];
};

export type PlatformInviteTenantUserPayload = {
  email: string;
  role: 'company_admin' | 'billing_admin' | 'billing_user' | 'viewer' | string;
};

export type PlatformCreateTenantUserPayload = PlatformInviteTenantUserPayload & {
  name: string;
};

export type PlatformCreateTenantUserResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    must_change_password: boolean;
  };
  temporary_password: string | null;
  created: boolean;
};

export type CoreHealth = {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
};

export type NotificationsHealth = {
  status: string;
  service: string;
  timestamp: string;
};

export type NotificationSenderAlias = {
  id: number;
  scope_type: 'global' | 'empresa';
  scope_id: number;
  purpose: string;
  from_email: string;
  from_name: string | null;
  reply_to_email: string | null;
  reply_to_name: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationSenderAliasPayload = {
  scope_type: 'global' | 'empresa';
  scope_id?: number | null;
  purpose: string;
  from_email: string;
  from_name?: string | null;
  reply_to_email?: string | null;
  reply_to_name?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type NotificationAction = {
  id: number;
  notification_activity_id: number;
  notification_sender_alias_id: number | null;
  key: string;
  name: string;
  purpose: string;
  status: 'active' | 'inactive' | string;
  metadata: Record<string, unknown> | null;
  sender_alias: Pick<NotificationSenderAlias, 'id' | 'purpose' | 'from_email' | 'from_name' | 'is_active'> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationActivity = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | string;
  metadata: Record<string, unknown> | null;
  actions: NotificationAction[];
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationActivityPayload = {
  key: string;
  name: string;
  description?: string | null;
  status?: 'active' | 'inactive';
  metadata?: Record<string, unknown> | null;
};

export type NotificationActionPayload = {
  key: string;
  name: string;
  purpose: string;
  notification_sender_alias_id?: number | null;
  status?: 'active' | 'inactive';
  metadata?: Record<string, unknown> | null;
};

export type NotificationActionUpdatePayload = Partial<Pick<NotificationActionPayload, 'name' | 'notification_sender_alias_id' | 'status' | 'metadata'>>;

export type NotificationMailTransport = {
  id: number;
  name: string;
  mailer: 'smtp' | string;
  host: string;
  port: number;
  scheme: 'ssl' | 'tls' | null;
  username: string;
  password_configured: boolean;
  default_from_email: string;
  default_from_name: string | null;
  is_active: boolean;
  last_verified_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationMailTransportPayload = {
  name: string;
  host: string;
  port: number;
  scheme: 'ssl' | 'tls' | 'null';
  username: string;
  password?: string | null;
  default_from_email: string;
  default_from_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DteMetadata = {
  tipo_dte: string;
  nombre: string;
  kind: string;
  profile: string;
  version: number;
  schema_path: string;
  schema_exists: boolean;
};

export type DtePreviewRequest = {
  tipoDte: DocumentType;
  ambiente: '00' | '01';
  empresa_id?: number;
  sucursal_id?: number;
  punto_venta_id?: number;
  codigoEstablecimiento?: string;
  codigoPuntoVenta?: string;
  correlativo?: number;
  emisor: Record<string, unknown>;
  receptor: Record<string, unknown>;
  documentoRelacionado?: Array<Record<string, unknown>>;
  ventaTercero?: Record<string, unknown> | null;
  apendice?: Array<Record<string, unknown>> | null;
  items: Array<Record<string, unknown>>;
  resumen: Record<string, unknown>;
};

export type DtePreviewResponse = {
  valid: boolean;
  payload: Record<string, unknown>;
  errors: Array<{ field: string; message: string } | string>;
};

export type DteDeliveryNotification = {
  status?: string | null;
  message_id?: number | string | null;
  queued_at?: string | null;
  recipient_email?: string | null;
  error?: string | null;
  last_error?: string | null;
  sent_at?: string | null;
  synced_at?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  attempts?: number | null;
  resent_at?: string | null;
  resend_count?: number | null;
};

export type DteDraftSummary = {
  id: number;
  estado: string;
  tipoDte: string;
  ambiente: string;
  numeroControl: string;
  codigoGeneracion: string;
  selloRecibido?: string | null;
  totalPagar: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  empresa?: {
    id: number;
    nombre_comercial: string;
    razon_social: string;
    nit: string;
  } | null;
  payload?: Record<string, unknown>;
  dte_json?: Record<string, unknown>;
  signedDocument?: string | null;
  signed_bundle?: Record<string, unknown> | null;
  transmission?: {
    status?: string | null;
    mh_estado?: string | null;
    codigo_msg?: string | null;
    descripcion_msg?: string | null;
    receipt_stamp?: string | null;
    observaciones?: string[];
    endpoint?: string | null;
    http_status?: number | null;
    raw_response?: Record<string, unknown> | null;
  } | null;
  mh_response?: Record<string, unknown> | null;
  transmission_attempts?: Array<{
    id: number;
    attempt_number: number;
    provider: string;
    ambiente: string;
    endpoint: string | null;
    http_status: number | null;
    result_status: string | null;
    response_payload: Record<string, unknown> | null;
    error_code: string | null;
    error_message: string | null;
    duration_ms: number | null;
    attempted_at: string | null;
  }>;
  transmission_attempts_count?: number;
  correlativo_retry?: Record<string, unknown> | null;
  notifications?: {
    dte_delivery?: DteDeliveryNotification;
  } | null;
  invalidacion?: {
    eligible: boolean;
    status: 'eligible' | 'expired' | 'invalidated' | 'not_transmitted' | 'missing_receipt_stamp' | 'missing_transmission_date' | string;
    reason: string;
    deadline: string | null;
    baseDate: string | null;
    rule: 'three_months' | 'tenth_business_day_next_month' | 'unknown' | string;
  };
  contingencia?: Record<string, unknown> | null;
  is_related_by_adjustment?: boolean;
  related_by_adjustment?: {
    id: number;
    tipoDte: string;
    estado: string;
    numeroControl: string | null;
    codigoGeneracion: string | null;
  } | null;
};

export type DteDocumentListResponse = {
  data: DteDraftSummary[];
  meta?: PaginationMeta;
};

export type DteEmailResendResponse = {
  message: string;
  notification: {
    status?: string | null;
    message_id?: number | string | null;
    recipient_email?: string | null;
    queued_at?: string | null;
    resent_at?: string | null;
    resend_count?: number | null;
  };
  document: DteDraftSummary;
};

export type DteEmailDeliveryResponse = {
  notification: DteDeliveryNotification | null;
  document: DteDraftSummary;
};

export type DteDashboardSummary = {
  generated_at: string;
  totals: {
    documents: number;
    emitted: number;
    accepted: number;
    rejected: number;
    invalidated: number;
    pending: number;
    companies: number;
  };
  by_status: Array<{
    status: string;
    total: number;
  }>;
  by_type: Array<{
    tipo_dte: string;
    total: number;
  }>;
  daily: Array<{
    date: string;
    total: number;
    accepted: number;
    rejected: number;
  }>;
};

export type DteQueryMhResponse = {
  id: number;
  mh: Record<string, unknown>;
  document: DteDraftSummary;
};

export type DteHistoryEntry = {
  event: string;
  created_at: string | null;
  payload: Record<string, unknown>;
};

export type MhFiscalEventSummary = {
  id: number;
  estado: string;
  eventType: string;
  schemaVersion: number;
  ambiente: string;
  numeroControl: string | null;
  codigoGeneracion: string | null;
  selloRecibido?: string | null;
  signedDocument?: string | null;
  signed_bundle?: Record<string, unknown> | null;
  mh_response?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  empresa?: {
    id: number;
    nombre_comercial: string;
    razon_social: string;
    nit: string;
  } | null;
  payload: Record<string, unknown>;
  relations: Array<{
    id: number;
    relationType: string;
    dteDocumentId: number | null;
    relatedMhFiscalEventId: number | null;
    tipoDte: string | null;
    numeroControl: string | null;
    codigoGeneracion: string | null;
    amount: number | null;
    payload: Record<string, unknown> | null;
  }>;
  signature?: Record<string, unknown> | null;
  transmission?: {
    status?: string | null;
    mh_estado?: string | null;
    codigo_msg?: string | null;
    descripcion_msg?: string | null;
    receipt_stamp?: string | null;
    observaciones?: string[];
    endpoint?: string | null;
    http_status?: number | null;
    raw_response?: Record<string, unknown> | null;
  } | null;
  transmission_attempts?: Array<{
    id: number;
    attempt_number: number;
    provider: string;
    ambiente: string;
    endpoint: string | null;
    http_status: number | null;
    result_status: string | null;
    response_payload: Record<string, unknown> | null;
    error_code: string | null;
    error_message: string | null;
    duration_ms: number | null;
    attempted_at: string | null;
  }>;
  signed_at?: string | null;
  transmitted_at?: string | null;
  processed_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MhFiscalEventListResponse = {
  data: MhFiscalEventSummary[];
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  last_page: number;
  total: number;
  from: number;
  to: number;
  has_more_pages: boolean;
};

export type MhFiscalEventValidation = {
  id: number;
  estado: string;
  eventType: string;
  validation: {
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
  };
};

export type MhFiscalEventDraftRequest = {
  empresa_id: number;
  ambiente: '00' | '01';
  payload: Record<string, unknown>;
  relations?: Array<Record<string, unknown>>;
};

export type BillingDocumentType = {
  code: DocumentType;
  label: string;
  version: number;
  implemented?: boolean;
};

export type BillingCatalogItem = {
  code: string;
  label: string;
};

export type BillingPuntoVenta = {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
};

export type BillingCorrelativo = {
  id: number;
  punto_venta_id: number;
  ambiente: string;
  tipo_dte: DocumentType;
  serie: string;
  actual: number;
  desde: number;
  hasta: number;
  activo: boolean;
};

export type BillingCorrelativoAdmin = BillingCorrelativo & {
  empresa_id: number;
  sucursal_id: number;
  sucursal_codigo: string | null;
  sucursal_nombre: string | null;
  punto_venta_codigo: string | null;
  punto_venta_nombre: string | null;
  next_correlativo: number | null;
  next_numero_control: string | null;
  remaining: number;
};

export type BillingCertificate = {
  id: number;
  ambiente: '00' | '01';
  nit: string;
  filename: string;
  activo: boolean;
  vence_at: string | null;
};

export type BillingSucursal = {
  id: number;
  nombre: string;
  codigo: string;
  direccion: string;
  departamento: string;
  municipio: string;
  distrito: string | null;
  telefono: string | null;
  email: string | null;
  puntosVenta: BillingPuntoVenta[];
  correlativos: BillingCorrelativo[];
};

export type BillingSucursalPayload = {
  nombre: string;
  codigo: string;
  direccion: string;
  departamento: string;
  municipio: string;
  distrito?: string | null;
  telefono?: string | null;
  email?: string | null;
  punto_venta_codigo?: string | null;
  punto_venta_nombre?: string | null;
  punto_venta_tipo?: string | null;
  lifecycle_status?: 'active' | 'inactive';
};

export type BillingPuntoVentaPayload = {
  codigo: string;
  nombre: string;
  tipo?: string | null;
  lifecycle_status?: 'active' | 'inactive';
};

export type BillingMhConfig = {
  id: number;
  certificado_id: number | null;
  ambiente: '00' | '01';
  profile: string;
  active: boolean;
  transmission_provider: 'stub' | 'mh';
  signing_provider: 'stub' | 'jar';
  base_url: string | null;
  auth_url: string | null;
  reception_url: string | null;
  event_reception_url: string | null;
  query_url: string | null;
  signer_url: string | null;
  simulate_unavailable: boolean;
  credentials_configured: boolean;
  signer_credentials_configured: boolean;
  last_auth?: {
    status?: string;
    expires_at?: string | null;
    http_status?: number | null;
    verified_at?: string | null;
    cache_status?: string | null;
  } | null;
  signer_sync?: {
    status?: string;
    service?: string;
    available?: boolean;
    status_url?: string;
    status_code?: number | null;
    message?: string;
    checked_at?: string | null;
    last_verified_at?: string | null;
  } | null;
  last_verified_at: string | null;
};

export type BillingEmpresa = {
  id: number;
  tenant_id: number;
  nombre_comercial: string;
  razon_social: string;
  fiscal_document_type: string | null;
  fiscal_document_number: string | null;
  nit: string;
  nrc: string | null;
  logo_url: string | null;
  codigo_actividad: string;
  desc_actividad: string;
  actividades_economicas?: Array<{
    codigo: string;
    descripcion: string;
  }>;
  ambiente: '00' | '01';
  lifecycle_status: 'active' | 'inactive';
  enabled_document_types?: string[];
  enabled_event_types?: string[];
  created_at: string | null;
  certificados: BillingCertificate[];
  mh_configs: BillingMhConfig[];
  sucursales: BillingSucursal[];
};

export type BillingCustomer = {
  id: number;
  empresa_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document_type: string | null;
  document_number: string | null;
  nit: string | null;
  nrc: string | null;
  cod_actividad: string | null;
  desc_actividad: string | null;
  nombre_comercial: string | null;
  departamento: string | null;
  municipio: string | null;
  distrito: string | null;
  direccion_complemento: string | null;
  allowed_dte_codes: string[];
  is_active: boolean;
};

export type BillingItemTemplate = {
  id: number;
  empresa_id: number;
  name: string;
  description: string;
  default_price: number;
  default_quantity: number;
  item_type: number;
  unit_measure: number;
  item_code: string | null;
};

export type DteIssueProgressEvent =
  | { type: 'stage'; stage: string; progress: number; message: string; attempt?: number; max_attempts?: number; numero_control?: string; correlativo?: number }
  | { type: 'retry'; stage: string; progress: number; message: string; attempt: number; next_attempt: number; max_attempts?: number; numero_control?: string; correlativo?: number; conflict?: boolean }
  | { type: 'completed'; ok: boolean; progress?: number; message: string; document_id?: number; attempts?: DteIssueResponse['attempts'] }
  | ({ type: 'result'; ok: true } & DteIssueResponse)
  | { type: 'result'; ok: false; message: string; errors?: string[] };

export type BillingContext = {
  user: Pick<AuthUser, 'id' | 'name' | 'email' | 'role' | 'is_backoffice'> | null;
  core: {
    profile: string;
    signing_provider: string;
    transmission_provider: string;
    mh_configured: boolean;
  };
  documentTypes: BillingDocumentType[];
  receptorDocumentTypes: BillingCatalogItem[];
  empresas: BillingEmpresa[];
};

export type BillingMunicipioCatalogItem = BillingCatalogItem & {
  departamento: string;
};

export type BillingDistritoCatalogItem = BillingCatalogItem & {
  departamento: string;
  municipio: string;
};

export type BillingCatalogs = {
  departamentos: BillingCatalogItem[];
  municipios: BillingMunicipioCatalogItem[];
  distritos: BillingDistritoCatalogItem[];
  actividadesEconomicas: BillingCatalogItem[];
};

export type BillingCompanyPayload = {
  tenant_nombre?: string | null;
  tenant_slug?: string | null;
  nombre_comercial: string;
  razon_social: string;
  documento_fiscal?: string | null;
  nit?: string | null;
  nrc?: string | null;
  codigo_actividad: string;
  desc_actividad: string;
  actividades_economicas?: Array<{
    codigo: string;
    descripcion: string;
  }>;
  enabled_document_types?: string[];
  enabled_event_types?: string[];
  ambiente: '00' | '01';
  sucursal_nombre?: string | null;
  sucursal_codigo?: string | null;
  direccion: string;
  departamento: string;
  municipio: string;
  distrito: string;
  telefono?: string | null;
  email?: string | null;
  logo?: File | null;
  punto_venta_codigo?: string | null;
  punto_venta_nombre?: string | null;
  punto_venta_tipo?: string | null;
};

export type BillingCompanyUpdatePayload = Partial<Omit<BillingCompanyPayload, 'tenant_slug' | 'sucursal_nombre' | 'sucursal_codigo' | 'punto_venta_codigo' | 'punto_venta_nombre' | 'punto_venta_tipo'>> & {
  lifecycle_status?: 'active' | 'inactive';
};

export type BillingCompanyResponse = {
  tenant: {
    id: number;
    nombre: string;
    slug: string;
  };
  empresa: BillingEmpresa;
};

export type BillingSettingsPayload = {
  empresa_id: number;
  ambiente: '00' | '01';
  certificado_id?: number | null;
  active?: boolean;
  transmission_provider: 'stub' | 'mh';
  signing_provider: 'stub' | 'jar';
  base_url?: string | null;
  auth_url?: string | null;
  reception_url?: string | null;
  event_reception_url?: string | null;
  query_url?: string | null;
  signer_url?: string | null;
  mh_nit?: string | null;
  mh_user?: string | null;
  mh_password?: string | null;
  auth_payload_mode?: 'form' | 'json';
  auth_token_path?: string | null;
  signer_nit?: string | null;
  signer_password_pri?: string | null;
  signer_activo?: boolean;
  simulate_unavailable?: boolean;
  verify?: boolean;
};

export type BillingSettings = Omit<BillingSettingsPayload, 'mh_nit' | 'mh_user' | 'mh_password' | 'signer_nit' | 'signer_password_pri' | 'signer_activo'> & {
  id: number;
  profile: string;
  credentials_configured: boolean;
  signer_credentials_configured: boolean;
  last_verified_at: string | null;
};

export type BillingSignerVerification = {
  status: 'ok' | 'error';
  service: string;
  available: boolean;
  status_url: string;
  status_code?: number;
  message?: string;
  signature_preview?: string;
  last_verified_at?: string;
};

export type MhBearerVerification = {
  status: 'ok' | 'error';
  service?: string;
  available: boolean;
  http_status?: number;
  auth_url?: string;
  token_type?: 'Bearer';
  bearer_token?: string;
  token_preview?: string;
  cache_status?: 'cached' | 'refreshed';
  received_at?: string;
  expires_at?: string;
  message?: string;
};

export type BillingSettingsVerification = {
  ok: boolean;
  message: string;
  correlativos?: {
    ok: boolean;
    message: string;
    enabled_document_types: string[];
    active_count: number;
    missing: Array<{
      sucursal: string;
      punto_venta: string;
      tipo_dte: string;
    }>;
  };
  signer: BillingSignerVerification;
  auth: MhBearerVerification;
};

export type CorrelativoRequest = {
  empresa_id: number;
  sucursal_id: number;
  punto_venta_id: number;
  ambiente: '00' | '01';
  tipo_dte: DocumentType;
};

export type CorrelativoReservation = {
  correlativo_id: number;
  correlativo: number;
  numero_control: string;
  remaining: number;
};

export type DteIssueResponse = {
  document: DteDraftSummary;
  attempts: Array<{
    attempt: number;
    document_id: number;
    correlativo: number;
    numero_control: string;
    mh_status?: string | null;
    mh_estado?: string | null;
    http_status?: number | null;
    codigo_msg?: string | null;
    descripcion_msg?: string | null;
    observaciones?: string[];
    conflict: boolean;
  }>;
};

export type ManualInvoiceInput = {
  documentType: DocumentType;
  empresa: BillingEmpresa;
  sucursal: BillingSucursal;
  puntoVenta: BillingPuntoVenta;
  correlativo: number;
  customerName: string;
  customerDocumentType: string | null;
  customerDocument: string | null;
  customerNrc?: string | null;
  customerActivityCode?: string | null;
  customerActivityDescription?: string | null;
  customerCommercialName?: string | null;
  customerDepartment?: string | null;
  customerMunicipality?: string | null;
  customerDistrict?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerEmail: string | null;
  priceIncludesIva?: boolean;
  retainIva10?: boolean;
  ivaRete?: number;
  ivaPerci?: number;
  reteRenta?: number;
  totalNoGravado?: number;
  relatedDocument?: DteDraftSummary | null;
  observations?: string | null;
  paymentCondition?: number;
  payments?: Array<{
    codigo: string;
    montoPago: number;
    referencia?: string | null;
    plazo?: string | null;
    periodo?: number | null;
  }>;
  items: BillingItem[];
};

function compactParams(params: Record<string, unknown>): URLSearchParams {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });

  return searchParams;
}

function normalizeServiceBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${trimmed}`;
    }

    return trimmed.replace(/^\/+/, '');
  }

  return trimmed.replace(/^\/+/, '');
}

function buildServiceHttp(
  baseUrl: string,
  authToken?: string | null | (() => string | null | undefined),
  credentials?: RequestCredentials
): KyInstance {
  return ky.create({
    prefixUrl: normalizeServiceBaseUrl(baseUrl),
    timeout: 15000,
    credentials,
    hooks: {
      beforeRequest: [
        (request) => {
          const token = typeof authToken === 'function' ? authToken() : authToken;
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        }
      ],
      beforeError: [
        async (error) => {
          const contentType = error.response.headers.get('content-type') ?? '';
          const body = await error.response.text().catch(() => '');
          const trimmedBody = body.trim();

          if (contentType.includes('application/json') && trimmedBody !== '') {
            try {
              const payload = JSON.parse(trimmedBody) as { message?: unknown; errors?: unknown };
              const message = typeof payload.message === 'string' ? payload.message : '';
              const errors = payload.errors && typeof payload.errors === 'object'
                ? Object.values(payload.errors as Record<string, unknown>).flat().map((item) => String(item)).join(' ')
                : '';
              error.message = message || errors || error.message;
              return error;
            } catch {
              return error;
            }
          }

          error.message = trimmedBody || error.message;
          return error;
        }
      ]
    }
  });
}

export class NotificationsClient {
  private readonly http: KyInstance;

  constructor(baseUrl: string, options: NotificationsClientOptions = {}) {
    this.http = buildServiceHttp(baseUrl, options.authToken, options.credentials);
  }

  health(): Promise<NotificationsHealth> {
    return this.http.get('health').json();
  }

  senderAliases(params: { scope_type?: string; scope_id?: number; purpose?: string } = {}): Promise<{ data: NotificationSenderAlias[] }> {
    return this.http.get('sender-aliases', { searchParams: compactParams(params) }).json();
  }

  saveSenderAlias(payload: NotificationSenderAliasPayload): Promise<{ data: NotificationSenderAlias }> {
    return this.http.post('sender-aliases', { json: payload }).json();
  }

  updateSenderAlias(id: number, payload: Partial<NotificationSenderAliasPayload>): Promise<{ data: NotificationSenderAlias }> {
    return this.http.patch(`sender-aliases/${id}`, { json: payload }).json();
  }

  activities(params: { key?: string; status?: string } = {}): Promise<{ data: NotificationActivity[] }> {
    return this.http.get('activities', { searchParams: compactParams(params) }).json();
  }

  saveActivity(payload: NotificationActivityPayload): Promise<{ data: NotificationActivity }> {
    return this.http.post('activities', { json: payload }).json();
  }

  saveAction(activityId: number, payload: NotificationActionPayload): Promise<{ data: NotificationAction }> {
    return this.http.post(`activities/${activityId}/actions`, { json: payload }).json();
  }

  updateAction(id: number, payload: NotificationActionUpdatePayload): Promise<{ data: NotificationAction }> {
    return this.http.patch(`actions/${id}`, { json: payload }).json();
  }

  mailTransport(): Promise<{ data: NotificationMailTransport | null }> {
    return this.http.get('mail-transport').json();
  }

  saveMailTransport(payload: NotificationMailTransportPayload): Promise<{ data: NotificationMailTransport }> {
    return this.http.post('mail-transport', { json: payload }).json();
  }
}

export class PlatformClient {
  private readonly http: KyInstance;

  constructor(baseUrl: string, options: PlatformClientOptions = {}) {
    this.http = buildServiceHttp(baseUrl, options.authToken, options.credentials);
  }

  me(): Promise<unknown> {
    return this.http.get('me').json();
  }

  globalUsers(): Promise<{ users: PlatformGlobalUser[] }> {
    return this.http.get('admin/platform/users').json();
  }

  tenantByCoreEmpresa(coreEmpresaId: number): Promise<{ tenant: PlatformTenantLookup | null }> {
    return this.http.get(`admin/platform/tenants/by-core-empresa/${coreEmpresaId}`).json();
  }

  tenantUsers(tenantId: number): Promise<PlatformTenantUsersResponse> {
    return this.http.get(`platform/tenants/${tenantId}/users`).json();
  }

  createTenantUser(tenantId: number, payload: PlatformCreateTenantUserPayload): Promise<PlatformCreateTenantUserResponse> {
    return this.http.post(`platform/tenants/${tenantId}/users`, { json: payload }).json();
  }

  inviteTenantUser(tenantId: number, payload: PlatformInviteTenantUserPayload): Promise<{ invitation: PlatformUserInvitation; token: string }> {
    return this.http.post(`platform/tenants/${tenantId}/invitations`, { json: payload }).json();
  }

  resendInvitation(invitationId: number): Promise<{ invitation: PlatformUserInvitation; token: string }> {
    return this.http.post(`platform/invitations/${invitationId}/resend`).json();
  }

  invitationDelivery(invitationId: number): Promise<PlatformInvitationDeliveryResponse> {
    return this.http.get(`platform/invitations/${invitationId}/delivery`).json();
  }

  updateMembershipRole(membershipId: number, role: PlatformInviteTenantUserPayload['role']): Promise<{ membership: PlatformTenantUserMembership }> {
    return this.http.patch(`platform/memberships/${membershipId}/role`, { json: { role } }).json();
  }

  suspendMembership(membershipId: number): Promise<{ membership: PlatformTenantUserMembership }> {
    return this.http.patch(`platform/memberships/${membershipId}/suspend`).json();
  }

  reactivateMembership(membershipId: number): Promise<{ membership: PlatformTenantUserMembership }> {
    return this.http.patch(`platform/memberships/${membershipId}/reactivate`).json();
  }

  removeMembership(membershipId: number): Promise<void> {
    return this.http.delete(`platform/memberships/${membershipId}`).json();
  }
}

export class CoreDteClient {
  private readonly http: KyInstance;
  private readonly authToken?: CoreDteClientOptions['authToken'];
  private readonly onSessionRefresh?: CoreDteClientOptions['onSessionRefresh'];
  private readonly credentials?: CoreDteClientOptions['credentials'];
  private readonly baseUrl: string;

  constructor(baseUrl: string, options: CoreDteClientOptions = {}) {
    this.authToken = options.authToken;
    this.onSessionRefresh = options.onSessionRefresh;
    this.credentials = options.credentials;
    this.baseUrl = this.normalizeBaseUrl(baseUrl);
    this.http = ky.create({
      prefixUrl: this.baseUrl,
      timeout: 15000,
      credentials: this.credentials,
      hooks: {
        beforeRequest: [
          (request) => {
            const token = typeof this.authToken === 'function' ? this.authToken() : this.authToken;
            if (token) {
              request.headers.set('Authorization', `Bearer ${token}`);
            }
          }
        ],
        beforeError: [
          async (error) => {
            const contentType = error.response.headers.get('content-type') ?? '';
            const body = await error.response.text().catch(() => '');
            const trimmedBody = body.trim();

            if (contentType.includes('application/json') && trimmedBody !== '') {
              try {
                const payload = JSON.parse(trimmedBody) as { message?: unknown; errors?: unknown };
                const message = typeof payload.message === 'string' ? payload.message : '';
                const errors = Array.isArray(payload.errors) ? payload.errors.map((item) => String(item)).join(' ') : '';
                error.message = message || errors || error.message;
                return error;
              } catch {
                error.message = error.message;
                return error;
              }
            }

            if (trimmedBody.startsWith('<!DOCTYPE') || trimmedBody.includes('<html')) {
              error.message = `HTTP ${error.response.status}: el servidor devolvio una pagina HTML de error.`;
              return error;
            }

            error.message = trimmedBody || error.message;
            return error;
          }
        ],
        afterResponse: [
          (_request, _options, response) => {
            const expiresAt = response.headers.get('X-Billing-Session-Expires-At');
            if (expiresAt && this.onSessionRefresh) {
              this.onSessionRefresh(expiresAt);
            }
            return response;
          }
        ]
      }
    });
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return normalizeServiceBaseUrl(baseUrl);
  }

  login(payload: { email: string; password: string; device_name?: string }): Promise<LoginResponse> {
    return this.http.post('auth/login', { json: payload }).json();
  }

  me(): Promise<{ user: AuthUser; expires_at: string | null }> {
    return this.http.get('auth/me').json();
  }

  logout(): Promise<void> {
    return this.http.post('auth/logout').then(() => undefined);
  }

  health(): Promise<CoreHealth> {
    return this.http.get('health').json();
  }

  metadata(tipoDte: DocumentType): Promise<DteMetadata> {
    return this.http.get(`dte/metadata/${tipoDte}`).json();
  }

  billingContext(): Promise<BillingContext> {
    return this.http.get('billing/context').json();
  }

  billingCatalogs(): Promise<BillingCatalogs> {
    return this.http.get('billing/catalogs').json();
  }

  registerBillingCompany(payload: BillingCompanyPayload): Promise<BillingCompanyResponse> {
    if (payload.logo) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (value instanceof File) {
          form.set(key, value);
          return;
        }
        if (Array.isArray(value) || typeof value === 'object') {
          form.set(key, JSON.stringify(value));
          return;
        }
        form.set(key, String(value));
      });

      return this.http.post('billing/companies', { body: form }).json();
    }

    return this.http.post('billing/companies', { json: payload }).json();
  }

  updateBillingCompany(empresaId: number, payload: BillingCompanyUpdatePayload): Promise<{ empresa: BillingEmpresa }> {
    if (payload.logo) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (value instanceof File) {
          form.set(key, value);
          return;
        }
        if (Array.isArray(value) || typeof value === 'object') {
          form.set(key, JSON.stringify(value));
          return;
        }
        form.set(key, String(value));
      });

      return this.http.post(`billing/companies/${empresaId}`, { body: form }).json();
    }

    return this.http.patch(`billing/companies/${empresaId}`, { json: payload }).json();
  }

  updateBillingCompanyStatus(empresaId: number, lifecycleStatus: 'active' | 'inactive'): Promise<{ empresa: BillingEmpresa }> {
    return this.updateBillingCompany(empresaId, { lifecycle_status: lifecycleStatus });
  }

  createBillingSucursal(empresaId: number, payload: BillingSucursalPayload): Promise<{ empresa: BillingEmpresa }> {
    return this.http.post(`billing/companies/${empresaId}/sucursales`, { json: payload }).json();
  }

  updateBillingSucursal(sucursalId: number, payload: Partial<BillingSucursalPayload>): Promise<{ empresa: BillingEmpresa }> {
    return this.http.patch(`billing/sucursales/${sucursalId}`, { json: payload }).json();
  }

  createBillingPuntoVenta(sucursalId: number, payload: BillingPuntoVentaPayload): Promise<{ empresa: BillingEmpresa }> {
    return this.http.post(`billing/sucursales/${sucursalId}/puntos-venta`, { json: payload }).json();
  }

  updateBillingPuntoVenta(puntoVentaId: number, payload: Partial<BillingPuntoVentaPayload>): Promise<{ empresa: BillingEmpresa }> {
    return this.http.patch(`billing/puntos-venta/${puntoVentaId}`, { json: payload }).json();
  }

  deleteBillingCompany(empresaId: number): Promise<void> {
    return this.http.delete(`billing/companies/${empresaId}`).then(() => undefined);
  }

  billingSettings(empresaId: number, ambiente: '00' | '01'): Promise<{ config: BillingSettings | null }> {
    return this.http.get('billing/settings', {
      searchParams: {
        empresa_id: String(empresaId),
        ambiente
      }
    }).json();
  }

  saveBillingSettings(payload: BillingSettingsPayload): Promise<{ config: BillingSettings; verification?: BillingSettingsVerification }> {
    return this.http.put('billing/settings', { json: payload }).json();
  }

  uploadCertificate(payload: { empresa_id: number; ambiente: '00' | '01'; certificate: File }): Promise<{ certificate: { id: number; filename: string; activo: boolean } }> {
    const form = new FormData();
    form.set('empresa_id', String(payload.empresa_id));
    form.set('ambiente', payload.ambiente);
    form.set('certificate', payload.certificate);

    return this.http.post('billing/certificates', { body: form }).json();
  }

  verifyBillingSigner(payload: { empresa_id: number; ambiente: '00' | '01' }): Promise<{ signer: BillingSignerVerification }> {
    return this.http.post('billing/signer/verify', { json: payload }).json();
  }

  requestMhBearer(payload: { empresa_id: number; ambiente: '00' | '01'; include_token?: boolean; force_refresh?: boolean }): Promise<{ auth: MhBearerVerification }> {
    return this.http.post('billing/mh/bearer', { json: payload }).json();
  }

  customers(params: { empresa_id: number; tipo_dte?: string; q?: string }): Promise<{ data: BillingCustomer[] }> {
    return this.http.get('billing/customers', {
      searchParams: compactParams(params)
    }).json();
  }

  saveCustomer(payload: Partial<BillingCustomer> & { empresa_id: number; name: string }): Promise<{ customer: BillingCustomer }> {
    return this.http.post('billing/customers', { json: payload }).json();
  }

  itemTemplates(params: { empresa_id: number; q?: string }): Promise<{ data: BillingItemTemplate[] }> {
    return this.http.get('billing/item-templates', {
      searchParams: compactParams(params)
    }).json();
  }

  saveItemTemplate(payload: {
    empresa_id: number;
    name: string;
    description: string;
    default_price: number;
    default_quantity?: number;
    item_type?: number;
    unit_measure?: number;
    item_code?: string | null;
  }): Promise<{ template: BillingItemTemplate }> {
    return this.http.post('billing/item-templates', { json: payload }).json();
  }

  previewCorrelativo(payload: CorrelativoRequest): Promise<CorrelativoReservation> {
    return this.http.post('billing/correlativos/preview', { json: payload }).json();
  }

  reserveCorrelativo(payload: CorrelativoRequest): Promise<CorrelativoReservation> {
    return this.http.post('billing/correlativos/reserve', { json: payload }).json();
  }

  correlativos(params: { empresa_id: number; ambiente?: '00' | '01' | string }): Promise<{ data: BillingCorrelativoAdmin[] }> {
    return this.http.get('billing/correlativos', { searchParams: compactParams(params) }).json();
  }

  updateCorrelativo(correlativoId: number, payload: { actual: number }): Promise<{ data: BillingCorrelativoAdmin }> {
    return this.http.patch(`billing/correlativos/${correlativoId}`, { json: payload }).json();
  }

  preview(payload: DtePreviewRequest): Promise<DtePreviewResponse> {
    return this.http.post('dte/preview', { json: payload }).json();
  }

  createDraft(payload: DtePreviewRequest): Promise<DteDraftSummary> {
    return this.http.post('dte/drafts', { json: payload }).json();
  }

  issue(payload: DtePreviewRequest): Promise<DteIssueResponse> {
    return this.http.post('dte/issue', { json: payload }).json();
  }

  async issueProgress(payload: DtePreviewRequest, onEvent: (event: DteIssueProgressEvent) => void): Promise<DteIssueResponse> {
    const token = typeof this.authToken === 'function' ? this.authToken() : this.authToken;
    const response = await fetch(`${this.baseUrl}/dte/issue-progress`, {
      method: 'POST',
      headers: {
        'Accept': 'application/x-ndjson',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: this.credentials,
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(await response.text().catch(() => `HTTP ${response.status}`));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalResult: DteIssueResponse | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line !== '') {
            const event = JSON.parse(line) as DteIssueProgressEvent;
            onEvent(event);
            if (event.type === 'result') {
              if (event.ok) finalResult = { document: event.document, attempts: event.attempts };
              else throw new Error(event.message);
            }
          }
          newline = buffer.indexOf('\n');
        }
      }
      if (done) break;
    }

    if (!finalResult) throw new Error('La emision termino sin resultado final.');
    return finalResult;
  }

  documents(params: { q?: string; estado?: string; tipo_dte?: string; empresa_id?: number; limit?: number; page?: number; include_payload?: boolean } = {}): Promise<DteDocumentListResponse> {
    return this.http.get('dte/drafts', { searchParams: compactParams(params) }).json();
  }

  dashboardSummary(params: { empresa_id?: number } = {}): Promise<DteDashboardSummary> {
    return this.http.get('dte/dashboard-summary', { searchParams: compactParams(params) }).json();
  }

  document(id: number): Promise<DteDraftSummary> {
    return this.http.get(`dte/drafts/${id}`).json();
  }

  graphicRepresentationHtml(id: number): Promise<string> {
    return this.http.get(`dte/drafts/${id}/artifacts/graphic`, {
      headers: { Accept: 'text/html' }
    }).text();
  }

  graphicRepresentationPdf(id: number): Promise<Blob> {
    return this.http.get(`dte/drafts/${id}/artifacts/pdf`, {
      headers: { Accept: 'application/pdf' },
      timeout: 90000
    }).blob();
  }

  mhEventGraphicRepresentationHtml(id: number): Promise<string> {
    return this.http.get(`mh/events/${id}/artifacts/graphic`, {
      headers: { Accept: 'text/html' }
    }).text();
  }

  mhEventGraphicRepresentationPdf(id: number): Promise<Blob> {
    return this.http.get(`mh/events/${id}/artifacts/pdf`, {
      headers: { Accept: 'application/pdf' },
      timeout: 90000
    }).blob();
  }

  queryMh(id: number): Promise<DteQueryMhResponse> {
    return this.http.post(`dte/drafts/${id}/query-mh`).json();
  }

  readyToSign(id: number): Promise<DteDraftSummary> {
    return this.http.post(`dte/drafts/${id}/ready-to-sign`).json();
  }

  signDraft(id: number): Promise<DteDraftSummary> {
    return this.http.post(`dte/drafts/${id}/sign`).json();
  }

  sendDraft(id: number): Promise<DteDraftSummary> {
    return this.http.post(`dte/drafts/${id}/send`).json();
  }

  receiveDraft(id: number, result: 'accepted' | 'rejected' = 'accepted'): Promise<DteDraftSummary> {
    return this.http.post(`dte/drafts/${id}/receive`, { json: { result } }).json();
  }

  resendDteEmail(id: number): Promise<DteEmailResendResponse> {
    return this.http.post(`dte/drafts/${id}/resend-email`).json();
  }

  dteEmailDelivery(id: number): Promise<DteEmailDeliveryResponse> {
    return this.http.get(`dte/drafts/${id}/email-delivery`).json();
  }

  history(id: number): Promise<DteHistoryEntry[]> {
    return this.http.get(`dte/drafts/${id}/history`).json();
  }

  mhEvents(params: { q?: string; estado?: string; event_type?: string; empresa_id?: number; limit?: number; page?: number } = {}): Promise<MhFiscalEventListResponse> {
    return this.http.get('mh/events', { searchParams: compactParams(params) }).json();
  }

  mhEvent(id: number): Promise<MhFiscalEventSummary> {
    return this.http.get(`mh/events/${id}`).json();
  }

  createMhEvent(eventType: string, payload: MhFiscalEventDraftRequest): Promise<MhFiscalEventSummary> {
    return this.http.post(`mh/events/${eventType}/drafts`, { json: payload }).json();
  }

  validateMhEvent(id: number): Promise<MhFiscalEventValidation> {
    return this.http.post(`mh/events/${id}/validate`).json();
  }

  signMhEvent(id: number): Promise<MhFiscalEventSummary> {
    return this.http.post(`mh/events/${id}/sign`).json();
  }

  transmitMhEvent(id: number): Promise<MhFiscalEventSummary> {
    return this.http.post(`mh/events/${id}/transmit`, { timeout: 60000 }).json();
  }
}

export function buildFacturaRequest(input: ManualInvoiceInput): DtePreviewRequest {
  const receptorDocument = normalizeRecipientDocument(input.customerDocumentType, input.customerDocument);
  const isAdjustmentNote = input.documentType === '05' || input.documentType === '06';
  const isSujetoExcluido = input.documentType === '14';
  const isFiscalStyle = input.documentType === '03' || isAdjustmentNote;
  const priceIncludesIva = input.documentType === '03' && input.priceIncludesIva !== false;
  const ivaRetention = input.documentType === '03' && input.retainIva10
    ? roundMoney(totalTaxableBase(input.items, priceIncludesIva) * 0.01)
    : 0;
  const items: Array<Record<string, unknown>> = input.items.map((item) => {
    const discount = lineDiscount(item);

    return {
      descripcion: item.description,
      cantidad: item.quantity,
      precioUni: item.unitPrice,
      montoDescu: discount,
      ...(isFiscalStyle ? { tributos: ['20'], precioIncluyeIva: priceIncludesIva } : {}),
      ...(input.documentType === '05' && typeof item.ivaAmount === 'number' ? { totalIva: roundMoney(item.ivaAmount), ivaItem: roundMoney(item.ivaAmount) } : {}),
      ...(isAdjustmentNote && input.relatedDocument ? { numeroDocumento: input.relatedDocument.codigoGeneracion } : {})
    };
  });

  if (ivaRetention > 0 && items[0]) {
    items[0] = {
      ...items[0],
      ivaRete1: ivaRetention
    };
  }

  const request: DtePreviewRequest = {
    tipoDte: input.documentType,
    ambiente: input.empresa.ambiente,
    empresa_id: input.empresa.id,
    sucursal_id: input.sucursal.id,
    punto_venta_id: input.puntoVenta.id,
    codigoEstablecimiento: input.sucursal.codigo,
    codigoPuntoVenta: input.puntoVenta.codigo,
    correlativo: input.correlativo,
    emisor: {
      nit: onlyDigits(input.empresa.nit),
      nrc: onlyDigits(input.empresa.nrc),
      nombre: input.empresa.razon_social,
      codActividad: input.empresa.codigo_actividad,
      descActividad: input.empresa.desc_actividad,
      nombreComercial: input.empresa.nombre_comercial,
      tipoEstablecimiento: '01',
      direccion: {
        departamento: input.sucursal.departamento,
        municipio: input.sucursal.municipio,
        distrito: input.sucursal.distrito ?? undefined,
        complemento: input.sucursal.direccion
      },
      telefono: input.sucursal.telefono,
      correo: input.sucursal.email,
      codEstableMH: null,
      codEstable: input.sucursal.codigo,
      codPuntoVentaMH: null,
      codPuntoVenta: input.puntoVenta.codigo
    },
    receptor: isFiscalStyle || isSujetoExcluido
      ? {
        ...(input.documentType === '03'
          ? { nit: onlyDigits(input.customerDocument) }
          : {
            tipoDocumento: receptorDocument.documentType || '36',
            numDocumento: receptorDocument.documentNumber || onlyDigits(input.customerDocument)
          }),
        nrc: onlyDigits(input.customerNrc),
        nombre: input.customerName,
        codActividad: input.customerActivityCode,
        descActividad: input.customerActivityDescription,
        nombreComercial: input.customerCommercialName ?? input.customerName,
        direccion: {
          departamento: input.customerDepartment,
          municipio: input.customerMunicipality,
          distrito: normalizeDistrict(input.customerDistrict),
          complemento: input.customerAddress
        },
        telefono: input.customerPhone,
        correo: input.customerEmail
      }
      : {
        nombre: input.customerName,
        tipoDocumento: receptorDocument.documentType,
        numDocumento: receptorDocument.documentNumber,
        nrc: null,
        codActividad: null,
        descActividad: null,
        direccion: null,
        telefono: input.customerPhone,
        correo: input.customerEmail
      },
    items,
    resumen: {
      totalPagar: input.items.reduce((total, item) => total + lineNetTotal(item), 0),
      ...(input.ivaRete !== undefined ? { ivaRete: roundMoney(input.ivaRete) } : {}),
      ...(input.ivaPerci !== undefined ? { ivaPerci: roundMoney(input.ivaPerci) } : {}),
      ...(input.reteRenta !== undefined ? { reteRenta: roundMoney(input.reteRenta) } : {}),
      ...(input.totalNoGravado !== undefined ? { totalNoGravado: roundMoney(input.totalNoGravado) } : {}),
      ...(input.paymentCondition !== undefined ? { condicionOperacion: input.paymentCondition } : {}),
      ...(input.payments !== undefined ? {
        pagos: input.payments.map((payment) => ({
          codigo: payment.codigo,
          montoPago: roundMoney(payment.montoPago),
          referencia: payment.referencia?.trim() ? payment.referencia.trim() : null,
          plazo: payment.plazo || null,
          periodo: payment.periodo ?? null
        }))
      } : {}),
      observaciones: input.observations ?? null,
      codigoRetencionMH: null
    }
  };

  if (isAdjustmentNote && input.relatedDocument) {
    const payload = (input.relatedDocument.payload ?? input.relatedDocument.dte_json ?? {}) as Record<string, unknown>;
    const identificacion = asRecord(payload.identificacion);

    request.documentoRelacionado = [{
      tipoDocumento: String(identificacion.tipoDte ?? input.relatedDocument.tipoDte),
      tipoGeneracion: 2,
      numeroDocumento: String(identificacion.codigoGeneracion ?? input.relatedDocument.codigoGeneracion),
      fechaEmision: String(identificacion.fecEmi ?? input.relatedDocument.created_at?.slice(0, 10) ?? '')
    }];
    request.ventaTercero = null;
    request.apendice = null;
  }

  return request;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function lineGrossTotal(item: BillingItem): number {
  return Math.max(0, Number(item.quantity || 0) * Number(item.unitPrice || 0));
}

function lineDiscount(item: BillingItem): number {
  const discount = Math.max(0, Number(item.discount || 0));

  return Math.min(lineGrossTotal(item), discount);
}

function lineNetTotal(item: BillingItem): number {
  return Math.max(0, lineGrossTotal(item) - lineDiscount(item));
}

function lineTaxableBase(item: BillingItem, priceIncludesIva: boolean): number {
  if (!priceIncludesIva) return lineNetTotal(item);

  const quantity = Math.max(0, Number(item.quantity || 0));
  const gross = lineGrossTotal(item);
  const discount = lineDiscount(item);
  const baseUnit = quantity > 0 ? roundUpMoney((gross / 1.13) / quantity) : 0;
  const baseDiscount = roundUpMoney(discount / 1.13);

  return roundMoney(Math.max(0, (baseUnit * quantity) - baseDiscount));
}

function totalTaxableBase(items: BillingItem[], priceIncludesIva: boolean): number {
  return roundMoney(items.reduce((total, item) => total + lineTaxableBase(item, priceIncludesIva), 0));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundUpMoney(value: number): number {
  return Math.ceil((value - 0.000000001) * 100) / 100;
}

function onlyDigits(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const digits = value.replace(/\D+/g, '');

  return digits === '' ? value : digits;
}

function normalizeDistrict(value: string | null | undefined): string | null {
  const digits = onlyDigits(value);
  if (!digits) return null;

  return digits.padStart(2, '0');
}

function normalizeRecipientDocument(type: string | null | undefined, value: string | null | undefined): { documentType: string | null; documentNumber: string | null } {
  const digits = onlyDigits(value);
  if (!digits) {
    return { documentType: null, documentNumber: null };
  }

  if (type === '36' && (digits.length === 9 || digits.length === 14)) {
    return { documentType: '36', documentNumber: digits };
  }

  if (digits.length === 9) {
    return { documentType: '13', documentNumber: digits };
  }

  if (digits.length === 14) {
    return { documentType: '36', documentNumber: digits };
  }

  return {
    documentType: type || null,
    documentNumber: digits,
  };
}
