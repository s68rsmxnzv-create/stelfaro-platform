<script setup lang="ts">
const apps = [
  { name: 'Taller', status: 'Disponible', scope: 'Operacion vertical', route: '/taller', tenants: 1 },
  { name: 'Facturacion libre', status: 'Disponible', scope: 'Fiscal independiente', route: '/facturacion', tenants: 1 },
  { name: 'Clinica', status: 'Futuro', scope: 'Operacion vertical', route: '/clinica', tenants: 0 },
  { name: 'Laboratorio', status: 'Futuro', scope: 'Operacion vertical', route: '/laboratorio', tenants: 0 }
];
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-muted">Plataforma</p>
      <h1 class="mt-1 text-2xl font-semibold text-text">Apps contratadas</h1>
      <p class="mt-2 max-w-3xl text-sm text-muted">
        Catalogo de apps que pueden asignarse a cada tenant. Aqui se gobierna acceso global, no la operacion diaria del tenant.
      </p>
    </div>

    <div class="overflow-hidden rounded-lg border border-line bg-surface">
      <table class="min-w-full divide-y divide-line text-sm">
        <thead class="bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-3">App</th>
            <th class="px-4 py-3">Alcance</th>
            <th class="px-4 py-3">Host</th>
            <th class="px-4 py-3">Tenants</th>
            <th class="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="app in apps" :key="app.name">
            <td class="px-4 py-3 font-medium text-text">{{ app.name }}</td>
            <td class="px-4 py-3 text-muted">{{ app.scope }}</td>
            <td class="px-4 py-3 font-mono text-xs text-muted">{{ app.route }}</td>
            <td class="px-4 py-3 text-muted">{{ app.tenants }}</td>
            <td class="px-4 py-3">
              <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="app.status === 'Disponible' ? 'bg-success-soft text-success' : 'bg-surface-muted text-muted'">
                {{ app.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
