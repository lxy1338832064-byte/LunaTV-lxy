/* eslint-disable no-console */
'use client';

import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
  compact?: boolean;
}

export default function ContinueWatching({
  className,
  compact = false,
}: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    // 将记录转换为数组并根据 save_time 由近到远排序
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    // 按 save_time 降序排序（最新的在前面）
    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time
    );

    setPlayRecords(sortedRecords);
  };

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);

        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
        setError('观看记录暂时加载失败，请关闭面板后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, []);

  // 如果没有播放记录，则不渲染组件
  if (!loading && playRecords.length === 0) {
    return compact ? (
      <p className='py-10 text-center text-sm text-gray-500'>
        {error || '暂无观看记录，播放影片后可在这里继续观看。'}
      </p>
    ) : null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (!Number.isFinite(record.total_time) || record.total_time <= 0) return 0;
    return Math.min(
      100,
      Math.max(0, (record.play_time / record.total_time) * 100)
    );
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  return (
    <section className={`mb-6 ${className || ''}`}>
      <div
        className={`mb-3 flex items-center ${
          compact ? 'justify-end' : 'justify-between'
        }`}
      >
        <h2
          className={`${
            compact
              ? 'sr-only'
              : 'lux-section-title text-lg font-semibold text-gray-800 dark:text-gray-200'
          }`}
        >
          继续观看
        </h2>
        {!loading && playRecords.length > 0 && (
          <button
            className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            onClick={async () => {
              try {
                await clearAllPlayRecords();
                setPlayRecords([]);
              } catch {
                setError('清空失败，请稍后重试');
              }
            }}
          >
            清空
          </button>
        )}
      </div>
      {error && (
        <p role='alert' className='mb-3 text-xs text-red-500'>
          {error}
        </p>
      )}
      <div
        className={
          compact
            ? 'grid grid-cols-1 gap-3'
            : 'grid grid-flow-col auto-cols-[minmax(260px,85%)] gap-3 overflow-x-auto pb-2 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3'
        }
      >
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                role='status'
                aria-label='正在加载观看记录'
                className='h-[138px] animate-pulse rounded-2xl bg-gray-200/60 dark:bg-gray-800'
              />
            ))
          : (expanded ? playRecords : playRecords.slice(0, 6)).map((record) => {
              const { source, id } = parseKey(record.key);
              return (
                <VideoCard
                  key={record.key}
                  variant='resume'
                  id={id}
                  title={record.title}
                  poster={record.cover}
                  year={record.year}
                  source={source}
                  source_name={record.source_name}
                  progress={getProgress(record)}
                  episodes={record.total_episodes}
                  currentEpisode={record.index}
                  query={record.search_title}
                  from='playrecord'
                  type={record.total_episodes > 1 ? 'tv' : ''}
                  onDelete={() =>
                    setPlayRecords((previous) =>
                      previous.filter((item) => item.key !== record.key)
                    )
                  }
                />
              );
            })}
      </div>
      {!loading && playRecords.length > 6 && (
        <button
          className='mt-3 text-xs text-gray-500 hover:text-green-600'
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '收起记录' : `查看全部 ${playRecords.length} 条记录`}
        </button>
      )}
    </section>
  );
}
