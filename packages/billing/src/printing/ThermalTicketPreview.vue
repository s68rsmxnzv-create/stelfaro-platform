<script setup lang="ts">
import { computed } from 'vue';
import { QrCode } from 'lucide-vue-next';
import type { PrinterSettings } from './printerSettings';

type PreviewCompany = {
  name: string;
  tradeName: string;
  logoUrl: string | null;
  nit: string;
  nrc: string | null;
  activity: string;
};

const props = defineProps<{ settings: PrinterSettings; company?: PreviewCompany | null }>();
const paperClass = computed(() => props.settings.paperWidth === '58' ? 'w-[280px]' : 'w-[370px]');
const qrSize = computed(() => 72 + (Math.max(1, Math.min(16, Math.round(props.settings.qrWidth / 48))) * 10));
const issuerName = 'ELECTRÓNICA DEMO';
const issuerNit = formatIdentity('06141234561019');
const issuerNrc = formatNrc('1234567');

function formatIdentity(value: string): string {
  const digits = value.replace(/\D+/g, '');
  if (digits.length === 9) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  if (digits.length === 14) return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`;
  return value;
}

function formatNrc(value?: string | null): string {
  const original = String(value || '');
  const digits = original.replace(/\D+/g, '');
  return digits.length >= 2 ? `${digits.slice(0, -1)}-${digits.slice(-1)}` : original;
}
</script>

<template>
  <section class="rounded-lg border border-line bg-surface-muted p-4 sm:p-5">
    <div class="mb-4">
      <h4 class="font-semibold text-text">Vista previa del ticket</h4>
      <p class="mt-1 text-sm text-muted">Referencia visual del contenido y ancho seleccionados.</p>
    </div>

    <div class="overflow-x-auto rounded-lg bg-slate-300 p-4 dark:bg-slate-950/60">
      <article :class="paperClass" class="mx-auto min-h-[620px] bg-white px-5 py-6 font-mono text-[11px] leading-[1.45] text-black shadow-xl transition-[width] duration-300">
        <div v-if="settings.showLogo" class="mb-3 text-center">
          <img v-if="company?.logoUrl" :src="company.logoUrl" alt="Logo de la empresa" class="mx-auto max-h-20 max-w-[75%] object-contain grayscale contrast-125">
          <div v-else class="mx-auto grid h-14 w-32 place-items-center border border-dashed border-black/40 text-[9px]">SIN LOGO CARGADO</div>
        </div>

        <div v-if="settings.showIssuerDetails" class="text-center">
          <p class="font-bold">{{ issuerName }}</p>
          <p>Servicios electrónicos n.c.p.</p>
          <p>NIT: {{ issuerNit }}</p>
          <p v-if="issuerNrc">NRC: {{ issuerNrc }}</p>
          <p>Av. Central, edificio de ejemplo, local 12</p>
          <p>Tel: 7000-0000</p>
          <p>facturacion@empresa-ejemplo.com</p>
        </div>

        <div class="my-2 border-t border-dashed border-black"></div>
        <div class="text-center font-bold">
          <p>FACTURA ELECTRÓNICA</p>
        </div>
        <div class="mt-2 break-words">
          <p>Número de control:</p>
          <p class="break-all">DTE-01-M001P001-000000000000001</p>
          <p class="mt-1">Código de generación:</p>
          <p class="break-all">A1B2C3D4-0000-4000-8000-123456789ABC</p>
          <p class="mt-1">Sello de recepción:</p>
          <p class="break-all">2026ABCDEF0123456789ABCDEF0123456789ABCD</p>
          <p class="mt-1">Fecha: 2026-07-20 10:30:00</p>
        </div>
        <div class="my-2 border-t border-dashed border-black"></div>
        <p class="font-bold">RECEPTOR</p>
        <p>Nombre: Andrea Hernández de Ejemplo</p>
        <p>Documento: 01234567-8</p>
        <div class="my-2 border-t border-dashed border-black"></div>
        <p class="font-bold">DETALLE</p>
        <p>Servicio de reparación de equipo electrónico modelo DEMO 2026</p>
        <div class="flex justify-between"><span>1 x $ 25.00</span><span>$ 25.00</span></div>
        <div class="my-2 border-t border-dashed border-black"></div>
        <p class="font-bold">RESUMEN</p>
        <div class="flex justify-between"><span>No sujetas</span><span>$ 0.00</span></div>
        <div class="flex justify-between"><span>Exentas</span><span>$ 0.00</span></div>
        <div class="flex justify-between"><span>Gravadas</span><span>$ 25.00</span></div>
        <div class="flex justify-between font-bold"><span>TOTAL A PAGAR</span><span>$ 25.00</span></div>
        <p class="mt-1">Total en letras: VEINTICINCO DÓLARES CON 00/100 USD</p>
        <div class="my-2 border-t border-dashed border-black"></div>

        <div v-if="settings.qrEnabled" class="mt-5 text-center">
          <p>Consulta DTE en Hacienda</p>
          <QrCode :style="{ width: `${qrSize}px`, height: `${qrSize}px` }" class="mx-auto mt-2" :stroke-width="1.5" />
        </div>
        <div class="mt-4 border-t border-dashed border-black pt-2 text-center">
          <p>Gracias por su compra</p>
          <p>Representación gráfica de DTE.</p>
        </div>
      </article>
    </div>
  </section>
</template>
