<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  type PlatformFiscalAssignment,
  type PlatformFiscalScopeResponse,
  type PlatformTenantLookup,
  type PlatformTenantUserMembership
} from '@stelfaro/api-client';
import { BillingFloatingToastStack, type BillingFloatingToast } from '@stelfaro/billing';
import {
  UiActionDropdown,
  UiActionMenuItem,
  UiButton,
  UiDataTable,
  UiEmailInput,
  UiInput,
  UiModalShell,
  UiPanel,
  UiRefreshButton,
  UiSelect,
  UiStatusBadge
} from '@stelfaro/ui';
import type { SelectedAdminCompany } from '../stores/adminWorkspace';
import { usePlatformSessionStore } from '../stores/platformSession';

const props = defineProps<{
  company: SelectedAdminCompany;
}>();

const platform = usePlatformSessionStore();
const tenant = ref<PlatformTenantLookup | null>(null);
const memberships = ref<PlatformTenantUserMembership[]>([]);
const fiscalScope = ref<PlatformFiscalScopeResponse | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const inviteOpen = ref(false);
const roleOpen = ref(false);
const fiscalOpen = ref(false);
const selectedMembership = ref<PlatformTenantUserMembership | null>(null);
const selectedFiscalMembership = ref<PlatformTenantUserMembership | null>(null);
const floatingToasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;
const toastTimers: ReturnType<typeof window.setTimeout>[] = [];

const inviteForm = reactive({
  name: '',
  email: '',
  role: 'billing_user'
});
const createdCredentials = ref<{ email: string; temporaryPassword: string | null } | null>(null);

const roleForm = reactive({
  role: 'billing_user'
});

const fiscalForm = reactive({
  sucursalId: '',
  puntoVentaId: ''
});

const roleOptions = [
  { value: 'company_admin', label: 'Admin empresa' },
  { value: 'billing_admin', label: 'Admin facturacion' },
  { value: 'billing_user', label: 'Cajero' },
  { value: 'viewer', label: 'Contador / lectura' }
];

const activeMembers = computed(() => memberships.value.filter((membership) => membership.status === 'active'));
const createdMembers = computed(() => memberships.value.filter((membership) => membership.role !== 'owner'));
const pendingActivationMembers = computed(() => createdMembers.value.filter((membership) => activationStatus(membership) === 'pending_password'));
const canSubmitInvite = computed(() => Boolean(inviteForm.name.trim() && inviteForm.email.trim() && inviteForm.role && tenant.value && !saving.value));
const canSubmitRole = computed(() => Boolean(selectedMembership.value && roleForm.role && !saving.value));
const sucursalOptions = computed(() => (fiscalScope.value?.sucursales ?? []).map((sucursal) => ({
  value: sucursal.id,
  label: `${sucursal.codigo} · ${sucursal.nombre}`
})));
const puntoVentaOptions = computed(() => {
  const sucursalId = Number(fiscalForm.sucursalId);
  const sucursal = fiscalScope.value?.sucursales.find((item) => item.id === sucursalId);

  return (sucursal?.puntos_venta ?? []).map((puntoVenta) => ({
    value: puntoVenta.id,
    label: `${puntoVenta.codigo} · ${puntoVenta.nombre}`
  }));
});
const canSubmitFiscalAssignment = computed(() => Boolean(
  selectedFiscalMembership.value
    && fiscalForm.sucursalId
    && fiscalForm.puntoVentaId
    && !saving.value
));

onMounted(() => {
  void load();
});

onBeforeUnmount(() => {
  toastTimers.forEach((timer) => window.clearTimeout(timer));
});

watch(() => props.company.id, () => {
  void load();
});

watch(() => fiscalForm.sucursalId, () => {
  const currentPoint = Number(fiscalForm.puntoVentaId);
  const availablePoints = puntoVentaOptions.value.map((option) => Number(option.value));

  if (!availablePoints.includes(currentPoint)) {
    fiscalForm.puntoVentaId = availablePoints[0] ? String(availablePoints[0]) : '';
  }
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  tenant.value = null;
  memberships.value = [];
  fiscalScope.value = null;

  try {
    const lookup = await platform.client.tenantByCoreEmpresa(props.company.id);
    tenant.value = lookup.tenant;

    if (!lookup.tenant) {
      return;
    }

    const response = await platform.client.tenantUsers(lookup.tenant.id);
    memberships.value = response.memberships;

    fiscalScope.value = await platform.client.tenantFiscalScope(lookup.tenant.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar usuarios de la empresa.';
  } finally {
    loading.value = false;
  }
}

function openInvite(): void {
  inviteForm.name = '';
  inviteForm.email = '';
  inviteForm.role = 'billing_user';
  createdCredentials.value = null;
  inviteOpen.value = true;
}

async function submitInvite(): Promise<void> {
  if (!tenant.value || !canSubmitInvite.value) {
    return;
  }

  saving.value = true;
  error.value = null;

  try {
    const response = await platform.client.createTenantUser(tenant.value.id, {
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role
    });
    createdCredentials.value = {
      email: response.user.email,
      temporaryPassword: response.temporary_password
    };
    await load();
    showFloatingToast({
      title: response.created ? 'Usuario creado' : 'Acceso activado',
      message: response.created
        ? `${response.user.email} debe cambiar su contrasena al primer inicio.`
        : `${response.user.email} ya puede acceder a esta empresa.`,
      variant: 'success'
    });
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, 'No fue posible crear el usuario.');
  } finally {
    saving.value = false;
  }
}

async function copyTemporaryPassword(): Promise<void> {
  if (!createdCredentials.value?.temporaryPassword) {
    return;
  }

  await navigator.clipboard?.writeText(createdCredentials.value.temporaryPassword);
  showFloatingToast({
    title: 'Contrasena copiada',
    message: 'Entrega esta contrasena temporal de forma segura.',
    variant: 'success'
  });
}

function openRoleModal(membership: PlatformTenantUserMembership): void {
  selectedMembership.value = membership;
  roleForm.role = membership.role;
  roleOpen.value = true;
}

function openFiscalModal(membership: PlatformTenantUserMembership): void {
  selectedFiscalMembership.value = membership;
  const defaultAssignment = defaultFiscalAssignment(membership);
  const fallbackSucursal = fiscalScope.value?.sucursales[0] ?? null;
  const fallbackPuntoVenta = fallbackSucursal?.puntos_venta[0] ?? null;

  fiscalForm.sucursalId = String(defaultAssignment?.core_sucursal_id ?? fallbackSucursal?.id ?? '');
  fiscalForm.puntoVentaId = String(defaultAssignment?.core_punto_venta_id ?? fallbackPuntoVenta?.id ?? '');
  fiscalOpen.value = true;
}

async function submitRole(): Promise<void> {
  if (!selectedMembership.value || !canSubmitRole.value) {
    return;
  }

  saving.value = true;
  error.value = null;

  try {
    await platform.client.updateMembershipRole(selectedMembership.value.id, roleForm.role);
    roleOpen.value = false;
    selectedMembership.value = null;
    await load();
    showFloatingToast({
      title: 'Rol actualizado',
      message: 'El acceso de la empresa quedo actualizado.',
      variant: 'success'
    });
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, 'No fue posible actualizar el rol.');
  } finally {
    saving.value = false;
  }
}

async function submitFiscalAssignment(): Promise<void> {
  if (!selectedFiscalMembership.value || !canSubmitFiscalAssignment.value) {
    return;
  }

  saving.value = true;
  error.value = null;

  try {
    await platform.client.updateMembershipFiscalAssignments(selectedFiscalMembership.value.id, [{
      sucursal_id: Number(fiscalForm.sucursalId),
      punto_venta_id: Number(fiscalForm.puntoVentaId),
      is_default: true
    }]);
    fiscalOpen.value = false;
    selectedFiscalMembership.value = null;
    await load();
    showFloatingToast({
      title: 'Caja fiscal asignada',
      message: 'El usuario ya tiene sucursal y punto de venta para facturar.',
      variant: 'success'
    });
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, 'No fue posible asignar la caja fiscal.');
  } finally {
    saving.value = false;
  }
}

async function suspendMembership(membership: PlatformTenantUserMembership): Promise<void> {
  await runMembershipAction(() => platform.client.suspendMembership(membership.id), 'Usuario suspendido.', 'No fue posible suspender el usuario.');
}

async function reactivateMembership(membership: PlatformTenantUserMembership): Promise<void> {
  await runMembershipAction(() => platform.client.reactivateMembership(membership.id), 'Usuario reactivado.', 'No fue posible reactivar el usuario.');
}

async function removeMembership(membership: PlatformTenantUserMembership): Promise<void> {
  if (!window.confirm('Confirma que deseas remover el acceso de esta empresa.')) {
    return;
  }

  await runMembershipAction(() => platform.client.removeMembership(membership.id), 'Acceso removido.', 'No fue posible remover el acceso.');
}

async function runMembershipAction(action: () => Promise<unknown>, successMessage: string, fallbackMessage: string): Promise<void> {
  saving.value = true;
  error.value = null;

  try {
    await action();
    await load();
    showFloatingToast({
      title: successMessage,
      variant: 'success'
    });
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, fallbackMessage);
  } finally {
    saving.value = false;
  }
}

function showFloatingToast(toast: Omit<BillingFloatingToast, 'id'>): void {
  const id = ++toastId;
  floatingToasts.value = [...floatingToasts.value, { id, ...toast }];
  const timer = window.setTimeout(() => {
    floatingToasts.value = floatingToasts.value.filter((item) => item.id !== id);
  }, toast.variant === 'success' || !toast.variant ? 4000 : 4300);
  toastTimers.push(timer);
}

async function errorMessageFromResponse(caught: unknown, fallback: string): Promise<string> {
  if (caught && typeof caught === 'object' && 'response' in caught) {
    const response = (caught as { response?: { json?: () => Promise<unknown> } }).response;
    const payload = await response?.json?.().catch(() => null);

    if (payload && typeof payload === 'object') {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }

      const errors = (payload as { errors?: Record<string, string[]> }).errors;
      const firstError = errors ? Object.values(errors).flat()[0] : null;
      if (firstError) {
        return firstError;
      }
    }
  }

  return caught instanceof Error ? caught.message : fallback;
}

function roleLabel(role: string): string {
  return ({
    owner: 'Owner',
    company_admin: 'Admin empresa',
    billing_admin: 'Admin facturacion',
    billing_user: 'Cajero',
    viewer: 'Contador'
  } as Record<string, string>)[role] ?? role;
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'active' || status === 'accepted') return 'success';
  if (status === 'pending' || status === 'pending_password') return 'warning';
  if (status === 'suspended' || status === 'expired' || status === 'removed') return 'danger';
  return 'neutral';
}

function statusLabel(status: string): string {
  return ({
    active: 'Activo',
    suspended: 'Suspendido',
    removed: 'Removido',
    pending: 'Pendiente',
    pending_password: 'Pendiente',
    accepted: 'Aceptada',
    expired: 'Expirada',
    revoked: 'Revocada'
  } as Record<string, string>)[status] ?? status;
}

function activationStatus(membership: PlatformTenantUserMembership): string {
  if (membership.status !== 'active') {
    return membership.status;
  }

  return membership.user.must_change_password ? 'pending_password' : 'active';
}

function activationDescription(membership: PlatformTenantUserMembership): string {
  if (membership.status === 'suspended') return 'Usuario suspendido';
  if (membership.status === 'removed') return 'Acceso removido';
  if (membership.user.must_change_password) return 'Debe cambiar su contrasena temporal';
  return membership.user.password_changed_at ? `Activo desde ${formatDate(membership.user.password_changed_at)}` : 'Contrasena personalizada';
}

function defaultFiscalAssignment(membership: PlatformTenantUserMembership): PlatformFiscalAssignment | null {
  return membership.fiscal_assignments?.find((assignment) => assignment.is_default)
    ?? membership.fiscal_assignments?.[0]
    ?? null;
}

function fiscalAssignmentLabel(membership: PlatformTenantUserMembership): string {
  const assignment = defaultFiscalAssignment(membership);

  if (!assignment) {
    return 'Sin caja fiscal';
  }

  const sucursal = fiscalScope.value?.sucursales.find((item) => item.id === assignment.core_sucursal_id);
  const puntoVenta = sucursal?.puntos_venta.find((item) => item.id === assignment.core_punto_venta_id);

  if (!sucursal || !puntoVenta) {
    return 'Caja asignada';
  }

  return `${sucursal.codigo} / ${puntoVenta.codigo}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'No registrado';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Usuarios</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950 dark:text-text">Usuarios de empresa</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-muted">
          Administra accesos directos de {{ company.tradeName }}.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UiRefreshButton :loading="loading" @click="load" />
        <UiButton :disabled="loading || !tenant" @click="openInvite">Crear usuario</UiButton>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Miembros activos</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ activeMembers.length }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Pendientes de activacion</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ pendingActivationMembers.length }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Tenant SaaS</p>
        <p class="mt-2 truncate text-lg font-bold text-slate-950 dark:text-text">{{ tenant?.slug ?? 'No vinculado' }}</p>
      </UiPanel>
    </div>

    <p v-if="error" class="rounded-md bg-rose-700 px-4 py-3 text-sm text-white">{{ error }}</p>
    <BillingFloatingToastStack :toasts="floatingToasts" />

    <UiPanel v-if="!loading && !tenant" variant="raised">
      <p class="text-lg font-bold text-slate-950 dark:text-text">Empresa sin tenant vinculado</p>
      <p class="mt-2 text-sm text-slate-600 dark:text-muted">
        Esta empresa fiscal aun no tiene un tenant SaaS asociado en platform-api.
      </p>
    </UiPanel>

    <div v-else class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <UiPanel variant="raised">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-950 dark:text-text">Miembros</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-muted">Usuarios con acceso directo a la empresa.</p>
          </div>
        </div>

        <UiDataTable class="mt-5" overflow="visible">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-surface-muted dark:text-soft">
            <tr>
              <th class="px-4 py-3">Usuario</th>
              <th class="px-4 py-3">Rol</th>
              <th class="px-4 py-3">Caja fiscal</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-line">
            <tr v-if="loading">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted">Cargando usuarios...</td>
            </tr>
            <tr v-else-if="memberships.length === 0">
              <td colspan="5" class="px-4 py-8 text-sm text-slate-600 dark:text-muted">No hay miembros registrados.</td>
            </tr>
            <tr v-for="membership in memberships" v-else :key="membership.id" class="hover:bg-slate-50 dark:hover:bg-surface-muted">
              <td class="px-4 py-4">
                <p class="font-bold text-slate-950 dark:text-text">{{ membership.user.name ?? 'Usuario pendiente' }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ membership.user.email ?? 'Sin correo' }}</p>
              </td>
              <td class="px-4 py-4 text-sm font-semibold text-slate-700 dark:text-muted">{{ roleLabel(membership.role) }}</td>
              <td class="px-4 py-4 text-sm font-semibold text-slate-700 dark:text-muted">{{ fiscalAssignmentLabel(membership) }}</td>
              <td class="px-4 py-4">
                <UiStatusBadge :tone="statusTone(activationStatus(membership))">{{ statusLabel(activationStatus(membership)) }}</UiStatusBadge>
              </td>
              <td class="px-4 py-4">
                <UiActionDropdown placement="top">
                  <UiActionMenuItem v-if="membership.status === 'active'" @select="openFiscalModal(membership)">Asignar caja fiscal</UiActionMenuItem>
                  <UiActionMenuItem v-if="membership.role !== 'owner'" @select="openRoleModal(membership)">Cambiar rol</UiActionMenuItem>
                  <UiActionMenuItem v-if="membership.status === 'active' && membership.role !== 'owner'" @select="suspendMembership(membership)">Suspender</UiActionMenuItem>
                  <UiActionMenuItem v-if="membership.status === 'suspended'" @select="reactivateMembership(membership)">Reactivar</UiActionMenuItem>
                  <UiActionMenuItem v-if="membership.role !== 'owner' && membership.status !== 'removed'" tone="danger" @select="removeMembership(membership)">Remover acceso</UiActionMenuItem>
                  <UiActionMenuItem v-if="membership.role === 'owner'" disabled>Owner protegido</UiActionMenuItem>
                </UiActionDropdown>
              </td>
            </tr>
          </tbody>
        </UiDataTable>
      </UiPanel>

      <UiPanel variant="raised">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-950 dark:text-text">Usuarios creados</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-muted">Activacion por cambio de contrasena.</p>
          </div>
        </div>

        <div v-if="createdMembers.length === 0" class="mt-6 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-line dark:text-muted">
          No hay usuarios creados para esta empresa.
        </div>

        <div v-else class="mt-5 space-y-3">
          <div
            v-for="membership in createdMembers"
            :key="membership.id"
            class="rounded-md border border-slate-200 p-4 dark:border-line dark:bg-surface"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-slate-950 dark:text-text">{{ membership.user.name ?? 'Usuario sin nombre' }}</p>
                <p class="mt-1 truncate text-xs text-slate-500 dark:text-muted">{{ membership.user.email ?? 'Sin correo' }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ roleLabel(membership.role) }} · {{ activationDescription(membership) }}</p>
                <p class="mt-1 text-xs font-semibold text-slate-600 dark:text-soft">{{ fiscalAssignmentLabel(membership) }}</p>
              </div>
              <UiStatusBadge :tone="statusTone(activationStatus(membership))">{{ statusLabel(activationStatus(membership)) }}</UiStatusBadge>
            </div>
          </div>
        </div>
      </UiPanel>
    </div>

    <UiModalShell
      :open="inviteOpen"
      title="Crear usuario"
      description="Se creara el acceso directo con contrasena temporal."
      @close="inviteOpen = false"
    >
      <div class="grid gap-4">
        <UiInput v-model="inviteForm.name" label="Nombre" placeholder="Nombre completo" />
        <UiEmailInput v-model="inviteForm.email" label="Correo" placeholder="usuario@empresa.com" />
        <UiSelect v-model="inviteForm.role" label="Rol" :options="roleOptions" />
        <UiPanel v-if="createdCredentials" variant="raised">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Credenciales temporales</p>
          <p class="mt-2 text-sm font-semibold text-slate-950 dark:text-text">{{ createdCredentials.email }}</p>
          <p v-if="createdCredentials.temporaryPassword" class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-950 dark:border-line dark:bg-surface-muted dark:text-text">
            {{ createdCredentials.temporaryPassword }}
          </p>
          <p v-else class="mt-3 text-sm text-slate-600 dark:text-muted">
            El usuario ya existia; no se genero una contrasena nueva.
          </p>
          <div v-if="createdCredentials.temporaryPassword" class="mt-3 flex justify-end">
            <UiButton size="sm" variant="secondary" @click="copyTemporaryPassword">Copiar contrasena</UiButton>
          </div>
        </UiPanel>
      </div>

      <template #footer>
        <UiButton variant="secondary" :disabled="saving" @click="inviteOpen = false">Cancelar</UiButton>
        <UiButton :disabled="!canSubmitInvite" @click="submitInvite">Crear usuario</UiButton>
      </template>
    </UiModalShell>

    <UiModalShell
      :open="roleOpen"
      title="Cambiar rol"
      :description="selectedMembership?.user.email ?? null"
      @close="roleOpen = false"
    >
      <UiSelect v-model="roleForm.role" label="Rol" :options="roleOptions" />

      <template #footer>
        <UiButton variant="secondary" :disabled="saving" @click="roleOpen = false">Cancelar</UiButton>
        <UiButton :disabled="!canSubmitRole" @click="submitRole">Guardar rol</UiButton>
      </template>
    </UiModalShell>

    <UiModalShell
      :open="fiscalOpen"
      title="Asignar caja fiscal"
      :description="selectedFiscalMembership?.user.email ?? null"
      @close="fiscalOpen = false"
    >
      <div class="grid gap-4">
        <UiPanel variant="raised">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Alcance de facturacion</p>
          <p class="mt-2 text-sm text-slate-600 dark:text-muted">
            Esta sucursal y punto de venta se enviaran a la sesion fiscal del usuario.
          </p>
        </UiPanel>
        <UiSelect
          v-model="fiscalForm.sucursalId"
          label="Sucursal"
          :options="sucursalOptions"
          placeholder="Selecciona una sucursal"
        />
        <UiSelect
          v-model="fiscalForm.puntoVentaId"
          label="Punto de venta"
          :options="puntoVentaOptions"
          placeholder="Selecciona un punto de venta"
          :disabled="!fiscalForm.sucursalId"
        />
      </div>

      <template #footer>
        <UiButton variant="secondary" :disabled="saving" @click="fiscalOpen = false">Cancelar</UiButton>
        <UiButton :disabled="!canSubmitFiscalAssignment" @click="submitFiscalAssignment">Guardar caja</UiButton>
      </template>
    </UiModalShell>
  </section>
</template>
