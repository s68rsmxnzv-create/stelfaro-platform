<script setup lang="ts">
import { UiButton, UiInfoIcon } from '@stelfaro/ui';
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
    :eyebrow="props.help?.summary ?? null"
    max-width="max-w-lg"
    z-index-class="z-[100]"
    panel-class="rounded-xl"
    close-label="Cerrar ayuda"
    @close="emit('close')"
  >
    <div v-if="props.help" class="space-y-4">
      <div class="flex items-start gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-primary-soft/25 dark:text-primary">
          <UiInfoIcon class="h-7 w-7" />
        </span>
        <p class="text-sm leading-6 text-slate-700 dark:text-muted">{{ props.help.use }}</p>
      </div>

      <ul v-if="props.help.details?.length" class="space-y-2 pl-14 text-sm leading-6 text-slate-600 dark:text-muted">
        <li v-for="detail in props.help.details" :key="detail" class="list-disc">
          {{ detail }}
        </li>
      </ul>
    </div>

    <template #footer>
      <UiButton type="button" @click="emit('close')">Entendido</UiButton>
    </template>
  </BillingModalShell>
</template>
