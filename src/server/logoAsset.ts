import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_DIRECTORY } from './runtimePaths.ts';

const DIRECTORY = resolve(DATA_DIRECTORY, 'assets');
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function sniffLogoMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}

/** File names are generated, never supplied by the browser. */
export function storeLogo(bytes: Buffer, expectedMime: string): string {
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) throw new Error('Tamaño de imagen no permitido (máx. 4 MB).');
  const mime = sniffLogoMime(bytes);
  if (!mime || mime !== expectedMime) throw new Error('Formato real de imagen no coincide con el declarado.');
  mkdirSync(DIRECTORY, { recursive: true });
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
  const id = `${randomUUID()}.${ext}`;
  writeFileSync(resolve(DIRECTORY, id), bytes, { flag: 'wx', mode: 0o600 });
  return `/api/station/assets/${id}`;
}

export function readLogo(filename: string): { bytes: Buffer, mime: string } | null {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(filename)) return null;
  const file = resolve(DIRECTORY, filename);
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  const mime = sniffLogoMime(bytes);
  if (!mime || bytes.length > MAX_LOGO_BYTES) return null;
  return { bytes, mime };
}
