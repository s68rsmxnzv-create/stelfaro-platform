<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Bell, CalendarClock, CheckCheck } from 'lucide-vue-next';
import { PlatformClient, type PlatformInternalNotification } from '@stelfaro/api-client';
import { UiButton, UiStatusBadge } from '@stelfaro/ui';

const props = withDefaults(defineProps<{
  platformBaseUrl: string;
  tenantId: number;
}>(), {
  platformBaseUrl: '/api/v1'
});

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const loading = ref(false);
const notifications = ref<PlatformInternalNotification[]>([]);
const unreadCount = ref(0);
const ringing = ref(false);
let pollTimer: number | null = null;
let ringTimer: number | null = null;

const client = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'include' }));

onMounted(() => {
  void load();
  pollTimer = window.setInterval(() => void load(true), 60_000);
  document.addEventListener('click', closeOutside);
  window.addEventListener('keydown', closeOnEscape);
});

onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer);
  if (ringTimer) window.clearTimeout(ringTimer);
  document.removeEventListener('click', closeOutside);
  window.removeEventListener('keydown', closeOnEscape);
});

watch(() => props.tenantId, () => void load());

async function load(silent = false): Promise<void> {
  if (!props.tenantId) return;
  if (!silent) loading.value = true;
  try {
    const previous = unreadCount.value;
    const response = await client.value.internalNotifications(props.tenantId);
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
  }
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
  if (!notification.read_at) {
    try {
      const response = await client.value.readInternalNotification(notification.id);
      notifications.value = notifications.value.map(item => item.id === notification.id ? response.data : item);
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch {
      return;
    }
  }

  if (notification.action_url) window.location.assign(notification.action_url);
}

async function markAllRead(): Promise<void> {
  if (!unreadCount.value) return;
  try {
    await client.value.readAllInternalNotifications(props.tenantId);
    const readAt = new Date().toISOString();
    notifications.value = notifications.value.map(item => ({ ...item, read_at: item.read_at ?? readAt }));
    unreadCount.value = 0;
  } catch {
    // Conservamos el estado actual para intentar nuevamente.
  }
}

function closeOutside(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
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
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative grid h-11 w-11 place-items-center rounded-full text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-400"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-label="Notificaciones"
      @click="open = !open"
    >
      <Bell class="h-6 w-6 origin-top" :class="ringing ? 'animate-bounce text-amber-300' : ''" aria-hidden="true" />
      <span v-if="unreadCount" class="absolute right-0.5 top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-slate-950" :class="ringing ? 'animate-pulse' : ''">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <section v-if="open" class="absolute right-0 z-40 mt-3 w-[min(92vw,390px)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/20 dark:border-line dark:bg-surface dark:text-text" role="dialog" aria-label="Notificaciones internas">
      <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-line">
        <div>
          <p class="font-black">Notificaciones</p>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-muted">{{ unreadCount ? `${unreadCount} sin leer` : 'Todo al día' }}</p>
        </div>
        <UiButton v-if="unreadCount" size="sm" variant="ghost" @click="markAllRead"><CheckCheck class="h-4 w-4" />Marcar leídas</UiButton>
      </header>

      <div class="max-h-[min(70vh,520px)] overflow-y-auto">
        <p v-if="loading" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-muted">Cargando notificaciones...</p>
        <div v-else-if="notifications.length === 0" class="px-5 py-10 text-center">
          <Bell class="mx-auto h-9 w-9 text-slate-300 dark:text-soft" />
          <p class="mt-3 font-bold">Sin notificaciones</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-muted">Aquí aparecerán los próximos vencimientos.</p>
        </div>
        <button
          v-for="notification in notifications"
          v-else
          :key="notification.id"
          type="button"
          class="flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-sky-50 dark:border-line dark:hover:bg-surface-muted"
          :class="notification.read_at ? 'bg-white dark:bg-surface' : 'bg-sky-50/70 dark:bg-primary-soft/40'"
          @click="openNotification(notification)"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-warning-soft dark:text-warning"><CalendarClock class="h-5 w-5" /></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-start justify-between gap-2">
              <strong class="text-sm text-slate-950 dark:text-text">{{ notification.title }}</strong>
              <i v-if="!notification.read_at" class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500"></i>
            </span>
            <span class="mt-1 block text-sm leading-5 text-slate-600 dark:text-muted">{{ notification.message }}</span>
            <span class="mt-2 flex flex-wrap items-center gap-2"><UiStatusBadge tone="warning">{{ dueLabel(notification) }}</UiStatusBadge><UiStatusBadge v-if="notification.metadata?.form_code" tone="info">{{ notification.metadata.form_code }}</UiStatusBadge></span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>
