@echo off
curl -s -X POST http://localhost:8711/imprimir ^
  -H "Content-Type: application/json" ^
  -d "{\"serial\":\"\",\"nombreImpresora\":\"Termica\",\"operaciones\":[{\"nombre\":\"EscribirTexto\",\"argumentos\":[\"Hola impresora desde Stelfaro Print Agent\n\"]},{\"nombre\":\"Corte\",\"argumentos\":[6]}]}"
echo.
