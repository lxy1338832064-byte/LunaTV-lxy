/** @jest-environment node */
import { ApiSite } from './config';
import { getSourceHealth, probeSource } from './source-health';

jest.mock('./config', () => ({
  API_CONFIG: { search: { path: '?ac=videolist&wd=', headers: {} } },
}));
const originalFetch = global.fetch;
const site = (key: string): ApiSite => ({
  key,
  name: `资源${key}`,
  api: `https://${key}.example/api`,
});
afterAll(() => {
  global.fetch = originalFetch;
});
beforeEach(() => {
  global.fetch = jest.fn();
});
const fetchMock = () => global.fetch as jest.Mock;
const response = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data,
  body: { cancel: jest.fn() },
});

test('an empty but valid search response is available; concurrent checks share one request', async () => {
  fetchMock().mockResolvedValue(response({ list: [] }));
  const [a, b] = await Promise.all([
    probeSource(site('healthy')),
    probeSource(site('healthy')),
  ]);
  expect(a.status).toBe('available');
  expect(b.status).toBe('available');
  await probeSource(site('healthy'));
  expect(fetchMock()).toHaveBeenCalledTimes(1);
  expect(a).not.toHaveProperty('api');
});

test('HTTP errors, malformed data, and timeouts are not reported as available', async () => {
  fetchMock().mockResolvedValueOnce(response({}, false, 403));
  expect((await probeSource(site('forbidden'))).status).toBe('unavailable');
  fetchMock().mockResolvedValueOnce(response({ message: 'not an API' }));
  expect((await probeSource(site('invalid'))).status).toBe('unavailable');
  fetchMock().mockRejectedValueOnce(
    Object.assign(new Error('timeout'), { name: 'TimeoutError' })
  );
  expect((await probeSource(site('timeout'))).message).toBe('检测超时');
});

test('changing an endpoint under the same source key triggers a fresh check', async () => {
  fetchMock().mockResolvedValue(response({ list: [] }));
  await probeSource(site('changed'));
  await probeSource({ ...site('changed'), api: 'https://new.example/api' });
  expect(fetchMock()).toHaveBeenCalledTimes(2);
});

test('checks use bounded concurrency and preserve source order', async () => {
  let active = 0;
  let maximum = 0;
  fetchMock().mockImplementation(async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return response({ list: [] });
  });
  const sources = Array.from({ length: 9 }, (_, i) => site(`batch${i}`));
  const result = await getSourceHealth(sources);
  expect(maximum).toBeLessThanOrEqual(4);
  expect(result.map((item) => item.key)).toEqual(
    sources.map((item) => item.key)
  );
});
