import { getAuthInfoFromBrowserCookie } from './auth';
import { readResume, selectedNodeUrl } from './playback-node';
import type { SearchResult } from './types';

export type DefaultSource = { key: string; name: string };
function storageKey() {
  return `lunatv.default-source:${
    getAuthInfoFromBrowserCookie()?.username || 'local'
  }`;
}
export function getDefaultSource(): DefaultSource | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    return value &&
      typeof value.key === 'string' &&
      value.key &&
      typeof value.name === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveDefaultSource(source: DefaultSource | null) {
  if (source) localStorage.setItem(storageKey(), JSON.stringify(source));
  else localStorage.removeItem(storageKey());
  window.dispatchEvent(new Event('lunatv:default-source-changed'));
}

// Resolve only this source; neither probes nor searches other sites on this path.
export async function resolveDefaultPlayback(
  original: string,
  source: DefaultSource,
  signal: AbortSignal
): Promise<string> {
  const parsed = new URL(original, 'http://localhost');
  const params = parsed.searchParams;
  let id = params.get('source') === source.key ? params.get('id') : null;
  if (!id) {
    const query = params.get('stitle') || params.get('title') || '';
    const year = params.get('year') || '';
    const episode = readResume(params)?.episode || 1;
    const response = await fetch(
      `/api/search/one?resourceId=${encodeURIComponent(
        source.key
      )}&q=${encodeURIComponent(query)}&fast=1&year=${encodeURIComponent(
        year
      )}&episode=${episode}`,
      { signal, cache: 'no-store' }
    );
    if (!response.ok) throw new Error('默认源未找到影片或暂时无法连接');
    const data = await response.json();
    const match = (data.results || []).find(
      (item: SearchResult) =>
        item.source === source.key &&
        item.title === query &&
        (!year ||
          !item.year ||
          item.year === 'unknown' ||
          item.year === year) &&
        item.episodes?.[episode - 1]
    );
    if (!match) throw new Error('默认源没有匹配的影片或集数');
    id = match.id;
  }
  if (signal.aborted) throw new Error('请求已取消');
  const target = new URL(
    selectedNodeUrl(original, source.key, id || ''),
    'http://localhost'
  );
  target.searchParams.set('usingDefault', '1');
  return target.pathname + target.search;
}
