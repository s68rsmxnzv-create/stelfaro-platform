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
