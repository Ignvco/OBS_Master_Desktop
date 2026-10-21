import { test } from 'node:test';
import assert from 'node:assert/strict';

function computeTargetWebSocketUrl(host: string, port: number, useSsl: boolean): string {
  const raw = (host || '127.0.0.1').trim();
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw;
  }
  const protocol = useSsl ? 'wss' : 'ws';
  const targetPort = port || 4455;
  return `${protocol}://${raw}:${targetPort}`;
}

test('computeTargetWebSocketUrl generates standard ws:// URL for localhost', () => {
  const url = computeTargetWebSocketUrl('127.0.0.1', 4455, false);
  assert.equal(url, 'ws://127.0.0.1:4455');
});

test('computeTargetWebSocketUrl supports custom port and wss:// secure protocol', () => {
  const url = computeTargetWebSocketUrl('studio.lan', 4450, true);
  assert.equal(url, 'wss://studio.lan:4450');
});

test('computeTargetWebSocketUrl preserves explicit ws:// or wss:// prefix if provided in host', () => {
  const url1 = computeTargetWebSocketUrl('wss://obs.example.com:4455', 4455, false);
  assert.equal(url1, 'wss://obs.example.com:4455');

  const url2 = computeTargetWebSocketUrl('ws://192.168.1.100:4455', 4455, true);
  assert.equal(url2, 'ws://192.168.1.100:4455');
});
