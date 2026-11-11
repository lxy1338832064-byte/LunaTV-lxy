import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { getVideoResolutionFromM3u8 } from '@/lib/utils';

import PlaybackNodePicker from './PlaybackNodePicker';

jest.mock('@/lib/utils', () => ({ getVideoResolutionFromM3u8: jest.fn() }));
const originalFetch = global.fetch;
const item = (id: string) => ({
  id,
  source: id,
  source_name: `节点${id}`,
  title: '测试影片',
  year: '2026',
  episodes: [`https://example.com/${id}.m3u8`],
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('nodes stay disabled until measured, failures stay disabled and fastest success is recommended', async () => {
  global.fetch = jest.fn(async (path) => ({
    ok: true,
    json: async () =>
      String(path).includes('/playback/nodes')
        ? [{ key: 'a' }, { key: 'b' }]
        : {
            results: [item(String(path).includes('resourceId=a') ? 'a' : 'b')],
          },
  })) as unknown as typeof fetch;
  let readyA: (value: unknown) => void = () => undefined;
  let readyB: (value: unknown) => void = () => undefined;
  (getVideoResolutionFromM3u8 as jest.Mock).mockImplementation(
    (url: string) =>
      new Promise((resolve) => {
        if (url.includes('/a.')) readyA = resolve;
        else readyB = resolve;
      })
  );
  const select = jest.fn();
  render(
    <PlaybackNodePicker
      url='/play?title=测试影片&year=2026&prefer=true'
      onSelect={select}
    />
  );
  const a = await screen.findByRole('button', { name: /节点a/ });
  const b = await screen.findByRole('button', { name: /节点b/ });
  expect(a).toBeDisabled();
  expect(b).toBeDisabled();
  fireEvent.click(a);
  expect(select).not.toHaveBeenCalled();
  await act(async () => {
    readyA({ loadSpeed: '400 KB/s', pingTime: 100, quality: '720p' });
  });
  await waitFor(() => expect(a).toBeEnabled());
  expect(b).toBeDisabled();
  await act(async () => {
    readyB({ loadSpeed: '2 MB/s', pingTime: 60, quality: '1080p' });
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /节点b.*推荐/ })).toBeEnabled()
  );
  fireEvent.click(b);
  const selected = new URL(select.mock.calls[0][0], 'http://localhost');
  expect(selected.searchParams.get('source')).toBe('b');
  expect(selected.searchParams.has('prefer')).toBe(false);
});

test('failed measurements cannot be played and closing aborts active work', async () => {
  global.fetch = jest.fn(async (path) => ({
    ok: true,
    json: async () =>
      String(path).includes('/playback/nodes')
        ? [{ key: 'a' }]
        : { results: [item('a')] },
  })) as unknown as typeof fetch;
  (getVideoResolutionFromM3u8 as jest.Mock).mockRejectedValue(
    new Error('offline')
  );
  const view = render(
    <PlaybackNodePicker url='/play?title=测试影片' onSelect={jest.fn()} />
  );
  const button = await screen.findByRole('button', { name: /测速失败/ });
  expect(button).toBeDisabled();
  const signal = (getVideoResolutionFromM3u8 as jest.Mock).mock
    .calls[0][1] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});
