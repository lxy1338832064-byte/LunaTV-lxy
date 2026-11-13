/** @jest-environment node */
import { updateAccountDefaultSources } from './account-default-source';
import type { AdminConfig } from './admin.types';
import { db } from './db';

jest.mock('./db', () => ({
  db: { getAdminConfig: jest.fn(), saveAdminConfig: jest.fn() },
}));
jest.mock('./config', () => ({
  getConfig: jest.fn(),
  setCachedConfig: jest.fn(),
}));
let config: AdminConfig;
beforeEach(() => {
  process.env.USERNAME = 'owner';
  config = {
    SourceConfig: [
      { key: 'a', name: 'A源' },
      { key: 'b', name: 'B源' },
      { key: 'off', name: '禁用源', disabled: true },
    ],
    UserConfig: {
      Users: [
        { username: 'owner', role: 'owner' },
        { username: 'admin', role: 'admin' },
        { username: 'peer', role: 'admin' },
        { username: 'u', role: 'user', enabledApis: ['a'] },
        { username: 'grouped', role: 'user', tags: ['limited'] },
      ],
      Tags: [{ name: 'limited', enabledApis: ['b'] }],
    },
  } as AdminConfig;
  (db.getAdminConfig as jest.Mock).mockImplementation(async () =>
    JSON.parse(JSON.stringify(config))
  );
  (db.saveAdminConfig as jest.Mock).mockImplementation(async (data) => {
    config = data;
  });
});
afterEach(() => jest.clearAllMocks());

test('an administrator can edit defaults for ordinary users, other admins and the owner', async () => {
  await updateAccountDefaultSources('admin', ['owner', 'peer', 'u'], 'a', true);
  expect(
    config.UserConfig.Users.filter((user) =>
      ['owner', 'peer', 'u'].includes(user.username)
    ).every((user) => user.defaultSourceKey === 'a')
  ).toBe(true);
});

test('one restricted user causes the whole batch to fail before any mutation', async () => {
  await expect(
    updateAccountDefaultSources('admin', ['peer', 'u'], 'b', true)
  ).rejects.toMatchObject({ status: 400 });
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
  expect(
    config.UserConfig.Users.every((user) => user.defaultSourceKey === undefined)
  ).toBe(true);
});

test('ordinary users and banned administrators cannot modify other accounts', async () => {
  await expect(
    updateAccountDefaultSources('u', ['peer'], 'a', true)
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    updateAccountDefaultSources('u', ['peer'], 'a', false)
  ).rejects.toMatchObject({ status: 403 });
  const admin = config.UserConfig.Users.find(
    (user) => user.username === 'admin'
  );
  if (admin) admin.banned = true;
  await expect(
    updateAccountDefaultSources('admin', ['u'], 'a', true)
  ).rejects.toMatchObject({ status: 403 });
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test('self-service and group restrictions are respected; disabled sources cannot be selected', async () => {
  await updateAccountDefaultSources('grouped', ['grouped'], 'b', false);
  expect(
    config.UserConfig.Users.find((user) => user.username === 'grouped')
      ?.defaultSourceKey
  ).toBe('b');
  await expect(
    updateAccountDefaultSources('grouped', ['grouped'], 'a', false)
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    updateAccountDefaultSources('owner', ['owner'], 'off', true)
  ).rejects.toMatchObject({ status: 400 });
});

test('old browser migrations cannot undo an admin assignment or explicit clear', async () => {
  await updateAccountDefaultSources('admin', ['u'], null, true);
  await updateAccountDefaultSources('u', ['u'], 'b', false, true);
  expect(
    config.UserConfig.Users.find((user) => user.username === 'u')
      ?.defaultSourceKey
  ).toBeNull();
  await updateAccountDefaultSources('admin', ['u'], 'a', true);
  await updateAccountDefaultSources('u', ['u'], null, false, true);
  expect(
    config.UserConfig.Users.find((user) => user.username === 'u')
      ?.defaultSourceKey
  ).toBe('a');
});
