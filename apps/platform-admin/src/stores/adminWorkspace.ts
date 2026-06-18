import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export type SelectedAdminCompany = {
  id: number;
  name: string;
  tradeName: string;
  documentLabel: string;
  lifecycleStatus: 'active' | 'inactive' | string;
};

export type AdminCompanyAction = 'edit' | 'edit-data' | 'edit-fiscal' | 'toggle-status' | 'delete';

export const useAdminWorkspaceStore = defineStore('admin-workspace', () => {
  const selectedCompany = ref<SelectedAdminCompany | null>(null);
  const companyDetailMode = ref(false);
  const companyEditMode = ref(false);
  const companyActionRequest = ref<{ action: AdminCompanyAction; nonce: number } | null>(null);

  const hasCompanyDetail = computed(() => Boolean(selectedCompany.value && companyDetailMode.value));

  function focusCompany(company: SelectedAdminCompany): void {
    selectedCompany.value = company;
    companyDetailMode.value = true;
  }

  function showCompanySearch(): void {
    companyDetailMode.value = false;
    companyEditMode.value = false;
  }

  function clearCompany(): void {
    selectedCompany.value = null;
    companyDetailMode.value = false;
    companyEditMode.value = false;
    companyActionRequest.value = null;
  }

  function requestCompanyAction(action: AdminCompanyAction): void {
    if (action === 'edit' || action === 'edit-data' || action === 'edit-fiscal') {
      companyEditMode.value = true;
    }

    companyActionRequest.value = {
      action,
      nonce: Date.now()
    };
  }

  return {
    selectedCompany,
    companyDetailMode,
    companyEditMode,
    companyActionRequest,
    hasCompanyDetail,
    focusCompany,
    showCompanySearch,
    clearCompany,
    requestCompanyAction
  };
});
