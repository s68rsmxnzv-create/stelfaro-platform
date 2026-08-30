<script setup lang="ts">
// @ts-nocheck
import { iconFor } from './mobileIcons';

defineProps({
  tabs: { type: Array, default: () => [] },
});
const emit = defineEmits(['select']);

function onSelect(event, tab) {
  emit('select', { event, tab });
}
</script>

<template>
  <nav
    class="sf-mobile-glass fixed inset-x-0 bottom-0 z-50 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
    aria-label="Navegación principal"
  >
    <ul class="mx-auto flex h-14 max-w-lg items-stretch justify-around px-1">
      <li
        v-for="tab in tabs"
        :key="tab.key"
        class="flex flex-1 items-stretch"
        :class="tab.kind === 'fab' ? 'relative' : ''"
      >
        <!-- Centre action button -->
        <button
          v-if="tab.kind === 'fab'"
          type="button"
          class="mx-auto -mt-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-contrast shadow-lg shadow-primary/30 transition active:scale-95"
          :aria-label="tab.label"
          @click="onSelect($event, tab)"
        >
          <component :is="iconFor(tab.iconName)" class="h-6 w-6" aria-hidden="true" />
        </button>

        <!-- Sheet-opening tab -->
        <button
          v-else-if="tab.kind === 'sheet'"
          type="button"
          class="flex w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition"
          :class="tab.active ? 'text-primary' : 'text-soft active:text-text'"
          :aria-expanded="tab.active ? 'true' : 'false'"
          @click="onSelect($event, tab)"
        >
          <component
            :is="iconFor(tab.iconName)"
            class="h-5 w-5"
            :stroke-width="tab.active ? 2.4 : 2"
            aria-hidden="true"
          />
          <span :class="tab.active ? 'font-bold' : ''">{{ tab.label }}</span>
        </button>

        <!-- Navigating tab -->
        <a
          v-else
          :href="tab.href"
          class="flex w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition"
          :class="tab.active ? 'text-primary' : 'text-soft active:text-text'"
          :aria-current="tab.active ? 'page' : undefined"
          @click="onSelect($event, tab)"
        >
          <component
            :is="iconFor(tab.iconName)"
            class="h-5 w-5"
            :stroke-width="tab.active ? 2.4 : 2"
            aria-hidden="true"
          />
          <span :class="tab.active ? 'font-bold' : ''">{{ tab.label }}</span>
        </a>
      </li>
    </ul>
  </nav>
</template>
