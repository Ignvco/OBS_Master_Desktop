import test from 'node:test';
import assert from 'node:assert/strict';
import { moveBox, resizeBox } from '../utils/editorGeometry.ts';

const start = {x: 100, y: 100, width: 500, height: 200, scale: 1};
test('arrastre traduce píxeles de pantalla en píxeles OBS', () => {
  const moved = moveBox(start, 100, 50, 960);
  assert.equal(moved.x, 300);
  assert.equal(moved.y, 200);
});
test('redimensionamiento funciona al mismo zoom y nunca genera tamaños negativos', () => {
  const resized = resizeBox(start, 80, 30, 960);
  assert.equal(resized.width, 660);
  assert.equal(resized.height, 260);
  assert.equal(resizeBox(start, -5000, -5000, 960).width, 80);
});
test('clamp de límites del lienzo y escalado', () => {
  const moved = moveBox({...start,scale:2},9999,9999,960);
  assert.equal(moved.x, 920);
  assert.equal(moved.y, 680);
});
