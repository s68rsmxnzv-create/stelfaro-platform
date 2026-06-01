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

export type ManualInvoiceInput = {
  documentType: DocumentType;
  customerName: string;
  customerDocument: string;
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
    ambiente: '00',
    emisor: {
      nit: '06142811231012',
      nrc: '1234567',
      nombre: 'Empresa Demo',
      codActividad: '62020',
      descActividad: 'Consultoria en informatica',
      nombreComercial: 'Empresa Demo',
      tipoEstablecimiento: '01',
      direccion: {
        departamento: '06',
        municipio: '14',
        complemento: 'Direccion demo'
      },
      telefono: '22222222',
      correo: 'demo@example.test',
      codEstableMH: null,
      codEstable: null,
      codPuntoVentaMH: null,
      codPuntoVenta: null
    },
    receptor: {
      nombre: input.customerName,
      tipoDocumento: '13',
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
