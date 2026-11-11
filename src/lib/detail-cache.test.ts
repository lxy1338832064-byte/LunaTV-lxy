/** @jest-environment node */
import type { ApiSite } from './config';
import { getDetailFromApi } from './downstream';

jest.mock('./config', () => ({
  API_CONFIG: { detail: { path: '?ac=videolist&ids=', headers: {} } },
}));

const originalFetch = global.fetch;
const site: ApiSite = {
  key: 'test',
  api: 'https://source.example/api',
  name: '测试源',
};
const response = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    list: [
      {
        vod_name: '测试影片',
        vod_pic: '',
        vod_year: '2026',
        vod_play_url: '第一集$https://video.example/1.m3u8',
      },
    ],
  }),
});
beforeEach(() => {
  global.fetch = jest.fn(async () => response() as Response);
});
afterEach(() => jest.useRealTimers());
afterAll(() => {
  global.fetch = originalFetch;
});

test('configured detail sites still use the structured API first', async () => {
  const configured = { ...site, detail: 'https://detail.example' };
  const result = await getDetailFromApi(configured, 'api-first');
  expect(result.title).toBe('测试影片');
  expect(global.fetch).toHaveBeenCalledWith(
    'https://source.example/api?ac=videolist&ids=api-first',
    expect.anything()
  );
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('a failed API can fall back to the configured detail site', async () => {
  (global.fetch as jest.Mock)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      ok: true,
      text: async () => '<h1>备用影片</h1>$https://video.example/fallback.m3u8',
    });
  const result = await getDetailFromApi(
    { ...site, detail: 'https://detail.example' },
    'fallback'
  );
  expect(result.title).toBe('备用影片');
  expect(result.episodes).toEqual(['https://video.example/fallback.m3u8']);
});

test('repeat and concurrent detail reads share one upstream request', async () => {
  const [a, b] = await Promise.all([
    getDetailFromApi(site, 'same'),
    getDetailFromApi(site, 'same'),
  ]);
  expect(a.episodes).toEqual(['https://video.example/1.m3u8']);
  expect(b).toEqual(a);
  await getDetailFromApi(site, 'same');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('changing the source URL cannot reuse another endpoint’s detail', async () => {
  await getDetailFromApi(site, 'changed');
  await getDetailFromApi(
    { ...site, api: 'https://new.example/api' },
    'changed'
  );
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('upstream errors are retried; successful details expire after thirty seconds', async () => {
  jest.useFakeTimers();
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(getDetailFromApi(site, 'retry')).rejects.toThrow('offline');
  await getDetailFromApi(site, 'retry');
  jest.advanceTimersByTime(30001);
  await getDetailFromApi(site, 'retry');
  expect(global.fetch).toHaveBeenCalledTimes(3);
});
