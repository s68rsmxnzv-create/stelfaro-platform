export type DocumentType = '01' | '03' | '05' | '06';

export type Money = number;

export type BillingItem = {
  description: string;
  quantity: number;
  unitPrice: Money;
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
