<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  type PlatformTenantLookup,
  type PlatformTenantUserMembership,
  type PlatformUserInvitation
} from '@stelfaro/api-client';
import { BillingFloatingToastStack, type BillingFloatingToast } from '@stelfaro/billing';
import {
  UiActionDropdown,
  UiActionMenuItem,
  UiButton,
  UiDataTable,
  UiEmailInput,
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
const invitations = ref<PlatformUserInvitation[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const inviteOpen = ref(false);
const roleOpen = ref(false);
const selectedMembership = ref<PlatformTenantUserMembership | null>(null);
const floatingToasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;
let unmounted = false;
const toastTimers: ReturnType<typeof window.setTimeout>[] = [];
const deliveryPollTimers: ReturnType<typeof window.setTimeout>[] = [];

const inviteForm = reactive({
  email: '',
  role: 'billing_user'
});

const roleForm = reactive({
  role: 'billing_user'
});

const roleOptions = [
  { value: 'company_admin', label: 'Admin empresa' },
  { value: 'billing_admin', label: 'Admin facturacion' },
  { value: 'billing_user', label: 'Cajero' },
  { value: 'viewer', label: 'Contador / lectura' }
];

const activeMembers = computed(() => memberships.value.filter((membership) => membership.status === 'active'));
const pendingInvitations = computed(() => invitations.value.filter((invitation) => invitation.status === 'pending'));
const canSubmitInvite = computed(() => Boolean(inviteForm.email.trim() && inviteForm.role && tenant.value && !saving.value));
const canSubmitRole = computed(() => Boolean(selectedMembership.value && roleForm.role && !saving.value));

onMounted(() => {
  unmounted = false;
  void load();
});

onBeforeUnmount(() => {
  unmounted = true;
  toastTimers.forEach((timer) => window.clearTimeout(timer));
  deliveryPollTimers.forEach((timer) => window.clearTimeout(timer));
});

watch(() => props.company.id, () => {
  void load();
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  tenant.value = null;
  memberships.value = [];
  invitations.value = [];

  try {
    const lookup = await platform.client.tenantByCoreEmpresa(props.company.id);
    tenant.value = lookup.tenant;

    if (!lookup.tenant) {
      return;
    }

    const response = await platform.client.tenantUsers(lookup.tenant.id);
    memberships.value = response.memberships;
    invitations.value = response.invitations;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar usuarios de la empresa.';
  } finally {
    loading.value = false;
  }
}

function openInvite(): void {
  inviteForm.email = '';
  inviteForm.role = 'billing_user';
  inviteOpen.value = true;
}

async function submitInvite(): Promise<void> {
  if (!tenant.value || !canSubmitInvite.value) {
    return;
  }

  saving.value = true;
  error.value = null;

  try {
    const response = await platform.client.inviteTenantUser(tenant.value.id, {
      email: inviteForm.email,
      role: inviteForm.role
    });
    const recipientEmail = response.invitation.email;
    inviteOpen.value = false;
    await load();
    showFloatingToast({
      title: 'Invitacion creada',
      message: `Correo en cola para ${recipientEmail}.`,
      variant: 'info'
    });
    void waitForInvitationEmailSent(response.invitation.id, recipientEmail);
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, 'No fue posible enviar la invitacion.');
  } finally {
    saving.value = false;
  }
}

function openRoleModal(membership: PlatformTenantUserMembership): void {
  selectedMembership.value = membership;
  roleForm.role = membership.role;
  roleOpen.value = true;
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

async function resendInvitation(invitation: PlatformUserInvitation): Promise<void> {
  saving.value = true;
  error.value = null;

  try {
    const response = await platform.client.resendInvitation(invitation.id);
    await load();
    showFloatingToast({
      title: 'Reenvio en cola',
      message: `Correo en cola para ${response.invitation.email}.`,
      variant: 'info'
    });
    void waitForInvitationEmailSent(response.invitation.id, response.invitation.email);
  } catch (caught) {
    error.value = await errorMessageFromResponse(caught, 'No fue posible reenviar la invitacion.');
  } finally {
    saving.value = false;
  }
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

async function waitForInvitationEmailSent(invitationId: number, fallbackRecipient?: string | null): Promise<void> {
  let lastStatus = '';
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 14 && !unmounted; attempt += 1) {
    if (attempt > 0) {
      await waitForDeliveryPoll(1500);
    }

    const response = await platform.client.invitationDelivery(invitationId);
    const status = String(response.notification?.status ?? '').toLowerCase();
    lastStatus = status;
    lastError = response.notification?.last_error ?? null;

    if (['sent', 'delivered'].includes(status)) {
      const recipient = response.notification?.recipient_email ?? fallbackRecipient;
      const recipientLabel = recipient ? ` a ${recipient}` : '';
      showFloatingToast({
        title: 'Correo enviado',
        message: `La invitacion fue enviada${recipientLabel}.`,
        variant: 'success'
      });
      return;
    }

    if (status === 'failed') {
      showFloatingToast({
        title: 'Correo no enviado',
        message: response.notification?.last_error ?? 'Notifications no pudo entregar la invitacion.',
        variant: 'error'
      });
      return;
    }
  }

  if (!unmounted && ['pending', 'queued', 'processing', 'retrying'].includes(lastStatus)) {
    const recipientLabel = fallbackRecipient ? ` para ${fallbackRecipient}` : '';
    showFloatingToast({
      title: 'Correo pendiente',
      message: lastError
        ? 'Notifications sigue reintentando la entrega. Revisa la configuracion SMTP si no llega.'
        : `El correo sigue en cola${recipientLabel}.`,
      variant: 'warning'
    });
  }
}

function waitForDeliveryPoll(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, milliseconds);
    deliveryPollTimers.push(timer);
  });
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
  if (status === 'pending') return 'warning';
  if (status === 'suspended' || status === 'expired') return 'danger';
  return 'neutral';
}

function statusLabel(status: string): string {
  return ({
    active: 'Activo',
    suspended: 'Suspendido',
    removed: 'Removido',
    pending: 'Pendiente',
    accepted: 'Aceptada',
    expired: 'Expirada',
    revoked: 'Revocada'
  } as Record<string, string>)[status] ?? status;
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
          Administra accesos e invitaciones de {{ company.tradeName }}.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UiRefreshButton :loading="loading" @click="load" />
        <UiButton :disabled="loading || !tenant" @click="openInvite">Invitar usuario</UiButton>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Miembros activos</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ activeMembers.length }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Invitaciones pendientes</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ pendingInvitations.length }}</p>
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
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-line">
            <tr v-if="loading">
              <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted">Cargando usuarios...</td>
            </tr>
            <tr v-else-if="memberships.length === 0">
              <td colspan="4" class="px-4 py-8 text-sm text-slate-600 dark:text-muted">No hay miembros registrados.</td>
            </tr>
            <tr v-for="membership in memberships" v-else :key="membership.id" class="hover:bg-slate-50 dark:hover:bg-surface-muted">
              <td class="px-4 py-4">
                <p class="font-bold text-slate-950 dark:text-text">{{ membership.user.name ?? 'Usuario pendiente' }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ membership.user.email ?? 'Sin correo' }}</p>
              </td>
              <td class="px-4 py-4 text-sm font-semibold text-slate-700 dark:text-muted">{{ roleLabel(membership.role) }}</td>
              <td class="px-4 py-4">
                <UiStatusBadge :tone="statusTone(membership.status)">{{ statusLabel(membership.status) }}</UiStatusBadge>
              </td>
              <td class="px-4 py-4">
                <UiActionDropdown placement="top">
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
            <h2 class="text-xl font-bold text-slate-950 dark:text-text">Invitaciones</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-muted">Correos enviados y accesos pendientes.</p>
          </div>
        </div>

        <div v-if="invitations.length === 0" class="mt-6 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-line dark:text-muted">
          No hay invitaciones registradas.
        </div>

        <div v-else class="mt-5 space-y-3">
          <div
            v-for="invitation in invitations"
            :key="invitation.id"
            class="rounded-md border border-slate-200 p-4 dark:border-line dark:bg-surface"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-slate-950 dark:text-text">{{ invitation.email }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-muted">{{ roleLabel(invitation.role) }} · vence {{ formatDate(invitation.expires_at) }}</p>
              </div>
              <UiStatusBadge :tone="statusTone(invitation.status)">{{ statusLabel(invitation.status) }}</UiStatusBadge>
            </div>
            <div v-if="invitation.status === 'pending'" class="mt-3 flex justify-end">
              <UiButton size="sm" variant="secondary" :disabled="saving" @click="resendInvitation(invitation)">Reenviar</UiButton>
            </div>
          </div>
        </div>
      </UiPanel>
    </div>

    <UiModalShell
      :open="inviteOpen"
      title="Invitar usuario"
      description="El correo se enviara con el alias configurado para invitaciones."
      @close="inviteOpen = false"
    >
      <div class="grid gap-4">
        <UiEmailInput v-model="inviteForm.email" label="Correo" placeholder="usuario@empresa.com" />
        <UiSelect v-model="inviteForm.role" label="Rol" :options="roleOptions" />
      </div>

      <template #footer>
        <UiButton variant="secondary" :disabled="saving" @click="inviteOpen = false">Cancelar</UiButton>
        <UiButton :disabled="!canSubmitInvite" @click="submitInvite">Enviar invitacion</UiButton>
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
  </section>
</template>
