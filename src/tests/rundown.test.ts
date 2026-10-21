import test from 'node:test';
import assert from 'node:assert/strict';
import type { RundownBlock } from '../types/index.ts';

function calculateTotalRundownDuration(blocks: RundownBlock[]): number {
  return blocks.reduce((acc, block) => acc + block.durationSeconds, 0);
}

function getNextRundownBlock(blocks: RundownBlock[], currentId: string): RundownBlock | null {
  const currentIndex = blocks.findIndex(b => b.id === currentId);
  if (currentIndex >= 0 && currentIndex < blocks.length - 1) {
    return blocks[currentIndex + 1];
  }
  return null;
}

test('calculateTotalRundownDuration sums block durations properly', () => {
  const blocks: RundownBlock[] = [
    { id: '1', order: 1, timePlanned: '20:00', title: 'Intro', presenter: 'DJ', durationSeconds: 60, obsSceneTarget: 'SCENE_1', graphicComponents: [], notes: '', status: 'completed' },
    { id: '2', order: 2, timePlanned: '20:01', title: 'Tema', presenter: 'Samuel', durationSeconds: 600, obsSceneTarget: 'SCENE_2', graphicComponents: [], notes: '', status: 'on-air' },
    { id: '3', order: 3, timePlanned: '20:11', title: 'Outro', presenter: 'DJ', durationSeconds: 120, obsSceneTarget: 'SCENE_3', graphicComponents: [], notes: '', status: 'pending' },
  ];

  assert.equal(calculateTotalRundownDuration(blocks), 780);
});

test('getNextRundownBlock correctly returns next scheduled block', () => {
  const blocks: RundownBlock[] = [
    { id: 'b1', order: 1, timePlanned: '20:00', title: 'Intro', presenter: 'Samuel', durationSeconds: 60, obsSceneTarget: 'SCENE_1', graphicComponents: [], notes: '', status: 'completed' },
    { id: 'b2', order: 2, timePlanned: '20:01', title: 'Debate', presenter: 'Samuel', durationSeconds: 300, obsSceneTarget: 'SCENE_2', graphicComponents: [], notes: '', status: 'on-air' },
  ];

  const next = getNextRundownBlock(blocks, 'b1');
  assert.equal(next?.id, 'b2');
  assert.equal(getNextRundownBlock(blocks, 'b2'), null);
});
