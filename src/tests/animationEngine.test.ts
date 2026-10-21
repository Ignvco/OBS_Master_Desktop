import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, getPresetMotion, componentMotionProps, motionReplayKey, BROADCAST_SAFE_ZONES } from '../utils/animationEngine.ts';
import type { AnimationSettings } from '../types/index.ts';

test('formatTime correctly formats seconds into mm:ss', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(45), '00:45');
  assert.equal(formatTime(300), '05:00');
  assert.equal(formatTime(3665), '01:01:05');
  assert.equal(formatTime(-15), '-00:15');
});

test('getPresetMotion returns valid variants for apple-spring preset', () => {
  const settings: AnimationSettings = {
    preset: 'apple-spring',
    entryDurationMs: 600,
    exitDurationMs: 400,
    delayMs: 100,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    staggerWords: false,
    direction: 'up',
    loopPulse: false
  };

  const motion = getPresetMotion(settings);
  assert.ok(motion.initial);
  assert.ok(motion.animate);
  assert.ok(motion.exit);
  assert.equal(motion.animate.opacity, 1);
  assert.equal(motion.animate.scale, 1);
  assert.equal(motion.initial.opacity, 0);
});

test('BROADCAST_SAFE_ZONES dimensions match 1080p broadcast standards', () => {
  assert.equal(BROADCAST_SAFE_ZONES.ACTION_SAFE.width, 1728);
  assert.equal(BROADCAST_SAFE_ZONES.ACTION_SAFE.height, 972);
  assert.equal(BROADCAST_SAFE_ZONES.TITLE_SAFE.width, 1536);
  assert.equal(BROADCAST_SAFE_ZONES.TITLE_SAFE.height, 864);
});


test('preset de OBS y de vista previa respetan transición y salida separada',()=>{
  const settings:AnimationSettings={preset:'mask-reveal',entryDurationMs:840,exitDurationMs:460,delayMs:220,easing:'ease-in-out',staggerWords:false,direction:'up',loopPulse:false};
  const props=componentMotionProps(settings);
  assert.equal(props.transition.duration,0.84);
  assert.equal(props.transition.delay,0.22);
  assert.equal((props.exit.transition as {duration:number}).duration,0.46);
  assert.equal(props.initial.opacity,0);
  assert.equal(props.animate.opacity,1);
});
test('solo repetir explícitamente cambia la clave de la gráfica OBS',()=>{
  assert.equal(motionReplayKey('banner'),motionReplayKey('banner',0));
  assert.notEqual(motionReplayKey('banner',123),motionReplayKey('banner',124));
  assert.equal(motionReplayKey('banner',-100),'banner::0');
});
