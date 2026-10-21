import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map<string, string>([['stdq_obs_connection_config', JSON.stringify({ autoConnect: false })]]);
(globalThis as any).localStorage = {
  getItem: (key: string) => mem.get(key) || null,
  setItem: (key: string, value: string) => mem.set(key, value),
};

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static last: MockWebSocket;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  failType = '';
  requests: any[] = [];
  url: string;
  constructor(url: string) { this.url = url; MockWebSocket.last = this; }
  send(payload: string) {
    const message = JSON.parse(payload);
    if (message.op !== 6) return;
    const { requestId, requestType, requestData } = message.d;
    this.requests.push(message.d);
    let result: any = {};
    if (requestType === 'GetSceneTransitionList') result = { currentSceneTransitionName: 'Fade', transitions: [{ transitionName: 'Fade' }, { transitionName: 'Cut' }] };
    if (requestType === 'GetSceneList') result = { currentProgramSceneName: 'CAM', currentPreviewSceneName: 'INTRO', scenes: [{ sceneName: 'CAM' }, { sceneName: 'INTRO' }] };
    if (requestType === 'GetSceneItemList') result = { sceneItems: requestData.sceneName === 'CAM' ? [{ sourceName: 'GFX_BANNER_FRASE', sceneItemId: 17, sceneItemEnabled: true, inputKind: 'browser_source' }] : [] };
    if (requestType === 'ToggleVirtualCam') result = { outputActive: true };
    if (requestType === 'GetVirtualCamStatus') result = { outputActive: false };
    if (requestType === 'GetStats') result = { cpuUsage: 8, memoryUsage: 120, activeFps: 30, averageFrameRenderTime: 2 };
    if (requestType === 'GetStreamStatus' || requestType === 'GetRecordStatus') result = { outputActive: false, outputKbitsPerSec: 0 };
    if (requestType === 'GetStudioModeEnabled') result = { studioModeEnabled: true };
    if (requestType === 'GetInputSettings') result = {inputSettings:{url:'http://localhost:3000/?overlayId=gfx-1234567890abcdef12345678'}};
    const ok = requestType !== this.failType;
    queueMicrotask(() => this.receive({ op: 7, d: { requestId, requestType, requestStatus: { result: ok, comment: ok ? '' : 'OBS rechazó la operación' }, responseData: result } }));
  }
  receive(msg: object) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: 'cerrado' }); }
}
(globalThis as any).WebSocket = MockWebSocket;

const { obsService } = await import('../services/obsWebSocket.ts');

test('no confirma peticiones OBS desconectadas', async () => {
  await assert.rejects(obsService.sendRequest('SetCurrentProgramScene', { sceneName: 'CAM' }), /desconectado/i);
});

test('connect espera Identified y no solo socket abierto', async () => {
  let done = false;
  const pending = obsService.connect({ autoConnect: false }).then(value => { done = true; return value; });
  const ws = MockWebSocket.last;
  ws.open();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(done, false);
  ws.receive({ op: 0, d: { rpcVersion: 1, obsWebSocketVersion: '5.6.0' } });
  ws.receive({ op: 2, d: { negotiatedRpcVersion: 1 } });
  assert.equal(await pending, true);
  // initial sync may still be finishing
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(obsService.getStatus().connected, true);
});

test('nunca cambia el estado de programa ante rechazo OBS', async () => {
  const ws = MockWebSocket.last;
  const previous = obsService.getStatus().currentProgramScene;
  ws.failType = 'SetCurrentProgramScene';
  await assert.rejects(obsService.setProgramScene('NO_EXISTE'), /rechazó/);
  assert.equal(obsService.getStatus().currentProgramScene, previous);
  ws.failType = '';
});

test('usa nombre exacto y la fuente real de OBS', async () => {
  const ws = MockWebSocket.last;
  await obsService.setSourceVisibility('CAM', 'Banner', false, 'banner');
  const item = [...ws.requests].reverse().find((r: { requestType: string }) => r.requestType === 'SetSceneItemEnabled');
  assert.equal(item.requestData.sceneItemId, 17);
  assert.equal(item.requestData.sceneItemEnabled, false);
  await assert.rejects(obsService.setSourceVisibility('CAM', 'otra_fuente', true), /no se encontró/i);
});

test('despejar gráficas realiza las peticiones SetSceneItemEnabled', async () => {
  const ws = MockWebSocket.last;
  const result = await obsService.hideOverlaySources({ banner: { name: 'Banner' } });
  assert.equal(result.hidden, 1);
  assert.equal(result.failures.length, 0);
  assert.ok(ws.requests.some(r => r.requestType === 'SetSceneItemEnabled' && r.requestData.sceneItemEnabled === false));
});

test('transiciones: solo usa nombres instalados y rechaza otros antes de llamar a OBS', async () => {
  const ws = MockWebSocket.last;
  const found = await obsService.fetchTransitions();
  assert.deepEqual(found, ['Fade', 'Cut']);
  const before = ws.requests.length;
  await assert.rejects(obsService.executeTransition('Wipe'), /no está instalada/i);
  assert.equal(ws.requests.slice(before).some((r: { requestType: string }) => r.requestType === 'SetCurrentSceneTransition'), false);
  await obsService.executeTransition('Cut');
  assert.ok(ws.requests.some((r: { requestType: string; requestData: { transitionName?: string } }) => r.requestType === 'SetCurrentSceneTransition' && r.requestData.transitionName === 'Cut'));
  assert.ok(ws.requests.some((r: { requestType: string }) => r.requestType === 'TriggerStudioModeTransition'));
});

test('toggle virtual cam no inventa cambio cuando OBS falla', async () => {
  const ws = MockWebSocket.last;
  ws.failType = 'ToggleVirtualCam';
  await assert.rejects(obsService.toggleVirtualCam(), /rechazó/);
  assert.equal(obsService.getStatus().virtualCamActive, false);
  ws.failType = '';
  assert.equal(await obsService.toggleVirtualCam(), true);
});

test('nueva fuente OBS se crea desactivada y se puede verificar su URL', async () => {
  const ws=MockWebSocket.last;
  await obsService.createCustomBrowserSource('CAM','STDQ_GFX_1234','http://localhost:3000/?overlayId=gfx-1234567890abcdef12345678');
  const created=[...ws.requests].reverse().find(r=>r.requestType==='CreateInput');
  assert.equal(created.requestData.inputKind,'browser_source');
  assert.equal(created.requestData.sceneItemEnabled,false);
  assert.equal(created.requestData.inputSettings.width,1920);
  assert.equal(await obsService.browserSourceUrl('STDQ_GFX_1234'),'http://localhost:3000/?overlayId=gfx-1234567890abcdef12345678');
});

test('desconectar manualmente mantiene sesión desconectada', async () => {
  obsService.disconnect();
  assert.equal(obsService.getStatus().connected, false);
  await assert.rejects(obsService.sendRequest('GetStats'), /desconectado/i);
});

