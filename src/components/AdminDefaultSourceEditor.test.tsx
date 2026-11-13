import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { AdminConfig } from '@/lib/admin.types';

import AdminDefaultSourceEditor from './AdminDefaultSourceEditor';

jest.mock('@/lib/default-source', () => ({
  syncDefaultSource: jest.fn(async () => null),
}));
const originalFetch = global.fetch;
const config = {
  SourceConfig: [
    { key: 'a', name: 'A源' },
    { key: 'b', name: 'B源' },
  ],
  UserConfig: {
    Users: [
      {
        username: 'alice',
        role: 'user',
        enabledApis: ['a'],
        defaultSourceKey: 'a',
      },
      { username: 'bob', role: 'admin', defaultSourceKey: 'b' },
    ],
  },
} as AdminConfig;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('individual edits expose only authorized choices and send the exact selected account', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true }),
  })) as unknown as typeof fetch;
  const refresh = jest.fn(async () => undefined);
  render(
    <AdminDefaultSourceEditor
      users={[config.UserConfig.Users[0]]}
      config={config}
      onSaved={refresh}
    />
  );
  expect(screen.getByLabelText('默认播放源：alice')).toHaveValue('a');
  expect(screen.queryByRole('option', { name: 'B源' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await screen.findByText('已保存');
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual(
    { usernames: ['alice'], sourceKey: null }
  );
  expect(refresh).toHaveBeenCalled();
});

test('the all-users editor uses only shared sources and surfaces a rejected save', async () => {
  global.fetch = jest.fn(async () => ({
    ok: false,
    json: async () => ({ error: '播放源权限已改变' }),
  })) as unknown as typeof fetch;
  render(
    <AdminDefaultSourceEditor
      users={config.UserConfig.Users}
      config={config}
      onSaved={jest.fn()}
    />
  );
  expect(screen.queryByRole('option', { name: 'B源' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });
  fireEvent.click(screen.getByRole('button', { name: /应用到全部/ }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('播放源权限已改变')
  );
});
