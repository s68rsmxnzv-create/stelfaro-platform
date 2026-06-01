# Stelfaro Platform

Frontend modular para facturacion reutilizable y futuras apps verticales como servicio tecnico, restaurante y retail.

## Stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Pinia
- Vue Router
- pnpm workspaces

## Apps

- `apps/billing-demo`: app ejecutable para desarrollar y probar el modulo transversal de facturacion.

## Packages

- `packages/api-client`: cliente HTTP para Core DTE.
- `packages/billing`: modulo reusable de facturacion.
- `packages/ui`: componentes base reutilizables.
- `packages/shared`: tipos y utilidades compartidas.

## Desarrollo

```bash
npx pnpm@9.15.4 install
npx pnpm@9.15.4 --filter @stelfaro/billing-demo dev
```

La app de desarrollo usa proxy de Vite y espera que Core DTE este disponible en:

```text
http://127.0.0.1:8000/api/v1
```
