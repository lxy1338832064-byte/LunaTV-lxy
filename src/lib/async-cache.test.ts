/** @jest-environment node */
import { createAsyncCache } from './async-cache';

afterEach(() => jest.useRealTimers());

test('concurrent callers share one load; successful values are reused until expiry', async () => {
  jest.useFakeTimers();
  const cache = createAsyncCache<number>(100, 2);
  const load = jest.fn(async () => 42);
  expect(
    await Promise.all([cache.get('a', load), cache.get('a', load)])
  ).toEqual([42, 42]);
  expect(await cache.get('a', load)).toBe(42);
  expect(load).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(101);
  await cache.get('a', load);
  expect(load).toHaveBeenCalledTimes(2);
});

test('failed requests are not cached', async () => {
  const cache = createAsyncCache<number>(100, 2);
  const load = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(7);
  await expect(cache.get('a', load)).rejects.toThrow('offline');
  await expect(cache.get('a', load)).resolves.toBe(7);
});

test('least recently used entries are evicted at the capacity limit', async () => {
  const cache = createAsyncCache<number>(10000, 2);
  await cache.get('a', async () => 1);
  await cache.get('b', async () => 2);
  await cache.get('a', async () => 10);
  await cache.get('c', async () => 3);
  expect(await cache.get('b', async () => 20)).toBe(20);
});

test('an invalidated pending load cannot overwrite a newer result', async () => {
  const cache = createAsyncCache<number>(10000, 2);
  let resolve: (value: number) => void = () => undefined;
  const old = cache.get(
    'a',
    () =>
      new Promise<number>((done) => {
        resolve = done;
      })
  );
  await Promise.resolve();
  cache.invalidate('a');
  await cache.get('a', async () => 2);
  resolve(1);
  await old;
  expect(await cache.get('a', async () => 3)).toBe(2);
});
