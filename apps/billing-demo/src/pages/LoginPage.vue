<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const error = ref<string | null>(null);
const form = reactive({
  email: '',
  password: ''
});

async function submit(): Promise<void> {
  error.value = null;

  try {
    await auth.login(form.email, form.password);
    await router.push(auth.isBackoffice ? '/companies' : '/billing');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible iniciar sesion.';
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col justify-center bg-slate-950 px-6 py-12 text-white lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-sky-500 text-lg font-black text-white shadow-lg shadow-sky-950/40">
        SF
      </div>
      <p class="mt-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Stelfaro Billing</p>
      <h1 class="mt-3 text-center text-2xl font-bold tracking-tight text-white">Inicia sesion en tu cuenta</h1>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="space-y-6" @submit.prevent="submit">
        <label class="block">
          <span class="block text-sm font-medium text-slate-100">Correo</span>
          <input
            v-model="form.email"
            class="mt-2 block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 transition placeholder:text-slate-500 focus:outline-2 focus:-outline-offset-2 focus:outline-sky-500 sm:text-sm"
            autocomplete="email"
            required
            type="email"
          >
        </label>

        <label class="block">
          <span class="flex items-center justify-between">
            <span class="block text-sm font-medium text-slate-100">Password</span>
            <button class="text-sm font-semibold text-sky-300 hover:text-sky-200" type="button" @click="form.password = ''">
              Limpiar
            </button>
          </span>
          <input
            v-model="form.password"
            class="mt-2 block w-full rounded-md bg-white/5 px-3 py-2 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 transition placeholder:text-slate-500 focus:outline-2 focus:-outline-offset-2 focus:outline-sky-500 sm:text-sm"
            autocomplete="current-password"
            required
            type="password"
          >
        </label>

        <p v-if="error" class="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{{ error }}</p>

        <button
          class="flex w-full justify-center rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="auth.loading || !form.email || !form.password"
          type="submit"
        >
          {{ auth.loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <p class="mt-10 text-center text-sm text-slate-400">
        Acceso privado para empresas configuradas en Stelfaro.
      </p>
    </div>
  </main>
</template>
