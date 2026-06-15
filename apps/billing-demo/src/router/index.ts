import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../pages/DashboardPage.vue';
import BillingPage from '../pages/BillingPage.vue';
import DteArtifactsPage from '../pages/DteArtifactsPage.vue';
import MhEventsPage from '../pages/MhEventsPage.vue';
import MhResponsesPage from '../pages/MhResponsesPage.vue';
import MhEventResponsesPage from '../pages/MhEventResponsesPage.vue';
import SettingsPage from '../pages/SettingsPage.vue';
import OnboardingPage from '../pages/OnboardingPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import { useAuthStore } from '../stores/auth';

const billingSlugs = new Set(['fe', 'ccf', 'nc', 'nd', 'se']);
const eventSlugs = new Set(['invalidacion', 'contingencia', 'retorno', 'operaciones-especiales']);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { public: true } },
    { path: '/', name: 'dashboard', component: DashboardPage, meta: { requiresAuth: true } },
    { path: '/onboarding', name: 'onboarding', component: OnboardingPage, meta: { requiresAuth: true, requiresBackoffice: true } },
    { path: '/companies', name: 'companies', component: SettingsPage, meta: { requiresAuth: true, requiresFiscalSettings: true } },
    { path: '/billing', redirect: '/billing/fe' },
    { path: '/billing/:documentSlug', name: 'billing', component: BillingPage, meta: { requiresAuth: true, requiresBilling: true } },
    { path: '/comprobantes', name: 'comprobantes', component: DteArtifactsPage, meta: { requiresAuth: true, requiresBilling: true } },
    { path: '/mh-events', redirect: '/mh-events/invalidacion' },
    { path: '/mh-events/:eventSlug', name: 'mh-events', component: MhEventsPage, meta: { requiresAuth: true, requiresBilling: true } },
    { path: '/mh-responses', name: 'mh-responses', component: MhResponsesPage, meta: { requiresAuth: true, requiresBilling: true } },
    { path: '/mh-event-responses', name: 'mh-event-responses', component: MhEventResponsesPage, meta: { requiresAuth: true, requiresBilling: true } },
    { path: '/settings', redirect: '/companies' }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();

  if (to.meta.public) {
    return auth.isAuthenticated ? { path: auth.isBackoffice ? '/companies' : '/billing/fe' } : true;
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    auth.setIntendedPath(to.fullPath);
    return { path: '/login' };
  }

  if (to.meta.requiresBackoffice && !auth.isBackoffice) {
    return { path: '/billing/fe' };
  }

  if (to.meta.requiresFiscalSettings && !auth.canManageFiscalSettings) {
    return { path: '/billing/fe' };
  }

  if (to.meta.requiresBilling && auth.isBackoffice) {
    return { path: '/companies' };
  }

  if (to.name === 'billing') {
    const documentSlug = String(to.params.documentSlug ?? '');
    if (!billingSlugs.has(documentSlug)) {
      return { path: '/billing/fe' };
    }
  }

  if (to.name === 'mh-events') {
    const eventSlug = String(to.params.eventSlug ?? '');
    if (!eventSlugs.has(eventSlug)) {
      return { path: '/mh-events/invalidacion' };
    }
  }

  return true;
});
