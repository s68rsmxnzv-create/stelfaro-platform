<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Laptop, LogOut, RefreshCw, ShieldCheck, Smartphone } from 'lucide-vue-next';
import { PlatformClient, type PlatformUserSecurityEvent, type PlatformUserSession } from '@stelfaro/api-client';
import { UiButton, UiStatusBadge } from '@stelfaro/ui';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';

const props = withDefaults(defineProps<{ platformBaseUrl?: string }>(), { platformBaseUrl: '/api/v1' });
const client = new PlatformClient(props.platformBaseUrl, { credentials: 'include' });
const sessions = ref<PlatformUserSession[]>([]);
const events = ref<PlatformUserSecurityEvent[]>([]);
const loading = ref(false);
const closing = ref<string | null>(null);
const error = ref<string | null>(null);
const toasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;

onMounted(() => { void load(); });

async function load(): Promise<void> {
  loading.value = true; error.value = null;
  try { const response = await client.userSecurity(); sessions.value = response.sessions; events.value = response.events; }
  catch (caught) { error.value = caught instanceof Error ? caught.message : 'No fue posible cargar la seguridad de la cuenta.'; }
  finally { loading.value = false; }
}

async function closeSession(id: string): Promise<void> {
  closing.value = id; error.value = null;
  try { await client.closeUserSession(id); sessions.value = sessions.value.filter(item => item.id !== id); notify('Sesión cerrada', 'Ese dispositivo ya no tiene una sesión activa.'); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : 'No fue posible cerrar la sesión.'; }
  finally { closing.value = null; }
}

async function closeOthers(): Promise<void> {
  closing.value = 'others'; error.value = null;
  try { const response = await client.closeOtherUserSessions(); sessions.value = sessions.value.filter(item => item.current); notify('Sesiones cerradas', response.message); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : 'No fue posible cerrar las sesiones.'; }
  finally { closing.value = null; }
}

function notify(title: string, detail: string): void { const id = ++toastId; toasts.value = [...toasts.value, { id, title, message: detail, variant: 'success' }]; window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4200); }
function date(value: string | null): string { return value ? new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'; }
</script>

<template>
  <div>
  <BillingFloatingToastStack :toasts="toasts" />
  <section class="rounded-xl border border-line bg-surface p-5 sm:p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div class="flex items-start gap-3"><span class="grid h-11 w-11 place-items-center rounded-xl bg-success-soft text-success"><ShieldCheck class="h-5 w-5" /></span><div><h2 class="font-bold text-text">Sesiones activas</h2><p class="mt-1 text-sm text-muted">Revisa dónde está abierta tu cuenta y cierra accesos que no reconozcas.</p></div></div><div class="flex gap-2"><UiButton size="sm" variant="secondary" :disabled="loading" @click="load"><RefreshCw class="h-4 w-4" />Actualizar</UiButton><UiButton size="sm" variant="secondary" :disabled="closing !== null || sessions.filter(item => !item.current).length === 0" @click="closeOthers"><LogOut class="h-4 w-4" />Cerrar las demás</UiButton></div></div>
    <div class="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
      <div v-if="loading" class="p-5 text-sm text-muted">Consultando sesiones...</div>
      <div v-for="session in sessions" v-else :key="session.id" class="flex flex-col gap-3 bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-muted text-muted"><Smartphone v-if="session.device.includes('iOS') || session.device.includes('Android')" class="h-5 w-5" /><Laptop v-else class="h-5 w-5" /></span><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><p class="font-semibold text-text">{{ session.device }}</p><UiStatusBadge v-if="session.current" tone="success">Esta sesión</UiStatusBadge></div><p class="mt-1 text-xs text-muted">{{ session.ip_address || 'IP no disponible' }} · Última actividad {{ date(session.last_activity) }}</p></div></div>
        <UiButton v-if="!session.current" size="sm" variant="secondary" :disabled="closing === session.id" @click="closeSession(session.id)"><LogOut class="h-4 w-4" />{{ closing === session.id ? 'Cerrando...' : 'Cerrar sesión' }}</UiButton>
      </div>
      <div v-if="!loading && sessions.length === 0" class="p-5 text-sm text-muted">No encontramos sesiones activas almacenadas.</div>
    </div>
  </section>

  <section class="mt-5 rounded-xl border border-line bg-surface p-5 sm:p-6"><h2 class="font-bold text-text">Actividad de seguridad reciente</h2><p class="mt-1 text-sm text-muted">Aquí aparecen bloqueos y eventos relevantes asociados a tu cuenta.</p><div class="mt-4 space-y-2"><div v-for="event in events" :key="event.id" class="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-raised px-4 py-3"><div><p class="text-sm font-semibold text-text">{{ event.type.replaceAll('_', ' ') }}</p><p class="mt-1 text-xs text-muted">{{ event.device }} · {{ event.ip_address || 'IP no disponible' }}</p></div><span class="shrink-0 text-xs text-muted">{{ date(event.created_at) }}</span></div><p v-if="events.length === 0" class="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">No hay alertas recientes para tu cuenta.</p></div></section>
  <section class="mt-5 rounded-xl border border-dashed border-line bg-surface-muted p-5"><p class="font-semibold text-text">Segundo factor</p><p class="mt-1 text-sm text-muted">Se incorporará más adelante. No hay controles simulados ni una activación incompleta.</p></section>
  <p v-if="error" class="mt-4 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>
  </div>
</template>
