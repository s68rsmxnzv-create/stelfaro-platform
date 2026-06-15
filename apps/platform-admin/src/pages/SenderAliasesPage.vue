<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { NotificationSenderAlias, NotificationSenderAliasPayload } from '@stelfaro/api-client';
import { useAdminSessionStore } from '../stores/adminSession';

const purposes = [
  { value: 'dte_delivery', label: 'Entrega de DTE' },
  { value: 'registration', label: 'Registro' },
  { value: 'password_reset', label: 'Recuperacion de acceso' },
  { value: 'system_alert', label: 'Alertas del sistema' }
];

const session = useAdminSessionStore();
const aliases = ref<NotificationSenderAlias[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const selectedId = ref<number | null>(null);
const filterPurpose = ref('');
const filterScope = ref('');

const form = reactive({
  scope_type: 'global' as 'global' | 'empresa',
  scope_id: '',
  purpose: 'dte_delivery',
  from_email: '',
  from_name: '',
  reply_to_email: '',
  reply_to_name: '',
  is_active: true
});

const selectedAlias = computed(() => aliases.value.find((alias) => alias.id === selectedId.value) ?? null);
const filteredAliases = computed(() => aliases.value.filter((alias) => {
  if (filterPurpose.value && alias.purpose !== filterPurpose.value) return false;
  if (filterScope.value && alias.scope_type !== filterScope.value) return false;

  return true;
}));

onMounted(() => {
  void loadAliases();
});

async function loadAliases(): Promise<void> {
  if (!session.token) return;

  loading.value = true;
  error.value = null;
  try {
    const response = await session.client.senderAliases();
    aliases.value = response.data;
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
    await loadAliases();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'No fue posible guardar alias.';
  } finally {
    saving.value = false;
  }
}

async function toggleAlias(alias: NotificationSenderAlias): Promise<void> {
  error.value = null;
  try {
    await session.client.updateSenderAlias(alias.id, { is_active: !alias.is_active });
    await loadAliases();
  } catch (toggleError) {
    error.value = toggleError instanceof Error ? toggleError.message : 'No fue posible actualizar estado.';
  }
}

function editAlias(alias: NotificationSenderAlias): void {
  selectedId.value = alias.id;
  form.scope_type = alias.scope_type;
  form.scope_id = alias.scope_type === 'empresa' ? String(alias.scope_id) : '';
  form.purpose = alias.purpose;
  form.from_email = alias.from_email;
  form.from_name = alias.from_name ?? '';
  form.reply_to_email = alias.reply_to_email ?? '';
  form.reply_to_name = alias.reply_to_name ?? '';
  form.is_active = alias.is_active;
}

function resetForm(): void {
  selectedId.value = null;
  form.scope_type = 'global';
  form.scope_id = '';
  form.purpose = 'dte_delivery';
  form.from_email = '';
  form.from_name = '';
  form.reply_to_email = '';
  form.reply_to_name = '';
  form.is_active = true;
}

function buildPayload(): NotificationSenderAliasPayload {
  return {
    scope_type: form.scope_type,
    scope_id: form.scope_type === 'empresa' ? Number(form.scope_id) : null,
    purpose: form.purpose,
    from_email: form.from_email,
    from_name: form.from_name || null,
    reply_to_email: form.reply_to_email || null,
    reply_to_name: form.reply_to_name || null,
    is_active: form.is_active
  };
}

function purposeLabel(value: string): string {
  return purposes.find((purpose) => purpose.value === value)?.label ?? value;
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Notificaciones</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-950">Alias de remitente</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600">
          Remitentes por actividad para mensajes transversales de Stelfaro. Estos valores son internos de plataforma y no forman parte de la configuracion fiscal del tenant.
        </p>
      </div>

      <button
        type="button"
        class="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-white"
        @click="loadAliases"
      >
        Actualizar
      </button>
    </div>

    <div v-if="!session.token" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Conecta el servicio de notificaciones para administrar alias.
    </div>

    <div v-else class="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div class="min-w-0">
        <div class="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row">
          <label class="block flex-1">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad</span>
            <select v-model="filterPurpose" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
              <option value="">Todas</option>
              <option v-for="purpose in purposes" :key="purpose.value" :value="purpose.value">
                {{ purpose.label }}
              </option>
            </select>
          </label>

          <label class="block flex-1">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Alcance</span>
            <select v-model="filterScope" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
              <option value="">Todos</option>
              <option value="global">Global</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
        </div>

        <p v-if="error" class="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</p>

        <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">Actividad</th>
                <th class="px-4 py-3">Alcance</th>
                <th class="px-4 py-3">Remitente</th>
                <th class="px-4 py-3">Reply-to</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="loading">
                <td class="px-4 py-6 text-slate-500" colspan="6">Cargando alias...</td>
              </tr>

              <tr v-else-if="filteredAliases.length === 0">
                <td class="px-4 py-6 text-slate-500" colspan="6">No hay alias configurados.</td>
              </tr>

              <tr v-for="alias in filteredAliases" v-else :key="alias.id" class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-950">{{ purposeLabel(alias.purpose) }}</td>
                <td class="px-4 py-3 text-slate-700">
                  {{ alias.scope_type === 'global' ? 'Global' : `Empresa #${alias.scope_id}` }}
                </td>
                <td class="px-4 py-3">
                  <p class="font-medium text-slate-950">{{ alias.from_email }}</p>
                  <p class="text-xs text-slate-500">{{ alias.from_name || 'Sin nombre visible' }}</p>
                </td>
                <td class="px-4 py-3 text-slate-700">
                  <span v-if="alias.reply_to_email">{{ alias.reply_to_email }}</span>
                  <span v-else class="text-slate-400">No definido</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                    :class="alias.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                  >
                    {{ alias.is_active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="mr-2 text-sm font-medium text-slate-700 hover:text-slate-950" @click="editAlias(alias)">
                    Editar
                  </button>
                  <button type="button" class="text-sm font-medium text-slate-700 hover:text-slate-950" @click="toggleAlias(alias)">
                    {{ alias.is_active ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <form class="rounded-lg border border-slate-200 bg-white p-5" @submit.prevent="saveAlias">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-950">{{ selectedAlias ? 'Editar alias' : 'Nuevo alias' }}</h2>
            <p class="mt-1 text-sm text-slate-600">Define el remitente que se usara para una actividad.</p>
          </div>
          <button v-if="selectedAlias" type="button" class="text-sm font-medium text-slate-600 hover:text-slate-950" @click="resetForm">
            Nuevo
          </button>
        </div>

        <div class="space-y-4">
          <label class="block">
            <span class="text-sm font-medium text-slate-700">Actividad</span>
            <select v-model="form.purpose" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
              <option v-for="purpose in purposes" :key="purpose.value" :value="purpose.value">
                {{ purpose.label }}
              </option>
            </select>
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">Alcance</span>
              <select v-model="form.scope_type" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
                <option value="global">Global</option>
                <option value="empresa">Empresa</option>
              </select>
            </label>

            <label class="block">
              <span class="text-sm font-medium text-slate-700">Empresa ID</span>
              <input
                v-model="form.scope_id"
                type="number"
                min="1"
                class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
                :disabled="form.scope_type === 'global'"
                placeholder="1"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Correo remitente</span>
            <input
              v-model="form.from_email"
              type="email"
              required
              class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="stelfaro.dte@stelfaro.com"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Nombre visible</span>
            <input
              v-model="form.from_name"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="Stelfaro DTE"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Reply-to</span>
            <input
              v-model="form.reply_to_email"
              type="email"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="soporte@stelfaro.com"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Nombre reply-to</span>
            <input
              v-model="form.reply_to_name"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="Soporte Stelfaro"
            />
          </label>

          <label class="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span class="text-sm font-medium text-slate-700">Activo</span>
            <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          </label>
        </div>

        <button
          type="submit"
          class="mt-5 h-10 w-full rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          :disabled="saving || !session.token"
        >
          {{ saving ? 'Guardando...' : selectedAlias ? 'Guardar cambios' : 'Crear alias' }}
        </button>
      </form>
    </div>
  </section>
</template>
