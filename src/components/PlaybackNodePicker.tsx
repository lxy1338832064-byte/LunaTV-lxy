'use client';

import { useEffect, useState } from 'react';

import { readResume, selectedNodeUrl, speedBytes } from '@/lib/playback-node';
import type { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/utils';

type Node = {
  key: string;
  name: string;
  item?: SearchResult;
  state: 'searching' | 'testing' | 'ready' | 'failed' | 'missing';
  speed?: string;
  quality?: string;
  ping?: number;
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
  const [message, setMessage] = useState('正在加载节点列表…');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const params = new URL(url, window.location.origin).searchParams;
    const episode = readResume(params)?.episode || 1;
    let active = true;
    setNodes([]);
    setSearching(true);
    setMessage('正在加载节点列表…');
    const patch = (key: string, change: Partial<Node>) => {
      if (active)
        setNodes((previous) =>
          previous.map((node) =>
            node.key === key ? { ...node, ...change } : node
          )
        );
    };
    const json = async (path: string) => {
      const request = new AbortController();
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 20000);
      if (signal.aborted) abort();
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
    void (async () => {
      try {
        const sources: Array<{ key: string; name: string }> = await json(
          '/api/playback/nodes'
        );
        if (!active) return;
        // Allocate one fixed slot per configured source before any search/probe.
        setNodes(
          sources.map((source) => ({
            key: source.key,
            name: source.name || `节点${source.key}`,
            state: 'searching',
          }))
        );
        let cursor = 0,
          completed = 0;
        await Promise.all(
          Array.from({ length: Math.min(3, sources.length) }, async () => {
            while (active && cursor < sources.length) {
              const source = sources[cursor++];
              try {
                let item: SearchResult | undefined;
                if (source.key === params.get('source') && params.get('id')) {
                  try {
                    item = await json(
                      `/api/detail?source=${encodeURIComponent(
                        source.key
                      )}&id=${encodeURIComponent(params.get('id') || '')}`
                    );
                  } catch {
                    /* Search this source as fallback. */
                  }
                }
                if (!item) {
                  const result = await json(
                    `/api/search/one?resourceId=${encodeURIComponent(
                      source.key
                    )}&q=${encodeURIComponent(
                      params.get('stitle') || params.get('title') || ''
                    )}`
                  );
                  item = (result.results || []).find(
                    (candidate: SearchResult) =>
                      (!params.get('year') ||
                        !candidate.year ||
                        candidate.year === 'unknown' ||
                        candidate.year === params.get('year')) &&
                      candidate.episodes?.length >= episode
                  );
                }
                if (!active) return;
                if (!item?.episodes?.[episode - 1]) {
                  patch(source.key, { state: 'missing' });
                  continue;
                }
                patch(source.key, { item, state: 'testing' });
                const measured = await getVideoResolutionFromM3u8(
                  item.episodes[episode - 1],
                  signal
                );
                if (!speedBytes(measured.loadSpeed))
                  throw new Error('测速失败');
                patch(source.key, {
                  item,
                  state: 'ready',
                  speed: measured.loadSpeed,
                  quality: measured.quality,
                  ping: measured.pingTime,
                });
              } catch {
                patch(source.key, { state: 'failed' });
              } finally {
                completed++;
                if (active)
                  setMessage(
                    `已检测 ${completed} / ${sources.length} 个资源站`
                  );
              }
            }
          })
        );
      } catch {
        if (active) setMessage('节点加载失败，请重试');
      } finally {
        if (active) setSearching(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [url, revision]);
  const best = nodes
    .filter((node) => node.state === 'ready')
    .sort((a, b) => speedBytes(b.speed || '') - speedBytes(a.speed || ''))[0];
  return (
    <div>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold text-white'>请选择播放节点</h3>
        <p role='status' className='text-xs text-gray-400'>
          {message}
        </p>
      </div>
      <div className='playback-node-grid grid gap-2'>
        {nodes.map((node) => (
          <button
            key={node.key}
            disabled={node.state !== 'ready'}
            onClick={() => {
              if (node.item)
                onSelect(selectedNodeUrl(url, node.item.source, node.item.id));
            }}
            className='flex h-[80px] min-w-0 flex-col items-start justify-between gap-1 overflow-hidden rounded-lg border border-white/10 bg-white/5 p-2.5 text-left enabled:hover:border-green-400 enabled:hover:bg-green-400/10 disabled:cursor-not-allowed disabled:opacity-50'
          >
            <span className='flex h-5 w-full items-center gap-1 text-xs font-medium text-white'>
              <span className='truncate'>{node.name}</span>
              {node === best && (
                <span className='shrink-0 rounded bg-green-500/20 px-1 py-0.5 text-[10px] text-green-300'>
                  ★ {searching ? '当前最快' : '推荐'}
                </span>
              )}
            </span>
            <span className='block text-xs text-green-300'>
              {node.state === 'ready' ? (
                node.speed
              ) : (
                <span
                  className={
                    node.state === 'failed' ? 'text-red-400' : 'text-gray-400'
                  }
                >
                  {node.state === 'searching'
                    ? '等待测速'
                    : node.state === 'testing'
                    ? '正在测速…'
                    : node.state === 'missing'
                    ? '无匹配集数'
                    : '测速失败'}
                </span>
              )}
            </span>
            <span className='block h-3 text-[10px] text-gray-500'>
              {node.state === 'ready'
                ? `${node.quality} · ${node.ping} ms`
                : node.item
                ? `第 ${
                    readResume(new URL(url, 'http://localhost').searchParams)
                      ?.episode || 1
                  } 集`
                : ''}
            </span>
          </button>
        ))}
      </div>
      {!searching && !best && (
        <p className='mt-3 text-xs text-gray-400'>
          暂无可用节点，请重试或稍后再试。
        </p>
      )}
      {!searching && (
        <button
          className='mt-3 text-xs text-green-400'
          onClick={() => setRevision((value) => value + 1)}
        >
          重新搜索测速
        </button>
      )}
    </div>
  );
}
