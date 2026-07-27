import { describe, expect, it } from 'vitest';
import {
  partitionPortableRasterJob,
  type PrintOperation,
  withoutUnsupportedFont,
} from '../../../packages/billing/src/printing/printJob';

describe('partitionPortableRasterJob', () => {
  const operations: PrintOperation[] = [
    { name: 'text', args: ['Inicio\n'] },
    { name: 'imageRaster', args: [376, 24, 'AA==', 0], section: 'qr_pair' },
    { name: 'imageRaster', args: [376, 24, 'AA==', 0], section: 'qr_pair' },
    { name: 'text', args: ['Fin\n'] },
  ];

  it('isolates each QR band into a paced job for 58 mm', () => {
    expect(partitionPortableRasterJob({ paperWidth: '58' }, operations)).toEqual([
      [operations[0]],
      [operations[1]],
      [operations[2]],
      [operations[3]],
    ]);
  });

  it('keeps the complete 80 mm job untouched', () => {
    expect(partitionPortableRasterJob({ paperWidth: '80' }, operations)).toEqual([operations]);
  });

  it('removes font operations only when an older agent rejects them', () => {
    const fontOperations: PrintOperation[] = [
      { name: 'font', args: ['B'] },
      { name: 'text', args: ['Código'] },
      { name: 'font', args: ['A'] },
    ];

    expect(withoutUnsupportedFont(fontOperations, new Error('Operacion no soportada: font')))
      .toEqual([{ name: 'text', args: ['Código'] }]);
    expect(withoutUnsupportedFont(fontOperations, new Error('Impresora no disponible'))).toBeNull();
  });
});
