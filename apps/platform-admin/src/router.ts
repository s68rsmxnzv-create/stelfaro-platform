import { createRouter, createWebHistory } from 'vue-router';
import SenderAliasesPage from './pages/SenderAliasesPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/notifications/sender-aliases' },
    { path: '/notifications/sender-aliases', name: 'sender-aliases', component: SenderAliasesPage },
    { path: '/:pathMatch(.*)*', redirect: '/notifications/sender-aliases' }
  ]
});
