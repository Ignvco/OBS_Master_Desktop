import test from 'node:test';
import assert from 'node:assert/strict';
import {clampWorkspaceZoom, fitCanvasWidth, worldPixelDelta, resolveWorkspacePreferences} from '../utils/workspaceView.ts';

test('zoom limits protect the editor and invalid storage', () => {
  assert.equal(clampWorkspaceZoom(0),50);
  assert.equal(clampWorkspaceZoom(900),250);
  assert.equal(clampWorkspaceZoom(NaN),100);
  assert.equal(resolveWorkspacePreferences({zoom:999,snap:false,background:'unknown'}).zoom,250);
  assert.equal(resolveWorkspacePreferences({zoom:999,snap:false,background:'unknown'}).background,'dark');
  assert.equal(resolveWorkspacePreferences({zoom:999,snap:false}).snap,false);
});
test('fit stays 16:9 and respects workspace dimensions', () => {
  assert.equal(fitCanvasWidth(1500,900),960);
  assert.equal(fitCanvasWidth(900,400), (400-80)*16/9);
  assert.ok(fitCanvasWidth(500,300) <= 420);
});
test('canvas zoom affects pointer movement, not broadcast coordinates', () => {
  assert.equal(worldPixelDelta(96,960,100),192);
  assert.equal(worldPixelDelta(96,960,200),96);
  assert.equal(worldPixelDelta(96,960,50),384);
});
