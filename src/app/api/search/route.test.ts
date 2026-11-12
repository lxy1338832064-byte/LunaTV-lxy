/** @jest-environment node */
import { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';

import { GET } from './route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: object) => ({ data, ...options }),
  },
}));
jest.mock('@/lib/auth', () => ({ getAuthInfoFromCookie: jest.fn() }));
jest.mock('@/lib/config', () => ({
  getAvailableApiSites: jest.fn(),
  getCacheTime: jest.fn(),
  getConfig: jest.fn(),
}));
jest.mock('@/lib/downstream', () => ({ searchFromApi: jest.fn() }));
beforeEach(() => {
  jest.useFakeTimers();
  (getAuthInfoFromCookie as jest.Mock).mockReturnValue({ username: 'viewer' });
  (getAvailableApiSites as jest.Mock).mockResolvedValue([
    { key: 'a' },
    { key: 'b' },
  ]);
  (getCacheTime as jest.Mock).mockResolvedValue(7200);
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: { DisableYellowFilter: true },
  });
  (searchFromApi as jest.Mock).mockResolvedValue([{ title: 'test' }]);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('a scoped search calls only the requested authorized source and avoids shared caching', async () => {
  const response = await GET({
    url: 'http://localhost/api/search?q=test&resourceId=b',
  } as NextRequest);
  expect(searchFromApi).toHaveBeenCalledTimes(1);
  expect(searchFromApi).toHaveBeenCalledWith({ key: 'b' }, 'test');
  expect(response.headers).toEqual(
    expect.objectContaining({ 'Cache-Control': 'private, no-store' })
  );
});

test('a stale or forbidden source never falls through into searching every source', async () => {
  await GET({
    url: 'http://localhost/api/search?q=test&resourceId=forbidden',
  } as NextRequest);
  expect(searchFromApi).not.toHaveBeenCalled();
});
