import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffLogoMime, MAX_LOGO_BYTES } from '../server/logoAsset.ts';

test('detectar PNG, JPEG, WebP y rechazar otros contenidos', () => {
  assert.equal(sniffLogoMime(Buffer.from([137,80,78,71,13,10,26,10])), 'image/png');
  assert.equal(sniffLogoMime(Buffer.from([255,216,255,0])), 'image/jpeg');
  assert.equal(sniffLogoMime(Buffer.from('RIFF0000WEBP', 'utf8')), 'image/webp');
  assert.equal(sniffLogoMime(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(MAX_LOGO_BYTES,4*1024*1024);
});
