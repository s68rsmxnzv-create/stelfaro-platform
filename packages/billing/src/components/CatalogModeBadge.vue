<script setup lang="ts">
import { UiStatusBadge } from '@stelfaro/ui';

defineProps<{
  controlsInventory: boolean;
}>();
</script>

<template>
  <UiStatusBadge :tone="controlsInventory ? 'success' : 'info'">
    {{ controlsInventory ? 'Inventario' : 'Catálogo' }}
  </UiStatusBadge>
</template>
