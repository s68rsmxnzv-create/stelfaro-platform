<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, LockKeyhole, RefreshCw, Store } from 'lucide-vue-next';
import type { PlatformCashConsolidatedBranch, PlatformClient } from '@stelfaro/api-client';

const props = defineProps<{
  platform: PlatformClient;
  tenantId: number;
  appBaseUrl: string;
}>();

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
}>();

const branches = ref<PlatformCashConsolidatedBranch[]>([]);
const loading = ref(false);
const error = ref('');
const activeIndex = ref(0);
const track = ref<HTMLElement | null>(null);

const base = computed(() => props.appBaseUrl.replace(/\/$/, ''));

const money = (value: number | null) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value ?? 0);
const dateShort = (value: string | null) =>
  value ? new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`)) : '—';
function historyHref(branch: PlatformCashConsolidatedBranch) {
  return `${base.value}/caja?tab=history&cash_register_id=${branch.register_id}`;
}

async function load() {
  if (!props.tenantId) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await props.platform.cashRegistersConsolidated(props.tenantId);
    branches.value = result.data;
    activeIndex.value = 0;
    emit('update:visible', result.has_multiple_branches);
  } catch {
    branches.value = [];
    emit('update:visible', false);
  } finally {
    loading.value = false;
  }
}

function goTo(index: number) {
  if (index < 0 || index >= branches.value.length || !track.value) return;
  activeIndex.value = index;
  const slide = track.value.children[index] as HTMLElement | undefined;
  slide?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
}

watch(() => props.tenantId, () => void load(), { immediate: true });

defineExpose({ load });
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
    <div class="flex items-center justify-between border-b border-line px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <Store class="h-4 w-4" />
        </span>
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-muted">Cajas por sucursal</h2>
          <p class="text-xs text-muted">Estado en vivo y últimos cierres</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="branches.length > 1"
          type="button"
          class="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted transition enabled:hover:bg-surface-muted disabled:opacity-40"
          :disabled="activeIndex <= 0"
          aria-label="Sucursal anterior"
          @click="goTo(activeIndex - 1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
        <button
          v-if="branches.length > 1"
          type="button"
          class="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted transition enabled:hover:bg-surface-muted disabled:opacity-40"
          :disabled="activeIndex >= branches.length - 1"
          aria-label="Siguiente sucursal"
          @click="goTo(activeIndex + 1)"
        >
          <ChevronRight class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition hover:bg-surface-muted"
          :disabled="loading"
          aria-label="Actualizar"
          @click="load"
        >
          <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <p v-if="error" class="px-4 py-4 text-sm text-danger">{{ error }}</p>
    <p v-else-if="loading && !branches.length" class="px-4 py-6 text-center text-sm text-muted">Cargando…</p>

    <div v-else ref="track" class="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
      <div v-for="branch in branches" :key="branch.branch_id" class="w-full shrink-0 snap-start px-4 py-3.5">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-text">{{ branch.branch_name }}</p>
            <p class="mt-0.5 text-xs text-muted">
              {{ branch.status === 'open' ? `Abierta por ${branch.opened_by || '—'}` : 'Cerrada' }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="branch.status === 'open' ? 'bg-success-soft text-success' : 'bg-surface-muted text-muted'"
            >
              <LockKeyhole v-if="branch.status !== 'open'" class="h-3 w-3" />
              {{ branch.status === 'open' ? 'Abierta' : 'Cerrada' }}
            </span>
            <strong class="text-sm font-bold tabular-nums text-text">{{ money(branch.balance) }}</strong>
          </div>
        </div>

        <div v-if="branch.recent_closures?.length" class="mt-3 space-y-1 border-t border-line pt-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-soft">Últimos cierres</p>
          <a
            v-for="closure in branch.recent_closures"
            :key="closure.id"
            :href="historyHref(branch)"
            class="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm transition hover:bg-surface-muted"
          >
            <span class="text-muted">{{ dateShort(closure.business_date) }}</span>
            <span v-if="closure.status === 'closed_unverified'" class="font-semibold text-warning">Sin confirmar</span>
            <span v-else class="font-semibold" :class="Math.abs(closure.difference ?? 0) < 0.01 ? 'text-success' : 'text-warning'">
              {{ money(closure.difference) }}
            </span>
          </a>
        </div>
      </div>
    </div>

    <div v-if="branches.length > 1" class="flex justify-center gap-1.5 border-t border-line py-2.5">
      <button
        v-for="(branch, index) in branches"
        :key="branch.branch_id"
        type="button"
        class="h-1.5 rounded-full transition-all"
        :class="index === activeIndex ? 'w-4 bg-primary' : 'w-1.5 bg-line-strong'"
        :aria-label="`Ir a ${branch.branch_name}`"
        @click="goTo(index)"
      ></button>
    </div>
  </section>
</template>
