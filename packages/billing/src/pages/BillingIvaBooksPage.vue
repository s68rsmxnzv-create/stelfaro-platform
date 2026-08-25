<script setup lang="ts">
import { computed, ref } from 'vue';

type IvaBookSelection = 'all' | 'taxpayer_sales' | 'consumer_sales' | 'purchases';

const props = withDefaults(defineProps<{
  appBaseUrl?: string;
}>(), {
  appBaseUrl: ''
});

const currentYear = new Date().getFullYear();
const selectedBook = ref<IvaBookSelection>('all');
const selectedMonth = ref(String(new Date().getMonth() + 1).padStart(2, '0'));
const selectedYear = ref(String(currentYear));

const bookOptions: Array<{ value: IvaBookSelection; label: string; description: string }> = [
  {
    value: 'all',
    label: 'Todos los libros',
    description: 'Genera ventas a contribuyentes, ventas a consumidor final y compras en un solo PDF.'
  },
  {
    value: 'taxpayer_sales',
    label: 'Ventas a contribuyentes',
    description: 'Libro formal para comprobantes emitidos a contribuyentes.'
  },
  {
    value: 'consumer_sales',
    label: 'Ventas a consumidor final',
    description: 'Libro formal consolidado para ventas a consumidor final.'
  },
  {
    value: 'purchases',
    label: 'Compras',
    description: 'Libro formal de compras y crédito fiscal.'
  }
];

const monthOptions = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' }
];

const yearOptions = computed(() => {
  const start = currentYear - 5;
  return Array.from({ length: 8 }, (_, index) => String(start + index)).reverse();
});

const selectedBookDescription = computed(() => {
  return bookOptions.find((option) => option.value === selectedBook.value)?.description ?? '';
});

const pdfUrl = computed(() => {
  const base = props.appBaseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    book: selectedBook.value,
    month: selectedMonth.value,
    year: selectedYear.value
  });

  return `${base}/libros-iva/pdf?${params.toString()}`;
});

</script>

<template>
  <section class="mx-auto max-w-5xl">
    <div class="rounded-lg border border-line bg-surface p-6 shadow-sm shadow-surface">
      <p class="text-xs font-semibold uppercase tracking-wide text-primary">Contabilidad fiscal</p>
      <h2 class="mt-1 text-2xl font-semibold text-text">Libros de IVA</h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Selecciona el período y el libro a generar. El documento se abre como PDF formal en una nueva pestaña.
      </p>

      <div class="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label class="block text-sm font-semibold text-text">
          Libro
          <select v-model="selectedBook" class="mt-1 w-full rounded-md border-line bg-surface text-sm text-text">
            <option v-for="option in bookOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="block text-sm font-semibold text-text">
          Mes
          <select v-model="selectedMonth" class="mt-1 w-full rounded-md border-line bg-surface text-sm text-text">
            <option v-for="option in monthOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="block text-sm font-semibold text-text">
          Año
          <select v-model="selectedYear" class="mt-1 w-full rounded-md border-line bg-surface text-sm text-text">
            <option v-for="year in yearOptions" :key="year" :value="year">
              {{ year }}
            </option>
          </select>
        </label>

        <div class="flex items-end">
          <a
            class="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast"
            :href="pdfUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Generar PDF
          </a>
        </div>
      </div>

      <div class="mt-5 rounded-md border border-line bg-surface-muted px-4 py-3">
        <p class="text-sm font-medium text-text">{{ selectedBookDescription }}</p>
      </div>
    </div>
  </section>
</template>
