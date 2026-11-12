'use client';

import { Check, Gauge, Radio, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  DefaultSource,
  getDefaultSource,
  saveDefaultSource,
} from '@/lib/default-source';
import type { SourceHealth } from '@/lib/source-health';

export default function DefaultSourceDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(() => getDefaultSource()?.key || '');
  const [sources, setSources] = useState<DefaultSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [health, setHealth] = useState<SourceHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [healthRevision, setHealthRevision] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const request = new AbortController();
    let active = true;
    const timer = setTimeout(() => request.abort(), 10000);
    setLoading(true);
    setError('');
    void fetch('/api/playback/nodes', {
      signal: request.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (active) setSources(data);
      })
      .catch(() => {
        if (active) setError('播放源列表加载失败，请重试');
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      request.abort();
    };
  }, [revision]);
  useEffect(() => {
    const request = new AbortController();
    let active = true;
    const timer = setTimeout(() => request.abort(), 15000);
    setHealthLoading(true);
    setHealthError('');
    void fetch('/api/service-status', {
      signal: request.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setHealth(Array.isArray(data.sources) ? data.sources : []);
        if (data.supported === false)
          setHealthError('当前存储模式不支持接口测速');
      })
      .catch(() => {
        if (active)
          setHealthError('接口测速暂未完成，可重试或直接选择已知可用的源');
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setHealthLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      request.abort();
    };
  }, [healthRevision]);
  const fastest = [...health]
    .filter((item) => item.status === 'available' && item.latencyMs !== null)
    .sort((a, b) => (a.latencyMs || 0) - (b.latencyMs || 0))[0]?.key;
  const unavailable = Boolean(
    selected && !loading && !sources.some((source) => source.key === selected)
  );
  const save = () => {
    try {
      const source = sources.find((source) => source.key === selected);
      if (selected && !source) return;
      saveDefaultSource(source || null);
      onClose();
    } catch {
      setError('浏览器未能保存设置，请检查存储权限后重试');
    }
  };
  return createPortal(
    <div
      className='fixed inset-0 z-[1500] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm'
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role='dialog'
        aria-modal='true'
        aria-labelledby='default-source-title'
        tabIndex={-1}
        className='flex max-h-[88dvh] w-full max-w-xl flex-col rounded-2xl border border-white/10 bg-[#161a1d] p-5 text-gray-200 shadow-2xl outline-none'
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Tab') {
            const items = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled)'
            );
            const first = items?.[0],
              last = items?.[items.length - 1];
            if (
              first &&
              last &&
              (event.shiftKey
                ? document.activeElement === first ||
                  document.activeElement === dialog.current
                : document.activeElement === last ||
                  document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              (event.shiftKey ? last : first).focus();
            }
          }
        }}
      >
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h2
            id='default-source-title'
            className='flex items-center gap-2 text-lg font-semibold text-white'
          >
            <Radio className='h-5 w-5 text-green-400' />
            默认播放源
          </h2>
          <button
            aria-label='关闭默认源设置'
            onClick={onClose}
            className='rounded-full p-2 hover:bg-white/10'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
        <p className='mb-4 text-sm leading-relaxed text-gray-400'>
          优先用默认源搜索和播放，跳过打开影片前的测速。找不到或加载异常时，再选择临时播放源。
        </p>
        {error && (
          <p role='alert' className='mb-3 text-sm text-amber-300'>
            {error}
            <button
              className='ml-2 underline'
              onClick={() => setRevision((previous) => previous + 1)}
            >
              重试
            </button>
          </p>
        )}
        {unavailable && !error && (
          <p role='alert' className='mb-3 text-xs text-amber-300'>
            之前设置的源已不可用，请重新选择或取消默认源。
          </p>
        )}
        <div className='mb-3 flex items-center justify-between gap-3 text-xs'>
          <span className='text-gray-500'>接口响应延迟 · 由服务器检测</span>
          <button
            onClick={() => setHealthRevision((previous) => previous + 1)}
            disabled={healthLoading}
            className='flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-green-300 disabled:opacity-50'
          >
            <Gauge className='h-3.5 w-3.5' />
            {healthLoading ? '测速中…' : '重新测速'}
          </button>
        </div>
        {healthError && (
          <p role='status' className='mb-3 text-xs text-amber-300'>
            {healthError}
          </p>
        )}
        <div className='min-h-0 overflow-y-auto pr-1'>
          <fieldset>
            <legend className='sr-only'>选择默认播放源</legend>
            <label className='mb-3 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3'>
              <input
                type='radio'
                name='default-source'
                checked={!selected}
                onChange={() => setSelected('')}
                className='accent-green-400'
              />
              <span className='text-sm'>
                不设置默认源
                <span className='mt-1 block text-xs text-gray-500'>
                  每次打开影片时选择播放节点
                </span>
              </span>
            </label>
            {loading ? (
              <p
                role='status'
                className='py-6 text-center text-sm text-gray-500'
              >
                正在加载播放源…
              </p>
            ) : (
              <div className='grid grid-cols-2 gap-2'>
                {sources.map((source) => {
                  const measured = health.find(
                    (item) => item.key === source.key
                  );
                  const available = measured?.status === 'available';
                  return (
                    <label
                      key={source.key}
                      className={`flex min-h-[48px] min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        selected === source.key
                          ? 'border-green-400/50 bg-green-400/10 text-green-300'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type='radio'
                        name='default-source'
                        checked={selected === source.key}
                        onChange={() => setSelected(source.key)}
                        className='accent-green-400'
                      />
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate'>{source.name}</span>
                        <span
                          className={`mt-1 block text-[11px] ${
                            available
                              ? (measured.latencyMs || 0) < 800
                                ? 'text-green-300'
                                : (measured.latencyMs || 0) < 2000
                                ? 'text-amber-300'
                                : 'text-orange-300'
                              : 'text-gray-500'
                          }`}
                        >
                          {healthLoading
                            ? '正在检测…'
                            : available
                            ? `${measured.latencyMs} ms${
                                fastest === source.key ? ' · ★ 最快' : ''
                              }`
                            : measured?.message || '暂未测通'}
                        </span>
                      </span>
                      {selected === source.key && (
                        <Check className='ml-auto h-4 w-4 shrink-0' />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        </div>
        <p className='mt-4 text-xs leading-relaxed text-gray-500'>
          接口测速最多缓存 60
          秒，实际播放速度以影片测速为准。设置仅保存在当前浏览器，按账号分别保存。临时换源不会修改默认源；继续观看优先使用上次播放源。
        </p>
        <div className='mt-4 flex justify-end gap-2 border-t border-white/10 pt-4'>
          <button
            onClick={onClose}
            className='rounded-lg bg-white/5 px-4 py-2 text-sm'
          >
            取消
          </button>
          <button
            disabled={loading || unavailable}
            onClick={save}
            className='rounded-lg bg-green-400 px-4 py-2 text-sm font-semibold text-gray-950 disabled:opacity-40'
          >
            保存设置
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
