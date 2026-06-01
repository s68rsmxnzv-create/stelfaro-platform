<script setup lang="ts">
const nav = [
  { label: 'Dashboard', to: '/' },
  { label: 'Facturacion', to: '/billing' }
];
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-950">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 lg:block">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Stelfaro</p>
        <h1 class="mt-2 text-xl font-bold">Billing Platform</h1>
      </div>
      <nav class="mt-8 space-y-2">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          active-class="bg-sky-50 text-sky-700"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <main class="lg:pl-64">
      <header class="border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500">Modulo transversal reusable</p>
            <p class="font-semibold">Core DTE + Billing</p>
          </div>
          <RouterLink to="/billing" class="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Nueva factura
          </RouterLink>
        </div>
      </header>
      <div class="px-5 py-6 lg:px-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
