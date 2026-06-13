<script setup lang="ts">
import { DteArtifactsPage } from '@stelfaro/billing';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <DteArtifactsPage core-base-url="/api/v1" :auth-token="auth.token" />
</template>
