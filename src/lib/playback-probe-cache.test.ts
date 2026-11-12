import {
  clearPlaybackProbeCache,
  measurePlaybackNode,
} from './playback-probe-cache';
import { getVideoResolutionFromM3u8 } from './utils';

jest.mock('./utils', () => ({ getVideoResolutionFromM3u8: jest.fn() }));
afterEach(() => {
  clearPlaybackProbeCache();
  jest.clearAllMocks();
  jest.useRealTimers();
});
test('successful probes are reused briefly, while manual retries and expired results probe again', async () => {
  jest.useFakeTimers();
  (getVideoResolutionFromM3u8 as jest.Mock).mockResolvedValue({
    loadSpeed: '1 MB/s',
    quality: '1080p',
    pingTime: 10,
  });
  const signal = new AbortController().signal;
  await measurePlaybackNode('a', signal);
  await measurePlaybackNode('a', signal);
  expect(getVideoResolutionFromM3u8).toHaveBeenCalledTimes(1);
  await measurePlaybackNode('a', signal, true);
  expect(getVideoResolutionFromM3u8).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(30001);
  await measurePlaybackNode('a', signal);
  expect(getVideoResolutionFromM3u8).toHaveBeenCalledTimes(3);
});
test('failed or aborted probes never become usable cached results', async () => {
  (getVideoResolutionFromM3u8 as jest.Mock).mockResolvedValue({
    loadSpeed: '未知',
  });
  const controller = new AbortController();
  await expect(measurePlaybackNode('a', controller.signal)).rejects.toThrow();
  await expect(measurePlaybackNode('a', controller.signal)).rejects.toThrow();
  expect(getVideoResolutionFromM3u8).toHaveBeenCalledTimes(2);
  controller.abort();
  await expect(measurePlaybackNode('a', controller.signal)).rejects.toThrow();
});
