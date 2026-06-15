import { createRouter, createWebHistory } from 'vue-router';
import MailTransportPage from './pages/MailTransportPage.vue';
import SenderAliasesPage from './pages/SenderAliasesPage.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/notifications/sender-aliases' },
    { path: '/notifications/sender-aliases', name: 'sender-aliases', component: SenderAliasesPage },
    { path: '/notifications/mail-transport', name: 'mail-transport', component: MailTransportPage },
    { path: '/:pathMatch(.*)*', redirect: '/notifications/sender-aliases' }
  ]
});
