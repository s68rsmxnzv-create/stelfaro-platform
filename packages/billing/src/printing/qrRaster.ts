import QRCode from 'qrcode';
import type { PrintOperation } from './printJob';
import { splitRasterIntoBands } from './rasterBands';

const QR_SLOT_58 = 180;
const QR_RASTER_WIDTH_58 = 184;
const QR_QUIET_MODULES = 4;

export function qrOperationTo58MmRaster(operation: PrintOperation): PrintOperation[] {
  if (operation.name !== 'qr') return [operation];

  const value = String(operation.args[0] || '');
  if (!value) return [operation];

  const qr = QRCode.create(value, { errorCorrectionLevel: 'L' }).modules;
  const scale = Math.max(1, Math.floor(QR_SLOT_58 / (qr.size + (QR_QUIET_MODULES * 2))));
  const symbolSize = qr.size * scale;
  const left = Math.floor((QR_RASTER_WIDTH_58 - symbolSize) / 2);
  const top = Math.floor((QR_SLOT_58 - symbolSize) / 2);
  const bytesPerRow = QR_RASTER_WIDTH_58 / 8;
  const bytes = new Uint8Array(bytesPerRow * QR_SLOT_58);

  for (let moduleY = 0; moduleY < qr.size; moduleY += 1) {
    for (let moduleX = 0; moduleX < qr.size; moduleX += 1) {
      if (!qr.data[(moduleY * qr.size) + moduleX]) continue;
      for (let pixelY = 0; pixelY < scale; pixelY += 1) {
        const y = top + (moduleY * scale) + pixelY;
        for (let pixelX = 0; pixelX < scale; pixelX += 1) {
          const x = left + (moduleX * scale) + pixelX;
          const index = (y * bytesPerRow) + Math.floor(x / 8);
          bytes[index] |= 0x80 >> (x % 8);
        }
      }
    }
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return splitRasterIntoBands({
    name: 'imageRaster',
    args: [QR_RASTER_WIDTH_58, QR_SLOT_58, btoa(binary), 0],
    section: operation.section || 'qr_58',
  });
}

export function prepare58MmQrOperations(
  paperWidth: '58' | '80',
  operations: PrintOperation[],
): PrintOperation[] {
  return paperWidth === '58'
    ? operations.flatMap(qrOperationTo58MmRaster)
    : operations;
}
