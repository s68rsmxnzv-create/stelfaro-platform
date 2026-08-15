import { describe, expect, it } from 'vitest';
import { prepare58MmQrOperations } from '../../../packages/billing/src/printing/qrRaster';
import type { PrintOperation } from '../../../packages/billing/src/printing/printJob';

describe('prepare58MmQrOperations', () => {
  const operations: PrintOperation[] = [
    { name: 'align', args: ['center'] },
    { name: 'qr', args: ['https://new.stelfaro.com/equipo/ABC123', 200, 1, 0] },
    { name: 'text', args: ['Fin\n'] },
  ];

  it('turns every 58 mm QR into buffer-safe raster bands', () => {
    const prepared = prepare58MmQrOperations('58', operations);
    const bands = prepared.filter(({ name }) => name === 'imageRaster');

    expect(prepared.some(({ name }) => name === 'qr')).toBe(false);
    expect(bands).toHaveLength(8);
    expect(bands.every(({ args, section }) => args[0] === 184 && Number(args[1]) <= 24 && section === 'qr_58')).toBe(true);
    expect(bands.reduce((rows, { args }) => rows + Number(args[1]), 0)).toBe(180);
    expect(bands.reduce((bytes, { args }) => bytes + atob(String(args[2])).length, 0)).toBe((184 / 8) * 180);
  });

  it('leaves the complete 80 mm operation list untouched', () => {
    expect(prepare58MmQrOperations('80', operations)).toBe(operations);
  });
});
