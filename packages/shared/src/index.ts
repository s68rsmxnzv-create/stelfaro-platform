export type DocumentType = '01' | '03' | '05' | '06' | '14';

export type Money = number;

export type BillingItem = {
  description: string;
  quantity: number;
  unitPrice: Money;
  discount?: Money;
  ivaAmount?: Money;
  priceIncludesIva?: boolean;
  unitMeasure?: string | number | null;
  code?: string | null;
  catalogItemId?: number | null;
  lineOrigin?: 'free' | 'catalog' | 'inventory' | string;
};

export type ApiState<T> = {
  loading: boolean;
  data: T | null;
  error: string | null;
};

export function currency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD'
  }).format(value ?? 0);
}

export function fiscalDate(value: string | Date | null | undefined): string {
  const parts = dateParts(value);
  if (!parts) return 'Sin fecha';

  return `${parts.day}-${parts.month}-${parts.year}`;
}

export function fiscalDateTime(value: string | Date | null | undefined): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return fiscalDate(value);
  }

  const parts = dateTimeParts(value);
  if (!parts) return 'Sin fecha';

  return parts.time ? `${parts.day}-${parts.month}-${parts.year} ${parts.time}` : `${parts.day}-${parts.month}-${parts.year}`;
}

function dateParts(value: string | Date | null | undefined): { day: string; month: string; year: string } | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : {
      day: pad(value.getDate()),
      month: pad(value.getMonth() + 1),
      year: String(value.getFullYear())
    };
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return {
      day: dateOnly[3],
      month: dateOnly[2],
      year: dateOnly[1]
    };
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : {
    day: pad(date.getDate()),
    month: pad(date.getMonth() + 1),
    year: String(date.getFullYear())
  };
}

function dateTimeParts(value: string | Date | null | undefined): { day: string; month: string; year: string; time: string } | null {
  const parts = dateParts(value);
  if (!parts || !value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { ...parts, time: '' };

  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;

  return {
    ...parts,
    time: `${pad(hours)}:${minutes} ${suffix}`
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
