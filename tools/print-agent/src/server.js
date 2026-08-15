import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const port = Number(process.env.PRINT_AGENT_PORT || 8711);
const dryRun = process.env.PRINT_AGENT_DRY_RUN === '1';
const maxBodyBytes = Number(process.env.PRINT_AGENT_MAX_BODY_BYTES || 5 * 1024 * 1024);
const allowedOrigins = new Set(String(process.env.PRINT_AGENT_ALLOWED_ORIGINS || 'https://new.stelfaro.com,http://localhost:5173,http://localhost:8000').split(',').map((value) => value.trim()).filter(Boolean));
const rawPrinterSource = `
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
`;

function json(req, res, status, payload) {
  const body = JSON.stringify(payload);
  const origin = String(req.headers.origin || '');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, X-Stelfaro-Agent-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function assertAllowedOrigin(req) {
  const origin = String(req.headers.origin || '');
  if (origin && !allowedOrigins.has(origin)) throw Object.assign(new Error('Origen no autorizado.'), { statusCode: 403 });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error('El trabajo de impresión excede el tamaño permitido.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function fallbackPrinters() {
  return String(process.env.PRINT_AGENT_PRINTERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => ({ name, source: 'env' }));
}

async function listPrinters() {
  const fallback = fallbackPrinters();

  try {
    if (process.platform === 'win32') {
      const script = 'Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name';
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { timeout: 5000 });
      const printers = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return printers.length ? printers.map((name) => ({ name, source: 'windows' })) : fallback;
    }

    const { stdout } = await execFileAsync('lpstat', ['-a'], { timeout: 5000 });
    const printers = stdout.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);
    return printers.length ? printers.map((name) => ({ name, source: 'cups' })) : fallback;
  } catch {
    return fallback;
  }
}

function stripDiacritics(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?');
}

export function encodeText(value, codepage = 'cp850') {
  const text = String(value ?? '');
  if (String(codepage).toLowerCase() !== 'cp850') {
    return Buffer.from(stripDiacritics(text), 'ascii');
  }

  const cp850 = new Map([
    ['á', 0xa0], ['í', 0xa1], ['ó', 0xa2], ['ú', 0xa3], ['ñ', 0xa4], ['Ñ', 0xa5],
    ['Á', 0xb5], ['Í', 0xd6], ['Ó', 0xe0], ['Ú', 0xe9], ['é', 0x82], ['É', 0x90],
    ['ü', 0x81], ['Ü', 0x9a], ['ç', 0x87], ['Ç', 0x80], ['¿', 0xa8], ['¡', 0xad], ['°', 0xf8],
  ]);
  const bytes = [];

  for (const char of text) {
    const code = char.codePointAt(0);
    if (cp850.has(char)) {
      bytes.push(cp850.get(char));
    } else if (code <= 0x7f) {
      bytes.push(code);
    } else {
      bytes.push(0x3f);
    }
  }

  return Buffer.from(bytes);
}

function escposQr(content, size = 6, correction = 49) {
  const data = Buffer.from(stripDiacritics(content), 'ascii');
  const storeLength = data.length + 3;
  const pL = storeLength % 256;
  const pH = Math.floor(storeLength / 256);

  return Buffer.concat([
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, Number(size) || 6))]),
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, correction]),
    Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    data,
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ]);
}

function escposQrPair58(leftContent, rightContent, moduleSize = 3) {
  const width = 384;
  const height = 190;
  const leftX = 8;
  const rightX = 200;
  const topY = 8;
  const position = (x, y) => Buffer.from([
    0x1b, 0x24, x & 0xff, (x >> 8) & 0xff,
    0x1d, 0x24, y & 0xff, (y >> 8) & 0xff,
  ]);

  return Buffer.concat([
    // ESC L: modo pagina. ESC W: area imprimible completa de 384 x 190 puntos.
    Buffer.from([
      0x1b, 0x4c,
      0x1b, 0x57,
      0x00, 0x00, 0x00, 0x00,
      width & 0xff, (width >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
      0x1b, 0x54, 0x00,
    ]),
    position(leftX, topY),
    escposQr(leftContent, moduleSize, 49),
    position(rightX, topY),
    escposQr(rightContent, moduleSize, 49),
    // FF imprime el buffer de pagina; ESC S vuelve inmediatamente a estandar.
    Buffer.from([0x0c, 0x1b, 0x53, 0x0a]),
  ]);
}

function escposRasterImage(width, height, base64Data, mode = 0) {
  const data = Buffer.from(String(base64Data || ''), 'base64');
  const bytesPerRow = Math.ceil(Number(width || 0) / 8);
  const rows = Number(height || 0);
  const expectedLength = bytesPerRow * rows;

  if (!bytesPerRow || !rows) {
    throw new Error('Imagen invalida: ancho/alto requeridos.');
  }
  if (data.length !== expectedLength) {
    throw new Error(`Imagen invalida: se esperaban ${expectedLength} bytes y llegaron ${data.length}.`);
  }

  return Buffer.concat([
    Buffer.from([
      0x1d, 0x76, 0x30, Number(mode || 0),
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      rows & 0xff,
      (rows >> 8) & 0xff,
    ]),
    data,
  ]);
}

function escposCashDrawer(pin = 0, onTime = 25, offTime = 250, mode = 'escp') {
  const connectorPin = Number(pin) === 1 ? 1 : 0;
  const pulseOn = Math.max(1, Math.min(255, Number(onTime) || 25));
  const pulseOff = Math.max(1, Math.min(255, Number(offTime) || 250));
  const normalizedMode = String(mode || 'escp').toLowerCase();

  if (normalizedMode === 'dle' || normalizedMode === 'dledc4') {
    return Buffer.from([0x10, 0x14, 0x01, connectorPin, pulseOn]);
  }

  if (normalizedMode === 'bel' || normalizedMode === 'bell') {
    return Buffer.from([0x07]);
  }

  return Buffer.from([0x1b, 0x70, connectorPin, pulseOn, pulseOff]);
}

function normalizeOperation(operation) {
  if (operation.name) return operation;

  const name = operation.nombre;
  const args = operation.argumentos || [];
  const map = {
    EscribirTexto: 'text',
    TextoSegunPaginaDeCodigos: 'textCodepage',
    Corte: 'cut',
    CorteParcial: 'partialCut',
    Feed: 'feed',
    Iniciar: 'init',
    EstablecerAlineacion: 'align',
    EstablecerEnfatizado: 'bold',
    EstablecerTamañoFuente: 'size',
    ImprimirCodigoQr: 'qr',
    ImprimirImagenRaster: 'imageRaster',
    AbrirCajon: 'openDrawer',
    AbrirGaveta: 'openDrawer',
    Pulso: 'openDrawer',
  };

  return {
    name: map[name] || name,
    args,
  };
}

export function buildEscpos(payload) {
  const operations = Array.isArray(payload.operations)
    ? payload.operations
    : Array.isArray(payload.operaciones)
      ? payload.operaciones.map(normalizeOperation)
      : [];
  if (operations.length > 250) throw new Error('El trabajo contiene demasiadas operaciones.');
  const buffers = [];

  for (const rawOperation of operations) {
    const operation = normalizeOperation(rawOperation);
    const args = operation.args || [];

    switch (operation.name) {
      case 'init':
        buffers.push(Buffer.from([0x1b, 0x40]));
        // FS . cancela el modo de caracteres chinos/Kanji que algunas
        // impresoras compatibles mantienen activo despues de ESC @.
        buffers.push(Buffer.from([0x1c, 0x2e]));
        // ESC t 2 selecciona PC850 en impresoras ESC/POS compatibles.
        // Sin esta orden los bytes de á, é, í, ó, ú y ñ pueden interpretarse
        // usando una tabla asiática configurada por defecto en la impresora.
        buffers.push(Buffer.from([0x1b, 0x74, 0x02]));
        break;
      case 'text':
        buffers.push(encodeText(args[0] || ''));
        break;
      case 'textCodepage':
        buffers.push(Buffer.from([0x1c, 0x2e]));
        buffers.push(Buffer.from([0x1b, 0x74, Number(args[0] || 2)]));
        buffers.push(encodeText(args[2] ?? args[0] ?? '', args[1] || 'cp850'));
        break;
      case 'feed':
        buffers.push(Buffer.from([0x1b, 0x64, Number(args[0] || 1)]));
        break;
      case 'cut':
        buffers.push(Buffer.from([0x1b, 0x64, Number(args[0] || 4), 0x1d, 0x56, 0x00]));
        break;
      case 'partialCut':
        buffers.push(Buffer.from([0x1b, 0x64, Number(args[0] || 4), 0x1d, 0x56, 0x01]));
        break;
      case 'align': {
        const value = args[0];
        const align = value === 'center' || value === 1 ? 1 : value === 'right' || value === 2 ? 2 : 0;
        buffers.push(Buffer.from([0x1b, 0x61, align]));
        break;
      }
      case 'bold':
        buffers.push(Buffer.from([0x1b, 0x45, args[0] ? 1 : 0]));
        break;
      case 'font': {
        const font = String(args[0] || 'A').toUpperCase() === 'B' || Number(args[0]) === 1 ? 1 : 0;
        // Some compact 58 mm mechanisms (notably PT-210 variants) consume
        // ESC M without rendering the following text. ESC ! bit 0 selects
        // the same font while remaining compatible with those firmwares.
        buffers.push(Buffer.from([0x1b, 0x21, font]));
        break;
      }
      case 'size': {
        const width = Math.max(1, Math.min(8, Number(args[0] || 1)));
        const height = Math.max(1, Math.min(8, Number(args[1] || width)));
        buffers.push(Buffer.from([0x1d, 0x21, ((width - 1) << 4) | (height - 1)]));
        break;
      }
      case 'qr':
        buffers.push(escposQr(args[0] || '', Math.round(Number(args[1] || 280) / 48), 49 + Number(args[2] || 1)));
        break;
      case 'qrPair58':
        buffers.push(escposQrPair58(args[0] || '', args[1] || '', Math.max(2, Math.min(4, Number(args[2]) || 3))));
        break;
      case 'imageRaster':
        buffers.push(escposRasterImage(args[0], args[1], args[2], args[3] || 0));
        break;
      case 'openDrawer':
      case 'cashDrawer':
      case 'cashDrawerPulse':
      case 'drawerPulse':
        buffers.push(escposCashDrawer(args[0], args[1], args[2], args[3]));
        break;
      default:
        throw new Error(`Operacion no soportada: ${operation.name}`);
    }
  }

  return Buffer.concat(buffers);
}

export function createWindowsRawPrintInvocation(printerName, payloadPath) {
  const sourceEncoded = Buffer.from(rawPrinterSource, 'utf8').toString('base64');
  const script = [
    `$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${sourceEncoded}'))`,
    'Add-Type -TypeDefinition $source',
    '$bytes=[IO.File]::ReadAllBytes($env:STELFARO_PRINT_PAYLOAD)',
    '$printer=$env:STELFARO_PRINTER_NAME',
    '$h=[IntPtr]::Zero',
    'if(-not [RawPrinterHelper]::OpenPrinter($printer,[ref]$h,[IntPtr]::Zero)){ throw "No se pudo abrir la impresora RAW: $printer" }',
    '$di=New-Object RawPrinterHelper+DOCINFOA',
    '$di.pDocName="Stelfaro Print Agent"',
    '$di.pDataType="RAW"',
    '$ptr=[Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)',
    'try {',
    '  [Runtime.InteropServices.Marshal]::Copy($bytes,0,$ptr,$bytes.Length)',
    '  if(-not [RawPrinterHelper]::StartDocPrinter($h,1,$di)){ throw "No se pudo iniciar documento RAW" }',
    '  if(-not [RawPrinterHelper]::StartPagePrinter($h)){ throw "No se pudo iniciar pagina RAW" }',
    '  $written=0',
    '  if(-not [RawPrinterHelper]::WritePrinter($h,$ptr,$bytes.Length,[ref]$written)){ throw "No se pudieron escribir bytes RAW" }',
    '  [RawPrinterHelper]::EndPagePrinter($h) | Out-Null',
    '  [RawPrinterHelper]::EndDocPrinter($h) | Out-Null',
    '} finally {',
    '  if($ptr -ne [IntPtr]::Zero){ [Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr) }',
    '  if($h -ne [IntPtr]::Zero){ [RawPrinterHelper]::ClosePrinter($h) | Out-Null }',
    '}',
  ].join(';');

  return {
    file: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-Command', script],
    options: {
      timeout: 15000,
      windowsHide: true,
      env: {
        ...process.env,
        STELFARO_PRINT_PAYLOAD: payloadPath,
        STELFARO_PRINTER_NAME: String(printerName),
      },
    },
  };
}

async function sendToPrinter(printerName, buffer) {
  if (dryRun) {
    return { bytes: buffer.length, dryRun: true };
  }

  if (!printerName) {
    throw new Error('No se especifico impresora.');
  }

  if (process.platform === 'win32') {
    const tempDirectory = await mkdtemp(join(os.tmpdir(), 'stelfaro-print-'));
    const payloadPath = join(tempDirectory, 'ticket.escpos');

    try {
      await writeFile(payloadPath, buffer, { flag: 'wx' });
      const invocation = createWindowsRawPrintInvocation(printerName, payloadPath);
      await execFileAsync(invocation.file, invocation.args, invocation.options);
      return { bytes: buffer.length, backend: 'windows-raw-spooler' };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  const child = execFile('lp', ['-d', printerName, '-o', 'raw'], { timeout: 15000 }, () => {});
  child.stdin.end(buffer);
  return { bytes: buffer.length, backend: 'cups-raw' };
}

function route(req) {
  return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      assertAllowedOrigin(req);
      return json(req, res, 204, {});
    }

    const url = route(req);

    if (req.method === 'GET' && url.pathname === '/health') {
      assertAllowedOrigin(req);
      return json(req, res, 200, { ok: true, name: 'Stelfaro Print Agent', version: '0.2.10', platform: os.platform(), dryRun });
    }

    if (req.method === 'GET' && (url.pathname === '/printers' || url.pathname === '/impresoras')) {
      assertAllowedOrigin(req);
      const printers = await listPrinters();
      if (url.pathname === '/impresoras') {
        return json(req, res, 200, printers.map((printer) => printer.name));
      }
      return json(req, res, 200, { ok: true, printers });
    }

    if (req.method === 'POST' && (url.pathname === '/print' || url.pathname === '/imprimir')) {
      assertAllowedOrigin(req);
      const payload = await readBody(req);
      const printerName = payload.printer || payload.nombreImpresora;
      const buffer = buildEscpos(payload);
      const result = await sendToPrinter(printerName, buffer);
      return json(req, res, 200, { ok: true, message: 'Impreso correctamente', ...result });
    }

    return json(req, res, 404, { ok: false, message: 'Ruta no encontrada' });
  } catch (error) {
    return json(req, res, Number(error.statusCode || 500), { ok: false, message: error.message || 'Error interno' });
  }
});

export function shouldStartServer({
  argvPath = process.argv[1],
  moduleUrl = import.meta.url,
  packaged = Boolean(process.pkg),
} = {}) {
  return packaged || Boolean(argvPath && moduleUrl === pathToFileURL(argvPath).href);
}

if (shouldStartServer()) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`Stelfaro Print Agent listening on http://localhost:${port}`);
  });
}
