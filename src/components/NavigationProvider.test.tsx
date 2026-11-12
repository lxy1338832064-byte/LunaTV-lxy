import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import { getDefaultSource, saveDefaultSource } from '@/lib/default-source';

import { NavigationProvider, useNavigation } from './NavigationProvider';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock(
  'next/dynamic',
  () => () =>
    function Picker() {
      return <div>节点选择内容</div>;
    }
);

const originalFetch = global.fetch;
beforeEach(() => localStorage.clear());
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function Entry({ url }: { url: string }) {
  const navigate = useNavigation();
  return <button onClick={() => navigate(url, '测试影片')}>继续观看</button>;
}

test('continue watching preserves the remembered source, episode and time without opening probes', () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  render(
    <NavigationProvider>
      <Entry url='/play?source=old&id=123&title=test&prefer=true&resumeEpisode=5&resumeTime=456' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  expect(push).toHaveBeenCalledTimes(1);
  const params = new URL(push.mock.calls[0][0], 'http://localhost')
    .searchParams;
  expect(params.get('source')).toBe('old');
  expect(params.get('id')).toBe('123');
  expect(params.get('resumeEpisode')).toBe('5');
  expect(params.get('resumeTime')).toBe('456');
  expect(params.has('prefer')).toBe(false);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an explicit source-change request opens nodes while retaining the resume position', () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  render(
    <NavigationProvider>
      <Entry url='/play?source=old&id=123&resumeEpisode=5&resumeTime=456&chooseNode=1' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveTextContent('从第 5 集 7:36 继续');
  expect(screen.getByText('节点选择内容')).toBeInTheDocument();
});

test('a configured source opens a movie directly after searching only that source, with no picker', async () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  saveDefaultSource({ key: 'preferred', name: '默认源' });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      results: [
        {
          source: 'preferred',
          id: 'p1',
          title: 'test',
          year: '2026',
          episodes: ['https://example.com/1.m3u8'],
        },
      ],
    }),
  })) as unknown as typeof fetch;
  render(
    <NavigationProvider>
      <Entry url='/play?title=test&year=2026&prefer=true' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
    'resourceId=preferred'
  );
  expect(push.mock.calls[0][0]).toContain('source=preferred');
  expect(push.mock.calls[0][0]).toContain('id=p1');
  expect(push.mock.calls[0][0]).toContain('usingDefault=1');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(getDefaultSource()?.key).toBe('preferred');
});

test('a missing movie falls back to the picker and explains that the default stays unchanged', async () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  saveDefaultSource({ key: 'preferred', name: '默认源' });
  global.fetch = jest.fn(async () => ({
    ok: false,
  })) as unknown as typeof fetch;
  render(
    <NavigationProvider>
      <Entry url='/play?title=test' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  expect(await screen.findByRole('dialog')).toHaveTextContent('不会修改默认源');
  expect(screen.getByRole('dialog')).toHaveTextContent(
    '未找到影片或暂时无法连接'
  );
  expect(push).not.toHaveBeenCalled();
  expect(getDefaultSource()?.key).toBe('preferred');
});

test('saved playback history takes precedence over the configured default', () => {
  const push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ push });
  saveDefaultSource({ key: 'preferred', name: '默认源' });
  global.fetch = jest.fn();
  render(
    <NavigationProvider>
      <Entry url='/play?source=old&id=123&resumeEpisode=4&resumeTime=245' />
    </NavigationProvider>
  );
  fireEvent.click(screen.getByText('继续观看'));
  expect(push.mock.calls[0][0]).toContain('source=old');
  expect(global.fetch).not.toHaveBeenCalled();
});
