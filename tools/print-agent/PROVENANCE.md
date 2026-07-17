# Procedencia y estado

Base importada en modo lectura desde `fiscal-import/tools/print-agent` el 17 de julio de 2026.

Artefacto original analizado:

- Archivo: `stelfaro-print-agent-0.1.0.zip`
- SHA-256: `03ecc45ff3464f26507f4d9d223f86862a77eefa0dcb54d1ea2252e13329a8da`
- Tamaño aproximado: 43 MB

La carpeta `dist/` no se versiona. Los ejecutables deben generarse desde este código fuente y publicarse como artefactos verificables.

## Cambios iniciales de seguridad

- Restricción de orígenes permitidos.
- Límite de tamaño y cantidad de operaciones por trabajo.
- Nombre de impresora transportado a PowerShell mediante Base64 para evitar interpolación.
- Cabecera `X-Content-Type-Options: nosniff`.

Pendiente antes de producción: emparejamiento por terminal con token rotatorio, firma del ejecutable, instalador versionado, actualización segura y auditoría local sin almacenar contenido sensible del ticket.
