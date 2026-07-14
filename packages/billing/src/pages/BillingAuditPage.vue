<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, PlatformClient, type DteDraftSummary, type MhFiscalEventSummary, type PlatformAuditLog } from '@stelfaro/api-client';
import { UiDataTable, UiInput, UiPanel, UiRefreshButton, UiSearchInput, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { Activity, FileText, ScrollText, ShieldCheck } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import { getBillingContext, peekBillingContext } from '../support/billingDataCache';

type AuditRow = {
  id: string;
  source: 'platform' | 'dte' | 'event';
  created_at: string | null;
  action: string;
  actor: string;
  actor_detail: string;
  context: string;
  result: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  detail: Record<string, unknown> | null;
};

const props = withDefaults(defineProps<{
  authToken?: string | null;
  coreBaseUrl?: string;
  platformBaseUrl?: string;
  platformSession?: Record<string, unknown> | null;
  billingContextCacheScope?: string;
}>(), {
  authToken: null,
  coreBaseUrl: '/api/v1',
  platformBaseUrl: '/api/v1',
  platformSession: null,
  billingContextCacheScope: 'default'
});

const core = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken }));
const platform = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const tenantId = computed(() => Number(props.platformSession?.tenant?.id || 0));
const context = ref(peekBillingContext(props.coreBaseUrl, props.billingContextCacheScope));
const selectedEmpresaId = ref<number | null>(null);
const platformLogs = ref<PlatformAuditLog[]>([]);
const documents = ref<DteDraftSummary[]>([]);
const events = ref<MhFiscalEventSummary[]>([]);
const selected = ref<AuditRow | null>(null);
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
  { value: 'dte', label: 'DTE' },
  { value: 'event', label: 'Eventos' }
];

const resultOptions = [
  { value: '', label: 'Todos' },
  { value: 'success', label: 'Exitosos' },
  { value: 'failed', label: 'Fallidos' }
];

const empresas = computed(() => context.value?.empresas ?? []);
const selectedEmpresa = computed(() => empresas.value.find((empresa) => Number(empresa.id) === Number(selectedEmpresaId.value)) ?? empresas.value[0] ?? null);

const rows = computed<AuditRow[]>(() => {
  const query = fold(filters.q.trim());
  const source = filters.source;
  const result = filters.result;

  return [
    ...platformLogs.value.map(platformRow),
    ...documents.value.map(documentRow),
    ...events.value.map(eventRow)
  ]
    .filter((row) => source === 'all' || row.source === source)
    .filter((row) => !result || resultMatches(row, result))
    .filter((row) => withinDates(row.created_at))
    .filter((row) => !query || fold([row.action, row.actor, row.actor_detail, row.context, row.result].join(' ')).includes(query))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, filters.limit);
});

const counts = computed(() => ({
  platform: rows.value.filter((row) => row.source === 'platform').length,
  dte: rows.value.filter((row) => row.source === 'dte').length,
  event: rows.value.filter((row) => row.source === 'event').length,
  failed: rows.value.filter((row) => row.tone === 'danger' || row.tone === 'warning').length
}));

watch(() => props.authToken, () => {
  void initialize();
}, { immediate: true });

watch(selectedEmpresaId, () => {
  void load();
});

async function initialize(): Promise<void> {
  if (!props.authToken) return;

  try {
    context.value = await getBillingContext(core.value, props.coreBaseUrl, props.billingContextCacheScope);
    selectedEmpresaId.value = selectedEmpresaId.value || context.value.empresas[0]?.id || null;
    await load();
  } catch (caught) {
    error.value = messageFromError(caught);
  }
}

async function load(): Promise<void> {
  if (!props.authToken || !tenantId.value || !selectedEmpresa.value) return;

  loading.value = true;
  error.value = null;

  try {
    const [platformResponse, documentResponse, eventResponse] = await Promise.all([
      platform.value.tenantAuditLogs(tenantId.value, {
        q: filters.q.trim() || undefined,
        result: filters.result || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        limit: filters.limit
      }),
      core.value.documents({
        empresa_id: selectedEmpresa.value.id,
        q: filters.q.trim() || undefined,
        limit: filters.limit,
        include_audit: false
      }),
      core.value.mhEvents({
        empresa_id: selectedEmpresa.value.id,
        q: filters.q.trim() || undefined,
        limit: filters.limit
      })
    ]);

    platformLogs.value = platformResponse.data;
    documents.value = documentResponse.data;
    events.value = eventResponse.data;
    selected.value = rows.value[0] ?? null;
  } catch (caught) {
    platformLogs.value = [];
    documents.value = [];
    events.value = [];
    selected.value = null;
    error.value = messageFromError(caught);
  } finally {
    loading.value = false;
  }
}

function platformRow(log: PlatformAuditLog): AuditRow {
  return {
    id: log.id,
    source: 'platform',
    created_at: log.created_at,
    action: actionLabel(log.action),
    actor: log.user?.name ?? 'Sin usuario',
    actor_detail: log.user?.email ?? log.ip_address ?? '-',
    context: log.tenant?.name ?? log.resource_type ?? '-',
    result: log.result === 'success' ? 'Exitoso' : (log.result === 'failed' ? 'Fallido' : log.result ?? '-'),
    tone: log.result === 'success' ? 'success' : 'danger',
    detail: log.metadata
  };
}

function documentRow(document: DteDraftSummary): AuditRow {
  const actor = document.performed_by;
  const accepted = ['accepted', 'received', 'received_by_mh'].includes(String(document.estado));

  return {
    id: `dte-${document.id}`,
    source: 'dte',
    created_at: document.processed_at ?? document.created_at ?? null,
    action: `DTE ${document.tipoDte} ${document.numeroControl}`,
    actor: actor?.name ?? 'Sin usuario',
    actor_detail: actor?.email ?? (actor?.platform_user_id ? `Usuario plataforma ${actor.platform_user_id}` : '-'),
    context: document.empresa?.nombre_comercial ?? document.empresa?.razon_social ?? '-',
    result: statusLabel(document.estado),
    tone: document.estado === 'rejected' ? 'danger' : (accepted ? 'success' : 'info'),
    detail: {
      codigoGeneracion: document.codigoGeneracion,
      selloRecibido: document.selloRecibido,
      totalPagar: document.totalPagar,
      performed_by: document.performed_by,
      error: document.errorMessage
    }
  };
}

function eventRow(event: MhFiscalEventSummary): AuditRow {
  const actor = event.transmitted_by ?? event.performed_by;

  return {
    id: `event-${event.id}`,
    source: 'event',
    created_at: event.processed_at ?? event.transmitted_at ?? event.created_at ?? null,
    action: `Evento ${event.eventType}`,
    actor: actor?.name ?? 'Sin usuario',
    actor_detail: actor?.email ?? (actor?.platform_user_id ? `Usuario plataforma ${actor.platform_user_id}` : '-'),
    context: event.empresa?.nombre_comercial ?? event.empresa?.razon_social ?? '-',
    result: statusLabel(event.estado),
    tone: event.estado === 'rejected' ? 'danger' : (event.estado === 'accepted' ? 'success' : 'info'),
    detail: {
      numeroControl: event.numeroControl,
      codigoGeneracion: event.codigoGeneracion,
      selloRecibido: event.selloRecibido,
      performed_by: event.performed_by,
      transmitted_by: event.transmitted_by,
      error: event.errorMessage
    }
  };
}

function resultMatches(row: AuditRow, result: string): boolean {
  return result === 'success'
    ? row.tone === 'success'
    : row.tone === 'danger' || row.tone === 'warning';
}

function withinDates(value: string | null): boolean {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (filters.dateFrom && time < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
  if (filters.dateTo && time > new Date(`${filters.dateTo}T23:59:59`).getTime()) return false;

  return true;
}

function sourceLabel(source: AuditRow['source']): string {
  if (source === 'dte') return 'DTE';
  if (source === 'event') return 'Evento';

  return 'Actividad';
}

function sourceTone(source: AuditRow['source']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (source === 'dte') return 'success';
  if (source === 'event') return 'warning';

  return 'info';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    ready_to_sign: 'Listo para firma',
    signed: 'Firmado',
    sent: 'Transmitido',
    accepted: 'Aceptado',
    received: 'Aceptado',
    received_by_mh: 'Aceptado',
    rejected: 'Rechazado'
  };

  return labels[status] ?? status;
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'auth.login': 'Inicio de sesion',
    'auth.logout': 'Cierre de sesion',
    'auth.login_failed': 'Login fallido',
    'auth.login_lockout': 'Bloqueo por intentos'
  };

  return labels[action] ?? action;
}

function formatDate(value: string | null): string {
  if (!value) return '-';

  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function detailText(detail: Record<string, unknown> | null): string {
  if (!detail || Object.keys(detail).length === 0) return 'Sin detalle adicional.';

  return JSON.stringify(detail, null, 2);
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function messageFromError(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'No fue posible cargar auditoría.';
}
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-sky-700 dark:text-primary">Empresa</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-950 dark:text-text">Auditoría operativa</h2>
      </div>
      <UiRefreshButton :loading="loading" @click="load" />
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <Activity class="h-6 w-6 text-sky-600 dark:text-primary" />
          <div>
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Actividad</p>
            <p class="text-2xl font-black text-slate-950 dark:text-text">{{ counts.platform }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <FileText class="h-6 w-6 text-emerald-600" />
          <div>
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">DTE</p>
            <p class="text-2xl font-black text-slate-950 dark:text-text">{{ counts.dte }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <ScrollText class="h-6 w-6 text-amber-600" />
          <div>
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Eventos</p>
            <p class="text-2xl font-black text-slate-950 dark:text-text">{{ counts.event }}</p>
          </div>
        </div>
      </UiPanel>
      <UiPanel variant="raised">
        <div class="flex items-center gap-3">
          <ShieldCheck class="h-6 w-6 text-rose-600" />
          <div>
            <p class="text-xs font-bold uppercase text-slate-500 dark:text-soft">Atención</p>
            <p class="text-2xl font-black text-slate-950 dark:text-text">{{ counts.failed }}</p>
          </div>
        </div>
      </UiPanel>
    </div>

    <UiPanel variant="raised">
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_0.75fr] lg:items-end">
        <UiSearchInput v-model="filters.q" label="Buscar" placeholder="Usuario, correo, documento, evento o ruta" @keyup.enter="load" />
        <UiSelect v-model="filters.source" label="Origen" :options="sourceOptions" />
        <UiSelect v-model="filters.result" label="Resultado" :options="resultOptions" />
        <UiInput v-model="filters.dateFrom" label="Desde" type="date" />
        <UiInput v-model="filters.dateTo" label="Hasta" type="date" />
      </div>
    </UiPanel>

    <p v-if="error" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-danger-soft dark:text-danger">{{ error }}</p>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.75fr)]">
      <UiPanel variant="raised">
        <UiDataTable overflow="auto" min-width="min-w-[1040px]">
          <thead class="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-surface-muted dark:text-soft">
            <tr>
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3">Origen</th>
              <th class="px-4 py-3">Acción</th>
              <th class="px-4 py-3">Usuario</th>
              <th class="px-4 py-3">Contexto</th>
              <th class="px-4 py-3">Resultado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-line">
            <tr v-if="loading">
              <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="6">Cargando auditoría...</td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="6">No hay registros para estos filtros.</td>
            </tr>
            <tr
              v-for="row in rows"
              v-else
              :key="row.id"
              class="cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-muted"
              :class="selected?.id === row.id ? 'bg-sky-50 dark:bg-primary-soft' : ''"
              @click="selected = row"
            >
              <td class="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-muted">{{ formatDate(row.created_at) }}</td>
              <td class="px-4 py-4"><UiStatusBadge :tone="sourceTone(row.source)">{{ sourceLabel(row.source) }}</UiStatusBadge></td>
              <td class="px-4 py-4 font-bold text-slate-950 dark:text-text">{{ row.action }}</td>
              <td class="px-4 py-4">
                <p class="font-semibold text-slate-800 dark:text-text">{{ row.actor }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ row.actor_detail }}</p>
              </td>
              <td class="px-4 py-4 text-sm text-slate-600 dark:text-muted">{{ row.context }}</td>
              <td class="px-4 py-4"><UiStatusBadge :tone="row.tone">{{ row.result }}</UiStatusBadge></td>
            </tr>
          </tbody>
        </UiDataTable>
      </UiPanel>

      <UiPanel variant="raised">
        <div v-if="selected">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Detalle</p>
          <h3 class="mt-2 text-lg font-black text-slate-950 dark:text-text">{{ selected.action }}</h3>
          <dl class="mt-4 space-y-3 text-sm">
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Usuario</dt>
              <dd class="mt-1 text-slate-800 dark:text-text">{{ selected.actor }} · {{ selected.actor_detail }}</dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Fecha</dt>
              <dd class="mt-1 text-slate-800 dark:text-text">{{ formatDate(selected.created_at) }}</dd>
            </div>
            <div>
              <dt class="font-bold text-slate-500 dark:text-soft">Contexto</dt>
              <dd class="mt-1 text-slate-800 dark:text-text">{{ selected.context }}</dd>
            </div>
          </dl>
          <pre class="mt-4 max-h-[32rem] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-line dark:bg-surface-muted dark:text-muted">{{ detailText(selected.detail) }}</pre>
        </div>
        <p v-else class="text-sm text-slate-500 dark:text-muted">Selecciona un registro para ver el detalle.</p>
      </UiPanel>
    </div>
  </section>
</template>
