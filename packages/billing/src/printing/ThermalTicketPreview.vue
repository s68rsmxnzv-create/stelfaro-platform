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
const qrSize = computed(() => Math.max(76, Math.min(126, Math.round(props.settings.qrWidth * 0.36))));
const issuerName = computed(() => props.company?.tradeName || props.company?.name || 'NOMBRE COMERCIAL');
const issuerNit = computed(() => formatIdentity(props.company?.nit || '00000000000000'));
const issuerNrc = computed(() => formatNrc(props.company?.nrc));

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
          <p class="font-bold">{{ issuerName.toUpperCase() }}</p>
          <p v-if="company?.activity">{{ company.activity }}</p>
          <p>NIT: {{ issuerNit }}</p>
          <p v-if="issuerNrc">NRC: {{ issuerNrc }}</p>
        </div>

        <div class="my-2 border-t border-dashed border-black"></div>
        <div class="text-center font-bold">
          <p>FACTURA ELECTRÓNICA</p>
          <p>DTE-01-M001P001-000000000000001</p>
        </div>
        <div class="mt-2 break-all">
          <p>Código de generación:</p>
          <p>00000000-0000-4000-8000-000000000000</p>
          <p class="mt-1">Sello de recepción: MH000000000000</p>
          <p>Fecha: 20/07/2026 10:30 a. m.</p>
        </div>
        <div class="my-2 border-t border-dashed border-black"></div>
        <p class="font-bold">RECEPTOR</p>
        <p>Nombre: Cliente de ejemplo</p>
        <p>Documento: 01234567-8</p>
        <div class="my-2 border-t border-dashed border-black"></div>
        <p class="font-bold">DETALLE</p>
        <p>Servicio o producto de ejemplo</p>
        <div class="flex justify-between"><span>1 x $ 25.00</span><span>$ 25.00</span></div>
        <div class="my-2 border-t border-dashed border-black"></div>
        <div class="flex justify-between"><span>Gravadas</span><span>$ 25.00</span></div>
        <div class="flex justify-between font-bold"><span>TOTAL A PAGAR</span><span>$ 25.00</span></div>

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
