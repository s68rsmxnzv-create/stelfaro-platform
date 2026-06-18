<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { NotificationMailTransport } from '@stelfaro/api-client';
import { useAdminSessionStore } from '../stores/adminSession';

const session = useAdminSessionStore();
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref(false);
const current = ref<NotificationMailTransport | null>(null);

const form = reactive({
  name: 'Hostinger Stelfaro',
  host: 'smtp.hostinger.com',
  port: 465,
  scheme: 'ssl' as 'ssl' | 'tls' | 'null',
  username: '',
  password: '',
  default_from_email: '',
  default_from_name: 'StelFaro'
});

onMounted(() => {
  void loadTransport();
});

async function loadTransport(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await session.client.mailTransport();
    current.value = response.data;

    if (response.data) {
      form.name = response.data.name;
      form.host = response.data.host;
      form.port = response.data.port;
      form.scheme = response.data.scheme ?? 'null';
      form.username = response.data.username;
      form.password = '';
      form.default_from_email = response.data.default_from_email;
      form.default_from_name = response.data.default_from_name ?? '';
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'No fue posible cargar el buzon SMTP.';
  } finally {
    loading.value = false;
  }
}

async function saveTransport(): Promise<void> {
  saving.value = true;
  saved.value = false;
  error.value = null;
  try {
    const response = await session.client.saveMailTransport({
      name: form.name,
      host: form.host,
      port: Number(form.port),
      scheme: form.scheme,
      username: form.username,
      password: form.password || null,
      default_from_email: form.default_from_email,
      default_from_name: form.default_from_name || null
    });

    current.value = response.data;
    form.password = '';
    saved.value = true;
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : 'No fue posible guardar el buzon SMTP.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-5xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Notificaciones</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-950">Buzon SMTP global</h1>
      <p class="mt-2 max-w-3xl text-sm text-slate-600">
        Buzon contratado que transporta todos los correos de la plataforma. Los alias de remitente usan este mismo buzon como salida.
      </p>
    </div>

    <div v-if="!session.isConnected" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      No fue posible conectar con el servicio de notificaciones.
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form class="rounded-lg border border-slate-200 bg-white p-5" @submit.prevent="saveTransport">
        <p v-if="error" class="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</p>
        <p v-if="saved" class="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Buzon guardado.</p>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="text-sm font-medium text-slate-700">Nombre interno</span>
            <input v-model="form.name" required class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Host SMTP</span>
            <input v-model="form.host" required class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">Puerto</span>
              <input v-model="form.port" type="number" min="1" max="65535" required class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="text-sm font-medium text-slate-700">Cifrado</span>
              <select v-model="form.scheme" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
                <option value="ssl">SSL</option>
                <option value="tls">TLS</option>
                <option value="null">Ninguno</option>
              </select>
            </label>
          </div>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Usuario SMTP</span>
            <input v-model="form.username" required class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" autocomplete="off" />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Contrasena SMTP</span>
            <input v-model="form.password" type="password" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" autocomplete="new-password" :placeholder="current?.password_configured ? 'Conservar actual' : ''" />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">From por defecto</span>
            <input v-model="form.default_from_email" type="email" required class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Nombre por defecto</span>
            <input v-model="form.default_from_name" class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          </label>
        </div>

        <button type="submit" class="mt-5 h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60" :disabled="saving || loading">
          {{ saving ? 'Guardando...' : 'Guardar buzon' }}
        </button>
      </form>

      <aside class="rounded-lg border border-slate-200 bg-white p-5">
        <h2 class="text-base font-semibold text-slate-950">Estado</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-slate-500">Activo</dt>
            <dd class="font-medium text-slate-950">{{ current ? 'Si' : 'No configurado' }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Password</dt>
            <dd class="font-medium text-slate-950">{{ current?.password_configured ? 'Configurado' : 'Pendiente' }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Transporte</dt>
            <dd class="font-medium text-slate-950">{{ current ? `${current.host}:${current.port}` : '-' }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
