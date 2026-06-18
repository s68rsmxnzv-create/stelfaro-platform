<script setup lang="ts">
import { BillingSettingsPage } from '@stelfaro/billing';
import { UiLoadingMark } from '@stelfaro/ui';
import { useCoreSessionStore } from '../stores/coreSession';
import { useAdminWorkspaceStore } from '../stores/adminWorkspace';
import { usePlatformSessionStore } from '../stores/platformSession';

const core = useCoreSessionStore();
const workspace = useAdminWorkspaceStore();
const platform = usePlatformSessionStore();
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div v-if="!core.isConnected" class="rounded-lg border border-slate-200 bg-white p-5">
      <UiLoadingMark label="Conectando con el core fiscal" />
      <p v-if="core.lastError" class="mx-auto -mt-8 max-w-xl rounded-md bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
        {{ core.lastError }}
      </p>
    </div>

    <BillingSettingsPage
      v-else
      :core-base-url="core.baseUrl"
      request-credentials="include"
      :detail-mode="workspace.companyDetailMode"
      :always-show-company-search="platform.canAccessAdmin"
      :company-action="workspace.companyActionRequest"
      @company-selected="workspace.focusCompany"
      @company-cleared="workspace.clearCompany"
    />
  </section>
</template>
