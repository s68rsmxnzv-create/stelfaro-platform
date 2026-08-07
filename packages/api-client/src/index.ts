import ky, { type KyInstance } from "ky";
import type { BillingItem, DocumentType } from "@stelfaro/shared";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role:
    | "super_admin"
    | "admin_fiscal"
    | "company_admin"
    | "billing_user"
    | "viewer"
    | string;
  is_backoffice: boolean;
  empresas: Array<{
    id: number;
    nombre_comercial: string;
    razon_social: string;
  }>;
};

export type LoginResponse = {
  token: string;
  token_type: "Bearer";
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

export type PlatformSubscriptionPlan = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  included_app_keys: string[];
  limits: Record<string, number | null>;
  status: string;
};

export type PlatformTenantSubscription = {
  id: number;
  tenant_id: number;
  plan: PlatformSubscriptionPlan | null;
  status: string;
  billing_cycle: string;
  price_cents: number;
  currency: string;
  starts_at: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  canceled_at: string | null;
  limits: Record<string, number | null> | null;
};

export type PlatformSubscriptionTenantRow = {
  tenant: {
    id: number;
    name: string;
    slug: string;
    status: string;
    environment?: "00" | "01" | string | null;
    core_empresa_id?: number | string | null;
  };
  subscription: PlatformTenantSubscription | null;
  apps: Array<{
    key: string | null;
    name: string | null;
    status: string;
    is_default: boolean;
  }>;
};

export type PlatformSubscriptionsResponse = {
  plans: PlatformSubscriptionPlan[];
  subscriptions: PlatformSubscriptionTenantRow[];
};

export type PlatformSubscriptionUpdatePayload = {
  plan_id: number;
  status:
    "trialing" | "active" | "past_due" | "suspended" | "canceled" | string;
  billing_cycle?: "monthly" | "annual" | "manual" | string | null;
  price_cents?: number | null;
  currency?: string | null;
  starts_at?: string | null;
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
  duration_days?: number | null;
  limits?: Record<string, number | null> | null;
};

export type PlatformTenantUserMembership = {
  id: number;
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
    must_change_password?: boolean | null;
    password_changed_at?: string | null;
  };
  role: string;
  status: string;
  is_default: boolean;
  fiscal_assignments: PlatformFiscalAssignment[];
};

export type PlatformFiscalAssignment = {
  id: number;
  core_empresa_id: number;
  core_sucursal_id: number;
  core_punto_venta_id: number;
  is_default: boolean;
  status: string;
};

export type PlatformFiscalPoint = {
  id: number;
  sucursal_id: number;
  nombre: string;
  codigo: string;
  tipo: string | null;
};

export type PlatformFiscalSucursal = {
  id: number;
  nombre: string;
  codigo: string;
  puntos_venta: PlatformFiscalPoint[];
};

export type PlatformFiscalScopeResponse = {
  empresa: {
    id: number;
    nombre_comercial: string | null;
    razon_social: string | null;
  };
  sucursales: PlatformFiscalSucursal[];
};

export type PlatformFiscalAssignmentPayload = {
  sucursal_id: number;
  punto_venta_id: number;
  is_default?: boolean;
};

export type PlatformUserInvitation = {
  id: number;
  tenant_id: number;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired" | "revoked" | string;
  expires_at: string | null;
  accepted_at: string | null;
  invited_by: {
    id: number;
    name: string;
    email: string;
  } | null;
};

export type PlatformInvitationDeliveryResponse = {
  invitation: Pick<
    PlatformUserInvitation,
    "id" | "tenant_id" | "email" | "role" | "status"
  >;
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

export type PlatformAuditLog = {
  id: string;
  source: "platform" | "security" | string;
  created_at: string | null;
  action: string;
  result: string | null;
  severity: string | null;
  status_code: number | null;
  method: string | null;
  url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  resource_type: string | null;
  resource_id: string | null;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
  tenant: {
    id: number;
    name: string;
    slug: string;
  } | null;
  metadata: Record<string, unknown> | null;
};

export type PlatformAuditLogsResponse = {
  data: PlatformAuditLog[];
  meta: {
    limit: number;
    total_returned: number;
    source: string;
  };
};

export type PlatformUserProfile = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  email_verified_at: string | null;
  password_changed_at: string | null;
};

export type PlatformUserSession = {
  id: string;
  current: boolean;
  ip_address: string | null;
  device: string;
  last_activity: string;
};

export type PlatformUserSecurityEvent = {
  id: number;
  type: string;
  severity: string | null;
  ip_address: string | null;
  device: string;
  created_at: string | null;
};

export type PlatformTenantRequestType =
  | "user_access"
  | "branch"
  | "point_of_sale"
  | "fiscal_identity"
  | "certificate"
  | "mh_credentials"
  | "correlatives"
  | "subscription"
  | "app_access"
  | "data_migration"
  | "support";
export type PlatformTenantRequestStatus =
  | "pending"
  | "in_review"
  | "needs_information"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled";

export type PlatformTenantRequest = {
  id: number;
  public_id: string;
  reference: string;
  tenant: { id: number; name?: string };
  requester: { id: number; name: string; email: string } | null;
  assignee: { id: number; name: string; email: string } | null;
  type: PlatformTenantRequestType;
  status: PlatformTenantRequestStatus;
  subject: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  reviewed_payload: Record<string, unknown> | null;
  admin_response: string | null;
  fulfillment: {
    user?: { id: number; name: string; email: string };
    resource_type?: string;
    resource_id?: string;
    credentials_available: boolean;
    credentials_revealed_at?: string | null;
  } | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformCreateTenantRequestPayload = {
  idempotency_key: string;
  type: PlatformTenantRequestType;
  subject: string;
  description?: string | null;
  payload?: Record<string, unknown> | null;
};

export type PlatformCatalogCategory = {
  id: number;
  tenant_id: number;
  name: string;
  kind: "product" | "service" | "mixed" | string;
  status: "active" | "inactive" | string;
  items_count: number | null;
  legacy_reference: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformCatalogItem = {
  id: number;
  tenant_id: number;
  catalog_category_id: number | null;
  category: Pick<PlatformCatalogCategory, "id" | "name" | "kind"> | null;
  legacy_item_id: number | null;
  sku: string | null;
  name: string;
  description: string | null;
  item_type: "product" | "service" | "part" | "labor" | "other" | string;
  unit_code: string;
  unit_name: string | null;
  units_per_package: number;
  taxable: boolean;
  controls_inventory: boolean;
  base_price: number;
  base_price_includes_tax: boolean;
  reference_cost: number | null;
  cost_source: "none" | "reference" | "real" | string;
  stock_quantity: number;
  branch_stock_quantity?: number | null;
  min_stock_quantity: number;
  status: "active" | "inactive" | string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformCatalogItemPayload = {
  catalog_category_id?: number | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  item_type: "product" | "service" | "part" | "labor" | "other" | string;
  unit_code?: string | null;
  unit_name?: string | null;
  units_per_package?: number | null;
  taxable?: boolean;
  controls_inventory?: boolean;
  base_price?: number | null;
  base_price_includes_tax?: boolean;
  reference_cost?: number | null;
  min_stock_quantity?: number | null;
  status?: "active" | "inactive" | string;
};

export type PlatformCatalogItemsResponse = {
  data: PlatformCatalogItem[];
  meta?: PaginationMeta;
};

export type WorkshopOrder = {
  id: number;
  ticket: string;
  status: string;
  priority: string;
  reported_fault: string;
  reception: {
    id: number;
    sequence: number;
    equipment_label: string;
    equipment_count: number;
  };
  physical_condition: string | null;
  physical_conditions: string[];
  accessories: string[];
  diagnosis: string | null;
  estimated_total: number | null;
  paid_total: number;
  refunded_total: number;
  balance: number;
  received_at: string;
  photo_count: number;
  branch?: { id: number; code: string | null; name: string | null } | null;
  financial: {
    status: "pending" | "settled" | string;
    final_total: number | null;
    closed_at: string | null;
  };
  billing: {
    status: "unbilled" | "pending" | "invoiced" | string;
    dte_type: "01" | "03" | null;
    core_document_id: number | null;
    number: string | null;
    generation_code: string | null;
    invoiced_at: string | null;
  };
  approval: {
    decision: string | null;
    method: string | null;
    notes: string | null;
    decided_at: string | null;
  };
  customer: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
  };
  device: {
    id: number;
    type: string;
    brand: string;
    model: string;
    color: string | null;
    imei: string | null;
    serial_number: string | null;
    identifier_not_visible: boolean;
    power_status: string;
    functional_tests: Record<string, string>;
    is_locked: boolean;
    access_type: string | null;
    has_access_secret: boolean;
  };
  device_access?: { url: string; pin: string } | null;
};

export type FollowUpNote = {
  id: number;
  person: {
    customer_id: number | null;
    name: string;
    phone: string | null;
    email: string | null;
  };
  title: string;
  description: string | null;
  category: "collection" | "loan" | "commitment" | "other" | string;
  occurred_on: string;
  remind_at: string | null;
  status: "pending" | "resolved" | "discarded" | string;
  resolution: {
    type: string | null;
    note: string | null;
    reference: string | null;
    resolved_at: string | null;
    resolved_by: string | null;
  };
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type FollowUpNotesResponse = {
  data: FollowUpNote[];
  meta: PaginationMeta;
  stats: { pending: number; overdue: number; today: number };
};

export type WorkshopTicketSettings = {
  receipt_copies: 1 | 2;
  print_equipment_label: boolean;
  terms: string;
};

export type WorkshopOrderPhoto = {
  id: number;
  url: string;
  stage: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
};

export type WorkshopOrdersResponse = {
  data: WorkshopOrder[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  stats: Record<string, number>;
};

export type WorkshopMaterial = {
  id: number;
  status: "reserved" | "confirmed" | "released" | "reversed" | string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  item: {
    id: number;
    sku: string | null;
    name: string;
    unit_name: string | null;
  } | null;
  description: string | null;
  branch: { id: number; code: string | null; name: string | null } | null;
  reserved_at: string | null;
  consumed_at: string | null;
  released_at: string | null;
  returned_at: string | null;
};

export type WorkshopDashboard = {
  generated_at: string;
  orders: {
    active: number;
    received_today: number;
    awaiting_approval: number;
    ready: number;
    urgent: number;
  };
  commercial: {
    sales_today: number;
    sales_net_today: number;
    sales_tax_today: number;
    sales_month: number;
    sales_net_month: number;
    sales_tax_month: number;
    purchase_tax_credit_month: number;
    estimated_tax_payable_month: number;
    estimated_tax_credit_balance_month: number;
    receivables: number;
  };
  recent_orders: WorkshopOrder[];
};

export type PlatformCommercialDashboard = {
  generated_at: string;
  commercial: {
    sales_today: number;
    sales_net_today: number;
    sales_tax_today: number;
    sales_month: number;
    sales_net_month: number;
    sales_tax_month: number;
    purchase_tax_credit_month: number;
    estimated_tax_payable_month: number;
    estimated_tax_credit_balance_month: number;
  };
};

export type PlatformCashSession = {
  id: number;
  status: string;
  business_date: string | null;
  opening_source: string;
  count_status: string;
  opening_balance: number;
  inflows: number;
  outflows: number;
  expected: number;
  opened_at: string;
  closed_at: string | null;
  declared_balance: number | null;
  difference: number | null;
  register: {
    id: number;
    name: string;
    branch_id: number | null;
    branch_name: string | null;
  };
};
export type PlatformCashMovement = {
  id: number;
  direction: "in" | "out";
  kind: string;
  method: string;
  amount: number;
  description: string;
  reference: string | null;
  occurred_at: string;
  reversed_at: string | null;
  expense: {
    id: number;
    status: string;
    category: string;
    supplier: string | null;
  } | null;
  order: { id: number; ticket: string } | null;
};
export type PlatformCashRegister = {
  id: number;
  name: string;
  status: string;
  branch_id: number | null;
  branch_code: string | null;
  branch_name: string | null;
  configured: boolean;
};
export type PlatformCashSettings = {
  timezone: string;
  default_opening_balance: number;
  carry_forward_balance: boolean;
  auto_open_enabled: boolean;
  auto_open_time: string | null;
  auto_close_enabled: boolean;
  auto_close_time: string | null;
  close_grace_minutes: number;
  working_days: number[];
  non_working_dates: string[];
  use_official_holidays: boolean;
  allow_non_cash_when_closed: boolean;
  active: boolean;
};
export type PlatformCashRegisterSettings = {
  id: number;
  name: string;
  status: string;
  core_sucursal_id: number | null;
  core_sucursal_code: string | null;
  core_sucursal_name: string | null;
  settings: PlatformCashSettings;
};
export type PlatformCashOverview = {
  registers: PlatformCashRegister[];
  active_session: PlatformCashSession | null;
  pending_counts: PlatformCashSession[];
  summary: { inflows: number; outflows: number; pending_documents: number };
  data: PlatformCashMovement[];
  meta: { current_page: number; last_page: number; total: number };
};
export type PlatformPaymentBreakdown = {
  cash: number;
  card: number;
  transfer: number;
  other: number;
};
export type PlatformSalesReport = {
  summary: {
    transactions: number;
    net: number;
    tax: number;
    total: number;
    receivable: number;
    cost: number;
    margin: number;
    payments: PlatformPaymentBreakdown & {
      recorded: number;
      unclassified: number;
    };
  };
  data: Array<{
    id: number;
    date: string | null;
    source_type: string;
    source_id: string;
    source_number: string | null;
    document_type: string | null;
    operation_kind: string;
    customer_name: string | null;
    payment_status: string;
    outstanding_amount: number;
    payment_methods: PlatformPaymentBreakdown;
    collected: number;
    net: number;
    tax: number;
    total: number;
  }>;
  meta: { current_page: number; last_page: number; total: number };
};

export type WorkshopOrderPayload = {
  reception_id?: number | null;
  core_sucursal_id?: number | null;
  core_sucursal_code?: string | null;
  core_sucursal_name?: string | null;
  customer: {
    core_customer_id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  device: {
    type: string;
    brand: string;
    model: string;
    color?: string | null;
    imei?: string | null;
    serial_number?: string | null;
    identifier_not_visible?: boolean;
    power_status: string;
    functional_tests?: Record<string, string>;
    is_locked?: boolean;
    access_type?: string | null;
    access_secret?: string | null;
  };
  reported_fault: string;
  physical_condition?: string | null;
  physical_conditions?: string[];
  accessories?: string[];
  priority?: string;
  estimated_total?: number | null;
  advance?: {
    amount?: number | null;
    method?: string;
    reference?: string | null;
  };
};

export type PlatformInventorySupplier = {
  id: number;
  tenant_id: number;
  name: string;
  tax_id: string | null;
  nrc: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "active" | "inactive" | string;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformInventoryLot = {
  id: number;
  tenant_id: number;
  core_sucursal_id: number | null;
  core_sucursal_code: string | null;
  core_sucursal_name: string | null;
  catalog_item_id: number;
  inventory_supplier_id: number | null;
  inventory_purchase_id: number | null;
  inventory_purchase_line_id: number | null;
  lot_code: string;
  received_date: string | null;
  unit_cost: number;
  initial_quantity: number;
  available_quantity: number;
  status: string;
  catalog_item?: Pick<
    PlatformCatalogItem,
    "id" | "sku" | "name" | "unit_code" | "unit_name"
  > | null;
  supplier?: Pick<
    PlatformInventorySupplier,
    "id" | "name" | "tax_id" | "nrc"
  > | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformInventoryMovement = {
  id: number;
  tenant_id: number;
  core_sucursal_id: number | null;
  core_sucursal_code: string | null;
  core_sucursal_name: string | null;
  catalog_item_id: number;
  inventory_lot_id: number | null;
  movement_type: "entry" | "exit" | string;
  reason: string;
  quantity: number;
  unit_cost: number | null;
  balance_after: number | null;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  notes: string | null;
  catalog_item?: Pick<PlatformCatalogItem, "id" | "sku" | "name"> | null;
  lot?: Pick<PlatformInventoryLot, "id" | "lot_code"> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformInventoryPurchasePayload = {
  inventory_supplier_id?: number | null;
  core_sucursal_id?: number | null;
  core_sucursal_code?: string | null;
  core_sucursal_name?: string | null;
  document_type?: string | null;
  document_mode?: "manual" | "dte" | "physical" | string | null;
  document_number?: string | null;
  payment_condition?: "cash" | "credit" | "contado" | "credito" | string | null;
  tax_amount?: number | null;
  document_total?: number | null;
  is_consumable?: boolean;
  apply_tax_perceived?: boolean;
  tax_perceived_mode?: "auto" | "manual" | "dte" | string | null;
  tax_perceived_rate?: number | null;
  tax_perceived_amount?: number | null;
  apply_fuel_charges?: boolean;
  fovial_per_unit?: number | null;
  cotrans_per_unit?: number | null;
  fiscal_profile?: string | null;
  fiscal_sector?: number | null;
  supplier_snapshot?: Record<string, unknown> | null;
  import_metadata?: Record<string, unknown> | null;
  purchase_date: string;
  lines: Array<{
    catalog_item_id: number;
    description?: string | null;
    unit_code?: string | null;
    unit_name?: string | null;
    quantity: number;
    unit_cost: number;
    subtotal?: number | null;
    price_includes_tax?: boolean;
    no_inventory?: boolean;
  }>;
};

export type PlatformInventoryPurchaseLine = {
  id: number;
  tenant_id: number;
  inventory_purchase_id: number;
  catalog_item_id: number;
  description_snapshot: string | null;
  unit_code: string | null;
  unit_name: string | null;
  quantity: number;
  input_unit_cost: number;
  unit_cost: number;
  base_unit_cost: number;
  tax_unit_amount: number;
  tax_rate: number;
  total_unit_amount: number;
  tax_amount: number;
  line_total: number;
  price_includes_tax: boolean;
  no_inventory: boolean;
  controls_inventory_snapshot: boolean;
  inventory_quantity: number;
  catalog_item?: Pick<
    PlatformCatalogItem,
    "id" | "sku" | "name" | "unit_code" | "unit_name" | "controls_inventory"
  > | null;
  lots?: PlatformInventoryLot[];
};

export type PlatformInventoryPurchase = {
  id: number;
  tenant_id: number;
  inventory_supplier_id: number | null;
  core_sucursal_id: number | null;
  core_sucursal_code: string | null;
  core_sucursal_name: string | null;
  purchase_number: number;
  document_type: string | null;
  document_mode: string | null;
  document_number: string | null;
  payment_condition: string | null;
  document_total: number | string | null;
  is_consumable: boolean;
  purchase_date: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  tax_perceived: number | string;
  fovial_per_unit: number | string;
  cotrans_per_unit: number | string;
  other_non_taxable_total: number | string;
  total: number | string;
  status: string;
  supplier_snapshot: Record<string, unknown> | null;
  import_metadata: Record<string, unknown> | null;
  lines_count?: number;
  supplier?: PlatformInventorySupplier | null;
  lines?: PlatformInventoryPurchaseLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformInventoryPurchaseImportPreview = {
  document: {
    document_type: string | null;
    document_mode: string;
    document_number: string | null;
    purchase_date: string;
    payment_condition: string;
    subtotal: number;
    tax_amount: number;
    document_total: number;
    apply_tax_perceived: boolean;
    tax_perceived_mode: string | null;
    tax_perceived_rate: number;
    tax_perceived_amount: number;
    apply_fuel_charges: boolean;
    fovial_per_unit: number;
    cotrans_per_unit: number;
  };
  supplier: {
    matched: Pick<
      PlatformInventorySupplier,
      "id" | "name" | "tax_id" | "nrc"
    > | null;
    from_json: {
      name: string | null;
      tax_id: string | null;
      nrc: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
    };
  };
  lines: Array<{
    description: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
    unit_code: string;
    supplier_code: string | null;
    no_inventory: boolean;
    matched_catalog_item: Pick<
      PlatformCatalogItem,
      "id" | "sku" | "name" | "item_type" | "controls_inventory"
    > | null;
  }>;
  import_metadata: Record<string, unknown>;
};

export type PlatformInventoryReservation = {
  id: number;
  tenant_id: number;
  core_sucursal_id: number | null;
  core_sucursal_code: string | null;
  core_sucursal_name: string | null;
  idempotency_key: string;
  status: "reserved" | "confirmed" | "released" | "reversed" | string;
  source_type: string | null;
  source_id: string | null;
  source_number: string | null;
  metadata: Record<string, unknown> | null;
  confirmed_at: string | null;
  released_at: string | null;
  lines?: Array<{
    id: number;
    catalog_item_id: number;
    quantity: number;
    description_snapshot: string | null;
    catalog_item?: Pick<PlatformCatalogItem, "id" | "sku" | "name"> | null;
    allocations?: Array<{
      id: number;
      inventory_lot_id: number;
      quantity: number;
      unit_cost: number;
      lot?: Pick<PlatformInventoryLot, "id" | "lot_code"> | null;
    }>;
  }>;
  created_at: string | null;
  updated_at: string | null;
};

export type PlatformInventoryReservationPayload = {
  idempotency_key: string;
  core_sucursal_id?: number | null;
  core_sucursal_code?: string | null;
  core_sucursal_name?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_number?: string | null;
  metadata?: Record<string, unknown> | null;
  lines: Array<{
    catalog_item_id: number;
    quantity: number;
    description?: string | null;
  }>;
};

export type PlatformInventorySalePayload = {
  core_sucursal_id?: number | null;
  core_sucursal_code?: string | null;
  core_sucursal_name?: string | null;
  source_type?: string | null;
  source_id: string;
  source_number?: string | null;
  sale_date?: string | null;
  fiscal_document_type?: "01" | "03" | "05" | "06" | "14" | string | null;
  net_amount?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  metadata?: Record<string, unknown> | null;
  replacement_of_source_type?: string | null;
  replacement_of_source_id?: string | null;
  lines: Array<{
    catalog_item_id?: number | null;
    line_origin?: "free" | "catalog" | "inventory" | string | null;
    inherited_from_line_id?: number | null;
    inherited_quantity?: number | null;
    description?: string | null;
    quantity: number;
    unit_price?: number | null;
    discount_amount?: number | null;
    net_total?: number | null;
    tax_amount?: number | null;
    total_amount?: number | null;
    reference_unit_cost?: number | null;
  }>;
};

export type PlatformFiscalSyncOperation = {
  id: number;
  kind: "dte_issue" | "mh_invalidation" | string;
  idempotency_key: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  core_resource_id: string | null;
  reservation: PlatformInventoryReservation | null;
  result: Record<string, unknown> | null;
  last_error: string | null;
  completed_at: string | null;
};

export type PlatformDteSyncPayload = {
  idempotency_key: string;
  workshop_order_id?: number | null;
  sales_order_id?: number | null;
  reservation?: Omit<
    PlatformInventoryReservationPayload,
    "idempotency_key"
  > | null;
  sale: Omit<PlatformInventorySalePayload, "source_id"> & {
    source_id?: string;
  };
};

export type PlatformInventorySale = {
  id: number;
  tenant_id: number;
  core_sucursal_id: number | null;
  core_sucursal_code: string | null;
  core_sucursal_name: string | null;
  source_type: string;
  source_id: string;
  source_number: string | null;
  sale_date: string | null;
  operation_kind:
    | "sale"
    | "credit_note"
    | "debit_note"
    | "excluded_subject_purchase"
    | string;
  fiscal_document_type: string | null;
  reporting_sign: number;
  net_amount: number;
  tax_amount: number;
  total_amount: number;
  status: "active" | "pending_replacement" | "superseded" | "reversed" | string;
  replacement_of_sale_id: number | null;
  metadata: Record<string, unknown> | null;
  lines: Array<{
    id: number;
    catalog_item_id: number | null;
    line_origin: "free" | "catalog" | "inventory" | string;
    inherited_from_line_id: number | null;
    description_snapshot: string | null;
    quantity: number;
    inherited_quantity: number;
    unit_price: number;
    discount_amount: number;
    net_total: number;
    tax_amount: number;
    total_amount: number;
    reference_unit_cost: number;
    catalog_item?: PlatformCatalogItem | null;
  }>;
};

export type PlatformInventorySaleFulfillment = {
  sale: PlatformInventorySale;
  reservation: PlatformInventoryReservation | null;
};

export type PlatformInventorySaleReportRow = {
  catalog_item_id: number | null;
  line_origin: "free" | "catalog" | "inventory" | string;
  sku: string | null;
  name: string;
  quantity: number;
  sales_total: number;
  reference_cost_total: number;
  margin_total?: number;
  margin_percent?: number;
};

export type PlatformInventoryStockAlert = Pick<
  PlatformCatalogItem,
  "id" | "sku" | "name"
> & {
  stock_quantity: number;
  min_stock_quantity: number;
  below_minimum: boolean;
};

export type PlatformInventorySummary = {
  products: number;
  units: number;
  inventory_value: number;
  lots: number;
  available_lots: number;
  movements: number;
  healthy: number;
  below_minimum: number;
  out_of_stock: number;
  stock_by_item: Array<{
    catalog_item_id: number;
    stock_quantity: number;
    stock_value: number;
  }>;
};

export type PlatformInventoryPurchaseAnnexRow = {
  purchase_id: number;
  purchase_date: string | null;
  document_type: string | null;
  document_mode: string | null;
  document_number: string | null;
  supplier_name: string | null;
  supplier_tax_id: string | null;
  supplier_nrc: string | null;
  payment_condition: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  tax_perceived: number | string;
  other_non_taxable_total: number | string;
  total: number | string;
  f07_operation_type: number | null;
  f07_classification: number | null;
  f07_sector: number | null;
  f07_cost_expense_type: number | null;
  import_metadata: Record<string, unknown> | null;
};

export type PlatformPurchaseAnnexDataset = {
  official_rows: string[][];
  preview: Array<Record<string, unknown>>;
  issues: string[];
};

export type PlatformPurchaseAnnexResponse = {
  data: {
    compras: PlatformPurchaseAnnexDataset;
  };
  headers: {
    compras: string[];
  };
  meta: {
    counts: {
      compras: number;
    };
    period: {
      from: string | null;
      to: string | null;
    };
  };
};

export type PlatformInternalNotification = {
  id: number;
  category: string;
  title: string;
  message: string;
  action_url: string | null;
  due_date: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string | null;
};

export type PlatformInternalNotificationsResponse = {
  data: PlatformInternalNotification[];
  unread_count: number;
};

export type PlatformWorkLine = {
  id?: number;
  catalog_item_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  total?: number;
};
export type PlatformSalesOrder = {
  id: number;
  number: string;
  title: string;
  work_type: string;
  status: string;
  financial_status: string;
  billing: {
    status: string;
    dte_type?: string | null;
    core_document_id?: number | null;
    number?: string | null;
  };
  customer: {
    id?: number | null;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  subtotal: number;
  discount_total: number;
  total: number;
  paid_total: number;
  balance: number;
  notes?: string | null;
  branch?: { id?: number | null; code?: string | null; name?: string | null };
  due_at?: string | null;
  cancellation_reason?: string | null;
  lines: PlatformWorkLine[];
  timeline?: Array<{
    id: number;
    from?: string | null;
    to: string;
    note?: string | null;
    occurred_at: string;
  }>;
  created_at?: string | null;
};
export type PlatformQuotation = {
  id: number;
  number: string;
  version?: number;
  title: string;
  status: string;
  public_url?: string;
  approval?: {
    method?: string | null;
    note?: string | null;
    accepted_at?: string | null;
  };
  branch?: { id?: number | null; code?: string | null; name?: string | null };
  customer: PlatformSalesOrder["customer"];
  subtotal: number;
  discount_total: number;
  total: number;
  requested_deposit: number;
  valid_until?: string | null;
  terms?: string | null;
  notes?: string | null;
  order_id?: number | null;
  lines: PlatformWorkLine[];
  created_at?: string | null;
};
export type PlatformReceivable = {
  id: number | string;
  collection_id: number;
  source_type: "workshop_order" | "sales_order" | "dte" | string;
  source_id: number;
  source_number: string;
  customer: { id?: number | null; name: string };
  original_amount: number;
  paid_amount: number;
  refunded_amount: number;
  balance: number;
  status: string;
  recognized_at?: string | null;
  due_at?: string | null;
  days_overdue?: number;
  entries?: Array<{
    id: number;
    type: string;
    amount: number;
    reference?: string | null;
    notes?: string | null;
    occurred_at?: string | null;
  }>;
};

export type PlatformInventoryCountPayload = {
  core_sucursal_id?: number | null;
  core_sucursal_code?: string | null;
  core_sucursal_name?: string | null;
  count_date?: string | null;
  notes?: string | null;
  lines: Array<{
    catalog_item_id: number;
    counted_quantity: number;
  }>;
};

export type PlatformInventoryTransferPayload = {
  from_core_sucursal_id: number;
  from_core_sucursal_code?: string | null;
  from_core_sucursal_name?: string | null;
  to_core_sucursal_id: number;
  to_core_sucursal_code?: string | null;
  to_core_sucursal_name?: string | null;
  transfer_date?: string | null;
  notes?: string | null;
  lines: Array<{
    catalog_item_id: number;
    quantity: number;
  }>;
};

export type PlatformPaginatedResponse<T> = {
  data: T[];
  meta?: PaginationMeta;
  links?: Record<string, string | null>;
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
};

export type PlatformInviteTenantUserPayload = {
  email: string;
  role: "company_admin" | "billing_admin" | "billing_user" | "viewer" | string;
};

export type PlatformCreateTenantUserPayload =
  PlatformInviteTenantUserPayload & {
    name: string;
    phone?: string | null;
  };

export type PlatformCreateTenantUserResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    must_change_password: boolean;
  };
  temporary_password: string | null;
  temporary_password_delivery?: {
    id: number | string | null;
    status: string | null;
    purpose: string | null;
    recipient_email: string | null;
  } | null;
  created: boolean;
};

export type CoreHealth = {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
};

export type FiscalCalendarEntry = {
  id: number;
  fiscal_calendar_id: number;
  date: string;
  type: "holiday" | "declaration_deadline" | "other";
  name: string;
  is_non_business_day: boolean;
  form_code: string | null;
  applicability: string | null;
  notes: string | null;
  active: boolean;
  updated_at: string | null;
};

export type FiscalCalendar = {
  id: number;
  year: number;
  name: string;
  status: "draft" | "published" | "archived";
  source_name: string | null;
  source_reference: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string | null;
  entries: FiscalCalendarEntry[];
};

export type FiscalCalendarPayload = Pick<
  FiscalCalendar,
  "year" | "name" | "status" | "source_name" | "source_reference" | "notes"
>;
export type FiscalCalendarEntryPayload = Pick<
  FiscalCalendarEntry,
  | "date"
  | "type"
  | "name"
  | "is_non_business_day"
  | "form_code"
  | "applicability"
  | "notes"
  | "active"
>;

export type NotificationsHealth = {
  status: string;
  service: string;
  timestamp: string;
};

export type NotificationSenderAlias = {
  id: number;
  scope_type: "global" | "empresa";
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
  scope_type: "global" | "empresa";
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
  status: "active" | "inactive" | string;
  metadata: Record<string, unknown> | null;
  sender_alias: Pick<
    NotificationSenderAlias,
    "id" | "purpose" | "from_email" | "from_name" | "is_active"
  > | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationActivity = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  status: "active" | "inactive" | string;
  metadata: Record<string, unknown> | null;
  actions: NotificationAction[];
  created_at: string | null;
  updated_at: string | null;
};

export type NotificationActivityPayload = {
  key: string;
  name: string;
  description?: string | null;
  status?: "active" | "inactive";
  metadata?: Record<string, unknown> | null;
};

export type NotificationActionPayload = {
  key: string;
  name: string;
  purpose: string;
  notification_sender_alias_id?: number | null;
  status?: "active" | "inactive";
  metadata?: Record<string, unknown> | null;
};

export type NotificationActionUpdatePayload = Partial<
  Pick<
    NotificationActionPayload,
    "name" | "notification_sender_alias_id" | "status" | "metadata"
  >
>;

export type NotificationMailTransport = {
  id: number;
  name: string;
  mailer: "smtp" | string;
  host: string;
  port: number;
  scheme: "ssl" | "tls" | null;
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
  scheme: "ssl" | "tls" | "null";
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
  ambiente: "00" | "01";
  empresa_id?: number;
  sucursal_id?: number;
  punto_venta_id?: number;
  codigoEstablecimiento?: string;
  codigoPuntoVenta?: string;
  correlativo?: number;
  idempotency_key?: string;
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

export type FiscalActorSummary = {
  user_id?: number | null;
  platform_user_id?: number | null;
  platform_session_id?: string | null;
  billing_access_token_id?: number | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  recorded_at?: string | null;
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
  performed_by?: FiscalActorSummary | null;
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
    status:
      | "eligible"
      | "expired"
      | "invalidated"
      | "not_transmitted"
      | "missing_receipt_stamp"
      | "missing_transmission_date"
      | string;
    reason: string;
    deadline: string | null;
    baseDate: string | null;
    rule: "three_months" | "tenth_business_day_next_month" | "unknown" | string;
  };
  retorno?: {
    eligible: boolean;
    status:
      | "eligible"
      | "unsupported_type"
      | "not_accepted"
      | "missing_receipt_stamp"
      | "missing_receipt_date"
      | "expired"
      | "missing_total"
      | "fully_returned"
      | string;
    reason: string;
    deadline: string | null;
    baseDate: string | null;
    originTotal: number;
    returnedAmount: number;
    remainingAmount: number;
    rule: "three_months_from_receipt_stamp" | string;
  } | null;
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

export type DteSalesAnnexBookKey =
  "ventas_contribuyente" | "ventas_consumidor_final";

export type DteSalesAnnexDataset = {
  official_rows: string[][];
  preview: Array<{
    fecha_emision?: string;
    tipo_dte?: string;
    numero_control?: string;
    codigo_generacion?: string;
    receptor_nombre?: string;
    total_pagar?: number;
    [key: string]: unknown;
  }>;
  issues: string[];
};

export type DteSalesAnnexResponse = {
  data: Record<DteSalesAnnexBookKey, DteSalesAnnexDataset>;
  meta: {
    from: string | null;
    to: string | null;
    empresa_id: number | null;
    counts: Record<DteSalesAnnexBookKey, number>;
  };
  headers: Record<DteSalesAnnexBookKey, string[]>;
};

export type DteInvalidatedAnnexBookKey = "documentos_invalidados";

export type DteInvalidatedAnnexResponse = {
  data: Record<DteInvalidatedAnnexBookKey, DteSalesAnnexDataset>;
  meta: {
    from?: string | null;
    to?: string | null;
    empresa_id?: number | null;
    counts: Record<DteInvalidatedAnnexBookKey, number>;
  };
  headers: Record<DteInvalidatedAnnexBookKey, string[]>;
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
  performed_by?: FiscalActorSummary | null;
  transmitted_by?: FiscalActorSummary | null;
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
  ambiente: "00" | "01";
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
  ambiente: "00" | "01";
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
  lifecycle_status?: "active" | "inactive";
};

export type BillingPuntoVentaPayload = {
  codigo: string;
  nombre: string;
  tipo?: string | null;
  lifecycle_status?: "active" | "inactive";
};

export type BillingMhConfig = {
  id: number;
  certificado_id: number | null;
  ambiente: "00" | "01";
  profile: string;
  active: boolean;
  transmission_provider: "stub" | "mh";
  signing_provider: "stub" | "jar";
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
  ambiente: "00" | "01";
  lifecycle_status: "active" | "inactive";
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

export type DteIssueProgressEvent =
  | {
      type: "stage";
      stage: string;
      progress: number;
      message: string;
      attempt?: number;
      max_attempts?: number;
      numero_control?: string;
      correlativo?: number;
    }
  | {
      type: "retry";
      stage: string;
      progress: number;
      message: string;
      attempt: number;
      next_attempt: number;
      max_attempts?: number;
      numero_control?: string;
      correlativo?: number;
      conflict?: boolean;
    }
  | {
      type: "completed";
      ok: boolean;
      progress?: number;
      message: string;
      document_id?: number;
      attempts?: DteIssueResponse["attempts"];
      status?: string;
    }
  | ({ type: "result"; ok: true } & DteIssueResponse)
  | {
      type: "result";
      ok: false;
      message: string;
      status?: string;
      errors?: string[];
      issue_request_id?: number;
    };

export type BillingContext = {
  user: Pick<
    AuthUser,
    "id" | "name" | "email" | "role" | "is_backoffice"
  > | null;
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
  ambiente: "00" | "01";
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

export type BillingCompanyUpdatePayload = Partial<
  Omit<
    BillingCompanyPayload,
    | "tenant_slug"
    | "sucursal_nombre"
    | "sucursal_codigo"
    | "punto_venta_codigo"
    | "punto_venta_nombre"
    | "punto_venta_tipo"
  >
> & {
  lifecycle_status?: "active" | "inactive";
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
  ambiente: "00" | "01";
  certificado_id?: number | null;
  active?: boolean;
  transmission_provider: "stub" | "mh";
  signing_provider: "stub" | "jar";
  base_url?: string | null;
  auth_url?: string | null;
  reception_url?: string | null;
  event_reception_url?: string | null;
  query_url?: string | null;
  signer_url?: string | null;
  mh_nit?: string | null;
  mh_user?: string | null;
  mh_password?: string | null;
  auth_payload_mode?: "form" | "json";
  auth_token_path?: string | null;
  signer_nit?: string | null;
  signer_password_pri?: string | null;
  signer_activo?: boolean;
  simulate_unavailable?: boolean;
  verify?: boolean;
};

export type BillingSettings = Omit<
  BillingSettingsPayload,
  | "mh_nit"
  | "mh_user"
  | "mh_password"
  | "signer_nit"
  | "signer_password_pri"
  | "signer_activo"
> & {
  id: number;
  profile: string;
  credentials_configured: boolean;
  signer_credentials_configured: boolean;
  last_verified_at: string | null;
};

export type BillingSignerVerification = {
  status: "ok" | "error";
  service: string;
  available: boolean;
  status_url: string;
  status_code?: number;
  message?: string;
  signature_preview?: string;
  last_verified_at?: string;
};

export type MhBearerVerification = {
  status: "ok" | "error";
  service?: string;
  available: boolean;
  http_status?: number;
  auth_url?: string;
  token_type?: "Bearer";
  bearer_token?: string;
  token_preview?: string;
  cache_status?: "cached" | "refreshed";
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
  ambiente: "00" | "01";
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
  idempotent?: boolean;
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

export type DteThermalArtifact = {
  format: "stelfaro-dte-thermal" | string;
  version: number;
  documentId: number;
  numeroControl: string;
  codigoGeneracion: string;
  profiles: Record<
    "58" | "80" | string,
    {
      paperWidth: number;
      widthChars: number;
      operations: Array<{
        name: string;
        args: unknown[];
        section?: "logo" | "issuer" | string;
      }>;
    }
  >;
};

export type ThermalLogoRaster = {
  width: number;
  height: number;
  data: string;
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
    if (value === null || value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  return searchParams;
}

function normalizeServiceBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${trimmed}`;
    }

    return trimmed.replace(/^\/+/, "");
  }

  return trimmed.replace(/^\/+/, "");
}

function buildServiceHttp(
  baseUrl: string,
  authToken?: string | null | (() => string | null | undefined),
  credentials?: RequestCredentials,
): KyInstance {
  return ky.create({
    prefixUrl: normalizeServiceBaseUrl(baseUrl),
    timeout: 15000,
    credentials,
    hooks: {
      beforeRequest: [
        (request) => {
          const token =
            typeof authToken === "function" ? authToken() : authToken;
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        },
      ],
      beforeError: [
        async (error) => {
          const contentType = error.response.headers.get("content-type") ?? "";
          const body = await error.response.text().catch(() => "");
          const trimmedBody = body.trim();

          if (contentType.includes("application/json") && trimmedBody !== "") {
            try {
              const payload = JSON.parse(trimmedBody) as {
                message?: unknown;
                errors?: unknown;
              };
              const message =
                typeof payload.message === "string" ? payload.message : "";
              const errors =
                payload.errors && typeof payload.errors === "object"
                  ? Object.values(payload.errors as Record<string, unknown>)
                      .flat()
                      .map((item) => String(item))
                      .join(" ")
                  : "";
              (error as typeof error & { payload?: unknown }).payload = payload;
              error.message = message || errors || error.message;
              return error;
            } catch {
              return error;
            }
          }

          const isHtmlResponse =
            contentType.includes("text/html") ||
            /^<!doctype\s+html/i.test(trimmedBody) ||
            /<html(?:\s|>)/i.test(trimmedBody);

          if (isHtmlResponse) {
            error.message =
              error.response.status === 404
                ? "La acción solicitada no está disponible. Actualiza la página e inténtalo nuevamente."
                : `No fue posible completar la solicitud (HTTP ${error.response.status}).`;
            return error;
          }

          error.message = trimmedBody || error.message;
          return error;
        },
      ],
    },
  });
}

export class NotificationsClient {
  private readonly http: KyInstance;

  constructor(baseUrl: string, options: NotificationsClientOptions = {}) {
    this.http = buildServiceHttp(
      baseUrl,
      options.authToken,
      options.credentials,
    );
  }

  health(): Promise<NotificationsHealth> {
    return this.http.get("health").json();
  }

  senderAliases(
    params: { scope_type?: string; scope_id?: number; purpose?: string } = {},
  ): Promise<{ data: NotificationSenderAlias[] }> {
    return this.http
      .get("sender-aliases", { searchParams: compactParams(params) })
      .json();
  }

  saveSenderAlias(
    payload: NotificationSenderAliasPayload,
  ): Promise<{ data: NotificationSenderAlias }> {
    return this.http.post("sender-aliases", { json: payload }).json();
  }

  updateSenderAlias(
    id: number,
    payload: Partial<NotificationSenderAliasPayload>,
  ): Promise<{ data: NotificationSenderAlias }> {
    return this.http.patch(`sender-aliases/${id}`, { json: payload }).json();
  }

  activities(
    params: { key?: string; status?: string } = {},
  ): Promise<{ data: NotificationActivity[] }> {
    return this.http
      .get("activities", { searchParams: compactParams(params) })
      .json();
  }

  saveActivity(
    payload: NotificationActivityPayload,
  ): Promise<{ data: NotificationActivity }> {
    return this.http.post("activities", { json: payload }).json();
  }

  saveAction(
    activityId: number,
    payload: NotificationActionPayload,
  ): Promise<{ data: NotificationAction }> {
    return this.http
      .post(`activities/${activityId}/actions`, { json: payload })
      .json();
  }

  updateAction(
    id: number,
    payload: NotificationActionUpdatePayload,
  ): Promise<{ data: NotificationAction }> {
    return this.http.patch(`actions/${id}`, { json: payload }).json();
  }

  mailTransport(): Promise<{ data: NotificationMailTransport | null }> {
    return this.http.get("mail-transport").json();
  }

  saveMailTransport(
    payload: NotificationMailTransportPayload,
  ): Promise<{ data: NotificationMailTransport }> {
    return this.http.post("mail-transport", { json: payload }).json();
  }
}

export class PlatformClient {
  private readonly http: KyInstance;

  constructor(baseUrl: string, options: PlatformClientOptions = {}) {
    this.http = buildServiceHttp(
      baseUrl,
      options.authToken,
      options.credentials,
    );
  }

  me(): Promise<unknown> {
    return this.http.get("me").json();
  }

  userProfile(): Promise<{ data: PlatformUserProfile }> {
    return this.http.get("me/profile").json();
  }

  updateUserProfile(
    payload: Pick<PlatformUserProfile, "name" | "email" | "phone">,
  ): Promise<{ data: PlatformUserProfile }> {
    return this.http.patch("me/profile", { json: payload }).json();
  }

  updateUserPassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string; data: PlatformUserProfile }> {
    return this.http.put("me/password", { json: payload }).json();
  }

  userSecurity(): Promise<{
    sessions: PlatformUserSession[];
    events: PlatformUserSecurityEvent[];
  }> {
    return this.http.get("me/security").json();
  }

  closeUserSession(sessionId: string): Promise<{ message: string }> {
    return this.http
      .delete(`me/security/sessions/${encodeURIComponent(sessionId)}`)
      .json();
  }

  closeOtherUserSessions(): Promise<{ message: string; closed: number }> {
    return this.http.post("me/security/sessions/revoke-others").json();
  }

  tenantRequests(
    tenantId: number,
    params: { status?: string; type?: string } = {},
  ): Promise<{ data: PlatformTenantRequest[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/requests`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createTenantRequest(
    tenantId: number,
    payload: PlatformCreateTenantRequestPayload,
  ): Promise<{ data: PlatformTenantRequest }> {
    return this.http
      .post(`platform/tenants/${tenantId}/requests`, { json: payload })
      .json();
  }

  adminTenantRequests(
    params: { status?: string; type?: string; q?: string } = {},
  ): Promise<{ data: PlatformTenantRequest[] }> {
    return this.http
      .get("admin/platform/requests", { searchParams: compactParams(params) })
      .json();
  }

  updateAdminTenantRequest(
    requestId: number,
    payload: {
      status: PlatformTenantRequestStatus;
      admin_response?: string | null;
    },
  ): Promise<{ data: PlatformTenantRequest }> {
    return this.http
      .patch(`admin/platform/requests/${requestId}`, { json: payload })
      .json();
  }

  reviewAdminTenantRequest(
    requestId: number,
  ): Promise<{ data: PlatformTenantRequest }> {
    return this.http.post(`admin/platform/requests/${requestId}/review`).json();
  }

  createUserFromAdminRequest(
    requestId: number,
    payload: PlatformCreateTenantUserPayload,
  ): Promise<{
    data: PlatformTenantRequest;
    user: { id: number; name: string; email: string };
    temporary_password: string | null;
    temporary_password_delivery: PlatformCreateTenantUserResponse["temporary_password_delivery"];
    created: boolean;
  }> {
    return this.http
      .post(`admin/platform/requests/${requestId}/create-user`, {
        json: payload,
      })
      .json();
  }

  createBranchFromAdminRequest(
    requestId: number,
    payload: BillingSucursalPayload,
  ): Promise<{ data: PlatformTenantRequest }> {
    return this.http
      .post(`admin/platform/requests/${requestId}/create-branch`, {
        json: payload,
      })
      .json();
  }

  createPointOfSaleFromAdminRequest(
    requestId: number,
    payload: BillingPuntoVentaPayload & { sucursal_id: number },
  ): Promise<{ data: PlatformTenantRequest }> {
    return this.http
      .post(`admin/platform/requests/${requestId}/create-point-of-sale`, {
        json: payload,
      })
      .json();
  }

  revealTenantRequestCredentials(
    tenantId: number,
    requestId: number,
  ): Promise<{ data: { email: string; temporary_password: string } }> {
    return this.http
      .post(`platform/tenants/${tenantId}/requests/${requestId}/credentials`)
      .json();
  }

  internalNotifications(
    tenantId: number,
    limit = 50,
  ): Promise<PlatformInternalNotificationsResponse> {
    return this.http
      .get("platform/notifications", {
        searchParams: { tenant_id: tenantId, limit, scope: "tenant" },
      })
      .json();
  }

  adminInternalNotifications(
    limit = 50,
    category?: string,
  ): Promise<PlatformInternalNotificationsResponse> {
    return this.http
      .get("platform/notifications", {
        searchParams: compactParams({ limit, scope: "admin", category }),
      })
      .json();
  }

  readInternalNotification(
    notificationId: number,
  ): Promise<{ data: PlatformInternalNotification }> {
    return this.http
      .post(`platform/notifications/${notificationId}/read`)
      .json();
  }

  readAllInternalNotifications(
    tenantId?: number | null,
    scope: "tenant" | "admin" = "tenant",
    category?: string,
  ): Promise<{ unread_count: number }> {
    return this.http
      .post("platform/notifications/read-all", {
        json: {
          tenant_id: tenantId || null,
          scope,
          category: category || null,
        },
      })
      .json();
  }

  deleteInternalNotification(
    notificationId: number,
  ): Promise<{ message: string }> {
    return this.http.delete(`platform/notifications/${notificationId}`).json();
  }

  globalUsers(): Promise<{ users: PlatformGlobalUser[] }> {
    return this.http.get("admin/platform/users").json();
  }

  auditLogs(
    params: {
      source?: string;
      q?: string;
      result?: string;
      date_from?: string;
      date_to?: string;
      limit?: number;
    } = {},
  ): Promise<PlatformAuditLogsResponse> {
    return this.http
      .get("admin/platform/audit-logs", { searchParams: compactParams(params) })
      .json();
  }

  tenantAuditLogs(
    tenantId: number,
    params: {
      q?: string;
      result?: string;
      date_from?: string;
      date_to?: string;
      limit?: number;
    } = {},
  ): Promise<PlatformAuditLogsResponse> {
    return this.http
      .get(`platform/tenants/${tenantId}/audit-logs`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  subscriptions(): Promise<PlatformSubscriptionsResponse> {
    return this.http.get("admin/platform/subscriptions").json();
  }

  tenantSubscriptionByCoreEmpresa(coreEmpresaId: number): Promise<{
    plans: PlatformSubscriptionPlan[];
    row: PlatformSubscriptionTenantRow | null;
  }> {
    return this.http
      .get(
        `admin/platform/tenants/by-core-empresa/${coreEmpresaId}/subscription`,
      )
      .json();
  }

  tenantSubscription(
    tenantId: number,
  ): Promise<{ row: PlatformSubscriptionTenantRow }> {
    return this.http.get(`platform/tenants/${tenantId}/subscription`).json();
  }

  tenantSubscriptionByCoreEmpresaForTenant(
    coreEmpresaId: number,
  ): Promise<{ row: PlatformSubscriptionTenantRow }> {
    return this.http
      .get(`platform/tenants/by-core-empresa/${coreEmpresaId}/subscription`)
      .json();
  }

  updateTenantSubscription(
    tenantId: number,
    payload: PlatformSubscriptionUpdatePayload,
  ): Promise<{ subscription: PlatformTenantSubscription }> {
    return this.http
      .put(`admin/platform/tenants/${tenantId}/subscription`, { json: payload })
      .json();
  }

  updateTenantSubscriptionByCoreEmpresa(
    coreEmpresaId: number,
    payload: PlatformSubscriptionUpdatePayload,
  ): Promise<{ subscription: PlatformTenantSubscription }> {
    return this.http
      .put(
        `admin/platform/tenants/by-core-empresa/${coreEmpresaId}/subscription`,
        { json: payload },
      )
      .json();
  }

  tenantByCoreEmpresa(
    coreEmpresaId: number,
  ): Promise<{ tenant: PlatformTenantLookup | null }> {
    return this.http
      .get(`admin/platform/tenants/by-core-empresa/${coreEmpresaId}`)
      .json();
  }

  purgeTenantByCoreEmpresa(
    coreEmpresaId: number,
  ): Promise<{ deleted: boolean }> {
    return this.http
      .post(`admin/platform/tenants/by-core-empresa/${coreEmpresaId}/purge`)
      .json();
  }

  tenantUsers(tenantId: number): Promise<PlatformTenantUsersResponse> {
    return this.http.get(`platform/tenants/${tenantId}/users`).json();
  }

  workshopOrders(
    tenantId: number,
    params: {
      q?: string;
      status?: string;
      priority?: string;
      payment_status?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<WorkshopOrdersResponse> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/orders`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  followUpNotes(
    tenantId: number,
    params: {
      q?: string;
      status?: string;
      category?: string;
      due?: string;
      note_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<FollowUpNotesResponse> {
    return this.http
      .get(`platform/tenants/${tenantId}/follow-up-notes`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createFollowUpNote(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: FollowUpNote }> {
    return this.http
      .post(`platform/tenants/${tenantId}/follow-up-notes`, { json: payload })
      .json();
  }

  updateFollowUpNote(
    tenantId: number,
    noteId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: FollowUpNote }> {
    return this.http
      .put(`platform/tenants/${tenantId}/follow-up-notes/${noteId}`, {
        json: payload,
      })
      .json();
  }

  resolveFollowUpNote(
    tenantId: number,
    noteId: number,
    payload: {
      resolution_type: "invoiced" | "returned" | "completed" | "other";
      resolution_note?: string | null;
      resolution_reference?: string | null;
    },
  ): Promise<{ data: FollowUpNote }> {
    return this.http
      .post(`platform/tenants/${tenantId}/follow-up-notes/${noteId}/resolve`, {
        json: payload,
      })
      .json();
  }

  discardFollowUpNote(
    tenantId: number,
    noteId: number,
    reason: string,
  ): Promise<{ data: FollowUpNote }> {
    return this.http
      .post(`platform/tenants/${tenantId}/follow-up-notes/${noteId}/discard`, {
        json: { reason },
      })
      .json();
  }

  workshopDashboard(tenantId: number): Promise<WorkshopDashboard> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/dashboard`)
      .json();
  }

  commercialDashboard(tenantId: number): Promise<PlatformCommercialDashboard> {
    return this.http
      .get(`platform/tenants/${tenantId}/commercial/dashboard`)
      .json();
  }

  salesOrders(
    tenantId: number,
    params: {
      q?: string;
      status?: string;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<{ data: PlatformSalesOrder[]; meta: PaginationMeta }> {
    return this.http
      .get(`platform/tenants/${tenantId}/sales-orders`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createSalesOrder(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformSalesOrder }> {
    return this.http
      .post(`platform/tenants/${tenantId}/sales-orders`, { json: payload })
      .json();
  }

  updateSalesOrder(
    tenantId: number,
    orderId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformSalesOrder }> {
    return this.http
      .patch(`platform/tenants/${tenantId}/sales-orders/${orderId}`, {
        json: payload,
      })
      .json();
  }

  paySalesOrder(
    tenantId: number,
    orderId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformSalesOrder }> {
    return this.http
      .post(`platform/tenants/${tenantId}/sales-orders/${orderId}/payments`, {
        json: payload,
      })
      .json();
  }

  cancelSalesOrder(
    tenantId: number,
    orderId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformSalesOrder }> {
    return this.http
      .post(`platform/tenants/${tenantId}/sales-orders/${orderId}/cancel`, {
        json: payload,
      })
      .json();
  }

  quotations(
    tenantId: number,
    params: { q?: string; status?: string } = {},
  ): Promise<{ data: PlatformQuotation[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/quotations`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createQuotation(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformQuotation }> {
    return this.http
      .post(`platform/tenants/${tenantId}/quotations`, { json: payload })
      .json();
  }

  updateQuotation(
    tenantId: number,
    quotationId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformQuotation }> {
    return this.http
      .put(`platform/tenants/${tenantId}/quotations/${quotationId}`, {
        json: payload,
      })
      .json();
  }

  duplicateQuotation(
    tenantId: number,
    quotationId: number,
  ): Promise<{ data: PlatformQuotation }> {
    return this.http
      .post(`platform/tenants/${tenantId}/quotations/${quotationId}/duplicate`)
      .json();
  }

  updateQuotationStatus(
    tenantId: number,
    quotationId: number,
    status: string,
    details: Record<string, unknown> = {},
  ): Promise<{ data: PlatformQuotation }> {
    return this.http
      .patch(`platform/tenants/${tenantId}/quotations/${quotationId}/status`, {
        json: { status, ...details },
      })
      .json();
  }

  convertQuotation(
    tenantId: number,
    quotationId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: { order_id: number; order_number: string } }> {
    return this.http
      .post(`platform/tenants/${tenantId}/quotations/${quotationId}/convert`, {
        json: payload,
      })
      .json();
  }

  receivables(
    tenantId: number,
    params: {
      q?: string;
      status?: string;
      aging?: "current" | "overdue" | "30" | "60" | "90";
    } = {},
  ): Promise<{
    data: PlatformReceivable[];
    summary: { open: number; accounts: number; overdue: number };
  }> {
    return this.http
      .get(`platform/tenants/${tenantId}/receivables`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  cashOverview(
    tenantId: number,
    params: {
      date_from?: string;
      date_to?: string;
      method?: string;
      direction?: string;
      cash_register_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<PlatformCashOverview> {
    return this.http
      .get(`platform/tenants/${tenantId}/cash`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  cashSettings(
    tenantId: number,
  ): Promise<{ data: PlatformCashRegisterSettings[] }> {
    return this.http.get(`platform/tenants/${tenantId}/cash/settings`).json();
  }

  createCashSettings(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformCashRegisterSettings }> {
    return this.http
      .post(`platform/tenants/${tenantId}/cash/settings`, { json: payload })
      .json();
  }

  updateCashSettings(
    tenantId: number,
    registerId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformCashRegisterSettings }> {
    return this.http
      .put(`platform/tenants/${tenantId}/cash/settings/${registerId}`, {
        json: payload,
      })
      .json();
  }

  openCashSession(
    tenantId: number,
    payload: {
      opening_balance: number;
      cash_register_id?: number;
      name?: string;
      notes?: string | null;
    },
  ): Promise<{ data: PlatformCashSession }> {
    return this.http
      .post(`platform/tenants/${tenantId}/cash/sessions`, { json: payload })
      .json();
  }

  closeCashSession(
    tenantId: number,
    sessionId: number,
    payload: { declared_balance: number; notes?: string | null },
  ): Promise<{ data: PlatformCashSession }> {
    return this.http
      .post(`platform/tenants/${tenantId}/cash/sessions/${sessionId}/close`, {
        json: payload,
      })
      .json();
  }

  createCashMovement(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformCashMovement }> {
    return this.http
      .post(`platform/tenants/${tenantId}/cash/movements`, { json: payload })
      .json();
  }

  reverseCashMovement(
    tenantId: number,
    movementId: number,
    reason: string,
  ): Promise<{ data: PlatformCashMovement }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/cash/movements/${movementId}/reverse`,
        { json: { reason } },
      )
      .json();
  }

  reconcileCashExpense(
    tenantId: number,
    expenseId: number,
    purchaseId: number,
  ): Promise<{
    data: {
      id: number;
      status: string;
      inventory_purchase_id: number;
      difference: number;
    };
  }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/cash/expenses/${expenseId}/reconcile`,
        { json: { inventory_purchase_id: purchaseId } },
      )
      .json();
  }

  commercialSalesReport(
    tenantId: number,
    params: {
      date_from?: string;
      date_to?: string;
      source_type?: string;
      document_type?: string;
      payment_status?: string;
      core_sucursal_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<PlatformSalesReport> {
    return this.http
      .get(`platform/tenants/${tenantId}/cash/sales-report`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  recordCommercialSalePayment(
    tenantId: number,
    saleId: number,
    payload: {
      amount: number;
      method: "cash" | "card" | "transfer" | "other";
      reference?: string | null;
      notes?: string | null;
      idempotency_key: string;
    },
  ): Promise<{
    data: {
      sale_id: number;
      payment_status: string;
      outstanding_amount: number;
      movement_id: number;
      created: boolean;
    };
  }> {
    return this.http
      .post(`platform/tenants/${tenantId}/cash/sales/${saleId}/payments`, {
        json: payload,
      })
      .json();
  }

  workshopOrder(
    tenantId: number,
    orderId: number,
  ): Promise<{ data: WorkshopOrder }> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/orders/${orderId}`)
      .json();
  }

  workshopMaterials(
    tenantId: number,
    orderId: number,
  ): Promise<{ data: WorkshopMaterial[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/orders/${orderId}/materials`)
      .json();
  }

  reserveWorkshopMaterial(
    tenantId: number,
    orderId: number,
    payload: { catalog_item_id: number; quantity: number; description?: string | null },
  ): Promise<{ data: WorkshopMaterial }> {
    return this.http
      .post(`platform/tenants/${tenantId}/workshop/orders/${orderId}/materials`, { json: payload })
      .json();
  }

  consumeWorkshopMaterial(
    tenantId: number,
    orderId: number,
    materialId: number,
  ): Promise<{ data: WorkshopMaterial }> {
    return this.http
      .post(`platform/tenants/${tenantId}/workshop/orders/${orderId}/materials/${materialId}/consume`)
      .json();
  }

  releaseWorkshopMaterial(
    tenantId: number,
    orderId: number,
    materialId: number,
  ): Promise<{ data: WorkshopMaterial }> {
    return this.http
      .post(`platform/tenants/${tenantId}/workshop/orders/${orderId}/materials/${materialId}/release`)
      .json();
  }

  returnWorkshopMaterial(
    tenantId: number,
    orderId: number,
    materialId: number,
    notes: string,
  ): Promise<{ data: WorkshopMaterial }> {
    return this.http
      .post(`platform/tenants/${tenantId}/workshop/orders/${orderId}/materials/${materialId}/return`, { json: { notes } })
      .json();
  }

  workshopReception(
    tenantId: number,
    receptionId: number,
  ): Promise<{
    data: {
      id: number;
      ticket: string;
      received_at: string;
      orders: WorkshopOrder[];
    };
  }> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/receptions/${receptionId}`)
      .json();
  }

  createWorkshopOrder(
    tenantId: number,
    payload: WorkshopOrderPayload,
  ): Promise<{ data: WorkshopOrder }> {
    return this.http
      .post(`platform/tenants/${tenantId}/workshop/orders`, { json: payload })
      .json();
  }

  updateWorkshopOrder(
    tenantId: number,
    orderId: number,
    payload: {
      status?: string;
      diagnosis?: string | null;
      estimated_total?: number | null;
      approval_decision?: "approved" | "rejected";
      approval_method?: "whatsapp" | "call" | "in_person";
      approval_notes?: string | null;
      payment?: {
        amount: number;
        method: "cash" | "card" | "transfer" | "other";
        reference?: string | null;
        notes?: string | null;
      };
    },
  ): Promise<{ data: WorkshopOrder }> {
    return this.http
      .patch(`platform/tenants/${tenantId}/workshop/orders/${orderId}`, {
        json: payload,
      })
      .json();
  }

  settleWorkshopOrder(
    tenantId: number,
    orderId: number,
    payload: {
      action: "deliver_close" | "cancel_close";
      final_total?: number;
      retained_amount?: number;
      diagnostic_charge?: number;
      amount_received?: number;
      method?: "cash" | "card" | "transfer" | "other";
      reference?: string | null;
      notes?: string | null;
      document_choice?: "work_order" | "dte";
      dte_type?: "01" | "03";
      payment_timing?: "paid_now" | "credit";
    },
  ): Promise<{ data: WorkshopOrder }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/workshop/orders/${orderId}/settlement`,
        { json: payload },
      )
      .json();
  }

  recordWorkshopOrderPayment(
    tenantId: number,
    orderId: number,
    payload: {
      amount: number;
      method: "cash" | "card" | "transfer" | "other";
      reference?: string | null;
      notes?: string | null;
    },
  ): Promise<{ data: WorkshopOrder }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/workshop/orders/${orderId}/payments`,
        { json: payload },
      )
      .json();
  }

  linkWorkshopOrderInvoice(
    tenantId: number,
    orderId: number,
    payload: {
      core_dte_document_id: number;
      dte_number: string;
      dte_generation_code: string;
      dte_type: "01" | "03";
    },
  ): Promise<{ data: WorkshopOrder }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/workshop/orders/${orderId}/invoice-link`,
        { json: payload },
      )
      .json();
  }

  createWorkshopPhotoSession(
    tenantId: number,
    orderId: number,
  ): Promise<{ data: { url: string; expires_at: string } }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/workshop/orders/${orderId}/photo-session`,
      )
      .json();
  }

  workshopDeviceAccess(
    tenantId: number,
    orderId: number,
  ): Promise<{ data: { url: string; pin: string } }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/workshop/orders/${orderId}/device-access`,
      )
      .json();
  }

  workshopTicketSettings(
    tenantId: number,
  ): Promise<{ data: WorkshopTicketSettings }> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/ticket-settings`)
      .json();
  }

  updateWorkshopTicketSettings(
    tenantId: number,
    payload: WorkshopTicketSettings,
  ): Promise<{ data: WorkshopTicketSettings }> {
    return this.http
      .patch(`platform/tenants/${tenantId}/workshop/ticket-settings`, {
        json: payload,
      })
      .json();
  }

  workshopOrderPhotos(
    tenantId: number,
    orderId: number,
  ): Promise<{ data: WorkshopOrderPhoto[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/workshop/orders/${orderId}/photos`)
      .json();
  }

  catalogCategories(
    tenantId: number,
    params: { status?: string } = {},
  ): Promise<{ data: PlatformCatalogCategory[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/catalog/categories`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createCatalogCategory(
    tenantId: number,
    payload: { name: string; kind?: string; status?: string },
  ): Promise<{ data: PlatformCatalogCategory }> {
    return this.http
      .post(`platform/tenants/${tenantId}/catalog/categories`, {
        json: payload,
      })
      .json();
  }

  updateCatalogCategory(
    tenantId: number,
    categoryId: number,
    payload: { name?: string; kind?: string; status?: string },
  ): Promise<{ data: PlatformCatalogCategory }> {
    return this.http
      .patch(`platform/tenants/${tenantId}/catalog/categories/${categoryId}`, {
        json: payload,
      })
      .json();
  }

  catalogItems(
    tenantId: number,
    params: {
      q?: string;
      status?: string;
      item_type?: string;
      controls_inventory?: boolean;
      core_sucursal_id?: number;
      category_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<PlatformCatalogItemsResponse> {
    return this.http
      .get(`platform/tenants/${tenantId}/catalog/items`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createCatalogItem(
    tenantId: number,
    payload: PlatformCatalogItemPayload,
  ): Promise<{ data: PlatformCatalogItem }> {
    return this.http
      .post(`platform/tenants/${tenantId}/catalog/items`, { json: payload })
      .json();
  }

  updateCatalogItem(
    tenantId: number,
    itemId: number,
    payload: Partial<PlatformCatalogItemPayload>,
  ): Promise<{ data: PlatformCatalogItem }> {
    return this.http
      .patch(`platform/tenants/${tenantId}/catalog/items/${itemId}`, {
        json: payload,
      })
      .json();
  }

  deactivateCatalogItem(
    tenantId: number,
    itemId: number,
  ): Promise<{ data: PlatformCatalogItem }> {
    return this.http
      .delete(`platform/tenants/${tenantId}/catalog/items/${itemId}`)
      .json();
  }

  inventorySuppliers(
    tenantId: number,
    params: { q?: string; status?: string; per_page?: number } = {},
  ): Promise<{ data: PlatformInventorySupplier[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/suppliers`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createInventorySupplier(
    tenantId: number,
    payload: Partial<PlatformInventorySupplier>,
  ): Promise<{ data: PlatformInventorySupplier }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/suppliers`, {
        json: payload,
      })
      .json();
  }

  createInventoryPurchase(
    tenantId: number,
    payload: PlatformInventoryPurchasePayload,
  ): Promise<{ data: unknown }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/purchases`, {
        json: payload,
      })
      .json();
  }

  inventoryPurchases(
    tenantId: number,
    params: { page?: number; per_page?: number } = {},
  ): Promise<PlatformPaginatedResponse<PlatformInventoryPurchase>> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/purchases`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryPurchase(
    tenantId: number,
    purchaseId: number,
  ): Promise<{ data: PlatformInventoryPurchase }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/purchases/${purchaseId}`)
      .json();
  }

  importInventoryPurchaseDteJson(
    tenantId: number,
    payload: Record<string, unknown>,
  ): Promise<{ data: PlatformInventoryPurchaseImportPreview }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/inventory/purchases/import-dte-json`,
        { json: { payload } },
      )
      .json();
  }

  inventoryLots(
    tenantId: number,
    params: {
      catalog_item_id?: number;
      core_sucursal_id?: number;
      available_only?: boolean;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<PlatformPaginatedResponse<PlatformInventoryLot>> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/lots`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryMovements(
    tenantId: number,
    params: {
      catalog_item_id?: number;
      core_sucursal_id?: number;
      movement_type?: string;
      reason?: string;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<PlatformPaginatedResponse<PlatformInventoryMovement>> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/movements`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  createInventoryAdjustment(
    tenantId: number,
    payload: {
      catalog_item_id: number;
      core_sucursal_id?: number | null;
      core_sucursal_code?: string | null;
      core_sucursal_name?: string | null;
      direction: "entry" | "exit";
      quantity: number;
      unit_cost?: number | null;
      notes?: string | null;
    },
  ): Promise<{ data: PlatformInventoryMovement }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/adjustments`, {
        json: payload,
      })
      .json();
  }

  createInventoryReservation(
    tenantId: number,
    payload: PlatformInventoryReservationPayload,
  ): Promise<{ data: PlatformInventoryReservation }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/reservations`, {
        json: payload,
      })
      .json();
  }

  prepareDteFiscalSync(
    tenantId: number,
    payload: PlatformDteSyncPayload,
  ): Promise<{ data: PlatformFiscalSyncOperation }> {
    return this.http
      .post(`platform/tenants/${tenantId}/fiscal-sync/dte-issues`, {
        json: payload,
      })
      .json();
  }

  prepareInvalidationFiscalSync(
    tenantId: number,
    payload: {
      idempotency_key: string;
      invalidation_type: number;
      original_source_id: string;
      replacement_source_id?: string | null;
    },
  ): Promise<{ data: PlatformFiscalSyncOperation }> {
    return this.http
      .post(`platform/tenants/${tenantId}/fiscal-sync/invalidations`, {
        json: payload,
      })
      .json();
  }

  attachFiscalSyncResource(
    tenantId: number,
    operationId: number,
    coreResourceId: string,
  ): Promise<{ data: PlatformFiscalSyncOperation }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/fiscal-sync/operations/${operationId}/attach`,
        { json: { core_resource_id: coreResourceId } },
      )
      .json();
  }

  completeFiscalSync(
    tenantId: number,
    operationId: number,
    fact: Record<string, unknown>,
  ): Promise<{ data: PlatformFiscalSyncOperation }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/fiscal-sync/operations/${operationId}/complete`,
        { json: { fact } },
      )
      .json();
  }

  confirmInventoryReservation(
    tenantId: number,
    reservationId: number,
    payload: {
      source_type?: string | null;
      source_id?: string | null;
      source_number?: string | null;
    } = {},
  ): Promise<{ data: PlatformInventoryReservation }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/inventory/reservations/${reservationId}/confirm`,
        { json: payload },
      )
      .json();
  }

  releaseInventoryReservation(
    tenantId: number,
    reservationId: number,
  ): Promise<{ data: PlatformInventoryReservation }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/inventory/reservations/${reservationId}/release`,
      )
      .json();
  }

  reverseInventoryReservation(
    tenantId: number,
    reservationId: number,
    payload: {
      source_type?: string | null;
      source_id?: string | null;
      source_number?: string | null;
      notes?: string | null;
    } = {},
  ): Promise<{ data: PlatformInventoryReservation }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/inventory/reservations/${reservationId}/reverse`,
        { json: payload },
      )
      .json();
  }

  recordInventorySale(
    tenantId: number,
    payload: PlatformInventorySalePayload,
  ): Promise<{ data: unknown }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/sales`, { json: payload })
      .json();
  }

  inventorySaleFulfillment(
    tenantId: number,
    sourceId: string,
    sourceType = "dte",
  ): Promise<{ data: PlatformInventorySaleFulfillment }> {
    return this.http
      .get(
        `platform/tenants/${tenantId}/inventory/sales/fulfillment-by-source`,
        {
          searchParams: { source_type: sourceType, source_id: sourceId },
        },
      )
      .json();
  }

  supersedeInventorySaleBySource(
    tenantId: number,
    payload: {
      source_type?: string | null;
      original_source_id: string;
      replacement_source_id: string;
      event_id?: string | null;
      event_number?: string | null;
    },
  ): Promise<{
    data: {
      original: PlatformInventorySale;
      replacement: PlatformInventorySale;
    };
  }> {
    return this.http
      .post(
        `platform/tenants/${tenantId}/inventory/sales/supersede-by-source`,
        { json: payload },
      )
      .json();
  }

  reverseInventorySaleBySource(
    tenantId: number,
    payload: {
      source_type?: string | null;
      source_id: string;
      event_id?: string | null;
      event_number?: string | null;
      notes?: string | null;
    },
  ): Promise<{ data: unknown }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/sales/reverse-by-source`, {
        json: payload,
      })
      .json();
  }

  createInventoryCount(
    tenantId: number,
    payload: PlatformInventoryCountPayload,
  ): Promise<{ data: unknown }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/counts`, { json: payload })
      .json();
  }

  createInventoryTransfer(
    tenantId: number,
    payload: PlatformInventoryTransferPayload,
  ): Promise<{ data: unknown }> {
    return this.http
      .post(`platform/tenants/${tenantId}/inventory/transfers`, {
        json: payload,
      })
      .json();
  }

  inventorySalesReport(
    tenantId: number,
    params: {
      from?: string;
      to?: string;
      core_sucursal_id?: number;
      per_page?: number;
    } = {},
  ): Promise<{ data: PlatformInventorySaleReportRow[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/reports/sales`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryKardexReport(
    tenantId: number,
    params: {
      catalog_item_id?: number;
      core_sucursal_id?: number;
      from?: string;
      to?: string;
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<PlatformPaginatedResponse<PlatformInventoryMovement>> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/reports/kardex`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryMarginReport(
    tenantId: number,
    params: {
      from?: string;
      to?: string;
      core_sucursal_id?: number;
      per_page?: number;
    } = {},
  ): Promise<{ data: PlatformInventorySaleReportRow[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/reports/margin`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventorySummary(
    tenantId: number,
    params: { core_sucursal_id?: number } = {},
  ): Promise<{ data: PlatformInventorySummary }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/reports/summary`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryStockAlerts(
    tenantId: number,
    params: { core_sucursal_id?: number } = {},
  ): Promise<{ data: PlatformInventoryStockAlert[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/reports/stock-alerts`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryPurchaseAnnexReport(
    tenantId: number,
    params: { from?: string; to?: string } = {},
  ): Promise<{ data: PlatformInventoryPurchaseAnnexRow[] }> {
    return this.http
      .get(`platform/tenants/${tenantId}/inventory/reports/purchase-annex`, {
        searchParams: compactParams(params),
      })
      .json();
  }

  inventoryPurchaseAnnexOfficial(
    tenantId: number,
    params: { from?: string; to?: string } = {},
  ): Promise<PlatformPurchaseAnnexResponse> {
    return this.http
      .get(
        `platform/tenants/${tenantId}/inventory/reports/purchase-annex/official`,
        { searchParams: compactParams(params) },
      )
      .json();
  }

  inventoryPurchaseAnnexCsv(
    tenantId: number,
    params: { from?: string; to?: string } = {},
  ): Promise<Blob> {
    return this.http
      .get(
        `platform/tenants/${tenantId}/inventory/reports/purchase-annex/csv`,
        {
          searchParams: compactParams(params),
          headers: { Accept: "text/csv" },
        },
      )
      .blob();
  }

  tenantFiscalScope(tenantId: number): Promise<PlatformFiscalScopeResponse> {
    return this.http.get(`platform/tenants/${tenantId}/fiscal-scope`).json();
  }

  createTenantUser(
    tenantId: number,
    payload: PlatformCreateTenantUserPayload,
  ): Promise<PlatformCreateTenantUserResponse> {
    return this.http
      .post(`platform/tenants/${tenantId}/users`, { json: payload })
      .json();
  }

  inviteTenantUser(
    tenantId: number,
    payload: PlatformInviteTenantUserPayload,
  ): Promise<{ invitation: PlatformUserInvitation; token: string }> {
    return this.http
      .post(`platform/tenants/${tenantId}/invitations`, { json: payload })
      .json();
  }

  resendInvitation(
    invitationId: number,
  ): Promise<{ invitation: PlatformUserInvitation; token: string }> {
    return this.http.post(`platform/invitations/${invitationId}/resend`).json();
  }

  invitationDelivery(
    invitationId: number,
  ): Promise<PlatformInvitationDeliveryResponse> {
    return this.http
      .get(`platform/invitations/${invitationId}/delivery`)
      .json();
  }

  updateMembershipRole(
    membershipId: number,
    role: PlatformInviteTenantUserPayload["role"],
  ): Promise<{ membership: PlatformTenantUserMembership }> {
    return this.http
      .patch(`platform/memberships/${membershipId}/role`, { json: { role } })
      .json();
  }

  resetMembershipTemporaryPassword(membershipId: number): Promise<{
    user: PlatformTenantUserMembership["user"];
    temporary_password: string;
  }> {
    return this.http
      .post(`platform/memberships/${membershipId}/temporary-password`)
      .json();
  }

  updateMembershipFiscalAssignments(
    membershipId: number,
    assignments: PlatformFiscalAssignmentPayload[],
  ): Promise<{ assignments: PlatformFiscalAssignment[] }> {
    return this.http
      .put(`platform/memberships/${membershipId}/fiscal-assignments`, {
        json: { assignments },
      })
      .json();
  }

  suspendMembership(
    membershipId: number,
  ): Promise<{ membership: PlatformTenantUserMembership }> {
    return this.http
      .patch(`platform/memberships/${membershipId}/suspend`)
      .json();
  }

  reactivateMembership(
    membershipId: number,
  ): Promise<{ membership: PlatformTenantUserMembership }> {
    return this.http
      .patch(`platform/memberships/${membershipId}/reactivate`)
      .json();
  }

  removeMembership(membershipId: number): Promise<void> {
    return this.http.delete(`platform/memberships/${membershipId}`).json();
  }
}

export class CoreDteClient {
  private readonly http: KyInstance;
  private readonly authToken?: CoreDteClientOptions["authToken"];
  private readonly onSessionRefresh?: CoreDteClientOptions["onSessionRefresh"];
  private readonly credentials?: CoreDteClientOptions["credentials"];
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
            const token =
              typeof this.authToken === "function"
                ? this.authToken()
                : this.authToken;
            if (token) {
              request.headers.set("Authorization", `Bearer ${token}`);
            }
          },
        ],
        beforeError: [
          async (error) => {
            const contentType =
              error.response.headers.get("content-type") ?? "";
            const body = await error.response.text().catch(() => "");
            const trimmedBody = body.trim();

            if (
              contentType.includes("application/json") &&
              trimmedBody !== ""
            ) {
              try {
                const payload = JSON.parse(trimmedBody) as {
                  message?: unknown;
                  errors?: unknown;
                };
                const message =
                  typeof payload.message === "string" ? payload.message : "";
                const errors = Array.isArray(payload.errors)
                  ? payload.errors.map((item) => String(item)).join(" ")
                  : "";
                error.message = message || errors || error.message;
                return error;
              } catch {
                error.message = error.message;
                return error;
              }
            }

            if (
              trimmedBody.startsWith("<!DOCTYPE") ||
              trimmedBody.includes("<html")
            ) {
              error.message = `HTTP ${error.response.status}: el servidor devolvio una pagina HTML de error.`;
              return error;
            }

            error.message = trimmedBody || error.message;
            return error;
          },
        ],
        afterResponse: [
          (_request, _options, response) => {
            const expiresAt = response.headers.get(
              "X-Billing-Session-Expires-At",
            );
            if (expiresAt && this.onSessionRefresh) {
              this.onSessionRefresh(expiresAt);
            }
            return response;
          },
        ],
      },
    });
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return normalizeServiceBaseUrl(baseUrl);
  }

  login(payload: {
    email: string;
    password: string;
    device_name?: string;
  }): Promise<LoginResponse> {
    return this.http.post("auth/login", { json: payload }).json();
  }

  me(): Promise<{ user: AuthUser; expires_at: string | null }> {
    return this.http.get("auth/me").json();
  }

  logout(): Promise<void> {
    return this.http.post("auth/logout").then(() => undefined);
  }

  health(): Promise<CoreHealth> {
    return this.http.get("health").json();
  }

  fiscalCalendars(
    params: { year?: number } = {},
  ): Promise<{ data: FiscalCalendar[] }> {
    return this.http
      .get("admin/fiscal-calendars", { searchParams: compactParams(params) })
      .json();
  }

  createFiscalCalendar(
    payload: FiscalCalendarPayload,
  ): Promise<{ data: FiscalCalendar }> {
    return this.http.post("admin/fiscal-calendars", { json: payload }).json();
  }

  updateFiscalCalendar(
    calendarId: number,
    payload: FiscalCalendarPayload,
  ): Promise<{ data: FiscalCalendar }> {
    return this.http
      .patch(`admin/fiscal-calendars/${calendarId}`, { json: payload })
      .json();
  }

  createFiscalCalendarEntry(
    calendarId: number,
    payload: FiscalCalendarEntryPayload,
  ): Promise<{ data: FiscalCalendarEntry }> {
    return this.http
      .post(`admin/fiscal-calendars/${calendarId}/entries`, { json: payload })
      .json();
  }

  updateFiscalCalendarEntry(
    entryId: number,
    payload: FiscalCalendarEntryPayload,
  ): Promise<{ data: FiscalCalendarEntry }> {
    return this.http
      .patch(`admin/fiscal-calendar-entries/${entryId}`, { json: payload })
      .json();
  }

  deleteFiscalCalendarEntry(entryId: number): Promise<void> {
    return this.http
      .delete(`admin/fiscal-calendar-entries/${entryId}`)
      .then(() => undefined);
  }

  metadata(tipoDte: DocumentType): Promise<DteMetadata> {
    return this.http.get(`dte/metadata/${tipoDte}`).json();
  }

  async billingContext(): Promise<BillingContext> {
    const context = await this.http
      .get("billing/context")
      .json<BillingContext>();

    return {
      ...context,
      empresas: context.empresas.map((empresa) => ({
        ...empresa,
        logo_url: empresa.logo_url
          ? `${this.baseUrl}/billing/companies/${empresa.id}/logo`
          : null,
      })),
    };
  }

  companyThermalLogo(
    companyId: number,
    width: number,
  ): Promise<{ logo: ThermalLogoRaster | null }> {
    return this.http
      .get(`billing/companies/${companyId}/thermal-logo`, {
        searchParams: { width },
      })
      .json();
  }

  billingCatalogs(): Promise<BillingCatalogs> {
    return this.http.get("billing/catalogs").json();
  }

  registerBillingCompany(
    payload: BillingCompanyPayload,
  ): Promise<BillingCompanyResponse> {
    if (payload.logo) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (value instanceof File) {
          form.set(key, value);
          return;
        }
        if (Array.isArray(value) || typeof value === "object") {
          form.set(key, JSON.stringify(value));
          return;
        }
        form.set(key, String(value));
      });

      return this.http.post("billing/companies", { body: form }).json();
    }

    return this.http.post("billing/companies", { json: payload }).json();
  }

  updateBillingCompany(
    empresaId: number,
    payload: BillingCompanyUpdatePayload,
  ): Promise<{ empresa: BillingEmpresa }> {
    if (payload.logo) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (value instanceof File) {
          form.set(key, value);
          return;
        }
        if (Array.isArray(value) || typeof value === "object") {
          form.set(key, JSON.stringify(value));
          return;
        }
        form.set(key, String(value));
      });

      return this.http
        .post(`billing/companies/${empresaId}`, { body: form })
        .json();
    }

    return this.http
      .patch(`billing/companies/${empresaId}`, { json: payload })
      .json();
  }

  updateBillingCompanyStatus(
    empresaId: number,
    lifecycleStatus: "active" | "inactive",
  ): Promise<{ empresa: BillingEmpresa }> {
    return this.updateBillingCompany(empresaId, {
      lifecycle_status: lifecycleStatus,
    });
  }

  createBillingSucursal(
    empresaId: number,
    payload: BillingSucursalPayload,
  ): Promise<{ empresa: BillingEmpresa }> {
    return this.http
      .post(`billing/companies/${empresaId}/sucursales`, { json: payload })
      .json();
  }

  updateBillingSucursal(
    sucursalId: number,
    payload: Partial<BillingSucursalPayload>,
  ): Promise<{ empresa: BillingEmpresa }> {
    return this.http
      .patch(`billing/sucursales/${sucursalId}`, { json: payload })
      .json();
  }

  createBillingPuntoVenta(
    sucursalId: number,
    payload: BillingPuntoVentaPayload,
  ): Promise<{ empresa: BillingEmpresa }> {
    return this.http
      .post(`billing/sucursales/${sucursalId}/puntos-venta`, { json: payload })
      .json();
  }

  updateBillingPuntoVenta(
    puntoVentaId: number,
    payload: Partial<BillingPuntoVentaPayload>,
  ): Promise<{ empresa: BillingEmpresa }> {
    return this.http
      .patch(`billing/puntos-venta/${puntoVentaId}`, { json: payload })
      .json();
  }

  deleteBillingCompany(empresaId: number): Promise<void> {
    return this.http
      .post(`billing/companies/${empresaId}/purge`)
      .then(() => undefined);
  }

  billingSettings(
    empresaId: number,
    ambiente: "00" | "01",
  ): Promise<{ config: BillingSettings | null }> {
    return this.http
      .get("billing/settings", {
        searchParams: {
          empresa_id: String(empresaId),
          ambiente,
        },
      })
      .json();
  }

  saveBillingSettings(payload: BillingSettingsPayload): Promise<{
    config: BillingSettings;
    verification?: BillingSettingsVerification;
  }> {
    return this.http.put("billing/settings", { json: payload }).json();
  }

  uploadCertificate(payload: {
    empresa_id: number;
    ambiente: "00" | "01";
    certificate: File;
  }): Promise<{
    certificate: { id: number; filename: string; activo: boolean };
  }> {
    const form = new FormData();
    form.set("empresa_id", String(payload.empresa_id));
    form.set("ambiente", payload.ambiente);
    form.set("certificate", payload.certificate);

    return this.http.post("billing/certificates", { body: form }).json();
  }

  verifyBillingSigner(payload: {
    empresa_id: number;
    ambiente: "00" | "01";
  }): Promise<{ signer: BillingSignerVerification }> {
    return this.http.post("billing/signer/verify", { json: payload }).json();
  }

  requestMhBearer(payload: {
    empresa_id: number;
    ambiente: "00" | "01";
    include_token?: boolean;
    force_refresh?: boolean;
  }): Promise<{ auth: MhBearerVerification }> {
    return this.http.post("billing/mh/bearer", { json: payload }).json();
  }

  customers(params: {
    empresa_id: number;
    tipo_dte?: string;
    q?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ data: BillingCustomer[]; meta: PaginationMeta }> {
    return this.http
      .get("billing/customers", {
        searchParams: compactParams(params),
      })
      .json();
  }

  customer(customerId: number): Promise<{ customer: BillingCustomer }> {
    return this.http.get(`billing/customers/${customerId}`).json();
  }

  saveCustomer(
    payload: Partial<BillingCustomer> & { empresa_id: number; name: string },
  ): Promise<{ customer: BillingCustomer }> {
    return this.http.post("billing/customers", { json: payload }).json();
  }

  updateCustomer(
    customerId: number,
    payload: Partial<BillingCustomer>,
  ): Promise<{ customer: BillingCustomer }> {
    return this.http
      .patch(`billing/customers/${customerId}`, { json: payload })
      .json();
  }

  deleteCustomer(customerId: number): Promise<void> {
    return this.http
      .delete(`billing/customers/${customerId}`)
      .then(() => undefined);
  }

  previewCorrelativo(
    payload: CorrelativoRequest,
  ): Promise<CorrelativoReservation> {
    return this.http
      .post("billing/correlativos/preview", { json: payload })
      .json();
  }

  reserveCorrelativo(
    payload: CorrelativoRequest,
  ): Promise<CorrelativoReservation> {
    return this.http
      .post("billing/correlativos/reserve", { json: payload })
      .json();
  }

  correlativos(params: {
    empresa_id: number;
    ambiente?: "00" | "01" | string;
  }): Promise<{ data: BillingCorrelativoAdmin[] }> {
    return this.http
      .get("billing/correlativos", { searchParams: compactParams(params) })
      .json();
  }

  updateCorrelativo(
    correlativoId: number,
    payload: { actual: number },
  ): Promise<{ data: BillingCorrelativoAdmin }> {
    return this.http
      .patch(`billing/correlativos/${correlativoId}`, { json: payload })
      .json();
  }

  preview(payload: DtePreviewRequest): Promise<DtePreviewResponse> {
    return this.http.post("dte/preview", { json: payload }).json();
  }

  createDraft(payload: DtePreviewRequest): Promise<DteDraftSummary> {
    return this.http.post("dte/drafts", { json: payload }).json();
  }

  issue(payload: DtePreviewRequest): Promise<DteIssueResponse> {
    return this.http.post("dte/issue", { json: payload }).json();
  }

  async issueProgress(
    payload: DtePreviewRequest,
    onEvent: (event: DteIssueProgressEvent) => void,
  ): Promise<DteIssueResponse> {
    const token =
      typeof this.authToken === "function" ? this.authToken() : this.authToken;
    const response = await fetch(`${this.baseUrl}/dte/issue-progress`, {
      method: "POST",
      headers: {
        Accept: "application/x-ndjson",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: this.credentials,
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error(
        await response.text().catch(() => `HTTP ${response.status}`),
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalResult: DteIssueResponse | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line !== "") {
            const event = JSON.parse(line) as DteIssueProgressEvent;
            onEvent(event);
            if (event.type === "result") {
              if (event.ok)
                finalResult = {
                  document: event.document,
                  attempts: event.attempts,
                  idempotent: event.idempotent,
                };
              else throw new Error(event.message);
            }
          }
          newline = buffer.indexOf("\n");
        }
      }
      if (done) break;
    }

    if (!finalResult)
      throw new Error("La emision termino sin resultado final.");
    return finalResult;
  }

  documents(
    params: {
      q?: string;
      estado?: string;
      tipo_dte?: string;
      empresa_id?: number;
      receptor_document?: string;
      platform_user_id?: number;
      performed_by_platform_user_id?: number;
      issued_by_user_id?: number;
      limit?: number;
      page?: number;
      include_payload?: boolean;
      include_audit?: boolean;
      retorno_eligible?: boolean;
    } = {},
  ): Promise<DteDocumentListResponse> {
    return this.http
      .get("dte/drafts", { searchParams: compactParams(params) })
      .json();
  }

  salesAnnex(
    params: {
      empresa_id?: number;
      tenant_id?: number;
      from?: string;
      to?: string;
      ventas_tipo_operacion_renta?: string;
      ventas_tipo_ingreso_renta?: string;
    } = {},
  ): Promise<DteSalesAnnexResponse> {
    return this.http
      .get("dte/annexes/sales", { searchParams: compactParams(params) })
      .json();
  }

  salesAnnexCsv(
    book: DteSalesAnnexBookKey,
    params: {
      empresa_id?: number;
      tenant_id?: number;
      from?: string;
      to?: string;
      ventas_tipo_operacion_renta?: string;
      ventas_tipo_ingreso_renta?: string;
    } = {},
  ): Promise<Blob> {
    return this.http
      .get(`dte/annexes/sales/${book}/csv`, {
        searchParams: compactParams(params),
        headers: { Accept: "text/csv" },
      })
      .blob();
  }

  invalidatedAnnex(
    params: {
      empresa_id?: number;
      tenant_id?: number;
      from?: string;
      to?: string;
    } = {},
  ): Promise<DteInvalidatedAnnexResponse> {
    return this.http
      .get("dte/annexes/invalidated", { searchParams: compactParams(params) })
      .json();
  }

  invalidatedAnnexCsv(
    params: {
      empresa_id?: number;
      tenant_id?: number;
      from?: string;
      to?: string;
    } = {},
  ): Promise<Blob> {
    return this.http
      .get("dte/annexes/invalidated/csv", {
        searchParams: compactParams(params),
        headers: { Accept: "text/csv" },
      })
      .blob();
  }

  dashboardSummary(
    params: { empresa_id?: number } = {},
  ): Promise<DteDashboardSummary> {
    return this.http
      .get("dte/dashboard-summary", { searchParams: compactParams(params) })
      .json();
  }

  document(id: number): Promise<DteDraftSummary> {
    return this.http.get(`dte/drafts/${id}`).json();
  }

  graphicRepresentationHtml(id: number): Promise<string> {
    return this.http
      .get(`dte/drafts/${id}/artifacts/graphic`, {
        headers: { Accept: "text/html" },
      })
      .text();
  }

  graphicRepresentationPdf(id: number): Promise<Blob> {
    return this.http
      .get(`dte/drafts/${id}/artifacts/pdf`, {
        headers: { Accept: "application/pdf" },
        timeout: 90000,
      })
      .blob();
  }

  clientJsonArtifact(id: number): Promise<Blob> {
    return this.http
      .get(`dte/drafts/${id}/artifacts/client-json`, {
        headers: { Accept: "application/json" },
      })
      .blob();
  }

  thermalArtifact(id: number): Promise<DteThermalArtifact> {
    return this.http
      .get(`dte/drafts/${id}/artifacts/thermal`, {
        headers: { Accept: "application/json" },
      })
      .json();
  }

  mhEventGraphicRepresentationHtml(id: number): Promise<string> {
    return this.http
      .get(`mh/events/${id}/artifacts/graphic`, {
        headers: { Accept: "text/html" },
      })
      .text();
  }

  mhEventGraphicRepresentationPdf(id: number): Promise<Blob> {
    return this.http
      .get(`mh/events/${id}/artifacts/pdf`, {
        headers: { Accept: "application/pdf" },
        timeout: 90000,
      })
      .blob();
  }

  mhEventClientJsonArtifact(id: number): Promise<Blob> {
    return this.http
      .get(`mh/events/${id}/artifacts/client-json`, {
        headers: { Accept: "application/json" },
      })
      .blob();
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

  receiveDraft(
    id: number,
    result: "accepted" | "rejected" = "accepted",
  ): Promise<DteDraftSummary> {
    return this.http
      .post(`dte/drafts/${id}/receive`, { json: { result } })
      .json();
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

  mhEvents(
    params: {
      q?: string;
      estado?: string;
      event_type?: string;
      empresa_id?: number;
      platform_user_id?: number;
      performed_by_platform_user_id?: number;
      transmitted_by_platform_user_id?: number;
      limit?: number;
      page?: number;
    } = {},
  ): Promise<MhFiscalEventListResponse> {
    return this.http
      .get("mh/events", { searchParams: compactParams(params) })
      .json();
  }

  mhEvent(id: number): Promise<MhFiscalEventSummary> {
    return this.http.get(`mh/events/${id}`).json();
  }

  createMhEvent(
    eventType: string,
    payload: MhFiscalEventDraftRequest,
  ): Promise<MhFiscalEventSummary> {
    return this.http
      .post(`mh/events/${eventType}/drafts`, { json: payload })
      .json();
  }

  validateMhEvent(id: number): Promise<MhFiscalEventValidation> {
    return this.http.post(`mh/events/${id}/validate`).json();
  }

  signMhEvent(id: number): Promise<MhFiscalEventSummary> {
    return this.http.post(`mh/events/${id}/sign`).json();
  }

  transmitMhEvent(id: number): Promise<MhFiscalEventSummary> {
    return this.http
      .post(`mh/events/${id}/transmit`, { timeout: 60000 })
      .json();
  }
}

export function buildFacturaRequest(
  input: ManualInvoiceInput,
): DtePreviewRequest {
  const receptorDocument = normalizeRecipientDocument(
    input.customerDocumentType,
    input.customerDocument,
  );
  const isAdjustmentNote =
    input.documentType === "05" || input.documentType === "06";
  const isSujetoExcluido = input.documentType === "14";
  const isFiscalStyle = input.documentType === "03" || isAdjustmentNote;
  const finalConsumerAddress = optionalAddress(input);
  const priceIncludesIva =
    (input.documentType === "03" && input.priceIncludesIva !== false) ||
    input.documentType === "05" ||
    input.documentType === "06";
  const ivaRetention =
    input.documentType === "03" && input.retainIva10
      ? roundMoney(totalTaxableBase(input.items, priceIncludesIva) * 0.01)
      : 0;
  const items: Array<Record<string, unknown>> = input.items.map((item) => {
    const discount = lineDiscount(item);
    const unitMeasure = Number(item.unitMeasure ?? 59);

    return {
      descripcion: item.description,
      cantidad: item.quantity,
      uniMedida: Number.isFinite(unitMeasure) ? unitMeasure : 59,
      codigo: item.code || null,
      precioUni: item.unitPrice,
      montoDescu: discount,
      ...(isFiscalStyle
        ? { tributos: ["20"], precioIncluyeIva: priceIncludesIva }
        : {}),
      ...(input.documentType === "05" && typeof item.ivaAmount === "number"
        ? {
            totalIva: roundMoney(item.ivaAmount),
            ivaItem: roundMoney(item.ivaAmount),
          }
        : {}),
      ...(isAdjustmentNote && input.relatedDocument
        ? { numeroDocumento: input.relatedDocument.codigoGeneracion }
        : {}),
    };
  });

  if (ivaRetention > 0 && items[0]) {
    items[0] = {
      ...items[0],
      ivaRete1: ivaRetention,
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
      tipoEstablecimiento: "01",
      direccion: {
        departamento: input.sucursal.departamento,
        municipio: input.sucursal.municipio,
        distrito: input.sucursal.distrito ?? undefined,
        complemento: input.sucursal.direccion,
      },
      telefono: input.sucursal.telefono,
      correo: input.sucursal.email,
      codEstableMH: null,
      codEstable: input.sucursal.codigo,
      codPuntoVentaMH: null,
      codPuntoVenta: input.puntoVenta.codigo,
    },
    receptor:
      isFiscalStyle || isSujetoExcluido
        ? {
            ...(input.documentType === "03"
              ? { nit: onlyDigits(input.customerDocument) }
              : {
                  tipoDocumento: receptorDocument.documentType || "36",
                  numDocumento:
                    receptorDocument.documentNumber ||
                    onlyDigits(input.customerDocument),
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
              complemento: input.customerAddress,
            },
            telefono: input.customerPhone,
            correo: input.customerEmail,
          }
        : {
            nombre: input.customerName,
            tipoDocumento: receptorDocument.documentType,
            numDocumento: receptorDocument.documentNumber,
            nrc: null,
            codActividad: null,
            descActividad: null,
            direccion: finalConsumerAddress,
            telefono: input.customerPhone,
            correo: input.customerEmail,
          },
    items,
    resumen: {
      totalPagar: input.items.reduce(
        (total, item) => total + lineNetTotal(item),
        0,
      ),
      ...(input.ivaRete !== undefined
        ? { ivaRete: roundMoney(input.ivaRete) }
        : {}),
      ...(input.ivaPerci !== undefined
        ? { ivaPerci: roundMoney(input.ivaPerci) }
        : {}),
      ...(input.reteRenta !== undefined
        ? { reteRenta: roundMoney(input.reteRenta) }
        : {}),
      ...(input.totalNoGravado !== undefined
        ? { totalNoGravado: roundMoney(input.totalNoGravado) }
        : {}),
      ...(input.paymentCondition !== undefined
        ? { condicionOperacion: input.paymentCondition }
        : {}),
      ...(input.payments !== undefined
        ? {
            pagos: input.payments.map((payment) => ({
              codigo: payment.codigo,
              montoPago: roundMoney(payment.montoPago),
              referencia: payment.referencia?.trim()
                ? payment.referencia.trim()
                : null,
              plazo: payment.plazo || null,
              periodo: payment.periodo ?? null,
            })),
          }
        : {}),
      observaciones: input.observations ?? null,
      codigoRetencionMH: null,
    },
  };

  if (isAdjustmentNote && input.relatedDocument) {
    const payload = (input.relatedDocument.payload ??
      input.relatedDocument.dte_json ??
      {}) as Record<string, unknown>;
    const identificacion = asRecord(payload.identificacion);

    request.documentoRelacionado = [
      {
        tipoDocumento: String(
          identificacion.tipoDte ?? input.relatedDocument.tipoDte,
        ),
        tipoGeneracion: 2,
        numeroDocumento: String(
          identificacion.codigoGeneracion ??
            input.relatedDocument.codigoGeneracion,
        ),
        fechaEmision: String(
          identificacion.fecEmi ??
            input.relatedDocument.created_at?.slice(0, 10) ??
            "",
        ),
      },
    ];
    request.ventaTercero = null;
    request.apendice = null;
  }

  return request;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const baseUnit = quantity > 0 ? roundUpMoney(gross / 1.13 / quantity) : 0;
  const baseDiscount = roundUpMoney(discount / 1.13);

  return roundMoney(Math.max(0, baseUnit * quantity - baseDiscount));
}

function totalTaxableBase(
  items: BillingItem[],
  priceIncludesIva: boolean,
): number {
  return roundMoney(
    items.reduce(
      (total, item) => total + lineTaxableBase(item, priceIncludesIva),
      0,
    ),
  );
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

  const digits = value.replace(/\D+/g, "");

  return digits === "" ? value : digits;
}

function normalizeDistrict(value: string | null | undefined): string | null {
  const digits = onlyDigits(value);
  if (!digits) return null;

  return digits.padStart(2, "0");
}

function optionalAddress(
  input: ManualInvoiceInput,
): Record<string, string | null> | null {
  if (
    !input.customerDepartment ||
    !input.customerMunicipality ||
    !input.customerAddress
  ) {
    return null;
  }

  return {
    departamento: input.customerDepartment,
    municipio: input.customerMunicipality,
    distrito: normalizeDistrict(input.customerDistrict),
    complemento: input.customerAddress,
  };
}

function normalizeRecipientDocument(
  type: string | null | undefined,
  value: string | null | undefined,
): { documentType: string | null; documentNumber: string | null } {
  const digits = onlyDigits(value);
  if (!digits) {
    return { documentType: null, documentNumber: null };
  }

  if (type === "36" && (digits.length === 9 || digits.length === 14)) {
    return { documentType: "36", documentNumber: digits };
  }

  if (digits.length === 9) {
    return { documentType: "13", documentNumber: digits };
  }

  if (digits.length === 14) {
    return { documentType: "36", documentNumber: digits };
  }

  return {
    documentType: type || null,
    documentNumber: digits,
  };
}
