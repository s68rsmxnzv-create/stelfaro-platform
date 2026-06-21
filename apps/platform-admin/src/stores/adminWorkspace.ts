import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export type SelectedAdminCompany = {
  id: number;
  name: string;
  tradeName: string;
  documentLabel: string;
  lifecycleStatus: 'active' | 'inactive' | string;
};

export type AdminCompanyAction = 'edit' | 'edit-data' | 'edit-fiscal' | 'edit-sucursales' | 'edit-correlativos' | 'users' | 'toggle-status' | 'delete';
export type AdminCompanyView = 'summary' | 'data' | 'fiscal' | 'sucursales' | 'correlativos' | 'users';

export const useAdminWorkspaceStore = defineStore('admin-workspace', () => {
  const selectedCompany = ref<SelectedAdminCompany | null>(null);
  const companyDetailMode = ref(false);
  const companyEditMode = ref(false);
  const activeCompanyView = ref<AdminCompanyView>('summary');
  const companyActionRequest = ref<{ action: AdminCompanyAction; nonce: number } | null>(null);

  const hasCompanyDetail = computed(() => Boolean(selectedCompany.value && companyDetailMode.value));

  function focusCompany(company: SelectedAdminCompany): void {
    selectedCompany.value = company;
    companyDetailMode.value = true;
  }

  function showCompanySearch(): void {
    companyDetailMode.value = false;
    companyEditMode.value = false;
    activeCompanyView.value = 'summary';
  }

  function clearCompany(): void {
    selectedCompany.value = null;
    companyDetailMode.value = false;
    companyEditMode.value = false;
    activeCompanyView.value = 'summary';
    companyActionRequest.value = null;
  }

  function requestCompanyAction(action: AdminCompanyAction): void {
    if (action === 'edit' || action === 'edit-data' || action === 'edit-fiscal' || action === 'edit-sucursales' || action === 'edit-correlativos') {
      companyEditMode.value = true;
    }

    if (action === 'edit' || action === 'edit-data') {
      activeCompanyView.value = 'data';
    }

    if (action === 'edit-fiscal') {
      activeCompanyView.value = 'fiscal';
    }

    if (action === 'edit-sucursales') {
      activeCompanyView.value = 'sucursales';
    }

    if (action === 'edit-correlativos') {
      activeCompanyView.value = 'correlativos';
    }

    if (action === 'users') {
      companyEditMode.value = false;
      activeCompanyView.value = 'users';
    }

    companyActionRequest.value = {
      action,
      nonce: Date.now()
    };
  }

  function setCompanyView(view: AdminCompanyView): void {
    activeCompanyView.value = view;
    companyEditMode.value = view !== 'summary';
  }

  return {
    selectedCompany,
    companyDetailMode,
    companyEditMode,
    activeCompanyView,
    companyActionRequest,
    hasCompanyDetail,
    focusCompany,
    showCompanySearch,
    clearCompany,
    requestCompanyAction,
    setCompanyView
  };
});
