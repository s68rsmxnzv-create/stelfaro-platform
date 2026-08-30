<script setup lang="ts">
import { computed } from 'vue';
import { Landmark } from 'lucide-vue-next';

type CommercialTax = {
  sales_tax_month: number;
  purchase_tax_credit_month: number;
  estimated_tax_payable_month: number;
  estimated_tax_credit_balance_month: number;
};

const props = defineProps<{ commercial: CommercialTax | null }>();

const money = (value: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value || 0);

const hasCredit = computed(() => (props.commercial?.estimated_tax_credit_balance_month ?? 0) > 0);
const amount = computed(() =>
  hasCredit.value
    ? props.commercial?.estimated_tax_credit_balance_month ?? 0
    : props.commercial?.estimated_tax_payable_month ?? 0,
);
const title = computed(() => (hasCredit.value ? 'Crédito fiscal a favor' : 'IVA estimado por pagar'));
</script>

<template>
  <section class="rounded-2xl border border-line bg-surface-muted/40 p-4 md:rounded-lg md:p-5">
    <div class="flex items-center gap-2">
      <Landmark class="h-4 w-4 text-muted" />
      <h3 class="text-sm font-medium text-muted">{{ title }}</h3>
    </div>
    <p class="mt-2 text-lg font-semibold tabular-nums" :class="hasCredit ? 'text-success' : 'text-text'">
      {{ commercial ? money(amount) : '—' }}
    </p>
    <p class="mt-1 text-xs leading-5 text-muted">
      Estimación del mes en curso · IVA en ventas {{ commercial ? money(commercial.sales_tax_month) : '—' }}
      · deducible {{ commercial ? money(commercial.purchase_tax_credit_month) : '—' }}
    </p>
  </section>
</template>
