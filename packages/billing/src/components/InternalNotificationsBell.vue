<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { Bell, CalendarClock, CheckCheck, FileClock, Trash2, X } from 'lucide-vue-next';
import { PlatformClient, type PlatformInternalNotification } from '@stelfaro/api-client';
import { UiButton, UiStatusBadge } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  platformBaseUrl: string;
  tenantId?: number;
  scope?: 'tenant' | 'admin';
  appearance?: 'dark' | 'light';
}>(), {
  platformBaseUrl: '/api/v1',
  tenantId: 0,
  scope: 'tenant',
  appearance: 'dark'
});

const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const open = ref(false);
const mobileViewport = ref(false);
const loading = ref(false);
const notifications = ref<PlatformInternalNotification[]>([]);
const unreadCount = ref(0);
const ringing = ref(false);
let pollTimer: number | null = null;
let ringTimer: number | null = null;
let refreshing = false;
let mobileMedia: MediaQueryList | null = null;

const client = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'include' }));

onMounted(() => {
  mobileMedia = window.matchMedia('(max-width: 767px)');
  mobileViewport.value = mobileMedia.matches;
  mobileMedia.addEventListener('change', syncMobileViewport);
  void load();
  pollTimer = window.setInterval(() => {
    if (!document.hidden) void load(true);
  }, 5_000);
  document.addEventListener('click', closeOutside);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('focus', refreshOnFocus);
  window.addEventListener('keydown', closeOnEscape);
});

onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer);
  if (ringTimer) window.clearTimeout(ringTimer);
  document.removeEventListener('click', closeOutside);
  document.removeEventListener('visibilitychange', refreshWhenVisible);
  window.removeEventListener('focus', refreshOnFocus);
  window.removeEventListener('keydown', closeOnEscape);
  mobileMedia?.removeEventListener('change', syncMobileViewport);
  document.body.style.overflow = '';
});

watch(() => [props.tenantId, props.scope], () => void load());
watch([open, mobileViewport], ([isOpen, isMobile]) => {
  document.body.style.overflow = isOpen && isMobile ? 'hidden' : '';
});

function syncMobileViewport(event: MediaQueryListEvent): void {
  mobileViewport.value = event.matches;
}

async function load(silent = false): Promise<void> {
  if (refreshing || (props.scope === 'tenant' && !props.tenantId)) return;
  refreshing = true;
  if (!silent) loading.value = true;
  try {
    const previous = unreadCount.value;
    const response = props.scope === 'admin'
      ? await client.value.adminInternalNotifications()
      : await client.value.internalNotifications(props.tenantId);
    notifications.value = response.data;
    unreadCount.value = response.unread_count;
    if (response.unread_count > previous) animateBell();
  } catch {
    if (!silent) {
      notifications.value = [];
      unreadCount.value = 0;
    }
  } finally {
    loading.value = false;
    refreshing = false;
  }
}

function refreshWhenVisible(): void {
  if (!document.hidden) void load(true);
}

function refreshOnFocus(): void {
  void load(true);
}

function animateBell(): void {
  ringing.value = false;
  void nextTick(() => {
    ringing.value = true;
    if (ringTimer) window.clearTimeout(ringTimer);
    ringTimer = window.setTimeout(() => { ringing.value = false; }, 1200);
  });
}

async function openNotification(notification: PlatformInternalNotification): Promise<void> {
  const opensAdminRequest = notification.category === 'tenant_request'
    && Boolean(notification.action_url?.includes('/requests'));

  if (opensAdminRequest && notification.action_url) {
    window.open(notification.action_url, '_blank', 'noopener,noreferrer');
  }

  if (!notification.read_at) {
    try {
      const response = await client.value.readInternalNotification(notification.id);
      notifications.value = notifications.value.map(item => item.id === notification.id ? response.data : item);
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch {
      return;
    }
  }

  if (notification.action_url && !opensAdminRequest) window.location.assign(notification.action_url);
}

async function markAllRead(): Promise<void> {
  if (!unreadCount.value) return;
  try {
    await client.value.readAllInternalNotifications(props.scope === 'tenant' ? props.tenantId : null, props.scope);
    const readAt = new Date().toISOString();
    notifications.value = notifications.value.map(item => ({ ...item, read_at: item.read_at ?? readAt }));
    unreadCount.value = 0;
  } catch {
    // Conservamos el estado actual para intentar nuevamente.
  }
}

async function removeNotification(notification: PlatformInternalNotification): Promise<void> {
  try {
    await client.value.deleteInternalNotification(notification.id);
    notifications.value = notifications.value.filter(item => item.id !== notification.id);
    if (!notification.read_at) unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch {
    // Conservamos la notificación para que el usuario pueda volver a intentarlo.
  }
}

function closeOutside(event: MouseEvent): void {
  const target = event.target as Node;
  if (open.value && root.value && !root.value.contains(target) && !panel.value?.contains(target)) open.value = false;
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false;
}

function dueLabel(notification: PlatformInternalNotification): string {
  const days = Number(notification.metadata?.days_remaining);
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (Number.isFinite(days)) return `Faltan ${days} días`;
  return notification.due_date ?? '';
}

function notificationIcon(notification: PlatformInternalNotification): Component {
  if (notification.category === 'tenant_request') return FileClock;
  if (notification.category === 'tax_deadline') return CalendarClock;
  return Bell;
}

function notificationTone(notification: PlatformInternalNotification): string {
  if (notification.category === 'tenant_request') return 'bg-sky-100 text-sky-700 dark:bg-primary-soft dark:text-primary';
  return 'bg-amber-100 text-amber-700 dark:bg-warning-soft dark:text-warning';
}

function createdLabel(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative grid h-11 w-11 place-items-center rounded-full transition focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-400"
      :class="appearance === 'dark' ? 'text-slate-200 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-muted dark:hover:bg-surface-muted dark:hover:text-text'"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-label="Notificaciones"
      @click="open = !open"
    >
      <Bell class="h-6 w-6 origin-top" :class="ringing ? 'animate-bounce text-amber-300' : ''" aria-hidden="true" />
      <span v-if="unreadCount" class="absolute right-0.5 top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-slate-950" :class="ringing ? 'animate-pulse' : ''">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <Teleport to="body" :disabled="!mobileViewport">
    <section
      v-if="open"
      ref="panel"
      class="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-white text-slate-950 dark:bg-surface dark:text-text md:absolute md:inset-auto md:right-0 md:z-40 md:mt-3 md:block md:w-[min(92vw,390px)] md:rounded-xl md:border md:border-slate-200 md:shadow-2xl md:shadow-slate-950/20 md:dark:border-line"
      role="dialog"
      aria-modal="true"
      aria-label="Notificaciones internas"
    >
      <header class="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-line md:min-h-0 md:py-3">
        <div>
          <p class="text-lg font-black md:text-base">Notificaciones</p>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-muted">{{ unreadCount ? `${unreadCount} sin leer` : 'Todo al día' }}</p>
        </div>
        <div class="flex items-center gap-1">
          <UiButton v-if="unreadCount" size="sm" variant="ghost" @click="markAllRead"><CheckCheck class="h-4 w-4" /><span class="hidden min-[360px]:inline">Marcar leídas</span></UiButton>
          <button type="button" class="grid h-11 w-11 place-items-center rounded-full text-slate-500 active:bg-slate-100 md:hidden dark:text-muted dark:active:bg-surface-muted" aria-label="Cerrar notificaciones" @click="open = false"><X class="h-6 w-6" /></button>
        </div>
      </header>

      <div class="min-h-0 flex-1 overscroll-contain overflow-y-auto pb-[env(safe-area-inset-bottom)] md:max-h-[min(70vh,520px)]">
        <p v-if="loading" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted">Cargando notificaciones...</p>
        <div v-else-if="notifications.length === 0" class="px-5 py-10 text-center">
          <Bell class="mx-auto h-9 w-9 text-slate-300 dark:text-soft" />
          <p class="mt-3 font-bold">Sin notificaciones</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-muted">Aquí aparecerán solicitudes, respuestas y próximos vencimientos.</p>
        </div>
        <article
          v-for="notification in notifications"
          v-else
          :key="notification.id"
          class="group relative flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-sky-50 dark:border-line dark:hover:bg-surface-muted"
          :class="notification.read_at ? 'bg-white dark:bg-surface' : 'bg-sky-50/70 dark:bg-primary-soft/40'"
        >
          <button type="button" class="absolute inset-0 z-0" :aria-label="`Abrir ${notification.title}`" @click="openNotification(notification)"></button>
          <span class="pointer-events-none grid h-10 w-10 shrink-0 place-items-center rounded-full" :class="notificationTone(notification)"><component :is="notificationIcon(notification)" class="h-5 w-5" /></span>
          <span class="pointer-events-none min-w-0 flex-1 pr-7">
            <span class="flex items-start justify-between gap-2">
              <strong class="text-sm text-slate-950 dark:text-text">{{ notification.title }}</strong>
              <i v-if="!notification.read_at" class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500"></i>
            </span>
            <span class="mt-1 block text-sm leading-5 text-slate-600 dark:text-muted">{{ notification.message }}</span>
            <span class="mt-2 flex flex-wrap items-center gap-2"><UiStatusBadge v-if="dueLabel(notification)" tone="warning">{{ dueLabel(notification) }}</UiStatusBadge><UiStatusBadge v-if="notification.metadata?.request_reference" tone="info">{{ notification.metadata.request_reference }}</UiStatusBadge><UiStatusBadge v-if="notification.metadata?.form_code" tone="info">{{ notification.metadata.form_code }}</UiStatusBadge><small class="text-xs text-slate-400 dark:text-soft">{{ createdLabel(notification.created_at) }}</small></span>
          </span>
          <button type="button" class="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-soft dark:hover:bg-danger-soft dark:hover:text-danger" :aria-label="`Eliminar ${notification.title}`" title="Eliminar notificación" @click.stop="removeNotification(notification)"><Trash2 class="h-4 w-4" /></button>
        </article>
      </div>
    </section>
    </Teleport>
  </div>
</template>
