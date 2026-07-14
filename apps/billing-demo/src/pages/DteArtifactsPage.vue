<script setup lang="ts">
import { DteArtifactsPage } from '@stelfaro/billing';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const initialArtifactType = computed(() => route.params.artifactSlug === 'eventos' ? 'events' : 'dte');
</script>

<template>
  <DteArtifactsPage core-base-url="/api/v1" :auth-token="auth.token" :initial-artifact-type="initialArtifactType" />
</template>
