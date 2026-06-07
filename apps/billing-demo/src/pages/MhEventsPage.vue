<script setup lang="ts">
import { MhEventsPage } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <MhEventsPage core-base-url="/api/v1" :auth-token="auth.token" />
</template>
