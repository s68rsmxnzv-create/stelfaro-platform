<script setup lang="ts">
import { BillingOnboardingPage } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <BillingOnboardingPage core-base-url="/api/v1" :auth-token="auth.token" />
</template>
