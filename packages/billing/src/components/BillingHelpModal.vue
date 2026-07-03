<script setup lang="ts">
import { UiButton } from '@stelfaro/ui';
import BillingModalShell from './BillingModalShell.vue';

type BillingHelpContent = {
  title: string;
  summary?: string | null;
  use?: string | null;
  details?: string[];
};

const props = withDefaults(defineProps<{
  open: boolean;
  help: BillingHelpContent | null;
}>(), {
  help: null
});

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <BillingModalShell
    :open="open && Boolean(help)"
    :title="props.help?.title ?? 'Ayuda'"
    eyebrow="Ayuda"
    :description="props.help?.summary ?? null"
    max-width="max-w-2xl"
    z-index-class="z-[100]"
    close-label="Cerrar ayuda"
    @close="emit('close')"
  >
    <div v-if="props.help" class="space-y-3 text-sm leading-6 text-slate-600 dark:text-muted">
      <p v-if="props.help.use">{{ props.help.use }}</p>
      <p v-for="detail in props.help.details" :key="detail">
        {{ detail }}
      </p>
    </div>

    <template #footer>
      <UiButton type="button" @click="emit('close')">Entendido</UiButton>
    </template>
  </BillingModalShell>
</template>
