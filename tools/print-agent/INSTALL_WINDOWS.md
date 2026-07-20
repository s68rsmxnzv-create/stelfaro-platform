# Instalación en Windows

Esta versión puede instalarse de dos formas:

1. Como servicio de Windows real. Recomendado.
2. Como tarea de inicio de sesión. Compatibilidad rápida.

## Instalación automática recomendada

Extrae el paquete Windows completo y abre `install-windows.cmd`. El script
solicita permisos de administrador, copia los archivos a `C:\print-agent`,
instala el servicio y lo inicia. Al terminar verifica:

```text
http://localhost:8711/health
```

## 1. Copiar carpeta

Copiar la carpeta `print-agent` a:

```text
C:\print-agent
```

Debe contener al menos:

```text
dist\stelfaro-print-agent.exe
install-service.cmd
uninstall-service.cmd
start-service.cmd
stop-service.cmd
service-status.cmd
stelfaro-print-agent-service.xml
```

## 2. Instalar como servicio de Windows

Abrir CMD o PowerShell como Administrador en `C:\print-agent` y ejecutar:

```bat
install-service.cmd
```

Esto instala el servicio:

```text
Stelfaro Print Agent
```

Arranca automáticamente con Windows, sin depender del login.

## 3. Verificar

```bat
service-status.cmd
```

Y revisar:

```text
http://localhost:8711/health
```

## 4. Iniciar o detener manualmente

```bat
start-service.cmd
stop-service.cmd
```

## 5. Desinstalar servicio

```bat
uninstall-service.cmd
```

## Opción alternativa: tarea de inicio de sesión

Si por alguna razón no puedes instalar el servicio, puedes usar:

```bat
install-startup-task.cmd
```

Eso crea una tarea de Windows que arranca cuando el usuario inicia sesión.

## Nota importante

Cuando se usa como servicio, la impresora debe estar instalada de forma disponible para el sistema, no solo para una sesión temporal del usuario. Si el servicio inicia pero no lista la impresora correcta, revisa eso primero.
