import type { DoubanResult } from './types';

const STORAGE_KEY = 'lunatv:catalog:v1';
const TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 20;
type Entry = { key: string; expires: number; value: DoubanResult };

function readEntries(): Entry[] {
  try {
    const entries: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || '[]'
    );
    if (!Array.isArray(entries)) return [];
    return entries
      .filter(
        (entry): entry is Entry =>
          typeof entry?.key === 'string' &&
          entry.expires > Date.now() &&
          entry.value?.code === 200 &&
          Array.isArray(entry.value.list)
      )
      .slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

// Only public recommendation lists go here; the key includes the selected proxy.
export function readCatalogSession(key: string): DoubanResult | undefined {
  return readEntries().find((entry) => entry.key === key)?.value;
}

export function writeCatalogSession(key: string, value: DoubanResult): void {
  if (value.code !== 200 || !Array.isArray(value.list)) return;
  try {
    const entries = readEntries().filter((entry) => entry.key !== key);
    entries.push({ key, expires: Date.now() + TTL, value });
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(-MAX_ENTRIES))
    );
  } catch {
    // Private browsing or full storage must not prevent recommendations loading.
  }
}
