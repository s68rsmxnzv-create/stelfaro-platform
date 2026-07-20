import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEscpos, encodeText, shouldStartServer } from '../src/server.js';

test('encodes Spanish text using CP850', () => {
  assert.deepEqual(
    [...encodeText('Hernández, Muñoz')],
    [72, 101, 114, 110, 160, 110, 100, 101, 122, 44, 32, 77, 117, 164, 111, 122],
  );
});

test('selects the PC850 table after initializing the printer', () => {
  const bytes = buildEscpos({ operations: [
    { name: 'init', args: [] },
    { name: 'text', args: ['José Hernández'] },
  ] });

  assert.deepEqual([...bytes.subarray(0, 5)], [0x1b, 0x40, 0x1b, 0x74, 0x02]);
});

test('starts when running inside the packaged Windows executable', () => {
  assert.equal(shouldStartServer({
    argvPath: 'C:\\print-agent\\stelfaro-print-agent.exe',
    moduleUrl: 'file:///snapshot/print-agent/src/server.js',
    packaged: true,
  }), true);
});
