import { useEffect, useRef, useState } from 'react';

import {
  AutomationOptions,
  createPlaybackAutomation,
  PlaybackAction,
} from '@/lib/playback-automation';

export function usePlaybackAutomation(
  episodeKey: string,
  options: Omit<AutomationOptions, 'publish'>
) {
  const [pending, setPending] = useState<PlaybackAction | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const controller = useRef<ReturnType<typeof createPlaybackAutomation> | null>(
    null
  );
  useEffect(() => {
    setPending(null);
    const engine = createPlaybackAutomation({
      ...latest.current,
      read: () => latest.current.read(),
      seek: (value) => latest.current.seek(value),
      pause: () => latest.current.pause(),
      advance: () => latest.current.advance(),
      notice: (message) => latest.current.notice(message),
      publish: setPending,
    });
    controller.current = engine;
    return () => {
      engine.dispose();
      controller.current = null;
    };
  }, [
    episodeKey,
    options.config.enable,
    options.config.intro_time,
    options.config.outro_time,
    options.autoNext,
    options.hasNext,
  ]);
  return {
    pending,
    tick: () => controller.current?.tick(),
    ended: () => controller.current?.ended(),
    cancel: () => controller.current?.cancel(),
    runNow: () => controller.current?.runNow(),
  };
}
