/** @jest-environment node */
import { getCachedSearchPage, setCachedSearchPage } from './search-cache';

afterEach(() => jest.useRealTimers());

test('temporary source failures expire quickly while successful searches stay cached', () => {
  jest.useFakeTimers();
  setCachedSearchPage('source', 'success', 1, 'ok', []);
  setCachedSearchPage('source', 'failure', 1, 'timeout', []);
  jest.advanceTimersByTime(30001);
  expect(getCachedSearchPage('source', 'failure', 1)).toBeNull();
  expect(getCachedSearchPage('source', 'success', 1)).not.toBeNull();
});

test('capacity is enforced on every write, even during a rapid burst', () => {
  for (let i = 0; i < 1001; i++)
    setCachedSearchPage('burst', String(i), 1, 'ok', []);
  expect(getCachedSearchPage('burst', '0', 1)).toBeNull();
  expect(getCachedSearchPage('burst', '1000', 1)).not.toBeNull();
});

test('source and query separators cannot collide', () => {
  setCachedSearchPage('a::b', 'c', 1, 'ok', [], 3);
  setCachedSearchPage('a', 'b::c', 1, 'ok', [], 5);
  expect(getCachedSearchPage('a::b', 'c', 1)?.pageCount).toBe(3);
  expect(getCachedSearchPage('a', 'b::c', 1)?.pageCount).toBe(5);
});
