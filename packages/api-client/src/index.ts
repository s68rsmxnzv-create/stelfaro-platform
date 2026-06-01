import ky, { type KyInstance } from 'ky';
import type { BillingItem, DocumentType } from '@stelfaro/shared';

export type CoreHealth = {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
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
  items: Array<Record<string, unknown>>;
  resumen: Record<string, unknown>;
};

export type DtePreviewResponse = {
  valid: boolean;
  payload: Record<string, unknown>;
  errors: Array<{ field: string; message: string } | string>;
};

export type DteDraftSummary = {
  id: number;
  estado: string;
  tipoDte: string;
  ambiente: string;
  numeroControl: string;
  codigoGeneracion: string;
  totalPagar: number | null;
  payload?: Record<string, unknown>;
};

export type DteHistoryEntry = {
  event: string;
  created_at: string | null;
  payload: Record<string, unknown>;
};

export type BillingDocumentType = {
  code: DocumentType;
  label: string;
  version: number;
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
  telefono: string | null;
  email: string | null;
  puntosVenta: BillingPuntoVenta[];
  correlativos: BillingCorrelativo[];
};

export type BillingEmpresa = {
  id: number;
  tenant_id: number;
  nombre_comercial: string;
  razon_social: string;
  nit: string;
  nrc: string | null;
  codigo_actividad: string;
  desc_actividad: string;
  ambiente: '00' | '01';
  certificados: BillingCertificate[];
  sucursales: BillingSucursal[];
};

export type BillingContext = {
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
};

export type BillingSettings = Omit<BillingSettingsPayload, 'mh_nit' | 'mh_user' | 'mh_password' | 'signer_nit' | 'signer_password_pri' | 'signer_activo'> & {
  id: number;
  profile: string;
  credentials_configured: boolean;
  signer_credentials_configured: boolean;
  last_verified_at: string | null;
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

export type ManualInvoiceInput = {
  documentType: DocumentType;
  empresa: BillingEmpresa;
  sucursal: BillingSucursal;
  puntoVenta: BillingPuntoVenta;
  correlativo: number;
  customerName: string;
  customerDocumentType: string | null;
  customerDocument: string | null;
  customerEmail: string | null;
  items: BillingItem[];
};

export class CoreDteClient {
  private readonly http: KyInstance;

  constructor(baseUrl: string) {
    this.http = ky.create({
      prefixUrl: baseUrl.replace(/^\/+/, '').replace(/\/$/, ''),
      timeout: 15000,
      hooks: {
        beforeError: [
          async (error) => {
            const body = await error.response.text().catch(() => '');
            error.message = body || error.message;
            return error;
          }
        ]
      }
    });
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

  billingSettings(empresaId: number, ambiente: '00' | '01'): Promise<{ config: BillingSettings | null }> {
    return this.http.get('billing/settings', {
      searchParams: {
        empresa_id: String(empresaId),
        ambiente
      }
    }).json();
  }

  saveBillingSettings(payload: BillingSettingsPayload): Promise<{ config: BillingSettings }> {
    return this.http.put('billing/settings', { json: payload }).json();
  }

  uploadCertificate(payload: { empresa_id: number; ambiente: '00' | '01'; certificate: File }): Promise<{ certificate: { id: number; filename: string; activo: boolean } }> {
    const form = new FormData();
    form.set('empresa_id', String(payload.empresa_id));
    form.set('ambiente', payload.ambiente);
    form.set('certificate', payload.certificate);

    return this.http.post('billing/certificates', { body: form }).json();
  }

  previewCorrelativo(payload: CorrelativoRequest): Promise<CorrelativoReservation> {
    return this.http.post('billing/correlativos/preview', { json: payload }).json();
  }

  reserveCorrelativo(payload: CorrelativoRequest): Promise<CorrelativoReservation> {
    return this.http.post('billing/correlativos/reserve', { json: payload }).json();
  }

  preview(payload: DtePreviewRequest): Promise<DtePreviewResponse> {
    return this.http.post('dte/preview', { json: payload }).json();
  }

  createDraft(payload: DtePreviewRequest): Promise<DteDraftSummary> {
    return this.http.post('dte/drafts', { json: payload }).json();
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

  history(id: number): Promise<DteHistoryEntry[]> {
    return this.http.get(`dte/drafts/${id}/history`).json();
  }
}

export function buildFacturaRequest(input: ManualInvoiceInput): DtePreviewRequest {
  return {
    tipoDte: input.documentType,
    ambiente: input.empresa.ambiente,
    empresa_id: input.empresa.id,
    sucursal_id: input.sucursal.id,
    punto_venta_id: input.puntoVenta.id,
    codigoEstablecimiento: input.sucursal.codigo,
    codigoPuntoVenta: input.puntoVenta.codigo,
    correlativo: input.correlativo,
    emisor: {
      nit: input.empresa.nit,
      nrc: input.empresa.nrc,
      nombre: input.empresa.razon_social,
      codActividad: input.empresa.codigo_actividad,
      descActividad: input.empresa.desc_actividad,
      nombreComercial: input.empresa.nombre_comercial,
      tipoEstablecimiento: '01',
      direccion: {
        departamento: input.sucursal.departamento,
        municipio: input.sucursal.municipio,
        complemento: input.sucursal.direccion
      },
      telefono: input.sucursal.telefono,
      correo: input.sucursal.email,
      codEstableMH: null,
      codEstable: input.sucursal.codigo,
      codPuntoVentaMH: null,
      codPuntoVenta: input.puntoVenta.codigo
    },
    receptor: {
      nombre: input.customerName,
      tipoDocumento: input.customerDocumentType,
      numDocumento: input.customerDocument,
      nrc: null,
      codActividad: null,
      descActividad: null,
      direccion: null,
      telefono: null,
      correo: input.customerEmail
    },
    items: input.items.map((item) => ({
      descripcion: item.description,
      cantidad: item.quantity,
      precioUni: item.unitPrice
    })),
    resumen: {
      totalPagar: input.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
    }
  };
}
