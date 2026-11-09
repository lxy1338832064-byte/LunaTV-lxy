'use client';

import { Suspense } from 'react';

import PageLayout from '@/components/PageLayout';
import RecentWatching from '@/components/RecentWatching';

export default function RecentWatchingPage() {
  return (
    <Suspense fallback={<div className='p-8 text-gray-500'>正在加载…</div>}>
      <PageLayout activePath='/recent-watching'>
        <div className='mx-auto max-w-[1600px] px-4 py-6 sm:px-10 sm:py-10'>
          <h1 className='mb-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100'>
            一起发现好故事
          </h1>
          <p className='mb-8 text-sm text-gray-500 dark:text-gray-400'>
            看看其他用户最近看过哪些电影和剧集。这里展示观看记录，不代表当前在线。
          </p>
          <RecentWatching />
        </div>
      </PageLayout>
    </Suspense>
  );
}
