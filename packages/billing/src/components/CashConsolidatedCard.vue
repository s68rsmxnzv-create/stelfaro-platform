<script setup lang="ts">
import { ref, watch } from 'vue';
import { LockKeyhole, RefreshCw, Store } from 'lucide-vue-next';
import type { PlatformCashConsolidatedBranch, PlatformClient } from '@stelfaro/api-client';

const props = defineProps<{
  platform: PlatformClient;
  tenantId: number;
}>();

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
}>();

const branches = ref<PlatformCashConsolidatedBranch[]>([]);
const loading = ref(false);
const error = ref('');

const money = (value: number | null) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value ?? 0);

async function load() {
  if (!props.tenantId) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await props.platform.cashRegistersConsolidated(props.tenantId);
    branches.value = result.data;
    emit('update:visible', result.has_multiple_branches);
  } catch {
    branches.value = [];
    emit('update:visible', false);
  } finally {
    loading.value = false;
  }
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
          <p class="text-xs text-muted">Estado y saldo actual</p>
        </div>
      </div>
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

    <p v-if="error" class="px-4 py-4 text-sm text-danger">{{ error }}</p>
    <p v-else-if="loading && !branches.length" class="px-4 py-6 text-center text-sm text-muted">Cargando…</p>

    <ul v-else class="divide-y divide-line" :class="loading ? 'opacity-60' : ''">
      <li v-for="branch in branches" :key="branch.branch_id" class="flex items-center justify-between gap-3 px-4 py-3.5">
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
      </li>
    </ul>
  </section>
</template>
