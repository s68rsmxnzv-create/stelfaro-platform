<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  label: string;
  detail?: string | null;
  top: number;
  left: number;
  placement?: 'right' | 'bottom';
  id?: string;
}>(), {
  detail: null,
  placement: 'right',
  id: undefined
});

const positionStyle = computed(() => ({
  top: `${props.top}px`,
  left: `${props.left}px`
}));

const placementClass = computed(() => (props.placement === 'bottom' ? '-translate-x-1/2' : '-translate-y-1/2'));
</script>

<template>
  <div
    v-if="open"
    :id="id"
    class="pointer-events-none fixed z-[60] min-w-44 rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow-lg shadow-slate-950/10 dark:border-line dark:bg-surface-raised dark:shadow-black/30"
    :class="placementClass"
    :style="positionStyle"
    role="tooltip"
  >
    <span class="block whitespace-nowrap text-sm font-bold text-slate-950 dark:text-text">{{ label }}</span>
    <span v-if="detail" class="mt-0.5 block whitespace-nowrap text-xs font-medium text-slate-500 dark:text-soft">{{ detail }}</span>
  </div>
</template>
