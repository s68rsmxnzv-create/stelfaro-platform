<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { NotificationActivity, NotificationSenderAlias, NotificationSenderAliasPayload } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiEmailInput, UiInput, UiModalShell, UiPanel, UiRefreshButton, UiSaveIcon, UiSelect, UiStatusBadge, UiToggle } from '@stelfaro/ui';
import { useAdminSessionStore } from '../stores/adminSession';

const ADD_PURPOSE_VALUE = '__add_purpose__';

const fallbackPurposes = [
  { value: 'platform_invitation', label: 'Invitaciones' },
  { value: 'dte_delivery', label: 'Entrega de DTE' },
  { value: 'registration', label: 'Registro' },
  { value: 'password_reset', label: 'Recuperacion de acceso' },
  { value: 'system_alert', label: 'Alertas del sistema' }
];

const session = useAdminSessionStore();
const aliases = ref<NotificationSenderAlias[]>([]);
const activities = ref<NotificationActivity[]>([]);
const loading = ref(false);
const saving = ref(false);
const creatingPurpose = ref(false);
const purposeModalOpen = ref(false);
const error = ref<string | null>(null);
const purposeError = ref<string | null>(null);
const selectedId = ref<number | null>(null);
const filterPurpose = ref('');

const form = reactive({
  purpose: 'platform_invitation',
  from_email: '',
  from_name: '',
  reply_to_email: '',
  reply_to_name: '',
  is_active: true
});

const purposeForm = reactive({
  name: '',
  purpose: '',
  description: ''
});

const selectedAlias = computed(() => aliases.value.find((alias) => alias.id === selectedId.value) ?? null);
const purposes = computed(() => {
  const items = new Map<string, string>();

  fallbackPurposes.forEach((purpose) => items.set(purpose.value, purpose.label));
  activities.value.forEach((activity) => {
    activity.actions.forEach((action) => items.set(action.purpose, action.name || activity.name || action.purpose));
  });
  aliases.value.forEach((alias) => items.set(alias.purpose, items.get(alias.purpose) ?? alias.purpose));

  return Array.from(items.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
});
const filterPurposeOptions = computed(() => [{ value: '', label: 'Todos' }, ...purposes.value]);
const formPurposeOptions = computed(() => [
  { value: ADD_PURPOSE_VALUE, label: '+ Agregar nuevo proposito' },
  ...purposes.value
]);
const filteredAliases = computed(() => aliases.value.filter((alias) => {
  if (filterPurpose.value && alias.purpose !== filterPurpose.value) return false;

  return true;
}));

onMounted(() => {
  void loadData();
});

async function loadData(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [aliasResponse, activityResponse] = await Promise.all([
      session.client.senderAliases(),
      session.client.activities()
    ]);
    aliases.value = aliasResponse.data;
    activities.value = activityResponse.data;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'No fue posible cargar alias.';
  } finally {
    loading.value = false;
  }
}

async function saveAlias(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const payload = buildPayload();

    if (selectedId.value) {
      await session.client.updateSenderAlias(selectedId.value, payload);
    } else {
      await session.client.saveSenderAlias(payload);
    }

    resetForm();
    await loadData();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'No fue posible guardar alias.';
  } finally {
    saving.value = false;
  }
}

async function createPurpose(): Promise<void> {
  creatingPurpose.value = true;
  purposeError.value = null;
  try {
    const purpose = normalizePurpose(purposeForm.purpose || purposeForm.name);
    const name = purposeForm.name.trim();

    const activity = await session.client.saveActivity({
      key: purpose,
      name,
      description: purposeForm.description || null
    });

    await session.client.saveAction(activity.data.id, {
      key: purpose,
      name,
      purpose
    });

    form.purpose = purpose;
    filterPurpose.value = purpose;
    closePurposeModal();
    await loadData();
  } catch (createError) {
    purposeError.value = createError instanceof Error ? createError.message : 'No fue posible crear el proposito.';
  } finally {
    creatingPurpose.value = false;
  }
}

async function toggleAlias(alias: NotificationSenderAlias): Promise<void> {
  error.value = null;
  try {
    await session.client.updateSenderAlias(alias.id, { is_active: !alias.is_active });
    await loadData();
  } catch (toggleError) {
    error.value = toggleError instanceof Error ? toggleError.message : 'No fue posible actualizar estado.';
  }
}

function updateFormPurpose(value: string): void {
  if (value === ADD_PURPOSE_VALUE) {
    openPurposeModal();
    return;
  }

  form.purpose = value;
}

function openPurposeModal(): void {
  purposeForm.name = '';
  purposeForm.purpose = '';
  purposeForm.description = '';
  purposeError.value = null;
  purposeModalOpen.value = true;
}

function closePurposeModal(): void {
  purposeModalOpen.value = false;
  purposeError.value = null;
}

function editAlias(alias: NotificationSenderAlias): void {
  selectedId.value = alias.id;
  form.purpose = alias.purpose;
  form.from_email = alias.from_email;
  form.from_name = alias.from_name ?? '';
  form.reply_to_email = alias.reply_to_email ?? '';
  form.reply_to_name = alias.reply_to_name ?? '';
  form.is_active = alias.is_active;
}

function resetForm(): void {
  selectedId.value = null;
  form.purpose = purposes.value[0]?.value ?? 'platform_invitation';
  form.from_email = '';
  form.from_name = '';
  form.reply_to_email = '';
  form.reply_to_name = '';
  form.is_active = true;
}

function buildPayload(): NotificationSenderAliasPayload {
  return {
    scope_type: 'global',
    scope_id: 0,
    purpose: form.purpose,
    from_email: form.from_email,
    from_name: form.from_name || null,
    reply_to_email: form.reply_to_email || null,
    reply_to_name: form.reply_to_name || null,
    is_active: form.is_active
  };
}

function purposeLabel(value: string): string {
  return purposes.value.find((purpose) => purpose.value === value)?.label ?? value;
}

function normalizePurpose(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-soft">Notificaciones</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-950 dark:text-text">Alias de remitente</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600 dark:text-muted">
          Configura el remitente que usara cada proposito de correo.
        </p>
      </div>

      <UiRefreshButton class="h-10" :loading="loading" @click="loadData" />
    </div>

    <UiPanel v-if="!session.isConnected" variant="raised">
      <p class="text-sm font-medium text-amber-800 dark:text-warning">No fue posible conectar con el servicio de notificaciones.</p>
    </UiPanel>

    <div v-else class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div class="min-w-0 space-y-4">
        <UiPanel variant="raised">
          <UiSelect v-model="filterPurpose" label="Proposito" :options="filterPurposeOptions" />
        </UiPanel>

        <p v-if="error" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-danger-soft dark:text-danger">{{ error }}</p>

        <UiPanel variant="raised">
          <UiDataTable>
            <thead class="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-surface-muted dark:text-soft">
              <tr>
                <th class="px-4 py-3">Proposito</th>
                <th class="px-4 py-3">Alias</th>
                <th class="px-4 py-3">Reply-to</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-line">
              <tr v-if="loading">
                <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="5">Cargando alias...</td>
              </tr>
              <tr v-else-if="filteredAliases.length === 0">
                <td class="px-4 py-6 text-slate-500 dark:text-muted" colspan="5">No hay alias configurados.</td>
              </tr>
              <tr v-for="alias in filteredAliases" v-else :key="alias.id" class="hover:bg-slate-50 dark:hover:bg-surface-muted">
                <td class="px-4 py-3 font-medium text-slate-950 dark:text-text">{{ purposeLabel(alias.purpose) }}</td>
                <td class="px-4 py-3">
                  <p class="font-medium text-slate-950 dark:text-text">{{ alias.from_email }}</p>
                  <p class="text-xs text-slate-500 dark:text-soft">{{ alias.from_name || 'Sin nombre visible' }}</p>
                </td>
                <td class="px-4 py-3 text-sm text-slate-600 dark:text-muted">{{ alias.reply_to_email || '-' }}</td>
                <td class="px-4 py-3">
                  <UiStatusBadge :tone="alias.is_active ? 'success' : 'neutral'">{{ alias.is_active ? 'Activo' : 'Inactivo' }}</UiStatusBadge>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <UiButton type="button" variant="ghost" size="sm" @click="editAlias(alias)">Editar</UiButton>
                    <UiButton type="button" variant="ghost" size="sm" @click="toggleAlias(alias)">
                      {{ alias.is_active ? 'Desactivar' : 'Activar' }}
                    </UiButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </UiDataTable>
        </UiPanel>
      </div>

      <UiPanel variant="raised">
        <form @submit.prevent="saveAlias">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-950 dark:text-text">{{ selectedAlias ? 'Editar alias' : 'Nuevo alias' }}</h2>
              <p class="mt-1 text-sm text-slate-600 dark:text-muted">Define el remitente de un proposito.</p>
            </div>
            <UiButton v-if="selectedAlias" type="button" variant="ghost" size="sm" @click="resetForm">Nuevo</UiButton>
          </div>

          <div class="space-y-4">
            <UiSelect :model-value="form.purpose" label="Proposito" :options="formPurposeOptions" @update:model-value="updateFormPurpose" />
            <UiEmailInput v-model="form.from_email" label="Correo remitente" placeholder="invitaciones@stelfaro.com" required />
            <UiInput v-model="form.from_name" label="Nombre visible" placeholder="StelFaro Invitaciones" />
            <UiEmailInput v-model="form.reply_to_email" label="Correo reply-to" placeholder="soporte@stelfaro.com" />
            <UiInput v-model="form.reply_to_name" label="Nombre reply-to" placeholder="Soporte StelFaro" />
            <div class="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-line">
              <span class="text-sm font-medium text-slate-700 dark:text-muted">Activo</span>
              <UiToggle v-model="form.is_active" />
            </div>
          </div>

          <UiButton type="submit" variant="success" class="mt-5 w-full" :disabled="saving || !session.isConnected || !form.from_email">
            <UiSaveIcon v-if="!saving" class="mr-2 h-5 w-5" />
            <span>{{ saving ? 'Guardando...' : selectedAlias ? 'Guardar cambios' : 'Crear alias' }}</span>
          </UiButton>
        </form>
      </UiPanel>
    </div>

    <UiModalShell
      :open="purposeModalOpen"
      title="Agregar nuevo proposito"
      description="Se creara la actividad y la accion necesarias para configurar su alias."
      max-width="max-w-lg"
      @close="closePurposeModal"
    >
      <form class="space-y-4" @submit.prevent="createPurpose">
        <p v-if="purposeError" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-danger-soft dark:text-danger">{{ purposeError }}</p>
        <UiInput v-model="purposeForm.name" label="Nombre" placeholder="Recordatorio de invitacion" required />
        <UiInput v-model="purposeForm.purpose" label="Clave tecnica" placeholder="invitation_reminder" />
        <UiInput v-model="purposeForm.description" label="Descripcion" placeholder="Correos de recordatorio para invitaciones pendientes" />
      </form>

      <template #footer>
        <UiButton type="button" variant="secondary" @click="closePurposeModal">Cancelar</UiButton>
        <UiButton
          type="button"
          variant="success"
          :disabled="creatingPurpose || !purposeForm.name || !normalizePurpose(purposeForm.purpose || purposeForm.name)"
          @click="createPurpose"
        >
          <UiSaveIcon v-if="!creatingPurpose" class="mr-2 h-5 w-5" />
          <span>{{ creatingPurpose ? 'Creando...' : 'Crear proposito' }}</span>
        </UiButton>
      </template>
    </UiModalShell>
  </section>
</template>
