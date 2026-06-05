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

## Producción

`billing.stelfaro.com` debe servir el build estático de:

```text
/var/www/stelfaro-platform/apps/billing-demo/dist
```

El frontend consume `/api/v1` en el mismo origen. Nginx enruta `/api/*` hacia Core DTE en:

```text
https://dte.stelfaro.me/api/*
```

Así el subdominio de billing no depende de Vite ni de servidores locales levantados a mano.

La configuración versionada de Nginx queda en:

```text
ops/nginx/billing.stelfaro.com.conf
```

## Desarrollo local opcional

```bash
npx pnpm@9.15.4 install
npx pnpm@9.15.4 --filter @stelfaro/billing-demo dev
```

La app de desarrollo usa proxy de Vite contra el Core DTE publicado en:

```text
https://dte.stelfaro.me/api/v1
```
