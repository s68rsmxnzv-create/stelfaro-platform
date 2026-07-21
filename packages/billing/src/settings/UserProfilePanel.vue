<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { KeyRound, Save, UserRound } from 'lucide-vue-next';
import { PlatformClient, type PlatformUserProfile } from '@stelfaro/api-client';
import { UiButton, UiEmailInput, UiInput, UiPasswordInput, UiPhoneInput, UiStatusBadge } from '@stelfaro/ui';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';

const props = withDefaults(defineProps<{
  platformBaseUrl?: string;
  platformSession?: (Record<string, unknown> & { tenant?: { name?: string | null; role?: string | null } | null }) | null;
}>(), { platformBaseUrl: '/api/v1', platformSession: null });

const client = new PlatformClient(props.platformBaseUrl, { credentials: 'include' });
const profile = ref<PlatformUserProfile | null>(null);
const loading = ref(false);
const saving = ref(false);
const changingPassword = ref(false);
const error = ref<string | null>(null);
const toasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;
const form = reactive({ name: '', email: '', phone: '' });
const password = reactive({ current_password: '', password: '', password_confirmation: '' });
const canSave = computed(() => form.name.trim() !== '' && form.email.trim() !== '' && !saving.value);
const canChangePassword = computed(() => password.current_password !== '' && password.password.length >= 8 && password.password === password.password_confirmation && !changingPassword.value);

onMounted(() => { void load(); });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await client.userProfile();
    profile.value = response.data;
    form.name = response.data.name;
    form.email = response.data.email;
    form.phone = response.data.phone ?? '';
  } catch (caught) {
    error.value = message(caught, 'No fue posible cargar tu perfil.');
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!canSave.value) return;
  saving.value = true;
  error.value = null;
  try {
    const response = await client.updateUserProfile({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null });
    profile.value = response.data;
    notify('Perfil actualizado', 'Tus datos personales fueron guardados.');
  } catch (caught) {
    error.value = message(caught, 'No fue posible guardar el perfil.');
  } finally {
    saving.value = false;
  }
}

async function changePassword(): Promise<void> {
  if (!canChangePassword.value) return;
  changingPassword.value = true;
  error.value = null;
  try {
    const response = await client.updateUserPassword({ ...password });
    profile.value = response.data;
    password.current_password = '';
    password.password = '';
    password.password_confirmation = '';
    notify('Contraseña actualizada', 'Las demás sesiones de tu cuenta fueron cerradas.');
  } catch (caught) {
    error.value = message(caught, 'No fue posible cambiar la contraseña.');
  } finally {
    changingPassword.value = false;
  }
}

function notify(title: string, detail: string): void {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, title, message: detail, variant: 'success' }];
  window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4200);
}

function message(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function roleLabel(role: string | null | undefined): string {
  return ({ owner: 'Propietario', company_admin: 'Administrador de empresa', billing_admin: 'Administrador de facturación', billing_user: 'Facturación', viewer: 'Consulta' } as Record<string, string>)[role ?? ''] ?? 'Usuario';
}

function formattedDate(value: string | null | undefined): string {
  if (!value) return 'Aún no registrado';
  return new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
</script>

<template>
  <BillingFloatingToastStack :toasts="toasts" />
  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
    <section class="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div class="flex items-start gap-3"><span class="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"><UserRound class="h-5 w-5" /></span><div><h2 class="font-bold text-text">Datos personales</h2><p class="mt-1 text-sm text-muted">Estos datos identifican tu cuenta, no modifican la información fiscal de la empresa.</p></div></div>
      <div v-if="loading" class="mt-6 text-sm text-muted">Cargando perfil...</div>
      <div v-else class="mt-6 grid gap-4 sm:grid-cols-2">
        <UiInput v-model="form.name" label="Nombre completo" />
        <UiEmailInput v-model="form.email" label="Correo de acceso" />
        <UiPhoneInput v-model="form.phone" label="Teléfono personal" />
        <div class="rounded-xl border border-line bg-surface-muted px-4 py-3"><p class="text-xs font-bold uppercase tracking-wide text-soft">Empresa actual</p><p class="mt-1 font-semibold text-text">{{ platformSession?.tenant?.name ?? 'Sin empresa seleccionada' }}</p><UiStatusBadge class="mt-2" tone="info">{{ roleLabel(platformSession?.tenant?.role) }}</UiStatusBadge></div>
        <div class="sm:col-span-2 flex justify-end"><UiButton variant="success" :disabled="!canSave" @click="save"><Save class="h-4 w-4" />{{ saving ? 'Guardando...' : 'Guardar perfil' }}</UiButton></div>
      </div>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div class="flex items-start gap-3"><span class="grid h-11 w-11 place-items-center rounded-xl bg-warning-soft text-warning"><KeyRound class="h-5 w-5" /></span><div><h2 class="font-bold text-text">Cambiar contraseña</h2><p class="mt-1 text-sm text-muted">Al cambiarla cerraremos las demás sesiones abiertas.</p></div></div>
      <div class="mt-6 space-y-4">
        <UiPasswordInput v-model="password.current_password" label="Contraseña actual" autocomplete="current-password" />
        <UiPasswordInput v-model="password.password" label="Nueva contraseña" autocomplete="new-password" />
        <UiPasswordInput v-model="password.password_confirmation" label="Confirmar nueva contraseña" autocomplete="new-password" />
        <p class="text-xs text-muted">Último cambio: {{ formattedDate(profile?.password_changed_at) }}</p>
        <div class="flex justify-end"><UiButton :disabled="!canChangePassword" @click="changePassword"><KeyRound class="h-4 w-4" />{{ changingPassword ? 'Actualizando...' : 'Actualizar contraseña' }}</UiButton></div>
      </div>
    </section>
  </div>
  <p v-if="error" class="mt-4 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>
</template>
