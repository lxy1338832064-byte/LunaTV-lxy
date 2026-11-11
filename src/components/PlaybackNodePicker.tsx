'use client';

import { useEffect, useState } from 'react';

import { selectedNodeUrl, speedBytes } from '@/lib/playback-node';
import type { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/utils';

type Node = {
  item: SearchResult;
  state: 'testing' | 'ready' | 'failed';
  speed?: string;
  ping?: number;
  quality?: string;
};

export default function PlaybackNodePicker({
  url,
  onSelect,
}: {
  url: string;
  onSelect: (url: string) => void;
}) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [searching, setSearching] = useState(true);
  const [message, setMessage] = useState('正在查找播放节点…');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const params = new URL(url, window.location.origin).searchParams;
    const seen = new Set<string>();
    let active = true;
    const tests: SearchResult[] = [];
    let running = 0;
    setNodes([]);
    setSearching(true);
    setMessage('正在查找播放节点…');
    const json = async (path: string) => {
      const request = new AbortController();
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      const timer = setTimeout(abort, 20000);
      try {
        const response = await fetch(path, {
          signal: request.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('请求失败');
        return await response.json();
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    };
    const pump = () => {
      while (active && running < 2 && tests.length) {
        const item = tests.shift();
        if (!item) break;
        running++;
        void getVideoResolutionFromM3u8(item.episodes[0], signal)
          .then((result) => {
            if (!speedBytes(result.loadSpeed)) throw new Error('无法测量速度');
            if (active)
              setNodes((previous) =>
                previous.map((node) =>
                  node.item === item
                    ? {
                        item,
                        state: 'ready',
                        speed: result.loadSpeed,
                        ping: result.pingTime,
                        quality: result.quality,
                      }
                    : node
                )
              );
          })
          .catch(() => {
            if (active)
              setNodes((previous) =>
                previous.map((node) =>
                  node.item === item ? { item, state: 'failed' } : node
                )
              );
          })
          .finally(() => {
            running--;
            pump();
          });
      }
    };
    const add = (item: SearchResult) => {
      if (!item.title)
        item = {
          ...item,
          title: params.get('title') || '影片',
          year: item.year || params.get('year') || '',
        };
      const key = `${item.source}:${item.id}`;
      if (!active || !item.episodes?.length || seen.has(key) || seen.size >= 20)
        return;
      const year = params.get('year');
      if (year && item.year && item.year !== 'unknown' && item.year !== year)
        return;
      seen.add(key);
      setNodes((previous) => [...previous, { item, state: 'testing' }]);
      tests.push(item);
      pump();
    };
    void (async () => {
      try {
        // Existing records appear immediately, without waiting for other sources.
        const direct =
          params.get('source') && params.get('id')
            ? json(
                `/api/detail?source=${encodeURIComponent(
                  params.get('source') || ''
                )}&id=${encodeURIComponent(params.get('id') || '')}`
              )
                .then(add)
                .catch(() => undefined)
            : Promise.resolve();
        const sources: Array<{ key: string; name: string }> = await json(
          '/api/playback/nodes'
        );
        let cursor = 0;
        let completed = 0;
        await Promise.all([
          direct,
          ...Array.from({ length: Math.min(3, sources.length) }, async () => {
            while (active && cursor < sources.length) {
              const source = sources[cursor++];
              try {
                const result = await json(
                  `/api/search/one?resourceId=${encodeURIComponent(
                    source.key
                  )}&q=${encodeURIComponent(
                    params.get('stitle') || params.get('title') || ''
                  )}`
                );
                (result.results || []).slice(0, 6).forEach(add);
              } catch {
                /* An unavailable source must not hide other results. */
              }
              completed++;
              if (active)
                setMessage(`已搜索 ${completed} / ${sources.length} 个资源站`);
            }
          }),
        ]);
      } catch {
        if (active) setMessage('部分节点获取失败，可以重试');
      } finally {
        if (active) setSearching(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      tests.length = 0;
    };
  }, [url, revision]);
  const best = nodes
    .filter((node) => node.state === 'ready')
    .sort((a, b) => speedBytes(b.speed || '') - speedBytes(a.speed || ''))[0];
  const testing = nodes.some((node) => node.state === 'testing');
  return (
    <div>
      <h3 className='text-base font-semibold text-white'>请选择播放节点</h3>
      <p role='status' className='mb-4 mt-2 text-xs text-gray-400'>
        {message}
        {testing ? ' · 正在测速，可先选择已就绪节点' : ''}
      </p>
      <div className='space-y-2'>
        {nodes.map((node) => (
          <button
            key={`${node.item.source}:${node.item.id}`}
            disabled={node.state !== 'ready'}
            onClick={() =>
              onSelect(selectedNodeUrl(url, node.item.source, node.item.id))
            }
            className='flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left enabled:hover:border-green-400 enabled:hover:bg-green-400/10 disabled:cursor-not-allowed disabled:opacity-60'
          >
            <span className='min-w-0'>
              <span className='block text-sm text-white'>
                {node.item.source_name}
                {node === best && (
                  <span className='ml-2 rounded bg-green-500/20 px-2 py-1 text-xs text-green-300'>
                    ★ {searching || testing ? '当前最快' : '推荐'}
                  </span>
                )}
              </span>
              <span className='mt-1 block truncate text-xs text-gray-400'>
                {node.item.title} · {node.item.year} ·{' '}
                {node.item.episodes.length} 集
              </span>
            </span>
            <span className='shrink-0 text-right text-xs text-green-300'>
              {node.state === 'ready' ? (
                <>
                  {node.speed}
                  <span className='mt-1 block text-gray-400'>
                    {node.quality} · {node.ping} ms
                  </span>
                </>
              ) : node.state === 'failed' ? (
                <span className='text-red-400'>测速失败</span>
              ) : (
                '等待 / 测速中…'
              )}
            </span>
          </button>
        ))}
      </div>
      {!searching && !testing && !best && (
        <p className='mt-4 text-sm text-gray-400'>
          暂无测速成功的节点，请重试或稍后再试。
        </p>
      )}
      {!searching && !testing && (
        <button
          className='mt-4 text-sm text-green-400'
          onClick={() => setRevision((value) => value + 1)}
        >
          重新搜索测速
        </button>
      )}
    </div>
  );
}
