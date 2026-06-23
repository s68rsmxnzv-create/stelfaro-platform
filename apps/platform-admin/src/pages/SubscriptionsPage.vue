<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { PlatformSubscriptionPlan, PlatformSubscriptionTenantRow } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiInput, UiModalShell, UiPanel, UiRefreshButton, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import { usePlatformSessionStore } from '../stores/platformSession';

const platform = usePlatformSessionStore();
const plans = ref<PlatformSubscriptionPlan[]>([]);
const subscriptions = ref<PlatformSubscriptionTenantRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);
const modalOpen = ref(false);
const selectedRow = ref<PlatformSubscriptionTenantRow | null>(null);

const form = reactive({
  planId: '',
  status: 'trialing',
  billingCycle: 'monthly',
  price: '',
  trialEndsAt: '',
  currentPeriodEndsAt: ''
});

const planOptions = computed(() => plans.value.map((plan) => ({
  value: plan.id,
  label: `${plan.name} · ${money(plan.price_cents, plan.currency)}`
})));
const statusOptions = [
  { value: 'trialing', label: 'Prueba' },
  { value: 'active', label: 'Activa' },
  { value: 'past_due', label: 'Pago pendiente' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'canceled', label: 'Cancelada' }
];
const billingCycleOptions = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
  { value: 'manual', label: 'Manual' }
];
const activeCount = computed(() => subscriptions.value.filter((item) => ['trialing', 'active'].includes(item.subscription?.status ?? '')).length);
const attentionCount = computed(() => subscriptions.value.filter((item) => ['past_due', 'suspended'].includes(item.subscription?.status ?? '')).length);
const unassignedCount = computed(() => subscriptions.value.filter((item) => !item.subscription).length);
const canSave = computed(() => Boolean(selectedRow.value && form.planId && form.status && !saving.value));

onMounted(() => {
  void load();
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    const response = await platform.client.subscriptions();
    plans.value = response.plans;
    subscriptions.value = response.subscriptions;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar suscripciones.';
  } finally {
    loading.value = false;
  }
}

function openSubscription(row: PlatformSubscriptionTenantRow): void {
  const plan = row.subscription?.plan ?? plans.value[0] ?? null;

  selectedRow.value = row;
  form.planId = plan ? String(plan.id) : '';
  form.status = row.subscription?.status ?? 'trialing';
  form.billingCycle = row.subscription?.billing_cycle ?? plan?.billing_cycle ?? 'monthly';
  form.price = String((row.subscription?.price_cents ?? plan?.price_cents ?? 0) / 100);
  form.trialEndsAt = dateInputValue(row.subscription?.trial_ends_at);
  form.currentPeriodEndsAt = dateInputValue(row.subscription?.current_period_ends_at);
  error.value = null;
  saved.value = null;
  modalOpen.value = true;
}

async function saveSubscription(): Promise<void> {
  if (!selectedRow.value || !canSave.value) {
    return;
  }

  saving.value = true;
  error.value = null;
  saved.value = null;

  try {
    await platform.client.updateTenantSubscription(selectedRow.value.tenant.id, {
      plan_id: Number(form.planId),
      status: form.status,
      billing_cycle: form.billingCycle,
      price_cents: Math.round(Number(form.price || 0) * 100),
      currency: 'USD',
      trial_ends_at: isoDate(form.trialEndsAt),
      current_period_ends_at: isoDate(form.currentPeriodEndsAt)
    });
    modalOpen.value = false;
    saved.value = `Suscripcion actualizada para ${selectedRow.value.tenant.name}.`;
    await load();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar la suscripcion.';
  } finally {
    saving.value = false;
  }
}

function selectedPlan(): PlatformSubscriptionPlan | null {
  return plans.value.find((plan) => plan.id === Number(form.planId)) ?? null;
}

function statusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'trialing') return 'info';
  if (status === 'past_due') return 'warning';
  if (status === 'suspended' || status === 'canceled') return 'danger';

  return 'neutral';
}

function statusLabel(status: string | null | undefined): string {
  if (status === 'trialing') return 'Prueba';
  if (status === 'active') return 'Activa';
  if (status === 'past_due') return 'Pago pendiente';
  if (status === 'suspended') return 'Suspendida';
  if (status === 'canceled') return 'Cancelada';

  return 'Sin suscripcion';
}

function appsLabel(row: PlatformSubscriptionTenantRow): string {
  const appNames = row.subscription?.plan?.included_app_keys?.length
    ? row.subscription.plan.included_app_keys
    : row.apps.map((app) => app.name || app.key).filter(Boolean);

  return appNames.length ? appNames.join(' + ') : '-';
}

function renewalLabel(row: PlatformSubscriptionTenantRow): string {
  const date = row.subscription?.current_period_ends_at ?? row.subscription?.trial_ends_at;

  return date ? formatDate(date) : 'Manual';
}

function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2
  }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function dateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

function isoDate(value: string): string | null {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-soft">Plataforma</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-950 dark:text-text">Suscripciones</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600 dark:text-muted">
          Control comercial de tenants, planes, vigencia y acceso operativo a apps.
        </p>
      </div>
      <UiRefreshButton :loading="loading" @click="load" />
    </div>

    <div class="mb-5 grid gap-4 md:grid-cols-3">
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Activas o prueba</p>
        <p class="mt-2 text-3xl font-black text-slate-950 dark:text-text">{{ activeCount }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Requieren atencion</p>
        <p class="mt-2 text-3xl font-black text-slate-950 dark:text-text">{{ attentionCount }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Sin suscripcion</p>
        <p class="mt-2 text-3xl font-black text-slate-950 dark:text-text">{{ unassignedCount }}</p>
      </UiPanel>
    </div>

    <p v-if="error" class="mb-4 rounded-md bg-rose-600 px-4 py-3 text-sm text-white">{{ error }}</p>
    <p v-if="saved" class="mb-4 rounded-md bg-emerald-600 px-4 py-3 text-sm text-white">{{ saved }}</p>

    <UiPanel variant="raised">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-black text-slate-950 dark:text-text">Suscripciones por tenant</h2>
          <p class="text-sm text-slate-600 dark:text-muted">La suscripcion actualiza el acceso a apps incluidas en el plan.</p>
        </div>
      </div>

      <UiDataTable overflow="auto" min-width="min-w-[920px]">
        <thead class="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-surface-muted dark:text-soft">
          <tr>
            <th class="px-4 py-3">Tenant</th>
            <th class="px-4 py-3">Plan</th>
            <th class="px-4 py-3">Apps</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Vigencia</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-line">
          <tr v-for="row in subscriptions" :key="row.tenant.id">
            <td class="px-4 py-4">
              <p class="font-bold text-slate-950 dark:text-text">{{ row.tenant.name }}</p>
              <p class="text-xs text-slate-500 dark:text-soft">{{ row.tenant.slug }}</p>
            </td>
            <td class="px-4 py-4 text-slate-700 dark:text-muted">
              {{ row.subscription?.plan?.name ?? 'Sin plan' }}
            </td>
            <td class="px-4 py-4 text-slate-700 dark:text-muted">{{ appsLabel(row) }}</td>
            <td class="px-4 py-4">
              <UiStatusBadge :tone="statusTone(row.subscription?.status)">{{ statusLabel(row.subscription?.status) }}</UiStatusBadge>
            </td>
            <td class="px-4 py-4 text-slate-700 dark:text-muted">{{ renewalLabel(row) }}</td>
            <td class="px-4 py-4 text-right">
              <UiButton size="sm" variant="secondary" @click="openSubscription(row)">
                {{ row.subscription ? 'Editar' : 'Asignar' }}
              </UiButton>
            </td>
          </tr>
          <tr v-if="!subscriptions.length && !loading">
            <td class="px-4 py-8 text-slate-600 dark:text-muted" colspan="6">No hay tenants registrados.</td>
          </tr>
        </tbody>
      </UiDataTable>
    </UiPanel>

    <UiModalShell
      :open="modalOpen"
      title="Suscripcion del tenant"
      :description="selectedRow ? selectedRow.tenant.name : ''"
      @close="modalOpen = false"
    >
      <div class="grid gap-4">
        <UiSelect v-model="form.planId" label="Plan" :options="planOptions" placeholder="Seleccionar plan" />
        <div class="grid gap-4 sm:grid-cols-2">
          <UiSelect v-model="form.status" label="Estado" :options="statusOptions" />
          <UiSelect v-model="form.billingCycle" label="Ciclo" :options="billingCycleOptions" />
        </div>
        <UiInput v-model="form.price" label="Precio USD" type="number" placeholder="0.00" />
        <div class="grid gap-4 sm:grid-cols-2">
          <UiInput v-model="form.trialEndsAt" label="Fin de prueba" type="date" />
          <UiInput v-model="form.currentPeriodEndsAt" label="Fin de periodo" type="date" />
        </div>
        <UiPanel v-if="selectedPlan()" variant="muted">
          <p class="text-sm font-bold text-slate-950 dark:text-text">{{ selectedPlan()?.name }}</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-muted">{{ selectedPlan()?.description }}</p>
          <p class="mt-3 text-sm font-semibold text-slate-700 dark:text-muted">
            Apps: {{ selectedPlan()?.included_app_keys.join(' + ') || '-' }}
          </p>
        </UiPanel>
      </div>

      <template #footer>
        <UiButton variant="secondary" :disabled="saving" @click="modalOpen = false">Cancelar</UiButton>
        <UiButton :disabled="!canSave" @click="saveSubscription">
          {{ saving ? 'Guardando...' : 'Guardar suscripcion' }}
        </UiButton>
      </template>
    </UiModalShell>
  </section>
</template>
