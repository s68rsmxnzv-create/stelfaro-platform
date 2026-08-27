<script setup lang="ts">
// @ts-nocheck
import { computed, ref, watch } from 'vue';
import BillingMobileTabBar from './BillingMobileTabBar.vue';
import BillingMobileSheet from './BillingMobileSheet.vue';
import BillingMobileActionGrid from './BillingMobileActionGrid.vue';
import { useSheetHistory } from './useSheetHistory';
import { useBodyScrollLock } from './useBodyScrollLock';

const props = defineProps({
  navModel: { type: Object, required: true },
});
const emit = defineEmits(['navigate']);

const activeSheet = ref(null);
const scrollLock = useBodyScrollLock();
const sheetHistory = useSheetHistory(() => {
  activeSheet.value = null;
});

watch(activeSheet, (sheet, previous) => {
  if (sheet) {
    scrollLock.lock();
    sheetHistory.open();
  } else if (previous) {
    scrollLock.unlock();
    sheetHistory.close();
  }
});

const sheetTitle = computed(() => {
  if (activeSheet.value === 'action') return '¿Qué querés crear?';
  if (activeSheet.value === 'management') return 'Gestión';
  return '';
});

function onTabSelect({ event, tab }) {
  if (tab.kind === 'fab') {
    activeSheet.value = 'action';
    return;
  }
  if (tab.kind === 'sheet') {
    activeSheet.value = tab.sheet;
    return;
  }
  navigate({ event, href: tab.href });
}

function navigate({ event, href }) {
  activeSheet.value = null;
  emit('navigate', { event, href });
}
</script>

<template>
  <div class="contents">
    <slot />

    <BillingMobileTabBar :tabs="navModel.tabs" @select="onTabSelect" />

    <BillingMobileSheet
      :open="activeSheet === 'action'"
      :title="sheetTitle"
      @close="activeSheet = null"
    >
      <BillingMobileActionGrid :items="navModel.actions" @navigate="navigate" />
    </BillingMobileSheet>

    <BillingMobileSheet
      :open="activeSheet === 'management'"
      :title="sheetTitle"
      @close="activeSheet = null"
    >
      <BillingMobileActionGrid
        :items="navModel.management ?? []"
        @navigate="navigate"
      />
    </BillingMobileSheet>

    <BillingMobileSheet
      :open="activeSheet === 'more'"
      title="Más"
      size="tall"
      @close="activeSheet = null"
    >
      <slot name="more" :close="() => (activeSheet = null)" :navigate="navigate" />
    </BillingMobileSheet>
  </div>
</template>
