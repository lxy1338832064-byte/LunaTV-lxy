import {
  createPlaybackAutomation,
  PlaybackAction,
  readPlaybackState,
} from './playback-automation';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('an Artplayer-shaped object reads pause state from its video and actually skips', () => {
  const player = { video: { currentTime: 1, duration: 1800, paused: false } };
  const a = setup({
    read: () => readPlaybackState(player),
    seek: (time) => {
      player.video.currentTime = time;
    },
  });
  expect('paused' in player).toBe(false);
  expect(readPlaybackState(player).paused).toBe(false);
  a.engine.tick();
  jest.advanceTimersByTime(3000);
  expect(player.video.currentTime).toBe(90);
  player.video.paused = true;
  expect(readPlaybackState(player).paused).toBe(true);
  expect(readPlaybackState(null).paused).toBe(true);
});
function setup(
  overrides: Partial<Parameters<typeof createPlaybackAutomation>[0]> = {}
) {
  const state = { time: 0, duration: 1800, paused: false };
  const seek = jest.fn((time: number) => {
      state.time = time;
    }),
    advance = jest.fn(),
    pause = jest.fn(),
    publish = jest.fn<void, [PlaybackAction | null]>();
  const engine = createPlaybackAutomation({
    config: { enable: true, intro_time: 90, outro_time: -90 },
    autoNext: true,
    hasNext: true,
    read: () => state,
    seek,
    advance,
    pause,
    publish,
    notice: jest.fn(),
    ...overrides,
  });
  return { engine, state, seek, advance, pause, publish };
}

test('intro jumps once after a cancellable countdown and never rewinds a resumed position', () => {
  const a = setup();
  a.state.time = 500;
  a.engine.tick();
  expect(a.publish).not.toHaveBeenCalled();
  a.state.time = 1;
  a.engine.tick();
  expect(a.publish).toHaveBeenLastCalledWith({ kind: 'intro', seconds: 3 });
  jest.advanceTimersByTime(3000);
  expect(a.seek).toHaveBeenCalledWith(90);
  a.state.time = 0;
  a.engine.tick();
  jest.advanceTimersByTime(3000);
  expect(a.seek).toHaveBeenCalledTimes(1);
});

test('outro advances only once even if timeupdate and ended both fire', () => {
  const a = setup();
  a.state.time = 1720;
  a.engine.tick();
  a.engine.tick();
  jest.advanceTimersByTime(5000);
  a.engine.ended();
  a.engine.tick();
  jest.advanceTimersByTime(10000);
  expect(a.advance).toHaveBeenCalledTimes(1);
});

test('a natural ending advances even with skip disabled, but the last episode and disabled autoplay stop', () => {
  const a = setup({ config: { enable: false, intro_time: 0, outro_time: 0 } });
  a.engine.ended();
  a.engine.ended();
  jest.advanceTimersByTime(5000);
  expect(a.advance).toHaveBeenCalledTimes(1);
  const last = setup({ hasNext: false });
  last.engine.ended();
  const off = setup({ autoNext: false });
  off.engine.ended();
  jest.advanceTimersByTime(5000);
  expect(last.advance).not.toHaveBeenCalled();
  expect(off.advance).not.toHaveBeenCalled();
});

test('cancelling or leaving an episode stops the queued next episode', () => {
  const a = setup();
  a.engine.ended();
  a.engine.cancel();
  const b = setup();
  b.engine.ended();
  b.engine.dispose();
  jest.advanceTimersByTime(10000);
  expect(a.advance).not.toHaveBeenCalled();
  expect(b.advance).not.toHaveBeenCalled();
});

test('short videos and invalid durations are never automatically skipped', () => {
  const a = setup();
  a.state.duration = 120;
  a.engine.tick();
  a.state.duration = Infinity;
  a.engine.tick();
  jest.advanceTimersByTime(10000);
  expect(a.seek).not.toHaveBeenCalled();
  expect(a.advance).not.toHaveBeenCalled();
});

test('pausing freezes the skip countdown and seeking away cancels an outro action', () => {
  const a = setup();
  a.engine.tick();
  a.state.paused = true;
  jest.advanceTimersByTime(5000);
  expect(a.seek).not.toHaveBeenCalled();
  a.state.paused = false;
  jest.advanceTimersByTime(3000);
  expect(a.seek).toHaveBeenCalledTimes(1);
  const b = setup();
  b.state.time = 1720;
  b.engine.tick();
  b.state.time = 500;
  jest.advanceTimersByTime(5000);
  expect(b.advance).not.toHaveBeenCalled();
});

test('outro skips to the end and pauses when no next episode is available', () => {
  const a = setup({ hasNext: false });
  a.state.time = 1720;
  a.engine.tick();
  jest.advanceTimersByTime(5000);
  expect(a.seek).toHaveBeenCalledWith(1800);
  expect(a.pause).toHaveBeenCalledTimes(1);
  expect(a.advance).not.toHaveBeenCalled();
});
