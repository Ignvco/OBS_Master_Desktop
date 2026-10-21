import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DATA_DIRECTORY } from './runtimePaths.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MediaAsset } from '../types/index.ts';

const DIRECTORY = resolve(DATA_DIRECTORY, 'media');
export const MAX_MEDIA_BYTES = 150 * 1024 * 1024;
const FORMATS: Record<string, { ext: string, kind: MediaAsset['type'] }> = {
  'image/png': { ext: 'png', kind: 'image' },
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
  'audio/wav': { ext: 'wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', kind: 'audio' },
};

export function sniffMedia(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start,end));
  if (bytes.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && ascii(4,8) === 'ftyp') return 'video/mp4';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  if (bytes.length >= 3 && ascii(0,3) === 'ID3') return 'audio/mpeg';
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (bytes.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WAVE') return 'audio/wav';
  return null;
}

export async function uploadMedia(req: IncomingMessage): Promise<MediaAsset> {
  const mime = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const expected = FORMATS[mime];
  if (!expected) throw new Error('Formato no permitido. PNG, JPG, WebP, MP4, WebM, MP3 o WAV.');
  const expectedSize = Number(req.headers['content-length']);
  if (expectedSize > MAX_MEDIA_BYTES) throw new Error('Máximo 150 MB por archivo.');
  let name = 'Recurso multimedia';
  try { name = decodeURIComponent(String(req.headers['x-file-name'] || 'Recurso multimedia')); }
  catch { /* Ignore invalid filename encoding */ }
  name = name.replace(/[\\/<>\x00-\x1f]/g, '').slice(0, 180).trim() || 'Recurso multimedia';
  mkdirSync(DIRECTORY, { recursive: true });
  const id = randomUUID();
  const temp = resolve(DIRECTORY, `${id}.partial`);
  const file = await open(temp, 'wx', 0o600);
  let size = 0;
  let beginning = Buffer.alloc(0);
  try {
    for await (const piece of req) {
      const chunk = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
      size += chunk.length;
      if (size > MAX_MEDIA_BYTES) throw new Error('Máximo 150 MB por archivo.');
      if (beginning.length < 16) beginning = Buffer.concat([beginning, chunk.subarray(0, 16 - beginning.length)]);
      let written = 0;
      while (written < chunk.length) {
        const result = await file.write(chunk, written, chunk.length - written);
        if (result.bytesWritten < 1) throw new Error('No se pudo completar la escritura del archivo.');
        written += result.bytesWritten;
      }
    }
    if (size === 0) throw new Error('Archivo vacío.');
    const realMime = sniffMedia(beginning);
    if (!realMime || FORMATS[realMime]?.ext !== expected.ext) throw new Error('El contenido no coincide con el formato declarado.');
    await file.close();
    const filename = `${id}.${expected.ext}`;
    await rename(temp, resolve(DIRECTORY, filename));
    return { id, name, type: expected.kind, url: `/api/station/media/${filename}`, sizeBytes: size, uploadedAt: new Date().toISOString(), tags: [] };
  } catch (err) {
    await file.close().catch(() => undefined);
    await unlink(temp).catch(() => undefined);
    throw err;
  }
}

export function mediaFile(filename: string): { path: string, size: number, mime: string } | null {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|mp4|webm|mp3|wav)$/.test(filename)) return null;
  const path = resolve(DIRECTORY, filename);
  if (!existsSync(path)) return null;
  const size = statSync(path).size;
  const ext = filename.split('.').pop();
  const mime = Object.entries(FORMATS).find(([_,v]) => v.ext === ext)?.[0] || 'application/octet-stream';
  return { path, size, mime };
}

export function serveMedia(req: IncomingMessage, res: ServerResponse, filename: string): void {
  const item = mediaFile(filename);
  if (!item) { res.writeHead(404); res.end('Recurso no encontrado'); return; }
  const range = req.headers.range;
  let start = 0;
  let end = item.size - 1;
  if (typeof range === 'string') {
    const matched = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!matched) { res.writeHead(416, { 'Content-Range': `bytes */${item.size}` }); res.end(); return; }
    if (matched[1] === '' && matched[2] !== '') {
      const suffix = Number(matched[2]);
      start = Math.max(0, item.size - suffix);
    } else {
      start = Number(matched[1]);
      end = matched[2] ? Math.min(item.size - 1, Number(matched[2])) : end;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= item.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${item.size}` }); res.end(); return;
    }
  }
  const headers: Record<string,string|number> = {
    'Content-Type': item.mime, 'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=120',
  };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${item.size}`;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(item.path, { start, end });
  stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
  stream.pipe(res);
}

export async function deleteMediaFile(url: string): Promise<void> {
  const file = url.split('/').pop() || '';
  const item = mediaFile(file);
  if (url.startsWith('/api/station/media/') && item) await unlink(item.path);
}
