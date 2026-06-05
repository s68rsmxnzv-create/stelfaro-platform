<script setup lang="ts">
import { BillingWorkspace } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <BillingWorkspace core-base-url="/api/v1" :auth-token="auth.token" initial-document-type="01" />
</template>
