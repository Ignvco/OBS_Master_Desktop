import type { AnimationPreset, AnimationSettings } from '../types/index.ts';

export interface MotionVariants {
  initial: Record<string, any>;
  animate: Record<string, any>;
  exit: Record<string, any>;
  transition: Record<string, any>;
}

export function getPresetMotion(settings: AnimationSettings): MotionVariants {
  const { preset, entryDurationMs, exitDurationMs, delayMs, easing, direction } = settings;
  const entryDuration = entryDurationMs / 1000;
  const exitDuration = exitDurationMs / 1000;
  const delay = delayMs / 1000;
  const selectedEase = easing === 'linear' ? 'linear' : easing === 'ease-out' ? 'easeOut' : easing === 'ease-in-out' ? 'easeInOut' : [0.16, 1, 0.3, 1] as const;

  let offset = { x: 0, y: 0 };
  const distance = 80;

  switch (direction) {
    case 'up':
      offset = { x: 0, y: distance };
      break;
    case 'down':
      offset = { x: 0, y: -distance };
      break;
    case 'left':
      offset = { x: -distance, y: 0 };
      break;
    case 'right':
      offset = { x: distance, y: 0 };
      break;
    default:
      offset = { x: 0, y: 0 };
  }

  const standardTransition = {
    duration: entryDuration,
    delay: delay,
    ease: selectedEase, // Use the easing configured in Content Studio
  };

  const exitTransition = {
    duration: exitDuration,
    ease: [0.7, 0, 0.84, 0],
  };

  switch (preset) {
    case 'apple-spring':
      return {
        initial: { opacity: 0, y: offset.y || 24, x: offset.x || 0, scale: 0.96 },
        animate: { opacity: 1, y: 0, x: 0, scale: 1 },
        exit: { opacity: 0, y: (offset.y || 24) * 0.5, scale: 0.98 },
        transition: standardTransition,
      };

    case 'cinematic-slide':
      return {
        initial: { opacity: 0, x: offset.x || -120, y: offset.y || 0 },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 0, x: (offset.x || -120) * 0.5 },
        transition: {
          duration: entryDuration * 1.1,
          delay: delay,
          ease: selectedEase,
        },
      };

    case 'mask-reveal':
      return {
        initial: { opacity: 0, clipPath: 'inset(100% 0% 0% 0%)', y: 15 },
        animate: { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', y: 0 },
        exit: { opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' },
        transition: {
          duration: entryDuration,
          delay: delay,
          ease: selectedEase,
        },
      };

    case 'stagger-fade-up':
      return {
        initial: { opacity: 0, y: 35 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: {
          duration: entryDuration,
          delay: delay,
          ease: selectedEase,
        },
      };

    case 'scale-pop':
      return {
        initial: { opacity: 0, scale: 0.88, filter: 'blur(8px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, scale: 0.92, filter: 'blur(4px)' },
        transition: {
          type: 'tween',
          duration: entryDuration,
          ease: [0.16, 1.12, 0.3, 1],
          delay: delay,
        },
      };

    case 'magazine-fold':
      return {
        initial: { opacity: 0, rotateX: 20, transformPerspective: 800, y: 30 },
        animate: { opacity: 1, rotateX: 0, y: 0 },
        exit: { opacity: 0, rotateX: -15, y: -20 },
        transition: {
          duration: entryDuration,
          delay: delay,
          ease: selectedEase,
        },
      };

    case 'editorial-wipe':
      return {
        initial: { opacity: 1, clipPath: 'inset(0% 100% 0% 0% round 18px)', x: -14 },
        animate: { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', x: 0 },
        exit: { opacity: 1, clipPath: 'inset(0% 0% 0% 100% round 18px)', x: 14 },
        transition: { duration: entryDuration, delay, ease: selectedEase },
      };
    case 'soft-focus':
      return {
        initial: { opacity: 0, filter: 'blur(12px)', y: offset.y || 16, scale: .985 },
        animate: { opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 },
        exit: { opacity: 0, filter: 'blur(9px)', y: -8, scale: .99 },
        transition: { duration: entryDuration, delay, ease: selectedEase },
      };
    case 'diagonal-reveal':
      return {
        initial: { opacity: 1, clipPath: 'polygon(-35% 0%,-5% 0%,-35% 100%,-65% 100%)' },
        animate: { opacity: 1, clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' },
        exit: { opacity: 1, clipPath: 'polygon(100% 0%,135% 0%,135% 100%,100% 100%)' },
        transition: { duration: entryDuration, delay, ease: selectedEase },
      };
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: entryDuration, delay: delay },
      };
  }
}

/**
 * Format total seconds to mm:ss or hh:mm:ss
 */
export function formatTime(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const absSec = Math.abs(totalSeconds);
  const hours = Math.floor(absSec / 3600);
  const minutes = Math.floor((absSec % 3600) / 60);
  const seconds = Math.floor(absSec % 60);

  const prefix = isNegative ? '-' : '';
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${prefix}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${prefix}${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calculate Safe Zones inside 1920x1080 canvas
 */
export const BROADCAST_SAFE_ZONES = {
  TITLE_SAFE: {
    // 80% inner area: 10% margins = 192px left/right, 108px top/bottom
    x: 192,
    y: 108,
    width: 1536,
    height: 864,
  },
  ACTION_SAFE: {
    // 90% inner area: 5% margins = 96px left/right, 54px top/bottom
    x: 96,
    y: 54,
    width: 1728,
    height: 972,
  }
};

/** Props shared by the editor preview and the OBS browser renderer.
 * Do not make separate interpretations of presets: a preview must match the on-air graphic.
 */
export function componentMotionProps(settings: AnimationSettings) {
  const preset = getPresetMotion(settings);
  const exitDuration = Math.max(0.05, settings.exitDurationMs / 1000);
  const exit = { ...preset.exit, transition: { duration: exitDuration, ease: [0.7, 0, 0.84, 0] as const } };
  return { initial: preset.initial, animate: preset.animate, exit, transition: preset.transition };
}

/** Stable replay identity. Text and geometry edits MUST NOT restart an on-air animation. */
export function motionReplayKey(id: string, replay: number = 0): string {
  return `${id}::${Math.max(0, Number.isFinite(replay) ? replay : 0)}`;
}
