<script setup lang="ts">
import { MhEventResponsesPage } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <MhEventResponsesPage core-base-url="/api/v1" :auth-token="auth.token" />
</template>
