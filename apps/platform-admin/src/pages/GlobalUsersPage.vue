<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { PlatformGlobalUser, PlatformTenantMembership } from '@stelfaro/api-client';
import { UiDataTable, UiPanel, UiRefreshButton, UiStatusBadge } from '@stelfaro/ui';
import { usePlatformSessionStore } from '../stores/platformSession';

const platform = usePlatformSessionStore();
const users = ref<PlatformGlobalUser[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const totalMemberships = computed(() => users.value.reduce((total, user) => total + user.memberships.length, 0));
const activeMemberships = computed(() => users.value.flatMap((user) => user.memberships).filter((membership) => membership.status === 'active').length);
const tenantCount = computed(() => new Set(users.value.flatMap((user) => user.memberships.map((membership) => membership.tenant_id))).size);

onMounted(() => {
  void loadUsers();
});

async function loadUsers(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const response = await platform.client.globalUsers();
    users.value = response.users;
  } catch (loadError) {
    users.value = [];
    error.value = loadError instanceof Error ? loadError.message : 'No fue posible cargar usuarios.';
  } finally {
    loading.value = false;
  }
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: 'Owner',
    company_admin: 'Admin empresa',
    billing_admin: 'Admin facturacion',
    billing_user: 'Cajero',
    viewer: 'Contador/Lectura',
    platform_owner: 'Owner plataforma',
    platform_admin: 'Admin plataforma'
  };

  return labels[role] ?? role;
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'warning';
  if (status === 'removed') return 'danger';

  return 'neutral';
}

function membershipSummary(memberships: PlatformTenantMembership[]): string {
  if (memberships.length === 0) return 'Sin empresas';
  if (memberships.length === 1) return memberships[0]?.tenant_name ?? 'Empresa sin nombre';

  return `${memberships.length} empresas`;
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Usuarios</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950 dark:text-text">Usuarios globales</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600 dark:text-muted">
          Vista global de usuarios SaaS, empresas asociadas y membresias activas.
        </p>
      </div>

      <UiRefreshButton class="h-10" :loading="loading" @click="loadUsers" />
    </div>

    <div class="mb-6 grid gap-4 md:grid-cols-3">
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Usuarios</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ users.length }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Membresias activas</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ activeMemberships }}</p>
      </UiPanel>
      <UiPanel variant="raised">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Empresas vinculadas</p>
        <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-text">{{ tenantCount }}</p>
      </UiPanel>
    </div>

    <p v-if="error" class="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-danger-soft dark:text-danger">{{ error }}</p>

    <UiPanel variant="raised">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-950 dark:text-text">Directorio</h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-muted">{{ totalMemberships }} membresias registradas.</p>
        </div>
      </div>

      <UiDataTable>
        <thead class="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-surface-muted dark:text-soft">
          <tr>
            <th class="px-4 py-3">Usuario</th>
            <th class="px-4 py-3">Empresas</th>
            <th class="px-4 py-3">Roles</th>
            <th class="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-line">
          <tr v-if="loading">
            <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="4">Cargando usuarios...</td>
          </tr>
          <tr v-else-if="users.length === 0">
            <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="4">No hay usuarios para mostrar.</td>
          </tr>
          <tr v-for="user in users" v-else :key="user.id" class="hover:bg-slate-50 dark:hover:bg-surface-muted">
            <td class="px-4 py-4">
              <p class="font-bold text-slate-950 dark:text-text">{{ user.name }}</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-muted">{{ user.email }}</p>
            </td>
            <td class="px-4 py-4 text-sm text-slate-600 dark:text-muted">
              {{ membershipSummary(user.memberships) }}
            </td>
            <td class="px-4 py-4">
              <div class="flex flex-wrap gap-2">
                <UiStatusBadge v-for="membership in user.memberships" :key="membership.id" tone="info">
                  {{ roleLabel(membership.role) }}
                </UiStatusBadge>
                <UiStatusBadge v-if="user.memberships.length === 0" tone="neutral">Sin rol</UiStatusBadge>
              </div>
            </td>
            <td class="px-4 py-4">
              <div class="flex flex-wrap gap-2">
                <UiStatusBadge v-for="membership in user.memberships" :key="`${membership.id}-status`" :tone="statusTone(membership.status)">
                  {{ membership.status }}
                </UiStatusBadge>
                <UiStatusBadge v-if="user.memberships.length === 0" tone="neutral">N/D</UiStatusBadge>
              </div>
            </td>
          </tr>
        </tbody>
      </UiDataTable>
    </UiPanel>
  </section>
</template>
