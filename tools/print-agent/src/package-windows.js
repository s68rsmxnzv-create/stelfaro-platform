import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import zlib from 'node:zlib';

const root = resolve(new URL('..', import.meta.url).pathname);
const outDir = resolve(root, '../../storage/app');
const outPath = join(outDir, 'stelfaro-print-agent-0.1.0.zip');
const files = [];

function dosTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
}

function dosDate(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function walk(dir) {
  for (const entry of await readdir(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      await walk(full);
    } else {
      files.push(full);
    }
  }
}

function u16(value) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value);
  return b;
}

function u32(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0);
  return b;
}

await mkdir(outDir, { recursive: true });
await walk(root);

const locals = [];
const centrals = [];
let offset = 0;

for (const file of files) {
  const info = await stat(file);
  const name = `print-agent/${relative(root, file).replaceAll('\\', '/')}`;
  const nameBuffer = Buffer.from(name);
  const data = await readFile(file);
  const compressed = zlib.deflateRawSync(data);
  const crc = crc32(data);
  const time = dosTime(info.mtime);
  const date = dosDate(info.mtime);

  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0), u16(8), u16(time), u16(date), u32(crc),
    u32(compressed.length), u32(data.length), u16(nameBuffer.length), u16(0),
    nameBuffer, compressed,
  ]);
  locals.push(local);

  const central = Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(time), u16(date), u32(crc),
    u32(compressed.length), u32(data.length), u16(nameBuffer.length), u16(0), u16(0),
    u16(0), u16(0), u32(0), u32(offset), nameBuffer,
  ]);
  centrals.push(central);
  offset += local.length;
}

const centralStart = offset;
const central = Buffer.concat(centrals);
const end = Buffer.concat([
  u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
  u32(central.length), u32(centralStart), u16(0),
]);

await writeFile(outPath, Buffer.concat([...locals, central, end]));
console.log(outPath);
