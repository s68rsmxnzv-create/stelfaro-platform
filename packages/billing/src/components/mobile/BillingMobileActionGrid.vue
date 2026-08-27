<script setup lang="ts">
// @ts-nocheck
import { iconFor } from './mobileIcons';

defineProps({
  items: { type: Array, default: () => [] },
});
const emit = defineEmits(['navigate']);

function onSelect(event, item) {
  if (item.enabled === false) return;
  if (item.newTab) return; // let the browser open the target in a new tab
  emit('navigate', { event, href: item.href });
}
</script>

<template>
  <ul class="grid grid-cols-2 gap-2">
    <li v-for="item in items" :key="item.key">
      <a
        :href="item.enabled === false ? undefined : item.href"
        :target="item.newTab ? '_blank' : undefined"
        :rel="item.newTab ? 'noopener noreferrer' : undefined"
        class="flex h-full min-h-[5.5rem] flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-[0.98]"
        :class="item.enabled === false
          ? 'cursor-not-allowed border-line/60 bg-surface-muted/40 text-soft'
          : 'border-line bg-surface text-text active:bg-primary-soft'"
        :aria-disabled="item.enabled === false ? 'true' : undefined"
        @click="onSelect($event, item)"
      >
        <component
          :is="iconFor(item.iconName)"
          class="h-5 w-5"
          :class="item.enabled === false ? 'text-soft' : 'text-primary'"
          aria-hidden="true"
        />
        <span class="mt-3 text-sm font-semibold leading-tight">{{ item.label }}</span>
        <span
          v-if="item.enabled === false"
          class="mt-0.5 text-[11px] font-medium text-soft"
        >No habilitado</span>
      </a>
    </li>
  </ul>
</template>
