/** @jest-environment node */
import { recentResources } from './recent-watching';
import type { PlayRecord } from './types';

const record = (
  title: string,
  save_time: number,
  year = '2026'
): PlayRecord => ({
  title,
  save_time,
  year,
  source_name: 'private-source',
  cover: '',
  index: 2,
  total_episodes: 20,
  play_time: 100,
  total_time: 200,
  search_title: title,
});

test('recent resources are newest first, deduplicated across sources, and capped at ten', () => {
  const records = Object.fromEntries(
    Array.from({ length: 14 }, (_, i) => [
      `source+${i}`,
      record(`影片${i}`, i + 1),
    ])
  );
  records['other-source+13'] = record('影片13', 50);
  const result = recentResources(records);
  expect(result).toHaveLength(10);
  expect(result[0].watchedAt).toBe(50);
  expect(result.filter((item) => item.title === '影片13')).toHaveLength(1);
  expect(result[9].title).toBe('影片4');
  expect(result[0]).not.toHaveProperty('source_name');
  expect(result[0]).not.toHaveProperty('play_time');
});

test('remakes from different years remain distinct; invalid records are skipped', () => {
  const result = recentResources({
    a: record('同名', 10, '2025'),
    b: record('同名', 11),
    c: record('', 12),
    d: record('无效时间', NaN),
  });
  expect(result.map((item) => item.year)).toEqual(['2026', '2025']);
});
