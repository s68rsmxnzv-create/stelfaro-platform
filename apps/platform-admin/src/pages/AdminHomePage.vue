<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { DteDashboardSummary } from '@stelfaro/api-client';
import { UiRefreshButton } from '@stelfaro/ui';
import { useAdminSessionStore } from '../stores/adminSession';
import { useCoreSessionStore } from '../stores/coreSession';

const core = useCoreSessionStore();
const notifications = useAdminSessionStore();

const summary = ref<DteDashboardSummary | null>(null);
const loadingSummary = ref(false);
const summaryError = ref<string | null>(null);

const quickActions = [
  { label: 'Empresas fiscales', description: 'Buscar y administrar empresas registradas.', href: '/empresas' },
  { label: 'Registrar empresa', description: 'Abrir onboarding fiscal.', href: '/fiscal/onboarding' },
  { label: 'Suscripciones', description: 'Revisar la capa comercial.', href: '/subscriptions' },
  { label: 'Buzon SMTP', description: 'Configurar correo global.', href: '/notifications/mail-transport' }
];

const maxDailyTotal = computed(() => Math.max(...(summary.value?.daily.map((item) => item.total) ?? [0]), 1));
const hasDailyActivity = computed(() => (summary.value?.daily ?? []).some((item) => item.total > 0));

const statusCards = computed(() => [
  {
    label: 'Core fiscal',
    value: core.isConnected ? 'Conectado' : 'Sin conexion',
    detail: core.serviceName ?? core.lastError ?? 'Motor fiscal',
    tone: core.isConnected ? 'ready' : 'offline'
  },
  {
    label: 'Notificaciones',
    value: notifications.isConnected ? 'Conectado' : 'Sin conexion',
    detail: notifications.serviceName ?? notifications.lastError ?? 'Servicio de correo',
    tone: notifications.isConnected ? 'ready' : 'offline'
  },
  {
    label: 'Empresas fiscales',
    value: formatNumber(summary.value?.totals.companies),
    detail: summary.value ? 'Registradas en el core fiscal' : 'Pendiente de lectura',
    tone: summary.value ? 'neutral' : 'pending'
  },
  {
    label: 'DTE emitidos',
    value: formatNumber(summary.value?.totals.emitted),
    detail: summary.value ? 'Total global transmitido o procesado' : 'Pendiente de lectura',
    tone: summary.value ? 'neutral' : 'pending'
  }
]);

onMounted(() => {
  void loadSummary();
});

watch(
  () => core.isConnected,
  (connected) => {
    if (connected && !summary.value) {
      void loadSummary();
    }
  }
);

async function loadSummary(): Promise<void> {
  if (!core.isConnected || loadingSummary.value) return;

  loadingSummary.value = true;
  summaryError.value = null;

  try {
    summary.value = await core.client.dashboardSummary();
  } catch (error) {
    summary.value = null;
    summaryError.value = error instanceof Error ? error.message : 'No fue posible cargar el resumen fiscal.';
  } finally {
    loadingSummary.value = false;
  }
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';

  return new Intl.NumberFormat('es-SV').format(value);
}

function barHeight(total: number): string {
  if (total <= 0) return '4px';

  return `${Math.max((total / maxDailyTotal.value) * 100, 8)}%`;
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-bold uppercase tracking-wide text-muted">Administracion global</p>
      <h1 class="mt-1 text-2xl font-bold text-text">Resumen operativo</h1>
    </div>

    <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="card in statusCards" :key="card.label" class="rounded-lg border border-line bg-surface p-5 shadow-surface">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">{{ card.label }}</p>
          <span
            class="mt-1 h-2.5 w-2.5 rounded-full"
            :class="{
              'bg-success': card.tone === 'ready',
              'bg-danger': card.tone === 'offline',
              'bg-warning': card.tone === 'pending',
              'bg-primary': card.tone === 'neutral'
            }"
          ></span>
        </div>
        <p class="mt-3 text-2xl font-bold text-text">{{ card.value }}</p>
        <p class="mt-2 truncate text-sm text-muted">{{ card.detail }}</p>
      </article>
    </div>

    <section class="rounded-lg border border-line bg-surface p-5 shadow-surface">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-text">DTE globales</h2>
          <p class="mt-1 text-sm text-muted">Actividad fiscal consolidada de los ultimos 30 dias.</p>
        </div>
        <UiRefreshButton
          class="h-10"
          :loading="loadingSummary"
          :disabled="loadingSummary || !core.isConnected"
          @click="loadSummary"
        />
      </div>

      <p v-if="summaryError" class="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{{ summaryError }}</p>

      <div v-if="summary" class="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div class="rounded-lg border border-line p-4">
          <div v-if="hasDailyActivity" class="flex h-64 items-end gap-1 border-b border-line px-1 pb-2">
            <div v-for="day in summary.daily" :key="day.date" class="group flex min-w-0 flex-1 items-end justify-center">
              <div
                class="w-full max-w-5 rounded-t bg-primary transition group-hover:bg-primary-hover"
                :style="{ height: barHeight(day.total) }"
                :title="`${shortDate(day.date)}: ${formatNumber(day.total)} DTE`"
              ></div>
            </div>
          </div>
          <div v-else class="grid h-64 place-items-center rounded-md bg-surface-muted text-sm font-medium text-muted">
            Sin DTE emitidos en los ultimos 30 dias.
          </div>
          <div class="mt-3 flex justify-between text-xs font-semibold text-muted">
            <span>{{ shortDate(summary.daily[0]?.date) }}</span>
            <span>{{ shortDate(summary.daily[summary.daily.length - 1]?.date) }}</span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="rounded-lg border border-line p-4">
            <p class="text-xs font-bold uppercase tracking-wide text-muted">Estado MH</p>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Aceptados</dt>
                <dd class="font-bold text-success">{{ formatNumber(summary.totals.accepted) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Rechazados</dt>
                <dd class="font-bold text-danger">{{ formatNumber(summary.totals.rejected) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Pendientes</dt>
                <dd class="font-bold text-warning">{{ formatNumber(summary.totals.pending) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Invalidados</dt>
                <dd class="font-bold text-muted">{{ formatNumber(summary.totals.invalidated) }}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-lg border border-line p-4">
            <p class="text-xs font-bold uppercase tracking-wide text-muted">Tipos DTE</p>
            <div v-if="summary.by_type.length > 0" class="mt-3 space-y-2">
              <div v-for="item in summary.by_type" :key="item.tipo_dte" class="flex items-center justify-between gap-3 text-sm">
                <span class="font-semibold text-muted">{{ item.tipo_dte }}</span>
                <span class="font-bold text-text">{{ formatNumber(item.total) }}</span>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-muted">Sin documentos registrados.</p>
          </div>
        </div>
      </div>

      <div v-else-if="loadingSummary" class="mt-5 grid h-64 place-items-center rounded-lg border border-line bg-surface-muted text-sm font-bold text-muted">
        Cargando resumen fiscal
      </div>

      <div v-else class="mt-5 grid h-64 place-items-center rounded-lg border border-line bg-surface-muted text-sm font-medium text-muted">
        Conecta el core fiscal para ver el resumen global de DTE.
      </div>
    </section>

    <section class="mt-6 rounded-lg border border-line bg-surface p-5 shadow-surface">
      <h2 class="text-lg font-bold text-text">Acciones</h2>
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        <RouterLink v-for="action in quickActions" :key="action.label" :to="action.href" class="rounded-md border border-line p-4 transition hover:border-primary/40 hover:bg-primary-soft">
          <p class="text-sm font-bold text-text">{{ action.label }}</p>
          <p class="mt-2 text-sm leading-6 text-muted">{{ action.description }}</p>
        </RouterLink>
      </div>
    </section>
  </section>
</template>
