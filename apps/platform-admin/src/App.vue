<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useAdminSessionStore } from './stores/adminSession';

const route = useRoute();
const session = useAdminSessionStore();
const connectOpen = ref(false);
const baseUrlInput = ref(session.baseUrl);
const tokenInput = ref(session.token);
const connectError = ref<string | null>(null);

onMounted(async () => {
  await session.initialize();
  connectOpen.value = !session.isConnected;
});

async function connect(): Promise<void> {
  connectError.value = null;
  try {
    await session.connect(baseUrlInput.value, tokenInput.value);
    connectOpen.value = false;
  } catch (error) {
    connectError.value = error instanceof Error ? error.message : 'No fue posible conectar.';
  }
}

function disconnect(): void {
  session.disconnect();
  tokenInput.value = '';
  connectOpen.value = true;
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <aside class="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
      <div class="flex h-16 items-center border-b border-slate-200 px-6">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Stelfaro</p>
          <h1 class="text-lg font-semibold text-slate-950">Platform Admin</h1>
        </div>
      </div>

      <nav class="px-3 py-5">
        <p class="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Operaciones</p>
        <RouterLink
          to="/notifications/sender-aliases"
          class="mt-2 flex h-10 items-center rounded-md px-3 text-sm font-medium"
          :class="route.path.startsWith('/notifications') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'"
        >
          Notificaciones
        </RouterLink>
        <RouterLink
          to="/notifications/mail-transport"
          class="mt-1 flex h-10 items-center rounded-md px-3 text-sm font-medium"
          :class="route.path === '/notifications/mail-transport' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'"
        >
          Buzon SMTP
        </RouterLink>
      </nav>
    </aside>

    <div class="lg:pl-72">
      <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Panel interno</p>
            <h2 class="text-base font-semibold text-slate-950">Administracion de plataforma</h2>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden text-right sm:block">
              <p class="text-xs text-slate-500">Notifications</p>
              <p class="text-sm font-medium" :class="session.isConnected ? 'text-emerald-700' : 'text-rose-700'">
                {{ session.isConnected ? session.serviceName : 'Sin conexion' }}
              </p>
            </div>
            <button
              type="button"
              class="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              @click="connectOpen = true"
            >
              Conexion
            </button>
            <button
              v-if="session.token"
              type="button"
              class="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
              @click="disconnect"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main class="px-4 py-6 sm:px-6 lg:px-8">
        <RouterView />
      </main>
    </div>

    <div v-if="connectOpen" class="fixed inset-0 z-50 bg-slate-950/50 px-4 py-6">
      <div class="mx-auto mt-20 max-w-lg rounded-lg bg-white shadow-xl">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-lg font-semibold text-slate-950">Conexion interna</h2>
          <p class="mt-1 text-sm text-slate-600">Usa el token interno de notifications para operar este panel.</p>
        </div>

        <form class="space-y-4 px-6 py-5" @submit.prevent="connect">
          <label class="block">
            <span class="text-sm font-medium text-slate-700">Base URL</span>
            <input
              v-model="baseUrlInput"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="/notifications-api/v1"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-slate-700">Token interno</span>
            <input
              v-model="tokenInput"
              type="password"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              autocomplete="off"
            />
          </label>

          <p v-if="connectError || session.lastError" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {{ connectError || session.lastError }}
          </p>

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              v-if="session.token"
              type="button"
              class="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
              @click="connectOpen = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              :disabled="session.loading"
            >
              {{ session.loading ? 'Conectando...' : 'Conectar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
