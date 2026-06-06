<script setup lang="ts">
import { computed } from 'vue';
import type {
  BillingEmpresa,
  BillingPuntoVenta,
  BillingSucursal,
  CorrelativoReservation,
  DteDraftSummary,
  DtePreviewResponse
} from '@stelfaro/api-client';
import { currency, type BillingItem } from '@stelfaro/shared';

const props = defineProps<{
  empresa: BillingEmpresa | null;
  sucursal: BillingSucursal | null;
  puntoVenta: BillingPuntoVenta | null;
  documentLabel: string;
  correlativo: CorrelativoReservation | null;
  customerName: string;
  customerDocumentType: string | null;
  customerDocument: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  items: BillingItem[];
  total: number;
  iva: number;
  totalLabel: number;
  preview: DtePreviewResponse | null;
  draft: DteDraftSummary | null;
}>();

const hasCustomerDetails = computed(() => Boolean(
  props.customerDocument?.trim()
  || props.customerEmail?.trim()
  || props.customerPhone?.trim()
));

const displayCustomerName = computed(() => props.customerName.trim() || 'Consumidor Final');
const displayNumeroControl = computed(() => props.draft?.numeroControl ?? props.correlativo?.numero_control ?? 'Pendiente');
const ambienteLabel = computed(() => props.empresa?.ambiente === '01' ? 'Produccion' : 'Pruebas');
const previewStatus = computed(() => {
  if (!props.preview) return null;
  return props.preview.valid ? 'Schema valido' : 'Schema invalido';
});

const subtotal = computed(() => props.items.reduce((sum, item) => sum + lineGrossTotal(item), 0));
const discountTotal = computed(() => props.items.reduce((sum, item) => sum + lineDiscountAmount(item), 0));

function lineGrossTotal(item: BillingItem): number {
  return Math.max(0, Number(item.quantity || 0) * Number(item.unitPrice || 0));
}

function lineDiscountAmount(item: BillingItem): number {
  return Math.min(lineGrossTotal(item), Math.max(0, Number(item.discount || 0)));
}

function lineNetTotal(item: BillingItem): number {
  return Math.max(0, lineGrossTotal(item) - lineDiscountAmount(item));
}
</script>

<template>
  <section class="sticky top-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-700">Vista previa</p>
        <h2 class="mt-1 text-lg font-bold text-slate-950">Ticket DTE</h2>
      </div>
      <span
        v-if="previewStatus"
        class="rounded-full px-2 py-1 text-xs font-semibold"
        :class="preview?.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
      >
        {{ previewStatus }}
      </span>
    </div>

    <div class="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-[12px] leading-relaxed text-slate-800">
      <div class="text-center">
        <p class="text-sm font-bold uppercase text-slate-950">{{ empresa?.nombre_comercial || empresa?.razon_social || 'Empresa emisora' }}</p>
        <p class="mt-1 uppercase">{{ empresa?.razon_social || 'Contribuyente' }}</p>
        <p v-if="empresa">NIT {{ empresa.nit }}<span v-if="empresa.nrc"> · NRC {{ empresa.nrc }}</span></p>
        <p v-if="empresa?.desc_actividad">{{ empresa.codigo_actividad }} · {{ empresa.desc_actividad }}</p>
      </div>

      <div class="my-4 border-t border-dashed border-slate-300"></div>

      <dl class="grid gap-1">
        <div class="flex justify-between gap-3">
          <dt>DTE</dt>
          <dd class="text-right font-semibold">{{ documentLabel }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>Ambiente</dt>
          <dd>{{ ambienteLabel }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>Sucursal</dt>
          <dd class="text-right">{{ sucursal?.codigo ?? 'M001' }} · {{ sucursal?.nombre ?? 'Casa matriz' }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>Punto</dt>
          <dd class="text-right">{{ puntoVenta?.codigo ?? 'P001' }} · {{ puntoVenta?.nombre ?? 'Caja principal' }}</dd>
        </div>
      </dl>

      <p class="mt-3 break-all text-[11px] text-slate-500">{{ displayNumeroControl }}</p>

      <div class="my-4 border-t border-dashed border-slate-300"></div>

      <div>
        <p class="font-semibold uppercase text-slate-950">Receptor</p>
        <p class="mt-1">{{ displayCustomerName }}</p>
        <p v-if="hasCustomerDetails" class="mt-1 text-slate-500">
          <span v-if="customerDocument">{{ customerDocumentType || 'Doc' }} {{ customerDocument }}</span>
          <span v-if="customerEmail"> · {{ customerEmail }}</span>
          <span v-if="customerPhone"> · {{ customerPhone }}</span>
        </p>
      </div>

      <div class="my-4 border-t border-dashed border-slate-300"></div>

      <div v-if="items.length" class="space-y-3">
        <div v-for="item in items" :key="`${item.description}-${item.quantity}-${item.unitPrice}-${item.discount ?? 0}`">
          <p class="font-semibold text-slate-950">{{ item.description }}</p>
          <div class="flex justify-between gap-3 text-slate-600">
            <span>{{ item.quantity }} x {{ currency(item.unitPrice) }}</span>
            <span class="font-semibold text-slate-950">{{ currency(lineNetTotal(item)) }}</span>
          </div>
          <div v-if="lineDiscountAmount(item) > 0" class="flex justify-between gap-3 text-slate-500">
            <span>Descuento</span>
            <span>-{{ currency(lineDiscountAmount(item)) }}</span>
          </div>
        </div>
      </div>
      <p v-else class="text-slate-500">Agrega productos para construir el ticket.</p>

      <div class="my-4 border-t border-dashed border-slate-300"></div>

      <dl class="grid gap-1">
        <div class="flex justify-between gap-3">
          <dt>Subtotal</dt>
          <dd>{{ currency(subtotal) }}</dd>
        </div>
        <div v-if="discountTotal > 0" class="flex justify-between gap-3">
          <dt>Descuento</dt>
          <dd>-{{ currency(discountTotal) }}</dd>
        </div>
        <div v-if="discountTotal > 0" class="flex justify-between gap-3">
          <dt>Neto</dt>
          <dd>{{ currency(total) }}</dd>
        </div>
        <div v-if="iva > 0" class="flex justify-between gap-3">
          <dt>IVA</dt>
          <dd>{{ currency(iva) }}</dd>
        </div>
        <div class="mt-2 flex justify-between gap-3 text-base font-bold text-slate-950">
          <dt>Total</dt>
          <dd>{{ currency(totalLabel) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
