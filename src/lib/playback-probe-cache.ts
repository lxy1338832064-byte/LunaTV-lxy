import { speedBytes } from './playback-node';
import { getVideoResolutionFromM3u8 } from './utils';

type Result = Awaited<ReturnType<typeof getVideoResolutionFromM3u8>>;
const cache = new Map<string, { value: Result; expires: number }>();
export function clearPlaybackProbeCache() {
  cache.clear();
}

// Short-lived successful measurements only. A manual retry always probes again.
export async function measurePlaybackNode(
  url: string,
  signal: AbortSignal,
  fresh = false
): Promise<Result> {
  if (signal.aborted) throw new Error('测速已取消');
  const saved = cache.get(url);
  if (!fresh && saved && saved.expires > Date.now()) return saved.value;
  const value = await getVideoResolutionFromM3u8(url, signal);
  if (signal.aborted) throw new Error('测速已取消');
  if (!speedBytes(value.loadSpeed)) throw new Error('测速未成功');
  cache.delete(url);
  cache.set(url, { value, expires: Date.now() + 30000 });
  while (cache.size > 64) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return value;
}
