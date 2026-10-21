import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeTickerItems,tickerSeconds,tickerDirection,tickerLoopWidth} from '../utils/tickerMotion.ts';
import {getPresetMotion,componentMotionProps} from '../utils/animationEngine.ts';
import type {AnimationPreset,AnimationSettings} from '../types/index.ts';

const settings=(preset:AnimationPreset):AnimationSettings => ({
  preset,entryDurationMs:640,exitDurationMs:450,delayMs:120,
  easing:'cubic-bezier(0.16, 1, 0.3, 1)',staggerWords:false,direction:'up',loopPulse:false,
});

test('la cinta ignora elementos no textuales, vacíos y limita la cantidad de noticias',()=>{
  assert.deepEqual(sanitizeTickerItems(['  Noticia  ',false,'',' Segunda ',null]),['Noticia','Segunda']);
  assert.deepEqual(sanitizeTickerItems('un texto'),[]);
  assert.equal(sanitizeTickerItems(Array.from({length:60},(_,i)=>`item ${i}`)).length,50);
});
test('la cinta preserva el ajuste previo de velocidad y limita valores inválidos',()=>{
  assert.equal(tickerSeconds(undefined),35);
  assert.equal(tickerSeconds(0),35);
  assert.equal(tickerSeconds(3),8);
  assert.equal(tickerSeconds(500),180);
  assert.equal(tickerSeconds(28),28);
  assert.equal(tickerLoopWidth(Number.NaN),0);
  assert.equal(tickerLoopWidth(840.5),840.5);
});
test('la cinta acepta direcciones definidas y usa izquierda como opción segura',()=>{
  assert.equal(tickerDirection('right'),'right');
  assert.equal(tickerDirection('left'),'left');
  assert.equal(tickerDirection('otro'),'left');
});
test('nuevas transiciones editoriales tienen entrada y salida independientes, con tiempos fieles',()=>{
  for(const preset of ['editorial-wipe','soft-focus','diagonal-reveal'] as AnimationPreset[]){
    const result=componentMotionProps(settings(preset));
    assert.ok(result.initial);
    assert.ok(result.animate);
    assert.ok(result.exit);
    assert.equal(result.transition.duration,.64);
    assert.equal(result.transition.delay,.12);
    assert.equal((result.exit.transition as {duration:number}).duration,.45);
  }
  assert.equal(typeof getPresetMotion(settings('editorial-wipe')).initial.clipPath,'string');
});
test('un ticker con tiempo cero sigue mostrando 00:00 en lugar de reiniciarse',async()=>{
  const fs=await import('node:fs');
  const data=fs.readFileSync('src/components/overlays/GraphicComponentRenderers.tsx','utf8');
  assert.ok(data.includes('countdown?.remainingSeconds ?? 300'));
  assert.ok(data.includes('countdown?.remainingSeconds ?? 120'));
});
test('la cinta enlaza el identificador de capa y el renderizador animado',async()=>{
  const fs=await import('node:fs');
  const data=fs.readFileSync('src/components/overlays/GraphicComponentRenderers.tsx','utf8');
  const ticker=data.split("case 'ticker':")[1]?.split("case 'editorial':")[0]||'';
  assert.ok(ticker.includes("layer('headline')"));
  assert.ok(ticker.includes('<TickerMarquee'));
  assert.ok(ticker.includes('speedSeconds={content.speedSeconds}'));
});
