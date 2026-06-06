<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { BillingWorkspace } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
type SupportedDocumentType = '01' | '03' | '05' | '06';
const documentTypeBySlug: Record<string, SupportedDocumentType> = {
  fe: '01',
  ccf: '03',
  nc: '05',
  nd: '06'
};
const initialDocumentType = computed<SupportedDocumentType>(() => documentTypeBySlug[String(route.params.documentSlug ?? 'fe')] ?? '01');
</script>

<template>
  <BillingWorkspace core-base-url="/api/v1" :auth-token="auth.token" :initial-document-type="initialDocumentType" />
</template>
