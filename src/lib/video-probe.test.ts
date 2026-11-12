import Hls from 'hls.js';

import { getVideoResolutionFromM3u8 } from './utils';

jest.mock('hls.js', () => {
  class MockHls {
    static instances: MockHls[] = [];
    static DefaultConfig = { loader: class {} };
    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
    };
    startLoad = jest.fn();
    recoverMediaError = jest.fn();
    static Events = {
      FRAG_LOADING: 'start',
      FRAG_LOADED: 'loaded',
      FRAG_BUFFERED: 'buffered',
      ERROR: 'error',
    };
    handlers: Record<string, (event: string, data?: unknown) => void> = {};
    destroy = jest.fn();
    attachMedia = jest.fn();
    loadSource = jest.fn();
    constructor() {
      MockHls.instances.push(this);
    }
    on(event: string, handler: (event: string, data?: unknown) => void) {
      this.handlers[event] = handler;
    }
    emit(event: string, data?: unknown) {
      this.handlers[event]?.(event, data);
    }
  }
  return { __esModule: true, default: MockHls };
});

type ProbeHls = {
  emit(event: string, data?: unknown): void;
  destroy: jest.Mock;
  startLoad: jest.Mock;
};
const instances = () => (Hls as unknown as { instances: ProbeHls[] }).instances;
beforeEach(() => {
  jest.useFakeTimers();
  instances().length = 0;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function begin() {
  const controller = new AbortController();
  const result = getVideoResolutionFromM3u8(
    'https://example.com/movie.m3u8',
    controller.signal
  );
  await Promise.resolve();
  await Promise.resolve();
  return { result, controller, hls: instances()[0] };
}

test('a slow but buffered media fragment succeeds without waiting for video metadata', async () => {
  const { result, hls } = await begin();
  const clock = jest.spyOn(performance, 'now').mockReturnValue(10);
  hls.emit(Hls.Events.FRAG_LOADING);
  jest.advanceTimersByTime(5000);
  clock.mockReturnValue(5010);
  hls.emit(Hls.Events.FRAG_LOADED, {
    frag: { sn: 0, stats: { loading: { start: 10, first: 110 } } },
    payload: new Uint8Array(10240),
  });
  hls.emit(Hls.Events.FRAG_BUFFERED);
  await expect(result).resolves.toEqual({
    quality: '未知',
    loadSpeed: '2.0 KB/s',
    pingTime: 100,
  });
  expect(hls.destroy).toHaveBeenCalledTimes(1);
});

test('downloaded bytes alone are not treated as playable; timeout releases the probe', async () => {
  const { result, hls } = await begin();
  const rejection = expect(result).rejects.toThrow('测速超时');
  jest.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValue(1010);
  hls.emit(Hls.Events.FRAG_LOADING);
  hls.emit(Hls.Events.FRAG_LOADED, {
    frag: { sn: 0 },
    payload: new Uint8Array(10240),
  });
  jest.advanceTimersByTime(12000);
  await rejection;
  expect(hls.destroy).toHaveBeenCalledTimes(1);
});

test('closing the dialog aborts and destroys the probe immediately', async () => {
  const { result, controller, hls } = await begin();
  const rejection = expect(result).rejects.toThrow('测速已取消');
  controller.abort();
  await rejection;
  expect(hls.destroy).toHaveBeenCalledTimes(1);
});

test('a transient fatal network error gets a bounded retry within the same deadline', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const { result, hls } = await begin();
  const rejection = expect(result).rejects.toThrow('HLS播放失败');
  hls.emit(Hls.Events.ERROR, {
    fatal: true,
    type: Hls.ErrorTypes.NETWORK_ERROR,
  });
  expect(hls.startLoad).toHaveBeenCalledTimes(1);
  expect(hls.destroy).not.toHaveBeenCalled();
  hls.emit(Hls.Events.ERROR, {
    fatal: true,
    type: Hls.ErrorTypes.NETWORK_ERROR,
  });
  await rejection;
  expect(hls.startLoad).toHaveBeenCalledTimes(1);
  expect(hls.destroy).toHaveBeenCalledTimes(1);
});
