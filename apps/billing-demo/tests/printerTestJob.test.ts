import { describe, expect, it } from 'vitest';
import { printerTestOperations } from '../../../packages/billing/src/printing/printerTestJob';

describe('printerTestOperations', () => {
  const printedAt = new Date('2026-07-21T15:38:08-06:00');

  it('adds the symmetric short-link QR raster only to the 58 mm test', () => {
    const operations = printerTestOperations({ paperWidth: '58', cutLines: 6 }, printedAt);
    const qrOperations = operations.filter(({ name }) => name === 'qr');
    const rasters = operations.filter(({ name }) => name === 'imageRaster');

    expect(qrOperations).toHaveLength(0);
    expect(rasters).toHaveLength(8);
    expect(rasters.every(({ args, section }) => args[0] === 376 && Number(args[1]) <= 24 && section === 'qr_pair_test')).toBe(true);
    expect(rasters.reduce((height, { args }) => height + Number(args[1]), 0)).toBe(180);
    expect(rasters.reduce((bytes, { args }) => bytes + atob(String(args[2])).length, 0)).toBe(8460);
  });

  it('keeps the existing 80 mm test free of QR operations', () => {
    const operations = printerTestOperations({ paperWidth: '80', cutLines: 6 }, printedAt);

    expect(operations.some(({ name }) => name === 'qr')).toBe(false);
    expect(operations.some(({ name }) => name === 'qrPair58')).toBe(false);
    expect(operations.some(({ name }) => name === 'imageRaster')).toBe(false);
    expect(operations.filter(({ name }) => name === 'text').map(({ args }) => args[0])).toEqual([
      'STELFARO\n',
      'Impresión configurada correctamente\n',
      'José Hernández / Muñoz / Elías\n',
      printedAt.toLocaleString('es-SV') + '\n',
    ]);
    expect(operations.at(-1)).toEqual({ name: 'cut', args: [6] });
  });
});
