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
- `apps/platform-admin`: panel interno de administracion de plataforma para operaciones Stelfaro.

## Packages

- `packages/api-client`: cliente HTTP para Core DTE.
- `packages/billing`: modulo reusable de facturacion.
- `packages/ui`: componentes base reutilizables.
- `packages/shared`: tipos y utilidades compartidas.

## Producción

La plataforma desplegada se sirve únicamente desde:

```text
https://new.stelfaro.com/
/var/www/stelfaro-platform-api/public
```

El panel administrativo se publica bajo el mismo origen:

```text
https://new.stelfaro.com/administracion/
/var/www/stelfaro-platform-api/public/administracion
```

El frontend consume `/api/v1` en el mismo origen. Nginx enruta `/api/*` hacia Core DTE por el listener interno:

```text
http://127.0.0.1:8181/api/*
```

`apps/billing-demo` queda únicamente como aplicación de desarrollo local; no tiene un subdominio de producción.

La configuración versionada de Nginx queda en:

```text
ops/nginx/new.stelfaro.com.conf
```

## Desarrollo local opcional

```bash
npx pnpm@9.15.4 install
npx pnpm@9.15.4 --filter @stelfaro/billing-demo dev
npx pnpm@9.15.4 --filter @stelfaro/platform-admin dev
```

La app de desarrollo usa proxy de Vite contra el Core DTE interno:

```text
http://127.0.0.1:8181/api/v1
```

El panel administrativo consume `stelfaro-notifications` desde `VITE_NOTIFICATIONS_API_BASE_URL` o, en desarrollo, desde `/notifications-api/v1`.
