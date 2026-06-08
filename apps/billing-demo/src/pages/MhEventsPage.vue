<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { MhEventsPage } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const eventTypeBySlug: Record<string, string> = {
  invalidacion: 'invalidacion',
  contingencia: 'contingencia',
  retorno: 'retorno',
  'operaciones-especiales': 'operaciones_especiales'
};
const initialEventType = computed(() => eventTypeBySlug[String(route.params.eventSlug ?? 'invalidacion')] ?? 'invalidacion');
</script>

<template>
  <MhEventsPage core-base-url="/api/v1" :auth-token="auth.token" :initial-event-type="initialEventType" />
</template>
