import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { measurePlaybackNode } from '@/lib/playback-probe-cache';
import type { SearchResult } from '@/lib/types';

import EpisodeSelector from './EpisodeSelector';

jest.mock('@/lib/playback-probe-cache', () => ({
  measurePlaybackNode: jest.fn(),
}));
const sources = ['a', 'b', 'c', 'd'].map(
  (id) =>
    ({
      id,
      source: id,
      source_name: `源${id}`,
      title: '测试影片',
      episodes: [1, 2, 3].map(
        (episode) => `https://example.com/${id}/${episode}.m3u8`
      ),
    } as SearchResult)
);
afterEach(() => jest.clearAllMocks());

test('episodes and sources are visible together, with existing selection callbacks preserved', () => {
  const change = jest.fn(),
    sourceChange = jest.fn();
  render(
    <EpisodeSelector
      totalEpisodes={3}
      episodes_titles={[]}
      value={2}
      currentSource='a'
      currentId='a'
      availableSources={sources}
      onChange={change}
      onSourceChange={sourceChange}
    />
  );
  expect(screen.getByRole('region', { name: '选集' })).toBeVisible();
  expect(screen.getByRole('region', { name: '播放源' })).toBeVisible();
  expect(screen.getByRole('button', { name: /源a/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '播放第 3 集' }));
  expect(change).toHaveBeenCalledWith(2);
  fireEvent.click(screen.getByRole('button', { name: /源b/ }));
  expect(sourceChange).toHaveBeenCalledWith('b', 'b', '测试影片');
  expect(measurePlaybackNode).not.toHaveBeenCalled();
  expect(sources.map((source) => source.id)).toEqual(['a', 'b', 'c', 'd']);
});

test('on-demand probes use the current episode, stay bounded and abort on episode change', async () => {
  const finish: Array<(result: unknown) => void> = [];
  (measurePlaybackNode as jest.Mock).mockImplementation(
    () => new Promise((resolve) => finish.push(resolve))
  );
  const view = render(
    <EpisodeSelector
      totalEpisodes={3}
      episodes_titles={[]}
      value={2}
      availableSources={sources}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '测速' }));
  await waitFor(() => expect(measurePlaybackNode).toHaveBeenCalledTimes(3));
  expect(
    (measurePlaybackNode as jest.Mock).mock.calls.map((call) => call[0])
  ).toEqual(sources.slice(0, 3).map((source) => source.episodes[1]));
  const signal = (measurePlaybackNode as jest.Mock).mock
    .calls[0][1] as AbortSignal;
  view.rerender(
    <EpisodeSelector
      totalEpisodes={3}
      episodes_titles={[]}
      value={3}
      availableSources={sources}
    />
  );
  expect(signal.aborted).toBe(true);
  await act(async () =>
    finish.forEach((resolve) =>
      resolve({ loadSpeed: '99 MB/s', quality: '1080p', pingTime: 1 })
    )
  );
  expect(measurePlaybackNode).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(/99 MB/)).not.toBeInTheDocument();
});
