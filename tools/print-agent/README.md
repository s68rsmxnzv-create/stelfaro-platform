# Stelfaro Print Agent

Agente local para imprimir ESC/POS desde aplicaciones web.

## Uso

Windows recomendado:

```bat
cd C:\print-agent
install-service.cmd
```

Luego verificar:

```bat
service-status.cmd
```

Si recibiste el paquete Windows completo, extráelo y ejecuta:

```bat
install-windows.cmd
```

El instalador solicitará permisos de administrador, copiará los archivos a
`C:\print-agent` y registrará el agente como servicio automático.

Inicio manual simple:

```bat
start-windows.cmd
```

Prueba sin imprimir:

```bat
start-windows-dry-run.cmd
```

Prueba de impresión:

```bat
print-test-windows.cmd
```

Si tienes el ejecutable empaquetado:

```bat
stelfaro-print-agent.exe
```

El `.exe` es un agente portable, no un instalador. Al ejecutarlo directamente
debe permanecer activo y mostrar que escucha en `http://localhost:8711`. Para
instalarlo con inicio automático, descarga el paquete Windows completo, extráelo
y sigue `INSTALL_WINDOWS.md`.

También puedes usar:

```bat
start-agent-exe.cmd
```

Ver `TESTING.md` para el checklist completo de pruebas.
Ver `INSTALL_WINDOWS.md` para instalación como servicio de Windows o tarea de inicio.

Linux/macOS:

```bash
cd tools/print-agent
npm start
```

Por defecto escucha en:

```text
http://localhost:8711
```

Endpoints:

- `GET /health`
- `GET /printers`
- `GET /impresoras` compatible con pruebas estilo Parzibyte
- `POST /print`
- `POST /imprimir` compatible con payload estilo Parzibyte

Variables:

- `PRINT_AGENT_PORT=8711`
- `PRINT_AGENT_PRINTERS=Termica,Otra` para fallback manual
- `PRINT_AGENT_DRY_RUN=1` para no enviar a impresora
- `PRINT_AGENT_ALLOWED_ORIGINS=https://platform.stelfaro.com,https://stelfaro.com,https://app.stelfaro.com`
- `PRINT_AGENT_MAX_BODY_BYTES=5242880` para limitar cada trabajo

Las solicitudes web se aceptan únicamente desde los orígenes configurados. Las herramientas locales sin cabecera `Origin`, como PowerShell o `curl`, continúan funcionando para diagnóstico.

La primera versión usa comandos del sistema:

- Windows: PowerShell `Get-CimInstance Win32_Printer` y spooler RAW `winspool.drv`
- Linux/macOS: `lpstat` y `lp`

## Empaquetar EXE

Desde Linux o Windows con Node instalado:

```bash
cd tools/print-agent
npm run package:win
```

Salida:

```text
tools/print-agent/dist/stelfaro-print-agent.exe
```

## Operaciones soportadas

El agente cancela automáticamente el modo chino/Kanji y selecciona la tabla
ESC/POS PC850 al iniciar cada trabajo. Esto permite imprimir correctamente
tildes, `ñ`, signos de apertura y otros caracteres usados en español, incluso
en impresoras cuyo self-test indica `Chinese character: Yes`.

Formato nativo:

```json
{
  "printer": "Termica",
  "operations": [
    { "name": "align", "args": ["center"] },
    { "name": "bold", "args": [true] },
    { "name": "size", "args": [2, 2] },
    { "name": "text", "args": ["Fiscal Import\n"] },
    { "name": "size", "args": [1, 1] },
    { "name": "bold", "args": [false] },
    { "name": "qr", "args": ["https://example.com", 280, 1, 0] },
    { "name": "openDrawer", "args": [0, 25, 250] },
    { "name": "cut", "args": [6] }
  ]
}
```

Formato compatible con Parzibyte:

```json
{
  "serial": "",
  "nombreImpresora": "Termica",
  "operaciones": [
    { "nombre": "EscribirTexto", "argumentos": ["Hola\n"] },
    { "nombre": "AbrirCajon", "argumentos": [0, 25, 250] },
    { "nombre": "Corte", "argumentos": [6] }
  ]
}
```

Gaveta/cajon de cobro:

```json
{ "name": "openDrawer", "args": [0, 25, 250] }
```

El primer argumento es el pin/conector de la impresora (`0` o `1`). Los otros dos son tiempos de pulso ESC/POS.
