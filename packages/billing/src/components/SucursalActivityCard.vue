<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, RefreshCw, Store } from 'lucide-vue-next';
import type {
  CoreDteClient,
  DteSucursalActivity,
  DteSucursalActivityGranularity,
} from '@stelfaro/api-client';

const props = defineProps<{
  core: CoreDteClient;
  empresaId: number;
}>();

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
}>();

const granularities: Array<{ value: DteSucursalActivityGranularity; label: string }> = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

const granularity = ref<DteSucursalActivityGranularity>('month');
const offset = ref(0);
const data = ref<DteSucursalActivity | null>(null);
const loading = ref(false);
const error = ref('');

const sucursales = computed(() => data.value?.sucursales ?? []);
const maxTotal = computed(() => sucursales.value.reduce((max, s) => Math.max(max, s.total), 0));
const periodLabel = computed(() => data.value?.period.label ?? '');
const emptyPeriod = computed(
  () => !loading.value && !error.value && sucursales.value.every((s) => s.total === 0),
);

async function load() {
  if (!props.empresaId) return;
  loading.value = true;
  error.value = '';
  try {
    data.value = await props.core.dashboardSucursales({
      empresa_id: props.empresaId,
      granularity: granularity.value,
      offset: offset.value,
    });
    emit('update:visible', data.value.has_multiple_sucursales);
  } catch {
    error.value = 'No pudimos cargar la actividad por sucursal.';
  } finally {
    loading.value = false;
  }
}

function selectGranularity(value: DteSucursalActivityGranularity) {
  if (value === granularity.value) return;
  granularity.value = value;
  offset.value = 0;
}

function goPrevious() {
  offset.value -= 1;
}

function goNext() {
  if (offset.value < 0) offset.value += 1;
}

watch(
  [() => props.empresaId, granularity, offset],
  () => {
    void load();
  },
  { immediate: true },
);

defineExpose({ load });
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <Store class="h-4 w-4" />
        </span>
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-muted">Actividad por sucursal</h2>
          <p class="text-xs text-muted">DTE emitidos por sucursal</p>
        </div>
      </div>
      <button
        type="button"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition hover:bg-surface-muted"
        :disabled="loading"
        aria-label="Actualizar"
        @click="load"
      >
        <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
      </button>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div class="inline-flex rounded-lg border border-line bg-surface-muted p-0.5">
        <button
          v-for="option in granularities"
          :key="option.value"
          type="button"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
          :class="option.value === granularity ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'"
          @click="selectGranularity(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted transition hover:bg-surface-muted"
          aria-label="Periodo anterior"
          @click="goPrevious"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <span class="min-w-[8.5rem] text-center text-xs font-semibold text-text">{{ periodLabel || '—' }}</span>
        <button
          type="button"
          class="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted transition enabled:hover:bg-surface-muted disabled:opacity-40"
          :disabled="offset >= 0"
          aria-label="Periodo siguiente"
          @click="goNext"
        >
          <ChevronRight class="h-4 w-4" />
        </button>
      </div>
    </div>

    <p v-if="error" class="px-4 py-4 text-sm text-danger">{{ error }}</p>

    <p v-else-if="loading && !data" class="px-4 py-6 text-center text-sm text-muted">Cargando…</p>

    <p v-else-if="emptyPeriod" class="px-4 py-6 text-center text-sm text-muted">
      Sin DTE emitidos en este periodo.
    </p>

    <ul v-else class="divide-y divide-line" :class="loading ? 'opacity-60' : ''">
      <li v-for="sucursal in sucursales" :key="sucursal.sucursal_id" class="px-4 py-3.5">
        <div class="flex items-baseline justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-text">{{ sucursal.nombre }}</p>
            <p v-if="sucursal.codigo" class="truncate text-xs text-muted">{{ sucursal.codigo }}</p>
          </div>
          <strong class="shrink-0 text-xl font-bold tabular-nums text-text">{{ sucursal.total }}</strong>
        </div>

        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            class="h-full rounded-full bg-primary"
            :style="{ width: `${maxTotal ? Math.round((sucursal.total / maxTotal) * 100) : 0}%` }"
          ></div>
        </div>

        <div v-if="sucursal.by_type.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="type in sucursal.by_type"
            :key="type.tipo_dte"
            class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
            :title="type.label"
          >
            <span class="font-medium text-text">{{ type.label }}</span>
            <span class="tabular-nums">{{ type.total }}</span>
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>
