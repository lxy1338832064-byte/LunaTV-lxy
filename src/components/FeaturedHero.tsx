'use client';

import { ChevronLeft, ChevronRight, Play, Search } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { DoubanItem } from '@/lib/types';
import { processPosterUrl } from '@/lib/utils';

import { useNavigation } from './NavigationProvider';

export type FeaturedItem = DoubanItem & { kind: 'movie' | 'tv' };
const keyOf = (item: FeaturedItem) => `${item.kind}:${item.id}`;

export default function FeaturedHero({
  items,
  loading,
}: {
  items: FeaturedItem[];
  loading: boolean;
}) {
  const [active, setActive] = useState('');
  const [failed, setFailed] = useState<string[]>([]);
  const navigate = useNavigation();
  const router = useRouter();
  const selected = items.find((item) => keyOf(item) === active) || items[0];
  const index = selected ? items.indexOf(selected) : 0;
  const shift = (step: number) =>
    setActive(keyOf(items[(index + step + items.length) % items.length]));
  if (!selected)
    return (
      <section
        aria-label='精选推荐'
        className='mb-5 flex min-h-[220px] items-end rounded-xl bg-gray-900 p-6 sm:min-h-[360px] sm:p-8'
      >
        <div>
          <p className='mb-2 text-xs text-green-400'>精选推荐</p>
          <h1 className='mb-3 text-3xl font-semibold text-gray-100'>
            {loading ? '好故事，即将呈现' : '发现下一部好故事'}
          </h1>
          <button
            onClick={() => navigate('/search', '搜索')}
            className='flex items-center gap-2 text-sm text-gray-400'
          >
            <Search className='h-4 w-4' />
            {loading ? '也可以先搜索想看的影片' : '搜索电影、电视剧'}
          </button>
        </div>
      </section>
    );
  const selectedKey = keyOf(selected);
  return (
    <section aria-label='精选推荐' className='mb-5'>
      <div className='portal-hero relative isolate h-[320px] overflow-hidden rounded-lg sm:h-[380px] xl:h-[440px]'>
        {!failed.includes(selectedKey) && (
          <Image
            key={selectedKey}
            src={processPosterUrl(selected.heroPoster || selected.poster, 480)}
            alt=''
            aria-hidden
            fill
            sizes='(max-width: 639px) 100vw, 80vw'
            priority
            fetchPriority='high'
            className='object-cover object-[center_28%] sm:object-[center_30%]'
            onError={() => setFailed((keys) => [...keys, selectedKey])}
          />
        )}
        <div className='absolute inset-x-0 bottom-7 z-10 px-5 sm:bottom-12 sm:px-8 lg:px-12'>
          <div className='max-w-[85%] py-2 sm:max-w-[60%]'>
            <span className='mb-3 inline-flex items-center gap-2 text-xs font-medium tracking-wider text-green-400'>
              <span className='h-1 w-5 rounded-full bg-green-400' />
              {selected.kind === 'tv' ? '剧集精选' : '电影精选'}
            </span>
            <h1 className='mb-3 line-clamp-2 text-2xl font-bold tracking-tight text-white sm:text-4xl xl:text-5xl'>
              {selected.title}
            </h1>
            <div className='mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-300 sm:text-sm'>
              {selected.rate && (
                <span className='font-semibold text-amber-300'>
                  ★ {selected.rate}
                </span>
              )}
              {selected.year && <span>{selected.year}</span>}
              <span>{selected.kind === 'tv' ? '人气剧集' : '热门电影'}</span>
            </div>
            <p className='mb-5 hidden text-sm text-gray-400 sm:block'>
              从热门片单出发，找到值得沉浸的下一部作品。
            </p>
            <button
              onMouseEnter={() => router.prefetch('/play')}
              onFocus={() => router.prefetch('/play')}
              onClick={() =>
                navigate(
                  `/play?title=${encodeURIComponent(
                    selected.title
                  )}&year=${encodeURIComponent(selected.year)}&stype=${
                    selected.kind
                  }`,
                  selected.title
                )
              }
              className='inline-flex items-center gap-2 rounded-md bg-green-500 px-4 py-2.5 text-xs font-semibold sm:px-6 sm:text-sm text-gray-950 hover:bg-green-400'
            >
              <Play className='h-4 w-4 fill-current' />
              立即观看
            </button>
            {items.length > 1 && (
              <div className='mt-4 flex items-center gap-2'>
                <button
                  aria-label='上一部推荐'
                  onClick={() => shift(-1)}
                  className='rounded-full border border-white/15 bg-black/30 p-2 text-white hover:bg-white/15'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                <button
                  aria-label='下一部推荐'
                  onClick={() => shift(1)}
                  className='rounded-full border border-white/15 bg-black/30 p-2 text-white hover:bg-white/15'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
                <span className='ml-1 text-xs tabular-nums text-gray-500'>
                  {index + 1} / {items.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className='mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2'
        aria-label='切换精选推荐'
      >
        {items.map((item) => (
          <button
            key={keyOf(item)}
            aria-pressed={keyOf(item) === selectedKey}
            aria-label={`推荐：${item.title}`}
            onClick={() => setActive(keyOf(item))}
            className={`group flex min-w-[200px] flex-1 basis-0 snap-start items-center gap-3 rounded-lg border p-3 text-left transition-colors sm:min-w-[220px] ${
              keyOf(item) === selectedKey
                ? 'border-green-500/60 bg-green-500/5'
                : 'border-white/5 bg-gray-900/40 hover:border-white/15'
            }`}
          >
            <span className='relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded bg-gray-950 sm:h-[120px] sm:w-20'>
              <Image
                src={processPosterUrl(item.poster)}
                alt=''
                fill
                sizes='80px'
                loading='lazy'
                className='object-contain'
              />
            </span>
            <span className='min-w-0'>
              <span
                className={`block line-clamp-2 text-sm ${
                  keyOf(item) === selectedKey
                    ? 'font-semibold text-white'
                    : 'text-gray-400 group-hover:text-gray-200'
                }`}
              >
                {item.title}
              </span>
              <span className='mt-2 block text-xs text-gray-500'>
                {item.year}
                {item.rate ? ` · ${item.rate}分` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
