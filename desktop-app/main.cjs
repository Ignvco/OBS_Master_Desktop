// OBS MASTER — production desktop entrypoint (no Vite development server).
const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage, session, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { DirectProcess } = require('./direct-process.cjs');

// Keep unpackaged development data separate from the installed stable v4.2.
const DATA_DIR_NAME = app.isPackaged ? 'STDQ OBS Master' : 'STDQ OBS Master V5 Native Dev';
const APP_ID = 'cl.sitedijeraque.obsmaster';
const PORT = 3000;
let mainWindow;
let tray;
let httpServers = [];
let explicitQuit = false;
let resizeTimer;
let rendererRecoveries = 0;
let direct;
function createDirectSupervisor() {
  const lab = process.env.STDQ_DIRECT_LAB || path.join(app.getPath('documents'), 'OBS-MASTER-DIRECT-LAB');
  direct = new DirectProcess({
    python: process.env.STDQ_DIRECT_PYTHON || path.join(lab,'.venv312clean','Scripts','python.exe'),
    script: process.env.STDQ_DIRECT_SCRIPT || (app.isPackaged ? path.join(process.resourcesPath,'direct-engine','direct_graphics.py') : path.join(__dirname,'lab','direct_graphics.py')),
    url:'http://127.0.0.1:3000/?overlay=direct-program',
    log: message => { if (process.env.STDQ_DIRECT_DEBUG==='1') console.log('[Direct]',message.trim()); },
  });
}
function reportDirectError(e) {
  dialog.showErrorBox('Unity Camera',String(e?.message||e));
}

const WINDOW_STATE = () => path.join(app.getPath('userData'), 'window-state.json');
function storedWindowBounds() {
  try {
    const bounds = JSON.parse(fs.readFileSync(WINDOW_STATE(), 'utf8'));
    if (![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)) return {};
    if (bounds.width < 1120 || bounds.height < 720 || bounds.width > 8000 || bounds.height > 5000) return {};
    const visible = screen.getAllDisplays().some(d => {
      const r = d.workArea;
      return bounds.x < r.x+r.width-160 && bounds.x+bounds.width > r.x+160
        && bounds.y < r.y+r.height-100 && bounds.y+bounds.height > r.y+100;
    });
    return visible ? bounds : {};
  } catch { return {}; }
}
function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized() || mainWindow.isMaximized()) return;
  try {
    fs.writeFileSync(WINDOW_STATE(), JSON.stringify(mainWindow.getBounds()), {mode:0o600});
  } catch { /* Non-critical preference. */ }
}
function requestFullExit() {
  if (explicitQuit) return;
  const choice = dialog.showMessageBoxSync({
    type: 'warning', title: 'Salir completamente de OBS MASTER',
    message: 'Salir detendrá OBS MASTER y la salida Unity Camera.',
    detail: 'Si StreamYard está usando OBS MASTER, la señal puede interrumpirse. Para seguir transmitiendo utiliza Minimizar a bandeja.',
    buttons: ['Cancelar', 'Salir completamente'], defaultId: 0, cancelId: 0, noLink: true,
  });
  if (choice === 1) { explicitQuit = true; app.quit(); }
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'SI TE DIJERA QUE? | OBS MASTER',
    width: 1540, height: 940, minWidth: 1120, minHeight: 720,
    ...storedWindowBounds(),
    backgroundColor: '#090A0D', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: false,
      // No preload and no Node APIs exposed to broadcast content.
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('resize', () => { clearTimeout(resizeTimer); resizeTimer=setTimeout(saveBounds,600); });
  mainWindow.on('move', () => { clearTimeout(resizeTimer); resizeTimer=setTimeout(saveBounds,600); });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (explicitQuit) return;
    // Keep the local graphic server available even if React's renderer crashes.
    if (rendererRecoveries++ < 2) {
      setTimeout(() => { if (!mainWindow.isDestroyed()) mainWindow.reload(); }, 1000);
    } else {
      dialog.showErrorBox('Interfaz interrumpida', 'La interfaz dejó de responder. El servidor local continúa activo. Cierra OBS MASTER y ábrelo nuevamente cuando no estés al aire.');
    }
  });
  mainWindow.on('close', e => {
    if (!explicitQuit) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (/^https:\/\//i.test(url)) {
      const result = dialog.showMessageBoxSync(mainWindow, {
        type:'question', title:'Abrir sitio externo',
        message:'¿Abrir este enlace fuera de OBS MASTER?', detail:url.slice(0,250),
        buttons:['Cancelar','Abrir enlace'], defaultId:0, cancelId:0,
      });
      if (result === 1) shell.openExternal(url).catch(() => {});
    }
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}/`)) e.preventDefault();
  });
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
}
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('OBS MASTER · Motor de gráficas activo');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label: 'Abrir OBS MASTER', click: showWindow},
    {label: 'Iniciar Unity Camera (laboratorio)', click:()=>{try{direct.start();}catch(e){reportDirectError(e);}}},
    {label: 'Detener Unity Camera',click:()=>{void direct.stop().then(s=>{if(s.state==='error')reportDirectError(s.error);});}},
    {label: 'Abrir carpeta de datos', click: () => shell.openPath(path.join(app.getPath('userData'), '.stdq-runtime'))},
    {type: 'separator'},
    {label: 'Salir completamente', click: requestFullExit},
  ]));
  tray.on('double-click', showWindow);
}

// Use a stable data location before the Chromium profile/session initializes.
const appDataFolder = path.join(app.getPath('appData'), DATA_DIR_NAME);
fs.mkdirSync(appDataFolder, {recursive:true});
app.setPath('userData', appDataFolder);
app.setAppUserModelId(APP_ID);

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    try {
      const runtime = path.join(app.getPath('userData'), '.stdq-runtime');
      fs.mkdirSync(runtime, {recursive:true});
      process.env.STDQ_DATA_DIR = runtime;
      process.env.STDQ_STATIC_DIR = path.join(__dirname, 'dist');
      session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
        // Preserve Copy URL and media export interactions in the studio.
        callback(permission === 'clipboard-sanitized-write');
      });
      // Read native compiled JS, never Vite or TypeScript source at runtime.
      const {startStationServer} = await import('./compiled/desktop-app/server.js');
      createDirectSupervisor();
      httpServers = await startStationServer({
        port: PORT,
        staticDir: path.join(__dirname,'dist'),
        directStatus: () => direct.status(),
        directMonitor: () => direct.monitorToken ? {port:direct.monitorPort,token:direct.monitorToken} : null,
        directTake: {
          take: (revision,takeId) => direct.take(revision,takeId),
          rollback: takeId => direct.rollbackTake(takeId),
        },
      });
      createWindow();
      createTray();
    } catch (error) {
      dialog.showErrorBox('No se pudo iniciar OBS MASTER',
        'No fue posible activar el servidor local en el puerto 3000.\n\n'+
        'Cierra cualquier instancia de OBS MASTER/Vite que esté usando el puerto.\n\n'+
        'Detalle: '+String(error.message || error));
      explicitQuit = true;
      app.quit();
    }
  });
  app.on('before-quit', (event) => {
    clearTimeout(resizeTimer); saveBounds(); explicitQuit=true;
    if(direct?.child && !app._directStopping){
      event.preventDefault();app._directStopping=true;
      void direct.stop().finally(()=>app.quit());
    }
  });
  app.on('window-all-closed', () => { /* Minimize to tray; keep OBS Browser Sources online. */ });
  app.on('quit', () => {
    for (const s of httpServers) { try {s.close();} catch {} }
  });
}
