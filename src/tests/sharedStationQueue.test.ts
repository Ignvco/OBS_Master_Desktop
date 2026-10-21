import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedStation } from '../services/sharedStation.ts';

test('envíos a OBS llegan al servidor en el orden de edición', async () => {
  const originalFetch = globalThis.fetch;
  const order: number[] = [];
  globalThis.fetch = (async (_url: unknown, args: any) => {
    const payload = JSON.parse(args.body);
    const revision = payload.countdown.remainingSeconds;
    if (revision === 1) await new Promise(resolve => setTimeout(resolve, 18));
    order.push(revision);
    return { ok:true } as any;
  }) as typeof fetch;
  try {
    const updates = [1,2,3].map(remainingSeconds => SharedStation.publish({
      countdown: { remainingSeconds, isRunning:false, isPaused:false, durationSeconds:5, message:'', style:'minimal' }
    }));
    await Promise.all(updates);
    assert.deepEqual(order,[1,2,3]);
  } finally { globalThis.fetch = originalFetch; }
});
