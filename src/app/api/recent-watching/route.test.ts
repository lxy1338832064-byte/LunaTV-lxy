/** @jest-environment node */
import { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

import { GET } from './route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options: { status: number; headers: unknown }) => ({
      data,
      ...options,
    }),
  },
}));
jest.mock('@/lib/auth', () => ({ getAuthInfoFromCookie: jest.fn() }));
jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/lib/db', () => ({ db: { getAllPlayRecords: jest.fn() } }));
const auth = getAuthInfoFromCookie as jest.Mock;
const config = getConfig as jest.Mock;
const records = db.getAllPlayRecords as jest.Mock;
const request = (scope = 'others') =>
  ({
    nextUrl: new URL(`http://localhost/api/recent-watching?scope=${scope}`),
  } as NextRequest);
const users = [
  { username: 'owner', role: 'owner' },
  { username: 'alice', role: 'user' },
  { username: 'bob', role: 'user' },
  { username: 'banned', role: 'user', banned: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.USERNAME = 'owner';
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'redis';
  auth.mockReturnValue({ username: 'alice' });
  config.mockResolvedValue({ UserConfig: { Users: users } });
  records.mockResolvedValue({});
});

test('requires authentication and rejects banned or deleted accounts', async () => {
  auth.mockReturnValue(null);
  expect((await GET(request())).status).toBe(401);
  auth.mockReturnValue({ username: 'banned' });
  expect((await GET(request())).status).toBe(403);
  auth.mockReturnValue({ username: 'deleted' });
  expect((await GET(request())).status).toBe(403);
  expect(records).not.toHaveBeenCalled();
});

test('ordinary users cannot request the administrator view', async () => {
  expect((await GET(request('all'))).status).toBe(403);
  expect(records).not.toHaveBeenCalled();
});

test('the shared feed excludes the viewer and banned users, and prevents shared CDN caching', async () => {
  const result = await GET(request());
  expect(records.mock.calls.map((call) => call[0]).sort()).toEqual([
    'bob',
    'owner',
  ]);
  expect(result.headers).toEqual({ 'Cache-Control': 'private, no-store' });
});

test('owner may inspect all active users; a single database failure does not hide other users', async () => {
  auth.mockReturnValue({ username: 'owner' });
  records.mockImplementation((name: string) =>
    name === 'bob' ? Promise.reject(new Error('offline')) : Promise.resolve({})
  );
  const result = (await GET(request('all'))) as unknown as {
    status: number;
    data: { partial: boolean; users: { username: string }[] };
  };
  expect(result.status).toBe(200);
  expect(result.data.partial).toBe(true);
  expect(result.data.users.map((user) => user.username).sort()).toEqual([
    'alice',
    'owner',
  ]);
});
