/** @jest-environment node */
import { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { getSourceHealth } from '@/lib/source-health';

import { GET } from './route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options: unknown) => ({
      data,
      ...(options as object),
    }),
  },
}));
jest.mock('@/lib/auth', () => ({ getAuthInfoFromCookie: jest.fn() }));
jest.mock('@/lib/config', () => ({
  getAvailableApiSites: jest.fn(),
  getConfig: jest.fn(),
}));
jest.mock('@/lib/source-health', () => ({ getSourceHealth: jest.fn() }));
const auth = getAuthInfoFromCookie as jest.Mock;
const sites = getAvailableApiSites as jest.Mock;
const config = getConfig as jest.Mock;
const health = getSourceHealth as jest.Mock;
const request = {} as NextRequest;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'redis';
  auth.mockReturnValue({ username: 'viewer' });
  config.mockResolvedValue({
    UserConfig: { Users: [{ username: 'viewer', role: 'user' }] },
  });
  sites.mockResolvedValue([{ key: 'allowed' }]);
  health.mockResolvedValue([{ key: 'allowed', status: 'available' }]);
});

test('anonymous, banned, and deleted accounts cannot trigger checks', async () => {
  auth.mockReturnValue(null);
  expect((await GET(request)).status).toBe(401);
  auth.mockReturnValue({ username: 'deleted' });
  expect((await GET(request)).status).toBe(403);
  auth.mockReturnValue({ username: 'viewer' });
  config.mockResolvedValue({
    UserConfig: { Users: [{ username: 'viewer', banned: true }] },
  });
  expect((await GET(request)).status).toBe(403);
  expect(health).not.toHaveBeenCalled();
});

test('only checks sources available to the viewer and disables shared response caching', async () => {
  const result = await GET(request);
  expect(result.status).toBe(200);
  expect(sites).toHaveBeenCalledWith('viewer');
  expect(health).toHaveBeenCalledWith([{ key: 'allowed' }]);
  expect(result.headers).toEqual({ 'Cache-Control': 'private, no-store' });
});
