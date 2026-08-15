import QRCode from 'qrcode';
import type { PrintOperation } from './printJob';
import type { PrinterSettings } from './printerSettings';
import { splitRasterIntoBands } from './rasterBands';

const TEST_HACIENDA_QR = 'https://new.stelfaro.com/q/m/731/ABCDEFGHIJKL';
const TEST_DOCUMENT_QR = 'https://new.stelfaro.com/q/d/731/ABCDEFGHIJKL';
const QR_SIZE_58 = 180;
const QR_GAP_58 = 16;

function qrPairRaster(leftValue: string, rightValue: string): PrintOperation {
  const width = (QR_SIZE_58 * 2) + QR_GAP_58;
  const height = QR_SIZE_58;
  const bytesPerRow = width / 8;
  const bytes = new Uint8Array(bytesPerRow * height);
  const symbols = [
    { qr: QRCode.create(leftValue, { errorCorrectionLevel: 'L' }).modules, offset: 0 },
    { qr: QRCode.create(rightValue, { errorCorrectionLevel: 'L' }).modules, offset: QR_SIZE_58 + QR_GAP_58 },
  ];

  for (const { qr, offset } of symbols) {
    const scale = Math.max(1, Math.floor((QR_SIZE_58 - 8) / qr.size));
    const renderedSize = qr.size * scale;
    const margin = Math.floor((QR_SIZE_58 - renderedSize) / 2);
    for (let y = 0; y < QR_SIZE_58; y += 1) {
      const moduleY = Math.floor((y - margin) / scale);
      if (moduleY < 0 || moduleY >= qr.size) continue;
      for (let x = 0; x < QR_SIZE_58; x += 1) {
        const moduleX = Math.floor((x - margin) / scale);
        if (moduleX < 0 || moduleX >= qr.size || !qr.data[(moduleY * qr.size) + moduleX]) continue;
        const rasterX = offset + x;
        const index = (y * bytesPerRow) + Math.floor(rasterX / 8);
        bytes[index] |= 0x80 >> (rasterX % 8);
      }
    }
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { name: 'imageRaster', args: [width, height, btoa(binary), 0], section: 'qr_pair_test' };
}
export function printerTestOperations(
  settings: Pick<PrinterSettings, 'paperWidth' | 'cutLines'>,
  printedAt = new Date(),
): PrintOperation[] {
  const operations: PrintOperation[] = [
    { name: 'init', args: [] },
    { name: 'align', args: ['center'] },
    { name: 'bold', args: [true] },
    { name: 'text', args: ['STELFARO\n'] },
    { name: 'bold', args: [false] },
    { name: 'text', args: ['Impresión configurada correctamente\n'] },
    { name: 'text', args: ['José Hernández / Muñoz / Elías\n'] },
    { name: 'text', args: [printedAt.toLocaleString('es-SV') + '\n'] },
  ];

  // En 58 mm usa dos enlaces cortos simetricos en un raster menor de 4 KB.
  // No se aplica a 80 mm para conservar su prueba sin cambios.
  if (settings.paperWidth === '58') {
    operations.push(
      { name: 'text', args: ['\nPRUEBA QR CORTO 58 MM\nHacienda       PDF y JSON\n'] },
      ...splitRasterIntoBands(qrPairRaster(TEST_HACIENDA_QR, TEST_DOCUMENT_QR)),
      { name: 'text', args: ['\nFIN PRUEBA QR\n'] },
    );
  }

  operations.push({ name: 'cut', args: [settings.cutLines] });
  return operations;
}
