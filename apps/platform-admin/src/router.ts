import { createRouter, createWebHistory } from 'vue-router';
import AdminHomePage from './pages/AdminHomePage.vue';
import AuditPage from './pages/AuditPage.vue';
import FiscalCompaniesPage from './pages/FiscalCompaniesPage.vue';
import FiscalOnboardingPage from './pages/FiscalOnboardingPage.vue';
import FiscalCalendarPage from './pages/FiscalCalendarPage.vue';
import MailTransportPage from './pages/MailTransportPage.vue';
import SenderAliasesPage from './pages/SenderAliasesPage.vue';
import SubscriptionsPage from './pages/SubscriptionsPage.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: AdminHomePage },
    { path: '/users', redirect: '/empresas' },
    { path: '/empresas', name: 'companies', component: FiscalCompaniesPage },
    { path: '/tenants', redirect: '/empresas' },
    { path: '/subscriptions', name: 'subscriptions', component: SubscriptionsPage },
    { path: '/audit', name: 'audit', component: AuditPage },
    { path: '/fiscal', redirect: '/empresas' },
    { path: '/fiscal/onboarding', name: 'fiscal-onboarding', component: FiscalOnboardingPage },
    { path: '/fiscal/calendar', name: 'fiscal-calendar', component: FiscalCalendarPage },
    { path: '/notifications/sender-aliases', name: 'sender-aliases', component: SenderAliasesPage },
    { path: '/notifications/mail-transport', name: 'mail-transport', component: MailTransportPage },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});
