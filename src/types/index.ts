import type { LayerMotion } from '../utils/layerTimeline';
export type NavigationSpace = 'inicio' | 'preparacion' | 'en-vivo' | 'content-studio' | 'biblioteca';

export type ComponentType = 
  | 'banner'
  | 'lower-third'
  | 'chapter'
  | 'section'
  | 'question'
  | 'quote'
  | 'scripture'
  | 'social'
  | 'social-pill'
  | 'logo-bug'
  | 'ticker'
  | 'editorial'
  | 'waiting'
  | 'break'
  | 'outro';

export interface HostInfo {
  id: string;
  name: string;
  role: string;
  handle?: string;
  avatar?: string;
}

export interface RundownBlock {
  id: string;
  order: number;
  timePlanned: string;
  title: string;
  presenter: string;
  durationSeconds: number;
  obsSceneTarget: string;
  graphicComponents: ComponentType[];
  /** Independent custom graphic IDs planned for this segment. */
  customGraphicIds?: string[];
  introVideoAttached?: boolean;
  notes: string;
  status: 'pending' | 'preview' | 'on-air' | 'completed';
}

export interface EpisodeData {
  id: string;
  number: number;
  season: number;
  title: string;
  subtitle: string;
  date: string;
  description: string;
  hosts: HostInfo[];
  tags: string[];
  phrases: string[];
  questions: string[];
  scriptures: { reference: string; text: string; reflection?: string }[];
  quotes: { quote: string; author: string; context?: string }[];
  tickerNews: string[];
  rundown: RundownBlock[];
  /** Resource IDs associated with this episode in the media library. */
  assetIds?: string[];
  /** Episode-scoped preproduction checklist and rundown timing. */
  preparation?: import('../utils/preparation').PreparationState;
}

export interface FontSettings {
  family: 'Plus Jakarta Sans' | 'Playfair Display' | 'Barlow Condensed' | 'JetBrains Mono' | 'Space Grotesk';
  size: number;
  weight: 300 | 400 | 500 | 600 | 700 | 800;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  align: 'left' | 'center' | 'right';
  shadowColor?: string;
  shadowBlur?: number;
}

export interface GeometrySettings {
  x: number; // percentage or px
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  opacity: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  backgroundGradient?: {
    enabled: boolean;
    type: 'linear' | 'radial';
    from: string;
    to: string;
    angle: number;
  };
  boxShadow: string;
  padding: number;
  /** Remove ALL shadows and glow including template hardcoded classes. */
  flatMode?: boolean;
  /** Independent option to hide strokes and hardcoded template dividers. */
  hideBorders?: boolean;
}

export type AnimationPreset = 
  | 'apple-spring'
  | 'cinematic-slide'
  | 'mask-reveal'
  | 'stagger-fade-up'
  | 'scale-pop'
  | 'magazine-fold'
  | 'editorial-wipe'
  | 'soft-focus'
  | 'diagonal-reveal';

export interface AnimationSettings {
  preset: AnimationPreset;
  entryDurationMs: number;
  exitDurationMs: number;
  delayMs: number;
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)' | 'ease-out' | 'ease-in-out' | 'linear';
  staggerWords: boolean;
  direction: 'up' | 'down' | 'left' | 'right' | 'none';
  loopPulse: boolean;
}

export type GlyphMode = 'default' | 'logo' | 'image' | 'none';
export interface ComponentGlyphSettings {
  /** Prefer stable, local URLs served by our bridge so OBS can access them. */
  mode: GlyphMode;
  assetUrl?: string;
  size: number;
  opacity: number;
  radius: number;
}

export interface BrandingSettings {
  /** Local URL served by the station bridge; accessible in the OBS browser sandbox. */
  assetUrl: string;
  visible: boolean;
  width: number;
  x: number;
  y: number;
  opacity: number;
  rotation: number;
}

/** Non-destructive per-part overrides of the existing HTML templates. */
export interface LayerOverride {
  x?: number; y?: number; width?: number; height?: number;
  rotation?: number; opacity?: number; fontSize?: number;
  fontWeight?: number; color?: string; backgroundColor?: string;
  borderRadius?: number; zIndex?: number; hidden?: boolean; locked?: boolean; groupId?: string; motion?: LayerMotion;
  shapePreset?: import('../utils/creativeStyles').ShapePreset;
  gradientMode?: import('../utils/creativeStyles').GradientMode;
  gradientFrom?: string; gradientTo?: string; gradientAngle?: number;
  borderWidth?: number; borderColor?: string;
  shadowPreset?: import('../utils/creativeStyles').ShadowPreset;
  fontFamily?: string; textAlign?: 'left'|'center'|'right'; lineHeight?: number;
  letterSpacing?: number; textTransform?: 'none'|'uppercase'|'lowercase'|'capitalize';
  imageFit?: 'contain'|'cover'; imagePosition?: string;
  blendMode?: 'normal'|'multiply'|'screen'|'overlay';

}

/** Independently editable extra element positioned in the component's own 1920p coordinate space. */
export interface GraphicLayer {
  id: string;
  kind: 'text' | 'shape' | 'image';
  name: string;
  x: number; y: number; width: number; height: number;
  rotation: number; opacity: number; zIndex: number;
  hidden: boolean; locked: boolean;
  /** Logical editorial group: moving members together without changing renderer markup. */
  groupId?: string;
  motion?: LayerMotion;
  text?: string; assetUrl?: string;
  fontSize?: number; fontWeight?: number; color?: string;
  backgroundColor?: string; borderRadius?: number;

  shapePreset?: import('../utils/creativeStyles').ShapePreset;
  gradientMode?: import('../utils/creativeStyles').GradientMode;
  gradientFrom?: string; gradientTo?: string; gradientAngle?: number;
  borderWidth?: number; borderColor?: string;
  shadowPreset?: import('../utils/creativeStyles').ShadowPreset;
  fontFamily?: string; textAlign?: 'left'|'center'|'right'; lineHeight?: number;
  letterSpacing?: number; textTransform?: 'none'|'uppercase'|'lowercase'|'capitalize';
  imageFit?: 'contain'|'cover'; imagePosition?: string;
  blendMode?: 'normal'|'multiply'|'screen'|'overlay';
}

export interface EditorialComponentConfig {
  id: string;
  /** Only independent custom components have instanceId; the 15 templates stay unchanged. */
  instanceId?: string;
  /** Scene-specific OBS source bindings for a custom graphic, stored in AppData. */
  obsSourceLinks?: Record<string,string>;
  type: ComponentType;
  name: string;
  visibleInOBS: boolean;
  content: Record<string, any>;
  font: FontSettings;
  geometry: GeometrySettings;
  animation: AnimationSettings;
  /** Explicit replay request; does not change design geometry or text. */
  animationReplay?: number;
  branding?: BrandingSettings;
  glyph?: ComponentGlyphSettings;
  /** Individual parts of the original template, stored independently of global geometry. */
  layerOverrides?: Record<string, LayerOverride>;
  /** Optional bottom-to-top order for template elements and free layers. Missing means legacy paint order. */
  layerOrder?: string[];
  /** Extra text, shape and image layers drawn on top of the template. */
  layers?: GraphicLayer[];
  updatedAt: string;
}

export type CustomComponentRegistry = Record<string, EditorialComponentConfig>;

export interface OBSConnectionConfig {
  host: string;
  port: number;
  password?: string;
  autoConnect: boolean;
  useSsl?: boolean;
}

export interface OBSSceneSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  locked: boolean;
  browserUrl?: string; // URL que OBS confirmó mediante GetInputSettings
}

export interface OBSScene {
  id: string;
  name: string;
  sources: OBSSceneSource[];
}

export interface OBSTelemetryPoint {
  time: string;
  cpu: number;
  bitrate: number;
  droppedFrames: number;
  fps: number;
  memoryMb: number;
}

export interface OBSStatus {
  connected: boolean;
  connecting: boolean;
  authenticated: boolean;
  isSimulated: boolean;
  handshakeStage?: 'idle' | 'opening_socket' | 'received_hello' | 'identifying' | 'authenticated' | 'failed';
  obsWebSocketVersion?: string;
  rpcVersion?: number;
  currentProgramScene: string;
  currentPreviewScene: string;
  studioMode: boolean;
  virtualCamActive: boolean;
  recordingActive: boolean;
  streamActive: boolean;
  scenes: OBSScene[];
  /** Transiciones anunciadas por el OBS conectado; nunca nombres supuestos. */
  availableTransitions?: string[];
  currentTransitionName?: string;
  lastError: string | null;
  latencyMs: number;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  kbitsPerSec: number;
  droppedFrames: number;
  totalFrames: number;
  fps: number;
  renderTimeAverageMs: number;
  telemetryHistory: OBSTelemetryPoint[];
}

export interface CountdownState {
  deadlineMs?: number; // Shared wall-clock deadline, survives browser throttling
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  message: string;
  style: 'minimal' | 'bold-digital' | 'analog-ring' | 'cinematic';
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio' | 'svg';
  url: string;
  durationSeconds?: number;
  sizeBytes?: number;
  thumbnailUrl?: string;
  uploadedAt: string;
  isMissing?: boolean;
  notes?: string;
  tags?: string[];
}

export interface LibrarySettings {
  startTab: 'episodes' | 'assets' | 'backups';
  assetView: 'grid' | 'list';
  confirmDeletion: boolean;
  backupBeforeSwitch: boolean;
}

/** Metadata and complete episode catalog; uploaded media bytes are separate files. */
export interface LibraryCatalog {
  version: 1;
  episodes: EpisodeData[];
  assets: MediaAsset[];
  settings: LibrarySettings;
}

export interface BroadcastStateSnapshot {
  timestamp: string;
  episode: EpisodeData;
  components: Record<ComponentType, EditorialComponentConfig>;
  /** Custom components saved together with the classic station state. */
  customComponents?: CustomComponentRegistry;
  countdown: CountdownState;
  library?: LibraryCatalog;
}
