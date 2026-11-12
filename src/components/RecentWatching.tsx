'use client';

import { RefreshCw, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { RecentUser } from '@/lib/recent-watching';

import RecentWatchingPreview from './RecentWatchingPreview';
import ScrollableRow from './ScrollableRow';
import VideoCard from './VideoCard';

export default function RecentWatching({
  compact = false,
  scope = 'others',
}: {
  compact?: boolean;
  scope?: 'others' | 'all';
}) {
  const [users, setUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const [partial, setPartial] = useState(false);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(12);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/recent-watching?scope=${scope}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('无法获取观看记录，请稍后重试');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setUsers(data.users);
        setSupported(data.supported);
        setPartial(Boolean(data.partial));
      })
      .catch(() => {
        if (active) setError('暂时无法获取观看记录，请重试');
      })
      .finally(() => {
        if (active) setLoading(false);
        clearTimeout(timeout);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [revision, scope]);

  // Refresh on returning to this tab; no background polling on a slow connection.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const activeUsers =
    scope === 'all' ? users : users.filter((user) => user.resources.length > 0);
  const filtered = activeUsers.filter((user) =>
    user.username.toLowerCase().includes(query.trim().toLowerCase())
  );
  const shown = filtered.slice(0, visible);

  if (compact)
    return (
      <RecentWatchingPreview
        users={filtered}
        loading={loading}
        error={error}
        supported={supported}
        onRefresh={refresh}
      />
    );

  return (
    <section
      className='mb-8'
      aria-label={scope === 'all' ? '用户最近观看' : '大家最近在看'}
    >
      <div className='mb-4 flex items-center justify-between gap-3'>
        <h2 className='flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200'>
          <Users className='h-5 w-5 text-green-600' />
          {scope === 'all' ? '用户最近观看' : '大家最近在看'}
        </h2>
        <button
          disabled={loading}
          onClick={refresh}
          className='flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 disabled:opacity-50'
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          刷新
        </button>
      </div>
      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm text-gray-500'>
          按最近观看时间排序，每人最多 10 部，相同影片合并展示。
        </p>
        <input
          aria-label='筛选用户'
          placeholder='搜索用户名'
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisible(12);
          }}
          className='rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
        />
      </div>
      {loading && users.length === 0 ? (
        <div
          role='status'
          className='h-24 rounded-xl bg-gray-200/60 p-5 text-sm text-gray-500 dark:bg-gray-800'
        >
          正在获取最近观看…
        </div>
      ) : error ? (
        <div
          role='alert'
          className='rounded-xl border border-gray-200 p-5 text-sm text-gray-500 dark:border-gray-800'
        >
          {error}
          <button className='ml-3 text-green-600' onClick={refresh}>
            重试
          </button>
        </div>
      ) : !supported ? (
        <p className='py-5 text-sm text-gray-500'>
          浏览器本地存储模式不支持跨用户观看记录。
        </p>
      ) : shown.length === 0 ? (
        <p className='rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-800'>
          {query
            ? '没有匹配的用户'
            : '还没有其他用户的观看记录，开始观看后会显示在这里。'}
        </p>
      ) : (
        <div className='space-y-6'>
          {shown.map((user) => (
            <article
              key={user.username}
              className='min-w-0 rounded-2xl border border-gray-200/80 bg-white/50 p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900/40'
            >
              <div className='mb-4 flex items-center justify-between gap-3'>
                <h3 className='truncate font-semibold text-gray-900 dark:text-gray-100'>
                  {user.username}
                  <span className='ml-2 text-sm font-normal text-gray-500'>
                    最近在看
                  </span>
                </h3>
                <span className='shrink-0 text-xs text-gray-400'>
                  {user.resources.length} / 10 部
                </span>
              </div>
              {!user.resources.length ? (
                <p className='text-sm text-gray-500'>暂无观看记录</p>
              ) : (
                <ScrollableRow>
                  {user.resources.map((resource) => (
                    <div
                      key={`${resource.title}:${resource.year}`}
                      className='w-28 min-w-[112px] sm:w-40 sm:min-w-[160px]'
                    >
                      <VideoCard
                        title={resource.title}
                        query={resource.searchTitle}
                        poster={resource.cover}
                        year={resource.year}
                        from='douban'
                        type={resource.totalEpisodes > 1 ? 'tv' : ''}
                      />
                      <p className='mt-2 text-center text-xs text-gray-500'>
                        {resource.totalEpisodes > 1
                          ? `看到第 ${resource.episode} 集 · `
                          : ''}
                        {new Date(resource.watchedAt).toLocaleDateString(
                          'zh-CN',
                          { month: 'numeric', day: 'numeric' }
                        )}
                      </p>
                    </div>
                  ))}
                </ScrollableRow>
              )}
            </article>
          ))}
        </div>
      )}
      {partial && (
        <p className='mt-3 text-xs text-amber-600'>
          部分用户记录暂时未能读取，可稍后刷新。
        </p>
      )}
      {filtered.length > visible && (
        <button
          onClick={() => setVisible((previous) => previous + 12)}
          className='mt-6 rounded-xl border border-gray-200 px-5 py-2 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300'
        >
          加载更多用户
        </button>
      )}
    </section>
  );
}
