import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Regression contract for the V4.2 UX layer. These are structural checks,
// not OBS integration tests or a replacement for Windows manual rehearsal.
const source=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

const app=source('src/App.tsx');
const header=source('src/components/common/Header.tsx');
const studio=source('src/components/spaces/ContentStudioSpace.tsx');
const live=source('src/components/spaces/BroadcastControlSpace.tsx');
const home=source('src/components/spaces/MissionControlSpace.tsx');
const styles=source('src/index.css');

test('UX V4.2: main navigation has five understandable spaces',()=>{
  for (const title of ['Inicio','Diseñar','Preparar','En Vivo','Biblioteca']) {
    assert.ok(header.includes(`label: '${title}'`),`Missing navigation label: ${title}`);
  }
  assert.ok(header.indexOf("label: 'Diseñar'") < header.indexOf("label: 'En Vivo'"));
});

test('UX V4.2: general navigation clears stale live graphic focus',()=>{
  assert.match(app,/const navigateWorkspace = \(space:NavigationSpace\) =>/);
  assert.ok(app.includes("if (space === 'en-vivo') setLiveFocusGraphic(null)"));
  assert.equal(app.split('onNavigate={navigateWorkspace}').length-1,2);
});

test('UX V4.2: explicit editor handoff preserves selected graphic without broadcasting it',()=>{
  assert.ok(app.includes("onGoLive={id => {setLiveFocusGraphic(id);setActiveSpace('en-vivo');}}"));
  assert.ok(studio.includes('onGoLive: (graphicId:string) => void;'));
  assert.equal(studio.split('onClick={()=>onGoLive(selectionKey)}').length-1,2);
  assert.ok(live.includes('onClearGraphicFocus: () => void;'));
  assert.ok(live.includes('onClick={onClearGraphicFocus}'));
});

test('UX V4.2: publishing is named differently from on-air visibility',()=>{
  assert.ok(studio.includes('Publicar diseño'));
  assert.ok(studio.includes('no muestra la gráfica al aire.'));
  assert.ok(studio.includes("onPublishGraphic: (id: string) => Promise<void>"));
  assert.ok(live.includes("onToggleComponentVisibility(c.type, linked || source?.name)"));
  assert.ok(live.includes('Mostrar en Program'));
  assert.ok(live.includes('Ocultar de Program'));
});

test('UX V4.2: controls never advertise an unverified video monitor as real video',()=>{
  assert.ok(live.includes('Representación de estado · no muestra video'));
  assert.ok(live.includes('verificar video en OBS'));
  assert.ok(home.includes('no confirman audio, imagen ni emisión pública'));
  assert.ok(header.includes('Cámara virtual de OBS activa (emisión externa no confirmada)'));
});

test('UX V4.2: scene preparation, protection and transition restrictions remain visible',()=>{
  assert.ok(live.includes('onSetPreviewScene(sceneName)'));
  assert.ok(live.includes('onSetProgramScene(sceneName)'));
  assert.ok(live.includes('(!obsStatus.studioMode && isProtectedMode)'));
  assert.ok(live.includes('(isProtectedMode && obsStatus.studioMode)'));
  assert.ok(live.includes('!obsStatus.currentPreviewScene || transitionPending'));
});

test('UX V4.2: unsafe or missing source binding has a recovery path, not an activation shortcut',()=>{
  assert.ok(live.includes('matchingLiveSources(programSources, config, config.type, linked)'));
  assert.ok(live.includes('Resolver vínculo ambiguo'));
  assert.ok(live.includes('Revisar fuente OBS'));
  assert.ok(live.includes('setEditLinks(true);setDetailGraphic(c.type)'));
  assert.ok(live.includes('disabled={unavailable || pending || transitionPending || scenePending}'));
});

test('UX V4.2: virtual camera toggles require an OBS connection',()=>{
  assert.ok(header.includes('disabled={!obsStatus.connected}'));
  assert.ok(home.includes('disabled={!obsStatus.connected}'));
  assert.ok(header.includes('aria-pressed={obsStatus.virtualCamActive}'));
});

test('UX V4.2: ergonomics offer compact schematic views and editor height optimization',()=>{
  assert.ok(live.includes('stdq-v42-live-compact-v1'));
  assert.ok(live.includes('Ampliar monitores'));
  assert.ok(live.includes('Compactar monitores'));
  assert.ok(styles.includes('@media (max-height: 820px)'));
  assert.ok(styles.includes('UX V4.2 Etapa 4'));
});

test('UX V4.2 ATEM Broadcast Surface: enforces hardware tally semantics, protected mode persistence, and truthful telemetry', () => {
  assert.ok(styles.includes('--tally-program: #D91F26'));
  assert.ok(styles.includes('--tally-preview: #00C853'));
  assert.ok(styles.includes('.atem-chassis'));
  assert.ok(styles.includes('.atem-btn-pgm'));
  assert.ok(styles.includes('.atem-btn-pvw'));

  assert.ok(app.includes('stdq_obs_master_protected_mode_v3'));
  assert.ok(app.includes('activeGraphicsCount'));

  assert.ok(live.includes('PREVIEW · PREPARACIÓN'));
  assert.ok(live.includes('PROGRAM · SALIDA OBS'));
  assert.ok(live.includes('M/E 1 · BANCO DE ESCENAS OBS'));
  assert.ok(live.includes('DOWNSTREAM KEYERS · MATRIZ DE GRÁFICAS EN PROGRAM'));

  assert.ok(home.includes('disabled={!obsStatus.connected}'));

  const obsSettings = source('src/components/spaces/OBSSettingsTab.tsx');
  assert.ok(!obsSettings.includes('/OBS-Master-v3.0.1.zip'));

  const perf = source('src/components/spaces/PerformanceTab.tsx');
  assert.ok(!perf.includes('EMEET 4K WebCam'));
});
