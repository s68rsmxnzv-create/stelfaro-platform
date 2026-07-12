<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Activity, ShieldAlert } from 'lucide-vue-next';
import type { PlatformAuditLog } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiInput, UiPanel, UiRefreshButton, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { usePlatformSessionStore } from '../stores/platformSession';

const platform = usePlatformSessionStore();
const logs = ref<PlatformAuditLog[]>([]);
const selected = ref<PlatformAuditLog | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const filters = reactive({
  source: 'all',
  q: '',
  result: '',
  dateFrom: '',
  dateTo: '',
  limit: 80
});

const sourceOptions = [
  { value: 'all', label: 'Todo' },
  { value: 'platform', label: 'Actividad' },
  { value: 'security', label: 'Seguridad' }
];

const resultOptions = computed(() => filters.source === 'security'
  ? [
    { value: '', label: 'Todos' },
    { value: 'warning', label: 'Advertencia' },
    { value: 'high', label: 'Alta' }
  ]
  : [
    { value: '', label: 'Todos' },
    { value: 'success', label: 'Exitoso' },
    { value: 'failed', label: 'Fallido' }
  ]);

const platformCount = computed(() => logs.value.filter((log) => log.source === 'platform').length);
const securityCount = computed(() => logs.value.filter((log) => log.source === 'security').length);
const failedCount = computed(() => logs.value.filter((log) => log.result === 'failed' || ['warning', 'high'].includes(log.severity ?? '')).length);

onMounted(() => {
  void load();
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await platform.client.auditLogs({
      source: filters.source,
      q: filters.q.trim() || undefined,
      result: filters.result || undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
      limit: filters.limit
    });
    logs.value = response.data;
    selected.value = response.data[0] ?? null;
  } catch (caught) {
    logs.value = [];
    selected.value = null;
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar auditoria.';
  } finally {
    loading.value = false;
  }
}

function resetFilters(): void {
  filters.source = 'all';
  filters.q = '';
  filters.result = '';
  filters.dateFrom = '';
  filters.dateTo = '';
  filters.limit = 80;
  void load();
}

function sourceLabel(source: string): string {
  return source === 'security' ? 'Seguridad' : 'Actividad';
}

function sourceTone(source: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  return source === 'security' ? 'warning' : 'info';
}

function resultLabel(log: PlatformAuditLog): string {
  if (log.source === 'security') {
    if (log.severity === 'high') return 'Alta';
    if (log.severity === 'warning') return 'Advertencia';

    return log.severity ?? 'Seguridad';
  }

  if (log.result === 'success') return 'Exitoso';
  if (log.result === 'failed') return 'Fallido';

  return log.result ?? 'N/D';
}

function resultTone(log: PlatformAuditLog): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (log.source === 'security') {
    return log.severity === 'high' ? 'danger' : 'warning';
  }

  return log.result === 'success' ? 'success' : 'danger';
}

function formatDate(value: string | null): string {
  if (!value) return '-';

  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function actorLabel(log: PlatformAuditLog): string {
  return log.user?.name ?? 'Sin usuario';
}

function contextLabel(log: PlatformAuditLog): string {
  return log.tenant?.name ?? log.ip_address ?? 'Sin contexto';
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'auth.login': 'Inicio de sesion',
    'auth.logout': 'Cierre de sesion',
    'auth.login_failed': 'Login fallido',
    'auth.login_lockout': 'Bloqueo por intentos',
    suspicious_input: 'Entrada sospechosa'
  };

  return labels[action] ?? action;
}

function metadataText(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return 'Sin metadatos adicionales.';
  }

  return JSON.stringify(metadata, null, 2);
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Gobierno</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950 dark:text-text">Auditoria</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600 dark:text-muted">
          Bitacora de actividad administrativa, accesos y eventos de seguridad.
        </p>
      </div>

      <UiRefreshButton :loading="loading" @click="load" />
    </div>

    <div class="mb-5 grid gap-4 md:grid-cols-3">
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <span class="grid h-11 w-11 place-items-center rounded-md bg-sky-100 text-sky-700 dark:bg-primary-soft dark:text-primary">
            <Activity class="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Actividad</p>
            <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ platformCount }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <span class="grid h-11 w-11 place-items-center rounded-md bg-amber-100 text-amber-700 dark:bg-warning-soft dark:text-warning">
            <ShieldAlert class="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Seguridad</p>
            <p class="mt-1 text-2xl font-black text-slate-950 dark:text-text">{{ securityCount }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Atencion</p>
        <p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ failedCount }}</p>
      </UiPanel>
    </div>

    <UiPanel variant="raised" class="mb-5">
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
        <UiInput v-model="filters.q" label="Buscar" placeholder="Accion, usuario, empresa, ruta o recurso" @keyup.enter="load" />
        <UiSelect v-model="filters.source" label="Origen" :options="sourceOptions" @change="filters.result = ''" />
        <UiSelect v-model="filters.result" label="Resultado" :options="resultOptions" />
        <UiInput v-model="filters.dateFrom" label="Desde" type="date" />
        <UiInput v-model="filters.dateTo" label="Hasta" type="date" />
        <div class="flex gap-2">
          <UiButton class="h-12" :disabled="loading" @click="load">Filtrar</UiButton>
          <UiButton class="h-12" variant="secondary" :disabled="loading" @click="resetFilters">Limpiar</UiButton>
        </div>
      </div>
    </UiPanel>

    <p v-if="error" class="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-danger-soft dark:text-danger">{{ error }}</p>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.75fr)]">
      <UiPanel variant="raised">
        <UiDataTable overflow="auto" min-width="min-w-[1040px]">
          <thead class="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-surface-muted dark:text-soft">
            <tr>
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3">Origen</th>
              <th class="px-4 py-3">Accion</th>
              <th class="px-4 py-3">Usuario</th>
              <th class="px-4 py-3">Contexto</th>
              <th class="px-4 py-3">Resultado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-line">
            <tr v-if="loading">
              <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="6">Cargando auditoria...</td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="6">No hay registros para estos filtros.</td>
            </tr>
            <tr
              v-for="log in logs"
              v-else
              :key="log.id"
              class="cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-muted"
              :class="selected?.id === log.id ? 'bg-sky-50 dark:bg-primary-soft' : ''"
              @click="selected = log"
            >
              <td class="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-muted">{{ formatDate(log.created_at) }}</td>
              <td class="px-4 py-4">
                <UiStatusBadge :tone="sourceTone(log.source)">{{ sourceLabel(log.source) }}</UiStatusBadge>
              </td>
              <td class="px-4 py-4">
                <p class="font-bold text-slate-950 dark:text-text">{{ actionLabel(log.action) }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ log.method || '-' }}</p>
              </td>
              <td class="px-4 py-4">
                <p class="font-semibold text-slate-800 dark:text-text">{{ actorLabel(log) }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ log.user?.email ?? log.ip_address ?? '-' }}</p>
              </td>
              <td class="px-4 py-4 text-sm text-slate-600 dark:text-muted">{{ contextLabel(log) }}</td>
              <td class="px-4 py-4">
                <UiStatusBadge :tone="resultTone(log)">{{ resultLabel(log) }}</UiStatusBadge>
              </td>
            </tr>
          </tbody>
        </UiDataTable>
      </UiPanel>

      <UiPanel variant="raised">
        <div v-if="selected">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Detalle</p>
              <h2 class="mt-1 text-lg font-black text-slate-950 dark:text-text">{{ actionLabel(selected.action) }}</h2>
            </div>
            <UiStatusBadge :tone="resultTone(selected)">{{ resultLabel(selected) }}</UiStatusBadge>
          </div>

          <dl class="mt-5 space-y-4 text-sm">
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Fecha</dt>
              <dd class="mt-1 text-slate-950 dark:text-text">{{ formatDate(selected.created_at) }}</dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Usuario</dt>
              <dd class="mt-1 text-slate-950 dark:text-text">{{ actorLabel(selected) }}</dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Empresa</dt>
              <dd class="mt-1 text-slate-950 dark:text-text">{{ selected.tenant?.name ?? '-' }}</dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Ruta</dt>
              <dd class="mt-1 break-all text-slate-950 dark:text-text">{{ selected.url ?? '-' }}</dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Recurso</dt>
              <dd class="mt-1 text-slate-950 dark:text-text">
                {{ selected.resource_type ?? '-' }} <span v-if="selected.resource_id">#{{ selected.resource_id }}</span>
              </dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Navegador</dt>
              <dd class="mt-1 break-words text-slate-950 dark:text-text">{{ selected.user_agent ?? '-' }}</dd>
            </div>
          </dl>

          <pre class="mt-5 max-h-80 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-line dark:bg-surface-muted dark:text-muted">{{ metadataText(selected.metadata) }}</pre>
        </div>
        <p v-else class="text-sm text-slate-500 dark:text-muted">Selecciona un registro para ver el detalle.</p>
      </UiPanel>
    </div>
  </section>
</template>
