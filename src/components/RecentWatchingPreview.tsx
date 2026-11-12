'use client';

import { ChevronRight, Film, RefreshCw, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { RecentUser } from '@/lib/recent-watching';
import { processPosterUrl } from '@/lib/utils';

import { useNavigation } from './NavigationProvider';

export default function RecentWatchingPreview({
  users,
  loading,
  error,
  supported,
  onRefresh,
}: {
  users: RecentUser[];
  loading: boolean;
  error: string;
  supported: boolean;
  onRefresh: () => void;
}) {
  const navigate = useNavigation();
  const recent = users.filter((user) => user.resources.length).slice(0, 4);
  return (
    <section aria-label='大家在看' className='mb-6 mt-5'>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <Users className='h-4 w-4 shrink-0 text-green-400' />
          <h2 className='shrink-0 text-base font-semibold text-gray-100'>
            大家在看
          </h2>
          <span className='hidden truncate text-xs text-gray-500 sm:block'>
            跟着大家发现好故事
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          <button
            aria-label='刷新最近观看'
            disabled={loading}
            onClick={onRefresh}
            className='rounded-md p-1.5 text-gray-500 hover:bg-white/5 hover:text-green-400 disabled:opacity-40'
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <Link
            href='/recent-watching'
            className='flex items-center gap-1 text-xs text-gray-400 hover:text-green-400'
          >
            查看全部
            <ChevronRight className='h-3.5 w-3.5' />
          </Link>
        </div>
      </div>
      {recent.length > 0 ? (
        <div className='recent-preview-grid grid gap-3'>
          {recent.map((user) => {
            const resource = user.resources[0];
            return (
              <button
                key={user.username}
                onClick={() =>
                  navigate(
                    `/play?title=${encodeURIComponent(
                      resource.searchTitle
                    )}&year=${encodeURIComponent(resource.year)}`,
                    resource.title,
                    processPosterUrl(resource.cover)
                  )
                }
                className='group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-left transition-colors hover:border-green-400/30 hover:bg-green-400/5'
              >
                <span className='relative flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5'>
                  <Film className='h-5 w-5 text-gray-600' />
                  {resource.cover && (
                    <Image
                      src={processPosterUrl(resource.cover)}
                      alt=''
                      fill
                      sizes='56px'
                      className='object-cover'
                    />
                  )}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center gap-1.5 text-[11px] text-gray-500'>
                    <span className='flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-400/10 text-[9px] text-green-300'>
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className='truncate'>{user.username} 最近在看</span>
                  </span>
                  <span className='mt-1.5 block truncate text-sm font-medium text-gray-100 group-hover:text-green-300'>
                    {resource.title}
                  </span>
                  <span className='mt-1 block truncate text-[11px] text-gray-500'>
                    {resource.totalEpisodes > 1
                      ? `看到第 ${resource.episode} 集 · `
                      : ''}
                    {new Date(resource.watchedAt).toLocaleDateString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </span>
                <ChevronRight className='h-4 w-4 shrink-0 text-gray-600 group-hover:text-green-400' />
              </button>
            );
          })}
        </div>
      ) : loading ? (
        <div
          role='status'
          aria-label='正在加载最近观看'
          className='h-10 rounded-lg bg-white/[0.025]'
        />
      ) : (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs text-gray-500'>
          <span>
            {error ||
              (!supported
                ? '当前模式暂不支持共享记录'
                : '还没有共享的观看记录，先发现一部喜欢的影片吧')}
          </span>
          {error && (
            <button onClick={onRefresh} className='shrink-0 text-green-400'>
              重试
            </button>
          )}
        </div>
      )}
    </section>
  );
}
