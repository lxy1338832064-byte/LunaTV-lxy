/** @jest-environment node */
import { searchFromApi } from './downstream';

jest.mock('./config', () => ({
  API_CONFIG: {
    search: { path: '?wd=', pagePath: '?wd={query}&pg={page}', headers: {} },
  },
  getConfig: async () => ({ SiteConfig: { SearchDownstreamMaxPage: 5 } }),
}));
const original = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => ({
      pagecount: 5,
      list: [
        {
          vod_id: String(url),
          vod_name: '测试',
          vod_pic: '',
          vod_play_url: '第一集$https://video.example/a.m3u8',
        },
      ],
    }),
  })) as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = original;
});
test('exact first-page candidates avoid waiting for additional pages', async () => {
  const result = await searchFromApi(
    { key: 'fast', api: 'https://a.example', name: 'a' },
    '测试',
    { earlyMatch: (r) => r.title === '测试' }
  );
  expect(result).toHaveLength(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('full searches do not append extra pages into the cached first-page array', async () => {
  const source = { key: 'full', api: 'https://b.example', name: 'b' };
  expect(await searchFromApi(source, '测试')).toHaveLength(5);
  expect(
    await searchFromApi(source, '测试', {
      earlyMatch: (r) => r.title === '测试',
    })
  ).toHaveLength(1);
  expect(global.fetch).toHaveBeenCalledTimes(5);
});
