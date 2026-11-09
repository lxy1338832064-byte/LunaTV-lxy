import type { SearchResult } from './types';

/** Enrich display fields without replacing the selected playback URLs or source. */
export function enrichPlaybackDetail(
  current: SearchResult,
  metadata: SearchResult
): SearchResult {
  if (current.source !== metadata.source || current.id !== metadata.id)
    return current;
  return {
    ...current,
    title: metadata.title || current.title,
    poster: metadata.poster || current.poster,
    year:
      metadata.year && metadata.year !== 'unknown'
        ? metadata.year
        : current.year,
    desc: metadata.desc || current.desc,
    class: metadata.class || current.class,
    type_name: metadata.type_name || current.type_name,
    douban_id: metadata.douban_id || current.douban_id,
  };
}
