'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { SourceHealth } from '@/lib/source-health';

function getSourceAppearance(source: SourceHealth, invalid: boolean) {
  if (invalid || source.status === 'unknown')
    return {
      color: 'bg-gray-300 dark:bg-gray-600',
      textColor: 'text-gray-400',
      label: '未检测',
    };
  if (source.status === 'unavailable')
    return {
      color: 'bg-[#c53929]',
      textColor: 'text-red-600 dark:text-red-400',
      label: '不可用',
    };
  if (source.latencyMs === null)
    return {
      color: 'bg-gray-300 dark:bg-gray-600',
      textColor: 'text-gray-400',
      label: '耗时未知',
    };
  if (source.latencyMs <= 800)
    return {
      color: 'bg-[#58a454]',
      textColor: 'text-green-700 dark:text-green-400',
      label: '快速',
    };
  if (source.latencyMs <= 2000)
    return {
      color: 'bg-[#d4ad36]',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      label: '正常',
    };
  return {
    color: 'bg-[#d88429]',
    textColor: 'text-orange-700 dark:text-orange-400',
    label: '偏慢',
  };
}

export default function ServiceStatus() {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 13000);
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/service-status', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('无法获取服务状态');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setSources(data.sources);
        setSupported(data.supported);
      })
      .catch(() => {
        if (active) setError('状态暂不可用');
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [revision]);
  const available = sources.filter(
    (source) => source.status === 'available'
  ).length;
  const unknown = sources.filter(
    (source) => source.status === 'unknown'
  ).length;
  const state = loading
    ? 'checking'
    : error || !supported || sources.length === 0 || unknown === sources.length
    ? 'unknown'
    : available === sources.length
    ? 'healthy'
    : available > 0 || unknown > 0
    ? 'partial'
    : 'offline';
  const colors = {
    checking: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    unknown: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    healthy:
      'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    partial:
      'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    offline: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  const label = loading
    ? '检测中'
    : error ||
      (!supported
        ? '暂不支持检测'
        : sources.length === 0
        ? '未配置接口'
        : state === 'healthy'
        ? '服务正常'
        : state === 'partial'
        ? '部分可用'
        : state === 'unknown'
        ? '待检测'
        : '暂不可用');
  return (
    <section
      aria-label='资源服务状态'
      className='lux-panel mb-4 rounded-xl border border-gray-200/80 bg-white/60 dark:border-gray-800 dark:bg-gray-900/40'
    >
      <div className='px-4 py-2.5 sm:px-5'>
        <div className='mb-1 flex flex-wrap items-center justify-between gap-3'>
          <button
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={id}
            title='绿色：≤800 ms；黄色：801–2000 ms；橙色：超过2000 ms；红色：不可用。点击展开详情。'
            className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200'
          >
            <span className='font-medium'>资源服务</span>
            <span
              role='status'
              className={`rounded-full px-2 py-0.5 text-xs ${colors[state]}`}
            >
              {label}
            </span>
            {!loading && !error && sources.length > 0 && (
              <span className='text-xs text-gray-400'>
                {available} / {sources.length} 可用
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 text-gray-400 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          <button
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading}
            aria-label='刷新服务状态'
            className='flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 disabled:opacity-50'
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
        <div
          className='flex w-full flex-wrap gap-x-3 gap-y-4 pb-1 pt-2'
          aria-label='各接口状态'
        >
          {sources.map((source) => {
            const appearance = getSourceAppearance(source, Boolean(error));
            const latency =
              source.status === 'available' &&
              source.latencyMs !== null &&
              !error
                ? `${source.latencyMs.toLocaleString()} ms`
                : '—';
            return (
              <button
                key={source.key}
                onClick={() => setExpanded(true)}
                aria-label={`${source.name}：${appearance.label}，${latency}`}
                title={`${source.name} · ${appearance.label} · ${latency}`}
                className='group min-w-0 basis-[140px] flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-4'
              >
                <span className='mb-2 flex items-center justify-between gap-2 text-xs'>
                  <span className='min-w-0 truncate font-medium text-gray-700 dark:text-gray-200'>
                    {source.name}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${appearance.textColor}`}
                  >
                    {latency}
                  </span>
                </span>
                <span
                  className={`block h-2.5 w-full rounded-full transition-opacity group-hover:opacity-75 ${
                    appearance.color
                  } ${loading ? 'opacity-50' : ''}`}
                />
              </button>
            );
          })}
          {sources.length === 0 && (
            <span className='py-2 text-xs text-gray-400'>
              {loading
                ? '正在检测接口…'
                : error || (!supported ? '暂不支持检测' : '尚未配置资源接口')}
            </span>
          )}
        </div>
        <p className='sr-only'>
          接口响应耗时：绿色 ≤800 毫秒，黄色 801–2000 毫秒，橙色超过 2000
          毫秒，红色不可用，灰色未检测。
        </p>
      </div>
      {expanded && (
        <div
          id={id}
          className='border-t border-gray-200/70 px-4 py-4 dark:border-gray-800'
        >
          <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            {sources.map((source) => (
              <div
                key={source.key}
                className='rounded-lg bg-gray-50 px-3 py-2.5 text-xs dark:bg-gray-800/50'
              >
                <div className='flex items-center justify-between gap-3'>
                  <span className='truncate font-medium text-gray-700 dark:text-gray-200'>
                    {source.name}
                  </span>
                  <span
                    className={
                      getSourceAppearance(source, Boolean(error)).textColor
                    }
                  >
                    {getSourceAppearance(source, Boolean(error)).label}
                  </span>
                </div>
                <p className='mt-1 text-gray-500'>
                  {source.message}
                  {source.status === 'available' && source.latencyMs !== null
                    ? ` · ${source.latencyMs} ms`
                    : ''}
                </p>
                {source.checkedAt && (
                  <p className='mt-1 text-gray-400'>
                    检测于{' '}
                    {new Date(source.checkedAt).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className='mt-3 text-xs leading-relaxed text-gray-400'>
            {error ||
              (!supported
                ? '浏览器本地存储模式不支持接口检测。'
                : sources.length === 0 && !loading
                ? '请在管理后台配置可用的视频源。'
                : '检测结果缓存 60 秒，仅检测接口响应，不代表每个视频都能播放。')}
          </p>
        </div>
      )}
    </section>
  );
}
