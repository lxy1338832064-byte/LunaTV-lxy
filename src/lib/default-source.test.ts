import { getAuthInfoFromBrowserCookie } from './auth';
import {
  getDefaultSource,
  resolveDefaultPlayback,
  saveDefaultSource,
} from './default-source';
import { selectedNodeUrl } from './playback-node';

jest.mock('./auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
const originalFetch = global.fetch;
beforeEach(() => {
  localStorage.clear();
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
  });
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('defaults are isolated per account and can be cleared', () => {
  saveDefaultSource({ key: 'a', name: 'A源' });
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'bob',
  });
  expect(getDefaultSource()).toBeNull();
  saveDefaultSource({ key: 'b', name: 'B源' });
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
  });
  expect(getDefaultSource()?.key).toBe('a');
  saveDefaultSource(null);
  expect(getDefaultSource()).toBeNull();
});

test('a known result from the default source skips even the search request', async () => {
  global.fetch = jest.fn();
  const target = await resolveDefaultPlayback(
    '/play?source=a&id=12&title=test&prefer=true',
    { key: 'a', name: 'A源' },
    new AbortController().signal
  );
  expect(global.fetch).not.toHaveBeenCalled();
  expect(target).toContain('usingDefault=1');
  expect(target).not.toContain('prefer=');
});

test('a different year or missing saved episode does not silently select a mismatched result', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      results: [
        { source: 'a', id: '12', title: 'test', year: '2020', episodes: ['x'] },
      ],
    }),
  })) as unknown as typeof fetch;
  await expect(
    resolveDefaultPlayback(
      '/play?title=test&year=2026',
      { key: 'a', name: 'A源' },
      new AbortController().signal
    )
  ).rejects.toThrow();
  await expect(
    resolveDefaultPlayback(
      '/play?title=test&resumeEpisode=2&resumeTime=20',
      { key: 'a', name: 'A源' },
      new AbortController().signal
    )
  ).rejects.toThrow();
});

test('a temporary selection keeps resume progress but drops the auto-fallback marker', () => {
  saveDefaultSource({ key: 'a', name: 'A源' });
  const url = selectedNodeUrl(
    '/play?source=a&id=12&usingDefault=1&chooseNode=1&fallbackReason=playback&resumeEpisode=4&resumeTime=245',
    'b',
    '99'
  );
  expect(url).toContain('source=b');
  expect(url).toContain('resumeEpisode=4');
  expect(url).toContain('resumeTime=245');
  expect(url).not.toContain('usingDefault');
  expect(url).not.toContain('chooseNode');
  expect(getDefaultSource()?.key).toBe('a');
});
