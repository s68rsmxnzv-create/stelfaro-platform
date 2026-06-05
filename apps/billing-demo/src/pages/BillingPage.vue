<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { BillingWorkspace } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

type BillingDocumentType = '01' | '03';

const auth = useAuthStore();
const route = useRoute();
const documentType = computed<BillingDocumentType>(() => {
  const tipoDte = route.query.tipoDte;
  return tipoDte === '03' ? '03' : '01';
});
</script>

<template>
  <BillingWorkspace core-base-url="/api/v1" :auth-token="auth.token" :initial-document-type="documentType" />
</template>
