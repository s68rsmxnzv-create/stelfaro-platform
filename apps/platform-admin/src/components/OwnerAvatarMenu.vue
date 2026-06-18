<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps<{
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  serviceStatus?: {
    tone: 'offline' | 'partial' | 'ready';
    label: string;
    description: string;
  };
}>();

const emit = defineEmits<{
  logout: [];
}>();

const open = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const initials = computed(() => {
  const name = props.name ?? 'Stelfaro';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SF';
});

const firstName = computed(() => (props.name ?? 'Stelfaro').split(' ').filter(Boolean)[0] ?? 'Stelfaro');

const status = computed(() => props.serviceStatus ?? {
  tone: 'offline' as const,
  label: 'Sin conexion',
  description: 'Servicios internos no conectados'
});

const statusClasses = computed(() => {
  if (status.value.tone === 'ready') {
    return {
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-100',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50'
    };
  }

  if (status.value.tone === 'partial') {
    return {
      dot: 'bg-amber-500',
      ring: 'ring-amber-100',
      text: 'text-amber-700',
      bg: 'bg-amber-50'
    };
  }

  return {
    dot: 'bg-rose-500',
    ring: 'ring-rose-100',
    text: 'text-rose-700',
    bg: 'bg-rose-50'
  };
});

onMounted(() => {
  window.addEventListener('keydown', closeOnEscape);
  document.addEventListener('click', closeOnOutsideClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeOnEscape);
  document.removeEventListener('click', closeOnOutsideClick);
});

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

function closeOnOutsideClick(event: MouseEvent): void {
  if (!open.value || !menuRef.value) return;
  if (!menuRef.value.contains(event.target as Node)) close();
}

function logout(): void {
  close();
  emit('logout');
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-3 rounded-xl bg-white p-2 text-left text-slate-950 transition hover:bg-slate-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-500"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="menu"
      @click="toggle"
    >
      <span class="relative shrink-0">
        <span class="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-indigo-100 text-sm font-bold text-indigo-900 ring-4" :class="statusClasses.ring">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" class="h-full w-full object-cover" />
          <span v-else>{{ initials }}</span>
        </span>
        <span class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white" :class="statusClasses.dot"></span>
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold">{{ firstName }}</span>
        <span class="mt-0.5 block truncate text-xs font-semibold" :class="statusClasses.text">{{ status.label }}</span>
      </span>
      <svg class="h-4 w-4 text-slate-700 transition" :class="open ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute bottom-full left-0 z-30 mb-3 w-80 origin-bottom-left rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-950/15"
      role="menu"
    >
      <div class="px-1 pb-4">
        <p class="truncate text-sm font-semibold text-slate-950">{{ name ?? 'Stelfaro' }}</p>
        <p class="mt-1 truncate text-sm text-slate-500">{{ email ?? 'Sesion activa' }}</p>
        <div class="mt-4 flex items-start gap-3 rounded-xl px-3 py-3" :class="statusClasses.bg">
          <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :class="statusClasses.dot"></span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold" :class="statusClasses.text">{{ status.label }}</span>
            <span class="mt-0.5 block text-xs leading-5 text-slate-600">{{ status.description }}</span>
          </span>
        </div>
      </div>

      <div class="space-y-1 py-2">
        <RouterLink to="/" class="flex items-center gap-4 rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950" role="menuitem" @click="close">
          <svg class="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M4 11.5 12 4l8 7.5" />
            <path d="M6.5 10.5V20h11v-9.5" />
          </svg>
          Resumen
        </RouterLink>
        <RouterLink to="/empresas" class="flex items-center gap-4 rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950" role="menuitem" @click="close">
          <svg class="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2.1 2.1 0 0 1-4.2 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-1.55-1H2.6a2.1 2.1 0 0 1 0-4.2h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.05-.05A2.1 2.1 0 1 1 6.8 3.9l.05.05a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V2.7a2.1 2.1 0 0 1 4.2 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.08a2.1 2.1 0 0 1 0 4.2H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
          Empresas
        </RouterLink>
        <RouterLink to="/fiscal/onboarding" class="flex items-center gap-4 rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950" role="menuitem" @click="close">
          <svg class="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01" />
            <path d="M11 11h1v5h1" />
          </svg>
          Registrar empresa
        </RouterLink>
      </div>

      <div class="mt-2 border-t border-slate-200 pt-2">
        <button type="button" class="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700" role="menuitem" @click="logout">
          <svg class="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M15 17l5-5-5-5" />
            <path d="M20 12H9" />
            <path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
          </svg>
          Salir
        </button>
      </div>
    </div>
  </div>
</template>
