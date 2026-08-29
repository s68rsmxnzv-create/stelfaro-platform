<script setup lang="ts">
import {
  PlatformClient,
  type PlatformFiscalAssignment,
  type PlatformFiscalScopeResponse,
  type PlatformTenantUserMembership,
} from '@stelfaro/api-client';
import { UiButton, UiPanel, UiRefreshButton, UiStatusBadge } from '@stelfaro/ui';
import { computed, onMounted, reactive, ref } from 'vue';

const props = withDefaults(defineProps<{
  tenantId: number;
  platformBaseUrl?: string;
  requestCredentials?: RequestCredentials;
}>(), {
  platformBaseUrl: '/api/v1',
  requestCredentials: undefined,
});

type AssignmentForm = { sucursalId: string; puntoVentaId: string };

const client = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: props.requestCredentials }));
const memberships = ref<PlatformTenantUserMembership[]>([]);
const fiscalScope = ref<PlatformFiscalScopeResponse | null>(null);
const forms = reactive<Record<number, AssignmentForm>>({});
const loading = ref(false);
const savingId = ref<number | null>(null);
const error = ref('');
const notice = ref('');
const cashiers = computed(() => memberships.value.filter((membership) => membership.role === 'billing_user' && membership.status === 'active'));

onMounted(() => void load());

async function load(): Promise<void> {
  if (!props.tenantId) return;
  loading.value = true;
  error.value = '';
  try {
    const [users, scope] = await Promise.all([
      client.value.tenantUsers(props.tenantId),
      client.value.tenantFiscalScope(props.tenantId),
    ]);
    memberships.value = users.memberships;
    fiscalScope.value = scope;
    cashiers.value.forEach((membership) => initializeForm(membership));
  } catch (caught) {
    error.value = errorMessage(caught, 'No se pudieron cargar los cajeros y las cajas fiscales.');
  } finally {
    loading.value = false;
  }
}

function initializeForm(membership: PlatformTenantUserMembership): void {
  const assignment = defaultAssignment(membership);
  const sucursal = fiscalScope.value?.sucursales.find((item) => item.id === assignment?.core_sucursal_id)
    ?? fiscalScope.value?.sucursales[0];
  const point = sucursal?.puntos_venta.find((item) => item.id === assignment?.core_punto_venta_id)
    ?? sucursal?.puntos_venta[0];
  forms[membership.id] = {
    sucursalId: sucursal ? String(sucursal.id) : '',
    puntoVentaId: point ? String(point.id) : '',
  };
}

function changeSucursal(membershipId: number): void {
  const firstPoint = pointsFor(membershipId)[0];
  forms[membershipId].puntoVentaId = firstPoint ? String(firstPoint.id) : '';
}

function pointsFor(membershipId: number) {
  const sucursalId = Number(forms[membershipId]?.sucursalId || 0);
  return fiscalScope.value?.sucursales.find((item) => item.id === sucursalId)?.puntos_venta ?? [];
}

async function save(membership: PlatformTenantUserMembership): Promise<void> {
  const form = forms[membership.id];
  if (!form?.sucursalId || !form.puntoVentaId) return;
  savingId.value = membership.id;
  error.value = '';
  notice.value = '';
  try {
    await client.value.updateMembershipFiscalAssignments(membership.id, [{
      sucursal_id: Number(form.sucursalId),
      punto_venta_id: Number(form.puntoVentaId),
      is_default: true,
    }]);
    notice.value = `Caja asignada a ${membership.user.name || membership.user.email || 'el cajero'}.`;
    await load();
  } catch (caught) {
    error.value = errorMessage(caught, 'No se pudo guardar la asignación fiscal.');
  } finally {
    savingId.value = null;
  }
}

function defaultAssignment(membership: PlatformTenantUserMembership): PlatformFiscalAssignment | null {
  return membership.fiscal_assignments.find((assignment) => assignment.is_default)
    ?? membership.fiscal_assignments[0]
    ?? null;
}

function assignmentLabel(membership: PlatformTenantUserMembership): string {
  const assignment = defaultAssignment(membership);
  if (!assignment) return 'Sin caja asignada';
  const sucursal = fiscalScope.value?.sucursales.find((item) => item.id === assignment.core_sucursal_id);
  const point = sucursal?.puntos_venta.find((item) => item.id === assignment.core_punto_venta_id);
  return sucursal && point ? `${sucursal.codigo} · ${point.codigo}` : 'Caja asignada';
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
</script>

<template>
  <div class="mt-6 space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-lg font-bold text-text">Asignación de caja</h2>
        <p class="mt-1 text-sm text-muted">Cada cajero trabaja con una sucursal y un punto de venta predeterminados.</p>
      </div>
      <UiRefreshButton :loading="loading" @click="load" />
    </div>

    <p v-if="error" class="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>
    <p v-if="notice" class="rounded-xl border border-success bg-success-soft px-4 py-3 text-sm text-success">{{ notice }}</p>

    <UiPanel v-if="loading && cashiers.length === 0" variant="muted">Cargando cajeros…</UiPanel>
    <UiPanel v-else-if="cashiers.length === 0" variant="muted">
      <p class="font-bold text-text">No hay cajeros activos</p>
      <p class="mt-1 text-sm text-muted">Crea o cambia un miembro al rol Cajero para poder asignarle una caja.</p>
    </UiPanel>

    <div v-else class="space-y-3">
      <UiPanel v-for="membership in cashiers" :key="membership.id" variant="raised">
        <div class="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] lg:items-end">
          <div>
            <p class="font-bold text-text">{{ membership.user.name || 'Cajero' }}</p>
            <p class="mt-1 text-xs text-muted">{{ membership.user.email }}</p>
            <UiStatusBadge class="mt-2" :tone="defaultAssignment(membership) ? 'success' : 'warning'">{{ assignmentLabel(membership) }}</UiStatusBadge>
          </div>
          <label class="text-sm font-semibold text-muted">
            Sucursal
            <select v-model="forms[membership.id].sucursalId" class="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-text" @change="changeSucursal(membership.id)">
              <option value="" disabled>Selecciona una sucursal</option>
              <option v-for="sucursal in fiscalScope?.sucursales || []" :key="sucursal.id" :value="String(sucursal.id)">{{ sucursal.codigo }} · {{ sucursal.nombre }}</option>
            </select>
          </label>
          <label class="text-sm font-semibold text-muted">
            Punto de venta
            <select v-model="forms[membership.id].puntoVentaId" class="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-text">
              <option value="" disabled>Selecciona un punto de venta</option>
              <option v-for="point in pointsFor(membership.id)" :key="point.id" :value="String(point.id)">{{ point.codigo }} · {{ point.nombre }}</option>
            </select>
          </label>
          <UiButton :disabled="savingId !== null || !forms[membership.id]?.puntoVentaId" @click="save(membership)">
            {{ savingId === membership.id ? 'Guardando…' : 'Guardar caja' }}
          </UiButton>
        </div>
      </UiPanel>
    </div>
  </div>
</template>
