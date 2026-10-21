import type { OBSStatus, OBSConnectionConfig, OBSScene, OBSSceneSource, OBSTelemetryPoint } from '../types';
import { SOURCE_ALIASES } from '../constants/obsSources.ts';

export interface OBSLogEntry {
  time: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export type OBSStatusListener = (status: OBSStatus) => void;
export type OBSLogListener = (log: OBSLogEntry) => void;

/**
 * Standard Browser WebCrypto SHA-256 helper for OBS WebSocket v5 Authentication
 */
async function sha256Base64(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return btoa(binary);
}

// Never invent historical CPU/FPS/bitrate samples. Charts remain empty until OBS responds.
function createInitialTelemetry(): OBSTelemetryPoint[] { return []; }

// Exact aliases for the OBS sources created by the earlier Content Studio editions.
export { SOURCE_ALIASES } from '../constants/obsSources.ts';


class OBSWebSocketService {
  private static instance: OBSWebSocketService;
  private ws: WebSocket | null = null;
  private listeners: Set<OBSStatusListener> = new Set();
  private logListeners: Set<OBSLogListener> = new Set();
  private pendingRequests: Map<string, { resolve: (data: any) => void; reject: (err: any) => void; timeout: any }> = new Map();
  private reconnectTimer: any = null;
  private statsTimer: any = null;
  private connectionTimeoutTimer: any = null;
  private manualDisconnect = false;
  private handshake: { resolve: (ok: boolean) => void; timer: ReturnType<typeof setTimeout> } | null = null;

  public logs: OBSLogEntry[] = [];

  private status: OBSStatus = {
    connected: false,
    connecting: false,
    authenticated: false,
    isSimulated: false,
    handshakeStage: 'idle',
    currentProgramScene: '',
    currentPreviewScene: '',
    studioMode: false,
    virtualCamActive: false,
    recordingActive: false,
    streamActive: false,
    scenes: [],
    availableTransitions: [],
    currentTransitionName: undefined,
    lastError: null,
    latencyMs: 0,
    cpuUsagePercent: 0,
    memoryUsageMb: 0,
    kbitsPerSec: 0,
    droppedFrames: 0,
    totalFrames: 0,
    fps: 0,
    renderTimeAverageMs: 0,
    telemetryHistory: createInitialTelemetry(),
  };

  private config: OBSConnectionConfig = {
    host: '127.0.0.1',
    port: 4455,
    password: '',
    autoConnect: true,
    useSsl: false,
  };

  private constructor() {
    // Load saved connection config
    try {
      const saved = localStorage.getItem('stdq_obs_connection_config');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch {
      // default config
    }

    // Auto-connect on startup if enabled
    if (this.config.autoConnect && !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('overlay'))) {
      setTimeout(() => {
        this.connect();
      }, 500);
    }
  }

  public static getInstance(): OBSWebSocketService {
    if (!OBSWebSocketService.instance) {
      OBSWebSocketService.instance = new OBSWebSocketService();
    }
    return OBSWebSocketService.instance;
  }

  public getStatus(): OBSStatus {
    return { ...this.status };
  }

  public getConfig(): OBSConnectionConfig {
    return { ...this.config };
  }

  public subscribe(listener: OBSStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeLogs(listener: OBSLogListener): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  private addLog(type: 'info' | 'success' | 'warn' | 'error', message: string) {
    const entry = {
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      message,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 80) this.logs.pop();

    this.logListeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        console.error('Error in log listener', e);
      }
    });
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (err) {
        console.error('Error in OBS status listener', err);
      }
    });
  }

  public getLogs(): OBSLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.logListeners.forEach(listener => {
      try {
        listener({
          time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'info',
          message: 'Registro de conexión limpiado.'
        });
      } catch {}
    });
  }

  public updateConfig(newConfig: Partial<OBSConnectionConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('stdq_obs_connection_config', JSON.stringify(this.config));
    } catch (err) {
      console.warn('Failed to save OBS config', err);
    }
  }

  /**
   * Determine exact target WebSocket URL based on config & browser environment
   */
  public getTargetUrl(): string {
    const rawHost = (this.config.host || '127.0.0.1').trim();
    if (rawHost.startsWith('ws://') || rawHost.startsWith('wss://')) {
      return rawHost;
    }
    const protocol = this.config.useSsl ? 'wss' : 'ws';
    const port = this.config.port || 4455;
    return `${protocol}://${rawHost}:${port}`;
  }

  /**
   * Connect to real OBS WebSocket v5
   */
  public async connect(overrideConfig?: Partial<OBSConnectionConfig>): Promise<boolean> {
    if (overrideConfig) {
      this.updateConfig(overrideConfig);
    }

    this.manualDisconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }

    this.status.connecting = true;
    this.status.connected = false;
    this.status.authenticated = false;
    this.status.isSimulated = false;
    this.status.handshakeStage = 'opening_socket';
    this.status.lastError = null;
    this.notify();

    const targetUrl = this.getTargetUrl();
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

    this.addLog('info', `Iniciando conexión con OBS Studio en ${targetUrl}...`);

    if (isHttps && targetUrl.startsWith('ws://')) {
      this.addLog('warn', 'Nota del navegador: Esta página está en HTTPS. Si el navegador bloquea ws://127.0.0.1, abre http://localhost:3000 o habilita "Insecure content" en la configuración del sitio.');
    }

    try {
      if (this.ws) {
        try {
          this.ws.close();
        } catch {}
        this.ws = null;
      }

      const ws = new WebSocket(targetUrl);
      this.ws = ws;
      const connected = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          if (this.handshake?.timer === timer) { this.handshake = null; resolve(false); }
          if (this.ws === ws && !this.status.authenticated) {
            this.handleConnectionFailure('OBS no completó el handshake en 8 segundos');
            ws.close();
          }
        }, 8000);
        this.handshake = { resolve, timer };
      });

      this.connectionTimeoutTimer = setTimeout(() => {
        if (!this.status.authenticated && this.ws === ws) {
          const errMsg = `Tiempo de espera agotado al conectar a ${targetUrl}. Verifique que OBS Studio esté abierto con Servidor WebSocket activo.`;
          this.addLog('warn', errMsg);
          this.handleConnectionFailure(errMsg);
          try {
            ws.close();
          } catch {}
        }
      }, 4500);

      ws.onopen = () => {
        if (this.connectionTimeoutTimer) {
          clearTimeout(this.connectionTimeoutTimer);
          this.connectionTimeoutTimer = null;
        }
        this.addLog('info', `Socket abierto con OBS en ${targetUrl}. Esperando saludo inicial (Hello OpCode 0)...`);
      };

      ws.onerror = (e) => {
        if (this.ws !== ws) return;
        if (this.connectionTimeoutTimer) {
          clearTimeout(this.connectionTimeoutTimer);
          this.connectionTimeoutTimer = null;
        }
        console.warn('OBS WebSocket onerror', e);
        let detail = `Error al conectar con OBS Studio en ${targetUrl}.`;
        if (isHttps && targetUrl.startsWith('ws://')) {
          detail += ' Bloqueado por política de contenido mixto del navegador (HTTPS -> ws://).';
        }
        this.addLog('error', detail);
        this.handleConnectionFailure(detail);
        try { ws.close(); } catch {}
      };

      ws.onclose = (event) => {
        if (this.connectionTimeoutTimer) {
          clearTimeout(this.connectionTimeoutTimer);
          this.connectionTimeoutTimer = null;
        }
        if (this.ws !== ws) return;
        if (this.handshake) { clearTimeout(this.handshake.timer); this.handshake.resolve(false); this.handshake = null; }
        this.stopStatsPolling();
        this.status.connected = false;
        this.status.connecting = false;
        this.status.authenticated = false;
        this.status.lastError = `Conexión cerrada (${event.code}): ${event.reason || 'sin detalles'}`;
        this.addLog('warn', `Conexión cerrada con OBS Studio (Código ${event.code}: ${event.reason || 'Sin razón especificada'}).`);
        this.notify();

        // Reject all pending requests
        this.pendingRequests.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject(new Error('Conexión con OBS cerrada'));
        });
        this.pendingRequests.clear();

        // Schedule reconnect if autoConnect is enabled
        if (this.config.autoConnect && !this.manualDisconnect && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 6000);
        }
      };

      ws.onmessage = async (event) => {
        if (this.ws !== ws) return;
        try {
          const msg = JSON.parse(event.data);
          await this.handleMessage(msg);
        } catch (err) {
          console.error('Error al procesar mensaje de OBS WebSocket:', err);
        }
      };

      return await connected;
    } catch (err: any) {
      this.handleConnectionFailure(err.message || 'Error de conexión');
      return false;
    }
  }

  private handleConnectionFailure(reason: string) {
    this.status.connected = false;
    this.status.connecting = false;
    this.status.authenticated = false;
    this.status.handshakeStage = 'failed';
    this.status.lastError = reason;
    this.notify();
  }

  /**
   * Handle OBS WebSocket v5 Protocol OpCodes
   */
  private async handleMessage(msg: { op: number; d: any }) {
    switch (msg.op) {
      // OpCode 0: Hello from OBS Studio
      case 0: {
        const { obsWebSocketVersion, rpcVersion, authentication } = msg.d;
        this.status.obsWebSocketVersion = obsWebSocketVersion;
        this.status.rpcVersion = rpcVersion;
        this.status.handshakeStage = 'received_hello';
        this.notify();
        this.addLog('info', `OBS Hello recibido: Protocolo v${rpcVersion}, OBS-WebSocket v${obsWebSocketVersion}.`);

        let authResponse: string | undefined = undefined;

        // If OBS requires password authentication
        if (authentication) {
          this.addLog('info', 'OBS requiere autenticación de contraseña. Calculando hash SHA-256...');
          if (!this.config.password) {
            this.addLog('warn', 'OBS requiere contraseña, pero no se ha configurado ninguna en el panel.');
          }
          const { challenge, salt } = authentication;
          const secret = await sha256Base64((this.config.password || '') + salt);
          authResponse = await sha256Base64(secret + challenge);
        }

        // Send OpCode 1: Identify
        const identifyPayload: any = {
          op: 1,
          d: {
            rpcVersion: 1,
            // Subscriptions: General(1) + Config(2) + Scenes(4) + Inputs(8) + Transitions(16) + Filters(32) + Outputs(64) + SceneItems(128) + MediaInputs(256) + UI(1024)
            eventSubscriptions: 1 | 2 | 4 | 8 | 16 | 64 | 128 | 256 | 512 | 1024,
          }
        };

        if (authResponse) {
          identifyPayload.d.authentication = authResponse;
        }

        this.status.handshakeStage = 'identifying';
        this.notify();
        this.sendRaw(identifyPayload);
        break;
      }

      // OpCode 2: Identified (Authentication & Handshake Succeeded)
      case 2: {
        this.status.connected = true;
        this.status.connecting = false;
        this.status.authenticated = true;
        this.status.isSimulated = false;
        this.status.handshakeStage = 'authenticated';
        if (this.handshake) { clearTimeout(this.handshake.timer); this.handshake.resolve(true); this.handshake = null; }
        this.status.lastError = null;
        this.addLog('success', '¡Conexión establecida y autenticada con OBS Studio con éxito!');
        this.notify();

        // Perform initial synchronization of scenes, virtual cam, and telemetry
        await this.syncWithOBS();
        this.startStatsPolling();
        break;
      }

      // OpCode 7: RequestResponse
      case 7: {
        const { requestId, requestType, requestStatus, responseData } = msg.d;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          if (requestStatus && requestStatus.result) {
            pending.resolve(responseData || {});
          } else {
            const comment = requestStatus?.comment || `OBS Error ${requestStatus?.code || 'desconocido'}`;
            this.addLog('error', `Error en petición OBS ${requestType}: ${comment}`);
            pending.reject(new Error(comment));
          }
        }
        break;
      }

      // OpCode 5: Events from OBS Studio
      case 5: {
        this.handleOBSEvent(msg.d.eventType, msg.d.eventData);
        break;
      }

      default:
        break;
    }
  }

  /**
   * Handle live OBS Studio events in real time
   */
  private handleOBSEvent(eventType: string, eventData: any) {
    switch (eventType) {
      case 'CurrentProgramSceneChanged':
        if (eventData.sceneName) {
          this.status.currentProgramScene = eventData.sceneName;
          this.addLog('info', `Escena al Aire cambiada a: ${eventData.sceneName}`);
          this.notify();
        }
        break;

      case 'CurrentPreviewSceneChanged':
        if (eventData.sceneName) {
          this.status.currentPreviewScene = eventData.sceneName;
          this.addLog('info', `Escena en Preview cambiada a: ${eventData.sceneName}`);
          this.notify();
        }
        break;

      case 'SceneItemCreated':
      case 'SceneItemRemoved':
      case 'SceneItemListReindexed':
      case 'SceneListChanged':
        this.syncWithOBS();
        break;

      case 'CurrentSceneTransitionChanged':
        this.status.currentTransitionName = eventData.transitionName;
        this.notify();
        break;

      case 'SceneTransitionListChanged':
        void this.fetchTransitions();
        break;

      case 'VirtualcamStateChanged':
        this.status.virtualCamActive = Boolean(eventData.outputActive);
        this.addLog('info', `Cámara Virtual de OBS: ${this.status.virtualCamActive ? 'ACTIVADA' : 'DETENIDA'}`);
        this.notify();
        break;

      case 'StreamStateChanged':
        this.status.streamActive = Boolean(eventData.outputActive);
        this.addLog('info', `Emisión en Directo (Stream): ${this.status.streamActive ? 'AL AIRE' : 'DETENIDA'}`);
        this.notify();
        break;

      case 'RecordStateChanged':
        this.status.recordingActive = Boolean(eventData.outputActive);
        this.addLog('info', `Grabación Local de OBS: ${this.status.recordingActive ? 'GRABANDO' : 'DETENIDA'}`);
        this.notify();
        break;

      case 'StudioModeStateChanged':
        this.status.studioMode = Boolean(eventData.studioModeEnabled);
        this.addLog('info', `Modo Estudio de OBS: ${this.status.studioMode ? 'ACTIVADO' : 'DESACTIVADO'}`);
        this.notify();
        break;

      case 'SceneItemEnableStateChanged':
        this.updateSourceState(eventData.sceneName, eventData.sceneItemId, eventData.sceneItemEnabled);
        break;

      default:
        break;
    }
  }

  private sendRaw(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send request to OBS Studio and wait for response
   */
  public sendRequest<T = any>(requestType: string, requestData?: Record<string, any>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.status.authenticated) {
        reject(new Error('OBS está desconectado. No se envió la acción.'));
        return;
      }

      const requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.addLog('error', `Tiempo de espera agotado para petición OBS: ${requestType}`);
        reject(new Error(`Timeout en petición ${requestType}`));
      }, 5000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.sendRaw({
        op: 6,
        d: {
          requestType,
          requestId,
          requestData: requestData || {},
        }
      });
    });
  }

  /**
   * Synchronize full scene list and states from real OBS
   */
  /** Transiciones declaradas por la instalación OBS actualmente conectada. */
  public async fetchTransitions(): Promise<string[]> {
    const data = await this.sendRequest<{ transitions?: { transitionName: string }[]; currentSceneTransitionName?: string }>('GetSceneTransitionList');
    const names = (data.transitions || [])
      .map(item => item.transitionName)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
    const uniqueNames = [...new Set(names)];
    this.status.availableTransitions = uniqueNames;
    this.status.currentTransitionName = data.currentSceneTransitionName;
    this.notify();
    return uniqueNames;
  }

  public async syncWithOBS() {
    try {
      // 1. Get Scene List
      const sceneList = await this.sendRequest('GetSceneList');
      if (sceneList && sceneList.scenes) {
        this.status.currentProgramScene = sceneList.currentProgramSceneName || this.status.currentProgramScene;
        this.status.currentPreviewScene = sceneList.currentPreviewSceneName || this.status.currentPreviewScene;

        const formattedScenes: OBSScene[] = [];
        // Multiple scenes can share the same OBS input. Resolve each Browser Source URL once per sync.
        const inputUrlCache=new Map<string,Promise<string|undefined>>();
        for (let idx = 0; idx < sceneList.scenes.length; idx++) {
          const s = sceneList.scenes[idx];
          const sceneName = s.sceneName;

          // Fetch items for this scene
          let sources: OBSSceneSource[] = [];
          try {
            const itemsRes = await this.sendRequest('GetSceneItemList', { sceneName });
            if (itemsRes && Array.isArray(itemsRes.sceneItems)) {
              sources = await Promise.all(itemsRes.sceneItems.map(async (item: any):Promise<OBSSceneSource> => {
                const source:OBSSceneSource={
                  id:String(item.sceneItemId),name:item.sourceName,
                  type:item.inputKind||item.sourceType||'source',enabled:Boolean(item.sceneItemEnabled),locked:Boolean(item.sceneItemLocked),
                };
                if(source.type==='browser_source'){
                  // URL is source-owned metadata. Verify before associating a graphic; an
                  // alias match alone is insufficient for custom graphics.
                  let read=inputUrlCache.get(source.name);
                  if(!read){read=this.browserSourceUrl(source.name).catch(()=>undefined);inputUrlCache.set(source.name,read);}
                  source.browserUrl=await read;
                }
                return source;
              }));
            }
          } catch {
            // ignore item listing failure
          }

          formattedScenes.push({
            id: `scene-${idx + 1}`,
            name: sceneName,
            sources,
          });
        }

        if (formattedScenes.length > 0) {
          this.status.scenes = formattedScenes;
        }
      }

      // 2. Transiciones efectivamente instaladas; nunca ofrecer Wipe/Cut inventados.
      try { await this.fetchTransitions(); }
      catch { this.status.availableTransitions = []; this.status.currentTransitionName = undefined; }

      // 3. Get Virtual Camera Status
      try {
        const vcam = await this.sendRequest('GetVirtualCamStatus');
        if (vcam && typeof vcam.outputActive === 'boolean') {
          this.status.virtualCamActive = vcam.outputActive;
        }
      } catch (e) {}

      // 3. Get Studio Mode Status
      try {
        const studio = await this.sendRequest('GetStudioModeEnabled');
        if (studio && typeof studio.studioModeEnabled === 'boolean') {
          this.status.studioMode = studio.studioModeEnabled;
        }
      } catch (e) {}

      // 4. Get Stream & Record Status
      try {
        const stream = await this.sendRequest('GetStreamStatus');
        if (stream && typeof stream.outputActive === 'boolean') {
          this.status.streamActive = stream.outputActive;
        }
      } catch (e) {}

      try {
        const rec = await this.sendRequest('GetRecordStatus');
        if (rec && typeof rec.outputActive === 'boolean') {
          this.status.recordingActive = rec.outputActive;
        }
      } catch (e) {}

      // 5. Initial Stats
      await this.queryStats();

      this.notify();
    } catch (err) {
      console.error('Error synchronizing with OBS:', err);
    }
  }

  private updateSourceState(sceneName: string, sceneItemId: number, enabled: boolean) {
    this.status.scenes = this.status.scenes.map(sc => {
      if (sc.name === sceneName) {
        return {
          ...sc,
          sources: sc.sources.map(src => 
            Number(src.id) === sceneItemId ? { ...src, enabled } : src
          )
        };
      }
      return sc;
    });
    this.notify();
  }

  /**
   * Query real telemetry from OBS Studio
   */
  public async queryStats() {
    try {
      const start = performance.now();
      const stats = await this.sendRequest('GetStats');
      const latency = Math.round(performance.now() - start);

      if (stats && typeof stats.cpuUsage === 'number') {
        this.status.latencyMs = latency;
        this.status.cpuUsagePercent = Number(stats.cpuUsage.toFixed(1));
        this.status.memoryUsageMb = Math.round(stats.memoryUsage || 0);
        this.status.fps = Number((stats.activeFps || 0).toFixed(1));
        this.status.renderTimeAverageMs = Number((stats.averageFrameRenderTime || 0).toFixed(1));
      }

      // Query output stream stats
      try {
        const streamStats = await this.sendRequest('GetStreamStatus');
        if (streamStats && typeof streamStats.outputActive === 'boolean') {
          this.status.streamActive = streamStats.outputActive;
          this.status.kbitsPerSec = streamStats.outputKbitsPerSec || 0;
          this.status.droppedFrames = streamStats.outputSkippedFrames || 0;
          this.status.totalFrames = streamStats.outputTotalFrames || 0;
        }
      } catch { /* Stream output unavailable; no invented metrics. */ }

      // Append point to rolling history for Recharts
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const newPoint: OBSTelemetryPoint = {
        time: timeStr,
        cpu: this.status.cpuUsagePercent,
        bitrate: this.status.kbitsPerSec,
        droppedFrames: this.status.droppedFrames,
        fps: this.status.fps,
        memoryMb: this.status.memoryUsageMb
      };

      const history = this.status.telemetryHistory || [];
      this.status.telemetryHistory = [...history.slice(-19), newPoint];
      this.notify();
    } catch {
      // ignore transient query error
    }
  }

  private startStatsPolling() {
    this.stopStatsPolling();
    this.statsTimer = setInterval(() => {
      if (this.status.connected) {
        this.queryStats();
      }
    }, 1500);
  }

  private stopStatsPolling() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  public disconnect() {
    this.manualDisconnect = true;
    this.stopStatsPolling();
    if (this.handshake) { clearTimeout(this.handshake.timer); this.handshake.resolve(false); this.handshake = null; }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.forEach(({ reject, timeout }) => { clearTimeout(timeout); reject(new Error('Desconectado manualmente')); });
    this.pendingRequests.clear();
    this.status.connected = false;
    this.status.connecting = false;
    this.status.authenticated = false;
    this.status.handshakeStage = 'idle';
    this.addLog('info', 'Desconectado de OBS Studio.');
    this.notify();
  }

  /**
   * Set Program Scene in OBS
   */
  public async setProgramScene(sceneName: string): Promise<boolean> {
    await this.sendRequest('SetCurrentProgramScene', { sceneName });
    this.status.currentProgramScene = sceneName;
    this.notify();
    this.addLog('success', `Escena en Program confirmada: ${sceneName}`);
    return true;
  }

  public async setPreviewScene(sceneName: string): Promise<boolean> {
    await this.sendRequest('SetCurrentPreviewScene', { sceneName });
    this.status.currentPreviewScene = sceneName;
    this.notify();
    return true;
  }

  public async executeTransition(transitionName: string = 'Fade'): Promise<boolean> {
    if (!this.status.studioMode) throw new Error('Activa Modo Estudio para realizar transiciones.');
    // Always check the current OBS catalogue; status can be out of date after scene collection edits.
    const names = await this.fetchTransitions();
    if (!names.includes(transitionName)) {
      throw new Error(`«${transitionName}» no está instalada en OBS. Disponibles: ${names.join(', ') || 'ninguna'}.`);
    }
    if (this.status.currentTransitionName !== transitionName) {
      await this.sendRequest('SetCurrentSceneTransition', { transitionName });
      this.status.currentTransitionName = transitionName;
    }
    await this.sendRequest('TriggerStudioModeTransition');
    // OBS emits CurrentProgramSceneChanged / CurrentPreviewSceneChanged; do not guess.
    return true;
  }

  public async toggleVirtualCam(): Promise<boolean> {
    const res = await this.sendRequest<{ outputActive: boolean }>('ToggleVirtualCam');
    if (typeof res.outputActive !== 'boolean') throw new Error('OBS no confirmó el estado de cámara virtual.');
    this.status.virtualCamActive = res.outputActive;
    this.notify();
    return res.outputActive;
  }

  public async toggleStream(): Promise<boolean> {
    const res = await this.sendRequest<{ outputActive: boolean }>('ToggleStream');
    if (typeof res.outputActive !== 'boolean') throw new Error('OBS no confirmó el estado de emisión.');
    this.status.streamActive = res.outputActive;
    this.notify();
    return res.outputActive;
  }

  public async toggleRecord(): Promise<boolean> {
    const res = await this.sendRequest<{ outputActive: boolean }>('ToggleRecord');
    if (typeof res.outputActive !== 'boolean') throw new Error('OBS no confirmó el estado de grabación.');
    this.status.recordingActive = res.outputActive;
    this.notify();
    return res.outputActive;
  }

  public async toggleStudioMode(): Promise<boolean> {
    const newState = !this.status.studioMode;
    await this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: newState });
    this.status.studioMode = newState;
    this.notify();
    return newState;
  }

  /**
   * Toggle Source / Overlay visibility inside scene in OBS
   */
  public async setSourceVisibility(sceneName: string, sourceName: string, enabled: boolean, type?: string): Promise<boolean> {
    const target = sceneName || this.status.currentProgramScene;
    if (!target) throw new Error('No hay escena de programa confirmada.');
    const response = await this.sendRequest<{ sceneItems: any[] }>('GetSceneItemList', { sceneName: target });
    if (!Array.isArray(response.sceneItems)) throw new Error('OBS no entregó la lista de fuentes.');
    const aliases = [sourceName, ...(type ? SOURCE_ALIASES[type] || [] : [])]
      .map(s => s.trim().toLocaleLowerCase());
    const matched = response.sceneItems.filter(item => aliases.includes(String(item.sourceName).trim().toLocaleLowerCase()));
    if (matched.length !== 1) {
      throw new Error(matched.length > 1
        ? `Más de una fuente coincide con ${sourceName}; asígnala de forma única.`
        : `No se encontró «${sourceName}» en «${target}». Configura la fuente OBS (ej. ${SOURCE_ALIASES[type || '']?.[0] || sourceName}).`);
    }
    const item = matched[0];
    await this.sendRequest('SetSceneItemEnabled', { sceneName: target, sceneItemId: item.sceneItemId, sceneItemEnabled: enabled });
    this.updateSourceState(target, Number(item.sceneItemId), enabled);
    return true;
  }

  /** Read back the real Browser Source URL before allowing a custom graphic to affect it. */
  public async browserSourceUrl(sourceName:string):Promise<string> {
    const data=await this.sendRequest<{inputSettings?:{url?:string};inputKind?:string}>('GetInputSettings',{inputName:sourceName});
    const url=data.inputSettings?.url;
    if(typeof url!=='string'||!url)throw new Error(`OBS no confirmó la URL de «${sourceName}».`);
    return url;
  }

  /** Explicitly create a disabled and uniquely named Browser Source in the selected scene. */
  public async createCustomBrowserSource(sceneName:string,sourceName:string,url:string):Promise<void> {
    if(!this.status.connected)throw new Error('Conecta OBS primero.');
    if(!this.status.scenes.some(scene=>scene.name===sceneName))throw new Error('Escena no disponible en OBS.');
    await this.sendRequest('CreateInput',{
      sceneName,inputName:sourceName,inputKind:'browser_source',
      inputSettings:{url,width:1920,height:1080,reroute_audio:false},
      sceneItemEnabled:false,
    });
    await this.syncWithOBS();
  }

  /** Emergency clear across ALL scenes. Never claims success without OBS acknowledgements. */
  public async hideOverlaySources(components: Record<string, { name: string }>, linkedNames: string[] = []): Promise<{ hidden: number; failures: string[] }> {
    if (!this.status.connected) throw new Error('OBS desconectado. No se pudieron controlar sus fuentes.');
    const aliases = new Set<string>();
    Object.entries(components).forEach(([type, config]) => {
      [config.name, ...(SOURCE_ALIASES[type] || [])].forEach(name => aliases.add(name.trim().toLocaleLowerCase()));
    });
    linkedNames.forEach(name => { if (typeof name === 'string' && name.trim()) aliases.add(name.trim().toLocaleLowerCase()); });
    const failures: string[] = [];
    let hidden = 0;
    const list = await this.sendRequest<{ scenes: { sceneName: string }[] }>('GetSceneList');
    for (const scene of list.scenes || []) {
      try {
        const items = await this.sendRequest<{ sceneItems: any[] }>('GetSceneItemList', { sceneName: scene.sceneName });
        for (const item of items.sceneItems || []) {
          if (item.inputKind === 'browser_source' && aliases.has(String(item.sourceName).trim().toLocaleLowerCase()) && item.sceneItemEnabled) {
            try {
              await this.sendRequest('SetSceneItemEnabled', { sceneName: scene.sceneName, sceneItemId: item.sceneItemId, sceneItemEnabled: false });
              this.updateSourceState(scene.sceneName, Number(item.sceneItemId), false);
              hidden++;
            } catch (e: any) { failures.push(`${scene.sceneName}/${item.sourceName}: ${e.message}`); }
          }
        }
      } catch (e: any) { failures.push(`${scene.sceneName}: ${e.message}`); }
    }
    return { hidden, failures };
  }
}

export const obsService = OBSWebSocketService.getInstance();
