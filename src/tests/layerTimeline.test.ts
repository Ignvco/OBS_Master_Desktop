import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layerMotionFrames,normalizeLayerMotion,DEFAULT_LAYER_MOTION} from '../utils/layerTimeline.ts';
test('animación de entrada sin salida permanece visible hasta apagar overlay',()=>{
  const info=layerMotionFrames({...DEFAULT_LAYER_MOTION,effect:'rise',entryMs:600,holdMs:0,exitMs:700});
  assert.ok(info);
  assert.equal(info.duration,600);
  assert.equal(info.frames.length,2);
  assert.equal(info.frames.at(-1)?.opacity,1);
});
test('entrada, permanencia y salida respetan el timeline',()=>{
  const info=layerMotionFrames({...DEFAULT_LAYER_MOTION,effect:'pop',delayMs:200,entryMs:500,holdMs:1500,exitMs:400});
  assert.ok(info);
  assert.equal(info.duration,2400);
  assert.equal(info.delay,200);
  assert.equal(info.frames.length,4);
  assert.equal(info.frames.at(-1)?.opacity,0);
});
test('no animar mantiene intactas las capas y valores corruptos se limitan',()=>{
  assert.equal(layerMotionFrames(DEFAULT_LAYER_MOTION),null);
  const normalized=normalizeLayerMotion({entryMs:-100,holdMs:Infinity,delayMs:-1});
  assert.equal(normalized.entryMs,1);
  assert.equal(normalized.delayMs,0);
  assert.equal(normalized.holdMs,0);
});
