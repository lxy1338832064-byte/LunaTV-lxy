import {
  getDefaultSource,
  saveAccountDefaultSource,
  saveDefaultSource,
  syncDefaultSource,
} from './default-source';

let username = '';
jest.mock('./auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username }),
}));
const a = { key: 'a', name: 'A源' };
const b = { key: 'b', name: 'B源' };
const response = (defaultSource: typeof a | null, configured = true) => ({
  ok: true,
  json: async () => ({ supported: true, configured, defaultSource }),
});
const originalFetch = global.fetch;
let sequence = 0;
beforeEach(() => {
  username = `sync-user-${++sequence}`;
  localStorage.clear();
  Object.assign(window, { RUNTIME_CONFIG: { STORAGE_TYPE: 'redis' } });
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
  Object.assign(window, { RUNTIME_CONFIG: undefined });
});

test('an account assignment replaces a stale browser preference without migration', async () => {
  saveDefaultSource(a);
  (fetch as jest.Mock).mockResolvedValue(response(b));
  expect(await syncDefaultSource(true)).toEqual(b);
  expect(getDefaultSource()).toEqual(b);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('an explicit admin clear overrides the old browser value', async () => {
  saveDefaultSource(a);
  (fetch as jest.Mock).mockResolvedValue(response(null));
  expect(await syncDefaultSource(true)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('legacy migration respects an admin clear that happened after the initial read', async () => {
  saveDefaultSource(a);
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(null, false))
    .mockResolvedValueOnce(response(null));
  expect(await syncDefaultSource(true)).toBeNull();
  expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body)).toEqual({
    sourceKey: 'a',
    migrateOnly: true,
  });
});

test('failed account saves retain the local value and successful saves use the server value', async () => {
  saveDefaultSource(a);
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: '没有该源权限' }),
  });
  await expect(saveAccountDefaultSource(b)).rejects.toThrow('没有该源权限');
  expect(getDefaultSource()).toEqual(a);
  (fetch as jest.Mock).mockResolvedValueOnce(response(b));
  await saveAccountDefaultSource(b);
  expect(getDefaultSource()).toEqual(b);
});

test('a delayed response cannot write another account preference after an account switch', async () => {
  saveDefaultSource(a);
  let resolve: (value: ReturnType<typeof response>) => void = () => undefined;
  (fetch as jest.Mock).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const pending = syncDefaultSource(true);
  username = 'another-user';
  saveDefaultSource(b);
  resolve(response(a));
  await pending;
  expect(getDefaultSource()).toEqual(b);
});
