/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';

// 客户端收藏 API
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import DeferredSection from '@/components/DeferredSection';
import FeaturedHero from '@/components/FeaturedHero';
import HomeQuickTools from '@/components/HomeQuickTools';
import { useNavigation } from '@/components/NavigationProvider';
import PageLayout from '@/components/PageLayout';
import RecentWatching from '@/components/RecentWatching';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const navigate = useNavigation();
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState({
    movies: true,
    tv: true,
    variety: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const { announcement } = useSite();
  const featuredItems = useMemo(
    () => [
      ...hotTvShows
        .slice(0, 6)
        .map((item) => ({ ...item, kind: 'tv' as const })),
      ...hotMovies
        .slice(0, 2)
        .map((item) => ({ ...item, kind: 'movie' as const })),
    ],
    [hotTvShows, hotMovies]
  );

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

  // 收藏夹数据
  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
    currentEpisode?: number;
    search_title?: string;
    origin?: 'vod' | 'live';
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async <T,>(
      key: keyof typeof loading,
      request: () => Promise<T>,
      update: (data: T) => void
    ) => {
      setLoading((prev) => ({ ...prev, [key]: true }));
      setErrors((prev) => ({ ...prev, [key]: '' }));
      try {
        const data = await request();
        if (active) update(data);
      } catch {
        if (active)
          setErrors((prev) => ({ ...prev, [key]: '暂时无法获取内容' }));
      } finally {
        if (active) setLoading((prev) => ({ ...prev, [key]: false }));
      }
    };
    const recommendations = async (
      params: Parameters<typeof getDoubanCategories>[0]
    ) => {
      const result = await getDoubanCategories(params);
      if (result.code !== 200) throw new Error('获取推荐失败');
      return result.list;
    };
    void load(
      'movies',
      () =>
        recommendations({
          kind: 'movie',
          category: '热门',
          type: '全部',
          pageLimit: 12,
        }),
      setHotMovies
    );
    void load(
      'tv',
      () =>
        recommendations({
          kind: 'tv',
          category: 'tv',
          type: 'tv',
          pageLimit: 12,
        }),
      setHotTvShows
    );
    void load(
      'variety',
      () =>
        recommendations({
          kind: 'tv',
          category: 'show',
          type: 'show',
          pageLimit: 12,
        }),
      setHotVarietyShows
    );
    return () => {
      active = false;
    };
  }, [retry]);

  const sectionMessage = (key: string, empty: boolean) =>
    !loading[key as keyof typeof loading] && empty ? (
      <div
        className='flex items-center gap-3 rounded-xl border border-gray-200/70 p-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400'
        role='status'
      >
        <span>{errors[key] || '暂无内容'}</span>
        {errors[key] && (
          <button
            className='text-green-600 hover:underline dark:text-green-400'
            onClick={() => setRetry((value) => value + 1)}
          >
            重新加载
          </button>
        )}
      </div>
    ) : null;

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();

    // 根据保存时间排序（从近到远）
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        // 查找对应的播放记录，获取当前集数
        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;

        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
          origin: fav?.origin,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    // 监听收藏更新事件
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab]);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      <div className='home-content portal-home px-4 pb-6 sm:px-6 lg:px-8'>
        <header className='flex min-h-[64px] flex-wrap items-center justify-between gap-3 py-3 md:pr-20'>
          <CapsuleSwitch
            options={[
              { label: '精选', value: 'home' },
              { label: '收藏', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
          <form
            action='/search'
            onSubmit={(event) => {
              event.preventDefault();
              const query = String(
                new FormData(event.currentTarget).get('q') || ''
              ).trim();
              if (query)
                navigate(`/search?q=${encodeURIComponent(query)}`, '搜索结果');
            }}
            role='search'
            className='relative flex w-full items-center gap-2 rounded-full border border-green-400/50 bg-[#17241e] p-1.5 shadow-[0_0_24px_rgba(34,197,94,0.08)] transition-colors focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/25 sm:ml-6 sm:w-auto sm:max-w-2xl sm:flex-1'
          >
            <Search
              aria-hidden='true'
              className='pointer-events-none absolute left-4 h-5 w-5 text-green-400'
            />
            <input
              name='q'
              aria-label='搜索电影、电视剧'
              placeholder='输入电影、电视剧名称…'
              className='h-11 min-w-0 flex-1 rounded-full border-0 bg-transparent pl-10 pr-1 text-base text-white outline-none placeholder:text-gray-300 focus:ring-0'
            />
            <button
              type='submit'
              className='h-11 shrink-0 rounded-full bg-green-400 px-5 text-sm font-bold text-gray-950 transition-colors hover:bg-green-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-300 sm:px-7'
            >
              搜索
            </button>
          </form>
        </header>
        {activeTab === 'home' && (
          <FeaturedHero
            items={featuredItems}
            loading={loading.movies || loading.tv}
          />
        )}
        {activeTab === 'home' && <RecentWatching compact />}
        <HomeQuickTools />
        <div className='w-full'>
          {activeTab === 'favorites' ? (
            // 收藏夹视图
            <section className='mb-6'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='lux-section-title text-lg font-semibold text-gray-800 dark:text-gray-200'>
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    onClick={async () => {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
                {favoriteItems.map((item) => (
                  <div key={item.id + item.source} className='w-full'>
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from='favorite'
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    暂无收藏内容
                  </div>
                )}
              </div>
            </section>
          ) : (
            // 首页视图
            <>
              {/* 热门电影 */}
              <section className='mb-6'>
                <div className='mb-4 flex items-center justify-between'>
                  <h2 className='lux-section-title text-lg font-semibold text-gray-800 dark:text-gray-200'>
                    热门电影
                  </h2>
                  <Link
                    href='/douban?type=movie'
                    className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                {sectionMessage('movies', hotMovies.length === 0)}
                <div className='portal-video-grid'>
                  {loading.movies
                    ? // 加载状态显示灰色占位数据
                      Array.from({ length: 12 }).map((_, index) => (
                        <div key={index} className='min-w-0 w-full'>
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                            <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                          </div>
                          <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                        </div>
                      ))
                    : // 显示真实数据
                      hotMovies.slice(0, 12).map((movie, index) => (
                        <div key={index} className='min-w-0 w-full'>
                          <VideoCard
                            from='douban'
                            variant='portal-poster'
                            title={movie.title}
                            poster={movie.poster}
                            douban_id={Number(movie.id)}
                            rate={movie.rate}
                            year={movie.year}
                            type='movie'
                          />
                        </div>
                      ))}
                </div>
              </section>

              {/* 热门剧集 */}
              <DeferredSection>
                <section className='mb-6'>
                  <div className='mb-4 flex items-center justify-between'>
                    <h2 className='lux-section-title text-lg font-semibold text-gray-800 dark:text-gray-200'>
                      热门剧集
                    </h2>
                    <Link
                      href='/douban?type=tv'
                      className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    >
                      查看更多
                      <ChevronRight className='w-4 h-4 ml-1' />
                    </Link>
                  </div>
                  {sectionMessage('tv', hotTvShows.length === 0)}
                  <div className='portal-video-grid'>
                    {loading.tv
                      ? // 加载状态显示灰色占位数据
                        Array.from({ length: 12 }).map((_, index) => (
                          <div key={index} className='min-w-0 w-full'>
                            <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                              <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                            </div>
                            <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                          </div>
                        ))
                      : // 显示真实数据
                        hotTvShows.slice(0, 12).map((show, index) => (
                          <div key={index} className='min-w-0 w-full'>
                            <VideoCard
                              from='douban'
                              variant='portal-poster'
                              title={show.title}
                              poster={show.poster}
                              douban_id={Number(show.id)}
                              rate={show.rate}
                              year={show.year}
                            />
                          </div>
                        ))}
                  </div>
                </section>
              </DeferredSection>

              {/* 热门综艺 */}
              <DeferredSection>
                <section className='mb-6'>
                  <div className='mb-4 flex items-center justify-between'>
                    <h2 className='lux-section-title text-lg font-semibold text-gray-800 dark:text-gray-200'>
                      热门综艺
                    </h2>
                    <Link
                      href='/douban?type=show'
                      className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    >
                      查看更多
                      <ChevronRight className='w-4 h-4 ml-1' />
                    </Link>
                  </div>
                  {sectionMessage('variety', hotVarietyShows.length === 0)}
                  <div className='portal-video-grid'>
                    {loading.variety
                      ? // 加载状态显示灰色占位数据
                        Array.from({ length: 12 }).map((_, index) => (
                          <div key={index} className='min-w-0 w-full'>
                            <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                              <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                            </div>
                            <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                          </div>
                        ))
                      : // 显示真实数据
                        hotVarietyShows.slice(0, 12).map((show, index) => (
                          <div key={index} className='min-w-0 w-full'>
                            <VideoCard
                              from='douban'
                              variant='portal-poster'
                              title={show.title}
                              poster={show.poster}
                              douban_id={Number(show.id)}
                              rate={show.rate}
                              year={show.year}
                            />
                          </div>
                        ))}
                  </div>
                </section>
              </DeferredSection>
            </>
          )}
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4 transition-opacity duration-300 ${
            showAnnouncement ? '' : 'opacity-0 pointer-events-none'
          }`}
          onTouchStart={(e) => {
            // 如果点击的是背景区域，阻止触摸事件冒泡，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          onTouchMove={(e) => {
            // 如果触摸的是背景区域，阻止触摸移动，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onTouchEnd={(e) => {
            // 如果触摸的是背景区域，阻止触摸结束事件，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          style={{
            touchAction: 'none', // 禁用所有触摸操作
          }}
        >
          <div
            className='w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl'
            onTouchMove={(e) => {
              // 允许公告内容区域正常滚动，阻止事件冒泡到外层
              e.stopPropagation();
            }}
            style={{
              touchAction: 'auto', // 允许内容区域的正常触摸操作
            }}
          >
            <div className='flex justify-between items-start mb-4'>
              <h3 className='text-2xl font-bold tracking-tight text-gray-800 dark:text-white border-b border-green-500 pb-1'>
                提示
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white transition-colors'
                aria-label='关闭'
              ></button>
            </div>
            <div className='mb-6'>
              <div className='relative overflow-hidden rounded-lg mb-4 bg-green-50 dark:bg-green-900/20'>
                <div className='absolute inset-y-0 left-0 w-1.5 bg-green-500 dark:bg-green-400'></div>
                <p className='ml-4 text-gray-600 dark:text-gray-300 leading-relaxed'>
                  {announcement}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 transition-all duration-300 transform hover:-translate-y-0.5'
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
