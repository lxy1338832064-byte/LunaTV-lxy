import type { PlayRecord } from './types';

export interface RecentResource {
  title: string;
  year: string;
  cover: string;
  episode: number;
  totalEpisodes: number;
  watchedAt: number;
  searchTitle: string;
}

export interface RecentUser {
  username: string;
  resources: RecentResource[];
}

// A title watched through several sources is still one resource.
// Return a display-only projection rather than raw database records.
export function recentResources(
  records: Record<string, PlayRecord>
): RecentResource[] {
  const seen = new Set<string>();
  const result: RecentResource[] = [];
  const sorted = Object.values(records)
    .filter(
      (record) =>
        record &&
        typeof record.title === 'string' &&
        record.title.trim() &&
        Number.isFinite(record.save_time) &&
        record.save_time > 0
    )
    .sort((a, b) => b.save_time - a.save_time);
  for (const record of sorted) {
    const key = `${record.title.normalize('NFKC').trim().toLowerCase()}\u0000${
      record.year || ''
    }`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      title: record.title.trim(),
      year: record.year || '',
      cover: record.cover || '',
      episode: Number.isFinite(record.index) ? Math.max(1, record.index) : 1,
      totalEpisodes: Number.isFinite(record.total_episodes)
        ? record.total_episodes
        : 0,
      watchedAt: record.save_time,
      searchTitle: record.search_title || record.title.trim(),
    });
    if (result.length === 10) break;
  }
  return result;
}
