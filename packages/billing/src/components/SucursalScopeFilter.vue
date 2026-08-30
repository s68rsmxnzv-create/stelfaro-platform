<script setup lang="ts">
import { PlatformClient, type PlatformFiscalSucursal } from '@stelfaro/api-client';
import { UiSelect } from '@stelfaro/ui';
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{
  tenantId: number;
  platformBaseUrl?: string;
  modelValue?: number | null;
}>(), {
  platformBaseUrl: '/api/v1',
  modelValue: null,
});

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>();

const sucursales = ref<PlatformFiscalSucursal[]>([]);

onMounted(async () => {
  if (!props.tenantId) return;
  try {
    const scope = await new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' })
      .tenantFiscalScope(props.tenantId);
    sucursales.value = scope.sucursales ?? [];
  } catch {
    // Sin scope no se muestra el filtro; la página sigue funcionando.
    sucursales.value = [];
  }
});

const options = computed(() => [
  { value: '', label: 'Todas las sucursales' },
  ...sucursales.value.map((sucursal) => ({
    value: String(sucursal.id),
    label: `${sucursal.codigo} · ${sucursal.nombre}`,
  })),
]);

const selected = computed({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (value: string) => emit('update:modelValue', value ? Number(value) : null),
});
</script>

<template>
  <UiSelect
    v-if="sucursales.length > 1"
    v-model="selected"
    label="Sucursal"
    :options="options"
  />
</template>
