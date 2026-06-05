<script setup lang="ts">
import { MhResponsesPage } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <MhResponsesPage core-base-url="/api/v1" :auth-token="auth.token" />
</template>
