# Pruebas rápidas en Windows

## 1. Instalar como servicio

```bat
cd C:\print-agent
install-service.cmd
```

Debe instalar e iniciar el servicio.

## 2. Verificar desde navegador

Abrir:

```text
http://localhost:8711/health
http://localhost:8711/printers
```

## 3. Revisar estado del servicio

```powershell
cd C:\print-agent
.\service-status.cmd
```

## 4. Prueba desde PowerShell

```powershell
cd C:\print-agent
.\print-test-windows.cmd
```

Debe imprimir texto y cortar.

## 5. Prueba desde Fiscal Import

1. Abrir `Laboratorio impresión`.
2. Confirmar URL: `http://localhost:8711`.
3. Presionar `Buscar`.
4. Seleccionar `Termica`.
5. Probar:
   - `Probar formatos`
   - cargar logo
   - `Imprimir ticket`

## 6. Si el agente no abre

Revisar si otro proceso usa el puerto:

```powershell
netstat -ano | findstr :8711
```

## 7. Si no imprime en RAW

Confirmar que la respuesta indique:

```json
"backend":"windows-raw-spooler"
```
