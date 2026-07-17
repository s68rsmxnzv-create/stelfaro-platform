# Plan de implementación

## Principios

- El agente es transporte local de impresión; no contiene lógica fiscal ni de Taller.
- El contrato HTTP y ESC/POS debe mantenerse compatible con la versión `0.1.0` actualmente instalada.
- Windows, Linux y Android deben exponer el mismo contrato mínimo: `/health`, `/printers` y `/print`.
- Cada cambio de fuente, instalador o contrato se versiona y genera un artefacto con SHA-256.
- Los trabajos deben ser idempotentes para evitar tickets duplicados durante reintentos.

## Etapas

### 1. Configuración por terminal

- Configuración en `localStorage` con esquema versionado.
- Estado del agente, detección de impresoras y prueba real.
- Preferencias de papel, QR, corte y gaveta.

### 2. Cliente web compartido

- Adaptador único para comprobar, imprimir y clasificar errores.
- Cola corta de reintentos y confirmación inequívoca de impresión.
- Contratos de ticket: recepción, orden cerrada, DTE y copia.

### 3. Seguridad y emparejamiento

- Token rotatorio por terminal.
- Orígenes permitidos configurables.
- Límites de trabajos y operaciones.
- Identificador de trabajo para deduplicación.

### 4. Distribución Windows

- Build reproducible del EXE.
- Firma de código.
- Instalador versionado y actualización segura.
- Publicación de ZIP y manifiesto de hashes desde la plataforma.

### 5. Android

- Verificar el proyecto/agente existente.
- Mantener el mismo contrato HTTP o crear un adaptador compatible.
- Detectar impresoras Bluetooth, USB y de red.
- Probar restricciones de WebView, CORS y ejecución en segundo plano.

## Compatibilidad

Los endpoints compatibles con Parzibyte (`/impresoras` y `/imprimir`) se conservarán mientras existan instalaciones anteriores que los consuman. Las nuevas aplicaciones usarán el contrato nativo en inglés.
