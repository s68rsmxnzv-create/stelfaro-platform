<script setup lang="ts">
// @ts-nocheck
import { computed, ref } from 'vue';
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
  // Back button / edge-swipe: the entry is already gone, just close.
  activeSheet.value = null;
  scrollLock.unlock();
});

function openSheet(key) {
  activeSheet.value = key;
  scrollLock.lock();
  sheetHistory.open();
}

function closeSheet() {
  if (!activeSheet.value) return;
  activeSheet.value = null;
  scrollLock.unlock();
  sheetHistory.close();
}

const sheetTitle = computed(() => {
  if (activeSheet.value === 'action') return '¿Qué querés crear?';
  if (activeSheet.value === 'management') return 'Gestión';
  return '';
});

function onTabSelect({ event, tab }) {
  if (tab.kind === 'fab') {
    openSheet('action');
    return;
  }
  if (tab.kind === 'sheet') {
    openSheet(tab.sheet);
    return;
  }
  navigate({ event, href: tab.href });
}

function navigate({ event, href }) {
  if (activeSheet.value) {
    // Leave the sheet without history.back() so it can't race the router.
    sheetHistory.release();
    activeSheet.value = null;
    scrollLock.unlock();
  }
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
      @close="closeSheet"
    >
      <BillingMobileActionGrid :items="navModel.actions" @navigate="navigate" />
    </BillingMobileSheet>

    <BillingMobileSheet
      :open="activeSheet === 'management'"
      :title="sheetTitle"
      @close="closeSheet"
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
      @close="closeSheet"
    >
      <slot name="more" :close="closeSheet" :navigate="navigate" />
    </BillingMobileSheet>
  </div>
</template>
