/** @jest-environment node */
import { enrichPlaybackDetail } from './playback-detail';
import type { SearchResult } from './types';

const current: SearchResult = {
  source: 'a',
  source_name: 'A',
  id: '1',
  title: '电影',
  year: '2026',
  poster: '',
  episodes: ['selected.m3u8'],
  episodes_titles: ['正片'],
};

test('background search enriches the cover and description without restarting on a different playlist', () => {
  const result = enrichPlaybackDetail(current, {
    ...current,
    poster: 'poster.jpg',
    desc: '简介',
    episodes: ['other.m3u8'],
    episodes_titles: ['其他'],
  });
  expect(result.poster).toBe('poster.jpg');
  expect(result.desc).toBe('简介');
  expect(result.episodes).toBe(current.episodes);
  expect(result.episodes_titles).toBe(current.episodes_titles);
});

test('empty fields and mismatched sources cannot overwrite the active resource', () => {
  expect(
    enrichPlaybackDetail(current, { ...current, title: '', year: 'unknown' })
      .title
  ).toBe('电影');
  expect(enrichPlaybackDetail(current, { ...current, source: 'b' })).toBe(
    current
  );
});
