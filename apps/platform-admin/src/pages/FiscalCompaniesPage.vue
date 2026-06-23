<script setup lang="ts">
import { computed } from 'vue';
import { BillingProcessToastOverlay, BillingSettingsPage } from '@stelfaro/billing';
import CompanySubscriptionPanel from './CompanySubscriptionPanel.vue';
import CompanyUsersPanel from './CompanyUsersPanel.vue';
import { useCoreSessionStore } from '../stores/coreSession';
import { useAdminWorkspaceStore } from '../stores/adminWorkspace';
import { usePlatformSessionStore } from '../stores/platformSession';

const core = useCoreSessionStore();
const workspace = useAdminWorkspaceStore();
const platform = usePlatformSessionStore();

type BillingCompanyAction = {
  action: 'summary' | 'edit' | 'edit-data' | 'edit-fiscal' | 'edit-sucursales' | 'edit-correlativos' | 'toggle-status' | 'delete';
  nonce: number;
};

const billingCompanyAction = computed<BillingCompanyAction | null>(() => {
  if (!workspace.companyActionRequest || workspace.companyActionRequest.action === 'users') {
    return null;
  }

  return workspace.companyActionRequest as BillingCompanyAction;
});
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <CompanyUsersPanel
      v-if="workspace.activeCompanyView === 'users' && workspace.selectedCompany"
      :company="workspace.selectedCompany"
    />

    <CompanySubscriptionPanel
      v-else-if="workspace.activeCompanyView === 'subscription' && workspace.selectedCompany"
      :company="workspace.selectedCompany"
    />

    <BillingSettingsPage
      v-else
      :core-base-url="core.baseUrl"
      platform-base-url="/api/v1"
      request-credentials="include"
      :detail-mode="workspace.companyDetailMode"
      :always-show-company-search="platform.canAccessAdmin"
      :company-action="billingCompanyAction"
      @company-selected="workspace.focusCompany"
      @company-cleared="workspace.clearCompany"
      @company-view-changed="workspace.setCompanyView"
    />

    <BillingProcessToastOverlay
      :open="!core.isConnected"
      :variant="core.lastError ? 'error' : 'loading'"
      :title="core.lastError ? 'No fue posible conectar con el core fiscal' : 'Conectando con el core fiscal'"
      :message="core.lastError || 'Preparando empresas fiscales y permisos administrativos.'"
    />
  </section>
</template>
