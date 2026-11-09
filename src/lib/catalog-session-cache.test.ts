import {
  readCatalogSession,
  writeCatalogSession,
} from './catalog-session-cache';
import type { DoubanResult } from './types';

const result: DoubanResult = { code: 200, message: 'ok', list: [] };
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('recommendations survive a reload but stay isolated by proxy and query', () => {
  writeCatalogSession('proxy-a:movie', result);
  expect(readCatalogSession('proxy-a:movie')).toEqual(result);
  expect(readCatalogSession('proxy-b:movie')).toBeUndefined();
  expect(readCatalogSession('proxy-a:tv')).toBeUndefined();
});

test('expired or unsuccessful responses are never reused', () => {
  jest.useFakeTimers();
  writeCatalogSession('a', result);
  writeCatalogSession('error', { ...result, code: 500 });
  expect(readCatalogSession('error')).toBeUndefined();
  jest.advanceTimersByTime(5 * 60 * 1000 + 1);
  expect(readCatalogSession('a')).toBeUndefined();
});

test('storage stays bounded and replacing an entry refreshes its position', () => {
  for (let i = 0; i < 20; i++) writeCatalogSession(String(i), result);
  writeCatalogSession('0', result);
  writeCatalogSession('20', result);
  expect(readCatalogSession('0')).toEqual(result);
  expect(readCatalogSession('1')).toBeUndefined();
});

test('broken or inaccessible browser storage does not break catalog loading', () => {
  sessionStorage.setItem('lunatv:catalog:v1', '{invalid');
  expect(readCatalogSession('a')).toBeUndefined();
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() => writeCatalogSession('a', result)).not.toThrow();
});
