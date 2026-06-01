import { createRouter, createWebHistory } from 'vue-router';
import DashboardPage from '../pages/DashboardPage.vue';
import BillingPage from '../pages/BillingPage.vue';
import SettingsPage from '../pages/SettingsPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardPage },
    { path: '/billing', name: 'billing', component: BillingPage },
    { path: '/settings', name: 'settings', component: SettingsPage }
  ]
});
