import type { SkipConfig } from './types';

export type PlaybackAction = {
  kind: 'intro' | 'outro' | 'next';
  seconds: number;
};
export interface AutomationOptions {
  config: SkipConfig;
  autoNext: boolean;
  hasNext: boolean;
  read: () => { time: number; duration: number; paused: boolean };
  seek: (seconds: number) => void;
  pause: () => void;
  advance: () => void;
  publish: (action: PlaybackAction | null) => void;
  notice: (message: string) => void;
}

// One controller per episode: an outro and an ended event can never advance twice.
export function createPlaybackAutomation(options: AutomationOptions) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending: PlaybackAction | null = null;
  let introSeen = false,
    outroSeen = false,
    endedSeen = false,
    advanced = false,
    disposed = false;
  const intro = Math.max(0, options.config.intro_time);
  const outro = Math.max(0, -options.config.outro_time);
  const clear = () => {
    clearInterval(timer);
    timer = undefined;
    pending = null;
  };
  const cancel = () => {
    clear();
    if (!disposed) options.publish(null);
  };
  const valid = (duration: number) =>
    Number.isFinite(duration) && duration > 0 && intro + outro + 30 < duration;
  const runNow = () => {
    if (!pending || disposed || advanced) return;
    const kind = pending.kind;
    const current = options.read();
    cancel();
    if (kind === 'intro') {
      if (valid(current.duration) && current.time < intro) {
        options.seek(intro);
        options.notice(`已跳过片头 ${Math.round(intro)} 秒`);
      }
    } else if (kind === 'next' || (options.autoNext && options.hasNext)) {
      if (options.hasNext && options.autoNext) {
        advanced = true;
        options.advance();
      }
    } else if (valid(current.duration)) {
      advanced = true;
      options.seek(current.duration);
      options.pause();
      options.notice('已跳过片尾');
    }
  };
  const queue = (kind: PlaybackAction['kind']) => {
    if (disposed || advanced || pending) return;
    pending = { kind, seconds: kind === 'intro' ? 3 : 5 };
    options.publish({ ...pending });
    timer = setInterval(() => {
      if (!pending || disposed) return;
      const current = options.read();
      if (pending.kind !== 'next') {
        if (
          !valid(current.duration) ||
          (pending.kind === 'intro'
            ? current.time >= intro
            : current.time < current.duration - outro)
        ) {
          cancel();
          return;
        }
        if (current.paused) return;
      }
      pending = { ...pending, seconds: pending.seconds - 1 };
      if (pending.seconds <= 0) runNow();
      else options.publish({ ...pending });
    }, 1000);
  };
  return {
    tick() {
      if (disposed || advanced || pending || !options.config.enable) return;
      const current = options.read();
      if (
        current.paused ||
        !Number.isFinite(current.time) ||
        !valid(current.duration)
      )
        return;
      if (!introSeen && intro > 0 && current.time < intro) {
        introSeen = true;
        queue('intro');
      } else if (
        !outroSeen &&
        outro > 0 &&
        current.time >= current.duration - outro
      ) {
        outroSeen = true;
        queue('outro');
      }
    },
    ended() {
      if (disposed || advanced || endedSeen) return;
      endedSeen = true;
      cancel();
      if (options.autoNext && options.hasNext) queue('next');
    },
    cancel,
    runNow,
    dispose() {
      disposed = true;
      clear();
    },
  };
}
