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
  const key = storageKey();
  versions.set(key, (versions.get(key) || 0) + 1);
  if (source) localStorage.setItem(storageKey(), JSON.stringify(source));
  else localStorage.removeItem(storageKey());
  window.dispatchEvent(new Event('lunatv:default-source-changed'));
}

export function accountDefaultSourceEnabled() {
  const runtime =
    typeof window !== 'undefined'
      ? (window as Window & { RUNTIME_CONFIG?: { STORAGE_TYPE?: string } })
          .RUNTIME_CONFIG
      : undefined;
  return Boolean(
    runtime?.STORAGE_TYPE && runtime.STORAGE_TYPE !== 'localstorage'
  );
}
const synchronized = new Map<string, number>();
const pending = new Map<string, Promise<DefaultSource | null>>();
const versions = new Map<string, number>();
async function preferenceRequest(body?: object) {
  const request = new AbortController();
  const timer = setTimeout(() => request.abort(), 8000);
  try {
    const response = await fetch('/api/user/default-source', {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      signal: request.signal,
      ...(body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '默认源设置同步失败');
    return data as {
      supported: boolean;
      configured: boolean;
      defaultSource: DefaultSource | null;
    };
  } finally {
    clearTimeout(timer);
  }
}
export async function saveAccountDefaultSource(source: DefaultSource | null) {
  if (!accountDefaultSourceEnabled()) {
    saveDefaultSource(source);
    return;
  }
  const key = storageKey();
  const data = await preferenceRequest({ sourceKey: source?.key || null });
  if (storageKey() === key) {
    saveDefaultSource(data.defaultSource);
    synchronized.set(key, Date.now());
  }
}
export function syncDefaultSource(
  force = false
): Promise<DefaultSource | null> {
  if (!accountDefaultSourceEnabled())
    return Promise.resolve(getDefaultSource());
  const key = storageKey();
  if (!force && Date.now() - (synchronized.get(key) || 0) < 30000)
    return Promise.resolve(getDefaultSource());
  const existing = pending.get(key);
  if (existing) return existing;
  const version = versions.get(key) || 0;
  const task = (async () => {
    try {
      let data = await preferenceRequest();
      if (storageKey() !== key || (versions.get(key) || 0) !== version)
        return getDefaultSource();
      if (!data.supported) return getDefaultSource();
      const legacy = getDefaultSource();
      // Migrate once, without allowing an old browser to overwrite an admin's explicit value/null.
      if (!data.configured && legacy)
        data = await preferenceRequest({
          sourceKey: legacy.key,
          migrateOnly: true,
        });
      if (storageKey() === key && (versions.get(key) || 0) === version) {
        saveDefaultSource(data.defaultSource);
        synchronized.set(key, Date.now());
      }
    } catch {
      synchronized.set(key, Date.now() - 25000);
    }
    return getDefaultSource();
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
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
