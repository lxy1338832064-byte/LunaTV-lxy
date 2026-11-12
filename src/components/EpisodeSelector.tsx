'use client';

import { ArrowDownUp, Gauge, Layers, Radio } from 'lucide-react';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getDefaultSource } from '@/lib/default-source';
import { speedBytes } from '@/lib/playback-node';
import { measurePlaybackNode } from '@/lib/playback-probe-cache';
import type { SearchResult } from '@/lib/types';

type VideoInfo = {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  hasError?: boolean;
};
interface EpisodeSelectorProps {
  totalEpisodes: number;
  episodes_titles: string[];
  episodesPerPage?: number;
  value?: number;
  onChange?: (episodeIndex: number) => void;
  onSourceChange?: (source: string, id: string, title: string) => void;
  currentSource?: string;
  currentId?: string;
  videoTitle?: string;
  videoYear?: string;
  availableSources?: SearchResult[];
  sourceSearchLoading?: boolean;
  sourceSearchError?: string | null;
  precomputedVideoInfo?: Map<string, VideoInfo>;
  onDiscoverSources?: () => void;
  playbackControls?: ReactNode;
}

export default function EpisodeSelector({
  totalEpisodes,
  episodes_titles,
  episodesPerPage = 50,
  value = 1,
  onChange,
  onSourceChange,
  currentSource,
  currentId,
  availableSources = [],
  sourceSearchLoading = false,
  sourceSearchError = null,
  precomputedVideoInfo,
  onDiscoverSources,
  playbackControls,
}: EpisodeSelectorProps) {
  const [defaultSourceKey, setDefaultSourceKey] = useState(
    () => getDefaultSource()?.key || ''
  );
  useEffect(() => {
    const update = () => setDefaultSourceKey(getDefaultSource()?.key || '');
    window.addEventListener('lunatv:default-source-changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('lunatv:default-source-changed', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(Math.floor((value - 1) / episodesPerPage));
  const [info, setInfo] = useState<Map<string, VideoInfo>>(new Map());
  const [testing, setTesting] = useState(false);
  const [testedEpisode, setTestedEpisode] = useState(value);
  const controller = useRef<AbortController | null>(null);
  const autoProbe = useRef('');
  const pageCount = Math.max(1, Math.ceil(totalEpisodes / episodesPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * episodesPerPage + 1;
  const episodes = Array.from(
    {
      length: Math.max(0, Math.min(episodesPerPage, totalEpisodes - start + 1)),
    },
    (_, i) => start + i
  );
  if (descending) episodes.reverse();
  const sortedSources = useMemo(
    () =>
      [...availableSources].sort(
        (a, b) =>
          Number(b.source === currentSource && b.id === currentId) -
          Number(a.source === currentSource && a.id === currentId)
      ),
    [availableSources, currentSource, currentId]
  );
  useEffect(() => {
    setPage(Math.floor((value - 1) / episodesPerPage));
    setInfo(new Map());
    setTestedEpisode(value);
    setTesting(false);
    controller.current?.abort();
    return () => {
      controller.current?.abort();
      autoProbe.current = '';
    };
  }, [value, episodesPerPage]);
  useEffect(() => {
    if (precomputedVideoInfo) setInfo(new Map(precomputedVideoInfo));
  }, [precomputedVideoInfo]);

  const testSources = useCallback(
    async (fresh = true) => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setTesting(true);
      setInfo(new Map());
      setTestedEpisode(value);
      let cursor = 0;
      const publish = (key: string, result: VideoInfo) => {
        if (!request.signal.aborted)
          setInfo((previous) => new Map(previous).set(key, result));
      };
      await Promise.all(
        Array.from({ length: Math.min(3, sortedSources.length) }, async () => {
          while (!request.signal.aborted && cursor < sortedSources.length) {
            const source = sortedSources[cursor++];
            const key = `${source.source}-${source.id}`;
            const episodeUrl = source.episodes?.[value - 1];
            if (!episodeUrl) continue;
            try {
              const result = await measurePlaybackNode(
                episodeUrl,
                request.signal,
                fresh
              );
              publish(key, result);
            } catch {
              publish(key, {
                quality: '未确认',
                loadSpeed: '未完成',
                pingTime: 0,
                hasError: true,
              });
            }
          }
        })
      );
      if (!request.signal.aborted) setTesting(false);
    },
    [sortedSources, value]
  );

  const sourceSignature = `${value}|${availableSources
    .map(
      (source) =>
        `${source.source}-${source.id}:${source.episodes?.[value - 1] || ''}`
    )
    .join('|')}`;
  useEffect(() => {
    if (
      !availableSources.length ||
      sourceSearchLoading ||
      autoProbe.current === sourceSignature
    )
      return;
    autoProbe.current = sourceSignature;
    void testSources(false);
  }, [
    availableSources.length,
    sourceSearchLoading,
    sourceSignature,
    testSources,
  ]);
  const measured =
    testedEpisode === value ? info : new Map<string, VideoInfo>();
  const fastest = Array.from(measured)
    .filter(
      ([, result]) => !result.hasError && speedBytes(result.loadSpeed) > 0
    )
    .sort(
      (a, b) => speedBytes(b[1].loadSpeed) - speedBytes(a[1].loadSpeed)
    )[0]?.[0];

  return (
    <div className='playback-sidebar flex min-h-0 flex-col gap-5 rounded-xl border border-white/10 bg-[#111416] p-4 text-gray-200 lg:h-full lg:overflow-y-auto'>
      <section
        aria-label='选集'
        className='flex min-h-0 flex-col lg:max-h-[34%]'
      >
        <div className='mb-3 flex shrink-0 items-center justify-between gap-2'>
          <h2 className='flex items-center gap-2 text-sm font-semibold text-white'>
            <Layers className='h-4 w-4 text-green-400' />
            选集{' '}
            <span className='text-xs font-normal text-gray-500'>
              共 {totalEpisodes} 集
            </span>
          </h2>
          <button
            type='button'
            aria-label={descending ? '切换为正序' : '切换为倒序'}
            onClick={() => setDescending((previous) => !previous)}
            className='rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-green-400'
          >
            <ArrowDownUp className='h-4 w-4' />
          </button>
        </div>
        {pageCount > 1 && (
          <div
            className='mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1'
            aria-label='集数分页'
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                aria-pressed={index === currentPage}
                onClick={() => setPage(index)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs ${
                  index === currentPage
                    ? 'bg-green-400/15 text-green-400'
                    : 'bg-white/5 text-gray-400'
                }`}
              >
                {index * episodesPerPage + 1}–
                {Math.min((index + 1) * episodesPerPage, totalEpisodes)}
              </button>
            ))}
          </div>
        )}
        <div className='flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto pr-1 lg:max-h-none'>
          {episodes.map((number) => {
            const label = episodes_titles[number - 1] || `第 ${number} 集`;
            const numeric = label.match(/^(?:第)?(\d+)(?:集|话)$/);
            return (
              <button
                key={number}
                aria-label={`播放${label}`}
                aria-pressed={value === number}
                title={label}
                onClick={() => onChange?.(number - 1)}
                className={`min-h-[40px] min-w-[40px] max-w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                  value === number
                    ? 'bg-green-400 font-semibold text-gray-950'
                    : 'bg-white/5 text-gray-300 hover:bg-green-400/15 hover:text-green-300'
                }`}
              >
                <span className='line-clamp-2'>
                  {numeric
                    ? numeric[1]
                    : label === `第 ${number} 集`
                    ? number
                    : label}
                </span>
              </button>
            );
          })}
          {totalEpisodes === 0 && (
            <p className='py-2 text-xs text-gray-500'>暂无可用集数</p>
          )}
        </div>
      </section>
      {playbackControls}
      <section
        aria-label='播放源'
        className='flex min-h-0 flex-1 flex-col border-t border-white/10 pt-4'
      >
        <div className='mb-3 flex shrink-0 items-center justify-between gap-2'>
          <h2 className='flex items-center gap-2 text-sm font-semibold text-white'>
            <Radio className='h-4 w-4 text-green-400' />
            播放源{' '}
            <span className='text-xs font-normal text-gray-500'>
              {availableSources.length} 个
            </span>
          </h2>
          <button
            type='button'
            disabled={testing || !availableSources.length}
            onClick={() => void testSources()}
            className='flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-2 text-xs text-gray-300 hover:text-green-300 disabled:opacity-50'
          >
            <Gauge className='h-3.5 w-3.5' />
            {testing ? '测速中…' : '重新测速'}
          </button>
        </div>
        {sourceSearchLoading && (
          <p role='status' className='mb-2 text-xs text-gray-500'>
            正在查找更多播放源，已找到的可先选择…
          </p>
        )}
        {sourceSearchError && (
          <p role='alert' className='mb-2 text-xs text-amber-300'>
            {sourceSearchError}
          </p>
        )}
        <div className='playback-source-grid grid max-h-80 gap-2 overflow-y-auto pr-1 lg:max-h-none'>
          {sortedSources.map((source) => {
            const key = `${source.source}-${source.id}`;
            const current =
              source.source === currentSource && source.id === currentId;
            const available = Boolean(source.episodes?.[value - 1]);
            const result = measured.get(key);
            return (
              <button
                type='button'
                key={key}
                aria-pressed={current}
                disabled={current || !available}
                onClick={() =>
                  onSourceChange?.(source.source, source.id, source.title)
                }
                className={`flex min-h-[76px] min-w-0 flex-col justify-between gap-1 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-default ${
                  current
                    ? 'border-green-400/50 bg-green-400/10'
                    : 'border-white/10 bg-white/[0.03] enabled:hover:border-green-400/40 enabled:hover:bg-green-400/5'
                } ${!available ? 'opacity-40' : ''}`}
              >
                <span className='flex w-full items-center justify-between gap-1 text-xs font-medium'>
                  <span className='truncate'>
                    {source.source_name || source.source}
                  </span>
                  <span className='flex shrink-0 items-center gap-1'>
                    {source.source === defaultSourceKey && (
                      <span className='rounded bg-amber-300/15 px-1 py-0.5 text-[10px] text-amber-300'>
                        默认
                      </span>
                    )}
                    {current ? (
                      <span className='shrink-0 text-[10px] text-green-400'>
                        当前
                      </span>
                    ) : fastest === key ? (
                      <span className='shrink-0 text-[10px] text-amber-300'>
                        ★ 最快
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className={`text-[11px] ${
                    result && !result.hasError
                      ? 'text-green-300'
                      : 'text-gray-500'
                  }`}
                >
                  {!available
                    ? '无当前集'
                    : result
                    ? result.hasError
                      ? '测速未完成，可尝试播放'
                      : `${result.loadSpeed} · ${result.pingTime} ms`
                    : testing
                    ? '等待测速…'
                    : `${source.episodes.length} 集 · 可切换`}
                </span>
                {result && !result.hasError && (
                  <span className='text-[10px] text-gray-500'>
                    {result.quality}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!availableSources.length && !sourceSearchLoading && (
          <p className='py-4 text-xs text-gray-500'>暂无其他播放源</p>
        )}
        {onDiscoverSources && (
          <button
            onClick={onDiscoverSources}
            className='mt-3 shrink-0 rounded-lg border border-green-400/20 px-3 py-2 text-xs text-green-300 hover:bg-green-400/10'
          >
            查找其他源（临时换源）
          </button>
        )}
        <p className='mt-3 shrink-0 text-[11px] leading-relaxed text-gray-500'>
          换源保留当前集数和进度，测速结果仅供参考。
        </p>
      </section>
    </div>
  );
}
