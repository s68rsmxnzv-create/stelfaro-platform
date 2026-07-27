import type { PrintOperation } from './printJob';

export function splitRasterIntoBands(operation: PrintOperation, rowsPerBand = 24): PrintOperation[] {
  if (operation.name !== 'imageRaster') return [operation];

  const section = (operation as PrintOperation & { section?: string }).section;
  const [rawWidth, rawHeight, rawData, mode = 0] = operation.args;
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  const bytesPerRow = Math.ceil(width / 8);
  const binary = atob(String(rawData || ''));

  if (!width || !height || binary.length !== bytesPerRow * height) return [operation];

  const bands: PrintOperation[] = [];
  for (let row = 0; row < height; row += rowsPerBand) {
    const bandHeight = Math.min(rowsPerBand, height - row);
    const start = row * bytesPerRow;
    const end = start + (bandHeight * bytesPerRow);
    bands.push({
      name: 'imageRaster',
      args: [width, bandHeight, btoa(binary.slice(start, end)), mode],
      ...(section ? { section } : {}),
    } as PrintOperation);
  }

  return bands;
}
