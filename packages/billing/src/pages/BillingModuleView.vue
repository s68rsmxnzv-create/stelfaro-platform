<script setup lang="ts">
// @ts-nocheck
import { computed } from 'vue';
import type { DocumentType } from '@stelfaro/shared';
import BillingSettingsPage from './BillingSettingsPage.vue';
import BillingWorkspace from './BillingWorkspace.vue';
import DteArtifactsPage from './DteArtifactsPage.vue';
import MhEventResponsesPage from './MhEventResponsesPage.vue';
import MhEventsPage from './MhEventsPage.vue';
import MhResponsesPage from './MhResponsesPage.vue';

const props = defineProps({
  authToken: {
    type: String,
    default: null
  },
  coreBaseUrl: {
    type: String,
    default: '/api/v1'
  },
  module: {
    type: String,
    default: 'billing'
  },
  documentSlug: {
    type: String,
    default: 'fe'
  },
  eventSlug: {
    type: String,
    default: 'invalidacion'
  }
});

const documentTypeBySlug: Record<string, DocumentType> = {
  fe: '01',
  ccf: '03',
  nc: '05',
  nd: '06',
  se: '14'
};
const eventTypeBySlug = {
  invalidacion: 'invalidacion',
  contingencia: 'contingencia',
  retorno: 'retorno',
  'operaciones-especiales': 'operaciones_especiales'
};
const moduleComponents = {
  billing: BillingWorkspace,
  artifacts: DteArtifactsPage,
  'mh-events': MhEventsPage,
  'mh-responses': MhResponsesPage,
  'mh-event-responses': MhEventResponsesPage,
  settings: BillingSettingsPage
};

const selectedComponent = computed(() => moduleComponents[props.module] || BillingWorkspace);
const selectedDocumentType = computed(() => documentTypeBySlug[props.documentSlug] || '01');
const selectedEventType = computed(() => eventTypeBySlug[props.eventSlug] || 'invalidacion');
const selectedComponentProps = computed(() => {
  const baseProps = {
    authToken: props.authToken,
    coreBaseUrl: props.coreBaseUrl
  };

  if (props.module === 'billing') {
    return {
      ...baseProps,
      initialDocumentType: selectedDocumentType.value
    };
  }

  if (props.module === 'mh-events') {
    return {
      ...baseProps,
      initialEventType: selectedEventType.value
    };
  }

  return baseProps;
});
</script>

<template>
  <div>
    <div v-if="!authToken" class="rounded-md border border-red-200 bg-red-50 p-5 text-red-700">
      No fue posible abrir la sesion fiscal.
    </div>
    <component
      :is="selectedComponent"
      v-else
      v-bind="selectedComponentProps"
    />
  </div>
</template>
