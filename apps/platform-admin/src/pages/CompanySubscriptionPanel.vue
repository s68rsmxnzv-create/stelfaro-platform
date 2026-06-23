<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { PlatformSubscriptionPlan, PlatformSubscriptionTenantRow } from '@stelfaro/api-client';
import { UiButton, UiInput, UiPanel, UiRefreshButton, UiSelect, UiStatusBadge } from '@stelfaro/ui';
import type { SelectedAdminCompany } from '../stores/adminWorkspace';
import { usePlatformSessionStore } from '../stores/platformSession';

const props = defineProps<{
  company: SelectedAdminCompany;
}>();

const platform = usePlatformSessionStore();
const plans = ref<PlatformSubscriptionPlan[]>([]);
const row = ref<PlatformSubscriptionTenantRow | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref<string | null>(null);

const form = reactive({
  planId: '',
  status: 'active',
  billingCycle: 'manual',
  price: '',
  durationDays: '365',
  currentPeriodEndsAt: ''
});

const durationOptions = [
  { value: 3, label: '3 dias' },
  { value: 90, label: '3 meses' },
  { value: 182, label: '6 meses' },
  { value: 365, label: '1 ano' }
];
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
const planOptions = computed(() => plans.value.map((plan) => ({
  value: plan.id,
  label: `${plan.name} · ${money(plan.price_cents, plan.currency)}`
})));
const selectedPlan = computed(() => plans.value.find((plan) => plan.id === Number(form.planId)) ?? null);
const subscription = computed(() => row.value?.subscription ?? null);
const canSave = computed(() => Boolean(form.planId && form.status && form.durationDays && !saving.value));

onMounted(() => {
  void load();
});

watch(() => props.company.id, () => {
  void load();
});

watch(selectedPlan, (plan) => {
  if (!plan) return;

  form.price = String(plan.price_cents / 100);
  form.billingCycle = plan.billing_cycle;
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  saved.value = null;

  try {
    const response = await platform.client.tenantSubscriptionByCoreEmpresa(props.company.id);
    plans.value = response.plans;
    row.value = response.row;
    hydrateForm();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar la suscripcion.';
  } finally {
    loading.value = false;
  }
}

function hydrateForm(): void {
  const currentPlan = row.value?.subscription?.plan ?? plans.value.find((plan) => plan.key === 'pro') ?? plans.value[0] ?? null;

  form.planId = currentPlan ? String(currentPlan.id) : '';
  form.status = row.value?.subscription?.status === 'trialing' ? 'active' : row.value?.subscription?.status ?? 'active';
  form.billingCycle = row.value?.subscription?.billing_cycle ?? currentPlan?.billing_cycle ?? 'manual';
  form.price = String((row.value?.subscription?.price_cents ?? currentPlan?.price_cents ?? 0) / 100);
  form.durationDays = '365';
  form.currentPeriodEndsAt = dateInputValue(row.value?.subscription?.current_period_ends_at);
}

async function saveSubscription(): Promise<void> {
  if (!canSave.value) return;

  saving.value = true;
  error.value = null;
  saved.value = null;

  try {
    await platform.client.updateTenantSubscriptionByCoreEmpresa(props.company.id, {
      plan_id: Number(form.planId),
      status: form.status,
      billing_cycle: form.billingCycle,
      price_cents: Math.round(Number(form.price || 0) * 100),
      currency: 'USD',
      duration_days: Number(form.durationDays)
    });
    saved.value = 'Suscripcion actualizada.';
    await load();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar la suscripcion.';
  } finally {
    saving.value = false;
  }
}

function setDuration(days: number): void {
  form.durationDays = String(days);
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

function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function dateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}
</script>

<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Suscripcion</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950 dark:text-text">Suscripcion de empresa</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-muted">
          Gestion comercial directa para {{ company.tradeName }}.
        </p>
      </div>
      <UiRefreshButton :loading="loading" @click="load" />
    </div>

    <p v-if="error" class="mb-4 rounded-md bg-rose-600 px-4 py-3 text-sm text-white">{{ error }}</p>
    <p v-if="saved" class="mb-4 rounded-md bg-emerald-600 px-4 py-3 text-sm text-white">{{ saved }}</p>

    <div class="grid gap-5 lg:grid-cols-[1fr_360px]">
      <UiPanel variant="raised">
        <div class="grid gap-4 sm:grid-cols-2">
          <UiSelect v-model="form.planId" label="Plan" :options="planOptions" placeholder="Seleccionar plan" />
          <UiSelect v-model="form.status" label="Estado" :options="statusOptions" />
          <UiSelect v-model="form.billingCycle" label="Ciclo" :options="billingCycleOptions" />
          <UiInput v-model="form.price" label="Precio USD" type="number" placeholder="0.00" />
        </div>

        <div class="mt-5">
          <p class="text-sm font-bold text-slate-700 dark:text-muted">Duracion</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <UiButton
              v-for="option in durationOptions"
              :key="option.value"
              size="sm"
              :variant="form.durationDays === String(option.value) ? 'primary' : 'secondary'"
              @click="setDuration(option.value)"
            >
              {{ option.label }}
            </UiButton>
          </div>
        </div>

        <UiPanel v-if="selectedPlan" variant="muted" class="mt-5">
          <p class="text-sm font-bold text-slate-950 dark:text-text">{{ selectedPlan.name }}</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-muted">{{ selectedPlan.description }}</p>
          <p class="mt-3 text-sm font-semibold text-slate-700 dark:text-muted">
            Apps: {{ selectedPlan.included_app_keys.join(' + ') || '-' }}
          </p>
        </UiPanel>

        <div class="mt-5 flex justify-end">
          <UiButton :disabled="!canSave" @click="saveSubscription">
            {{ saving ? 'Guardando...' : 'Guardar suscripcion' }}
          </UiButton>
        </div>
      </UiPanel>

      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Estado actual</p>
        <div class="mt-3 flex items-center justify-between gap-3">
          <p class="text-lg font-black text-slate-950 dark:text-text">
            {{ subscription?.plan?.name ?? 'Sin plan contratado' }}
          </p>
          <UiStatusBadge :tone="statusTone(subscription?.status)">{{ statusLabel(subscription?.status) }}</UiStatusBadge>
        </div>

        <dl class="mt-5 grid gap-4 text-sm">
          <div>
            <dt class="font-semibold text-slate-500 dark:text-soft">Fin de prueba</dt>
            <dd class="mt-1 font-bold text-slate-950 dark:text-text">{{ formatDate(subscription?.trial_ends_at) }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-slate-500 dark:text-soft">Vigente hasta</dt>
            <dd class="mt-1 font-bold text-slate-950 dark:text-text">{{ formatDate(subscription?.current_period_ends_at) }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-slate-500 dark:text-soft">Precio</dt>
            <dd class="mt-1 font-bold text-slate-950 dark:text-text">
              {{ subscription ? money(subscription.price_cents, subscription.currency) : '-' }}
            </dd>
          </div>
        </dl>
      </UiPanel>
    </div>
  </section>
</template>
