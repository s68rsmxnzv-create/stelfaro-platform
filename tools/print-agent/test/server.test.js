import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEscpos, createWindowsRawPrintInvocation, encodeText, shouldStartServer } from '../src/server.js';

test('encodes Spanish text using CP850', () => {
  assert.deepEqual(
    [...encodeText('Hernández, Muñoz')],
    [72, 101, 114, 110, 160, 110, 100, 101, 122, 44, 32, 77, 117, 164, 111, 122],
  );
});

test('leaves Chinese mode and selects PC850 after initializing the printer', () => {
  const bytes = buildEscpos({ operations: [
    { name: 'init', args: [] },
    { name: 'text', args: ['José Hernández'] },
  ] });

  assert.deepEqual(
    [...bytes.subarray(0, 7)],
    [0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, 0x02],
  );
});

test('starts when running inside the packaged Windows executable', () => {
  assert.equal(shouldStartServer({
    argvPath: 'C:\\print-agent\\stelfaro-print-agent.exe',
    moduleUrl: 'file:///snapshot/print-agent/src/server.js',
    packaged: true,
  }), true);
});

test('keeps large ESC/POS payloads outside the Windows command line', () => {
  const invocation = createWindowsRawPrintInvocation(
    'Impresora térmica de recepción',
    'C:\\Users\\Tecnico\\AppData\\Local\\Temp\\stelfaro-print-123\\ticket.escpos',
  );
  const commandLine = invocation.args.join(' ');

  assert.equal(invocation.file, 'powershell.exe');
  assert.match(commandLine, /ReadAllBytes\(\$env:STELFARO_PRINT_PAYLOAD\)/);
  assert.doesNotMatch(commandLine, /Impresora térmica de recepción/);
  assert.equal(invocation.options.env.STELFARO_PRINTER_NAME, 'Impresora térmica de recepción');
  assert.equal(invocation.options.env.STELFARO_PRINT_PAYLOAD.endsWith('ticket.escpos'), true);
  assert.equal(commandLine.length < 8000, true);
});

test('places the 58 mm QR pair in native ESC/POS page mode', () => {
  const bytes = buildEscpos({ operations: [
    { name: 'qrPair58', args: ['https://example.test/hacienda', 'https://example.test/documento', 3] },
  ] });

  assert.equal(bytes[0], 0x1b);
  assert.equal(bytes[1], 0x4c);
  assert.equal(bytes.includes(Buffer.from([0x1b, 0x57])), true);
  assert.equal(bytes.includes(Buffer.from([0x1b, 0x24, 0x08, 0x00])), true);
  assert.equal(bytes.includes(Buffer.from([0x1b, 0x24, 0xc8, 0x00])), true);
  assert.equal(bytes.includes(Buffer.from([0x0c, 0x1b, 0x53, 0x0a])), true);
});

test('selects compact font B and restores font A', () => {
  const bytes = buildEscpos({ operations: [
    { name: 'font', args: ['B'] },
    { name: 'text', args: ['DB2551FC-8FED-4CF0-B265-253C64EC854F\n'] },
    { name: 'font', args: ['A'] },
  ] });

  assert.deepEqual([...bytes.subarray(0, 3)], [0x1b, 0x21, 0x01]);
  assert.deepEqual([...bytes.subarray(-3)], [0x1b, 0x21, 0x00]);
});
