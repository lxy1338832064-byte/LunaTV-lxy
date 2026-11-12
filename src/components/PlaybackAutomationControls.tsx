'use client';

import { useEffect, useState } from 'react';

import type { SkipConfig } from '@/lib/types';

export default function PlaybackAutomationControls({
  config,
  autoNext,
  onConfig,
  onAutoNext,
  getPosition,
}: {
  config: SkipConfig;
  autoNext: boolean;
  onConfig: (config: SkipConfig) => void;
  onAutoNext: (enabled: boolean) => void;
  getPosition: () => { time: number; duration: number };
}) {
  const [intro, setIntro] = useState(String(Math.round(config.intro_time)));
  const [outro, setOutro] = useState(String(Math.round(-config.outro_time)));
  const [message, setMessage] = useState('');
  useEffect(() => {
    setIntro(String(Math.round(config.intro_time)));
    setOutro(String(Math.round(-config.outro_time)));
  }, [config.intro_time, config.outro_time]);
  const save = (first = Number(intro), last = Number(outro)) => {
    const { duration } = getPosition();
    if (
      !Number.isFinite(first) ||
      !Number.isFinite(last) ||
      first < 0 ||
      last < 0 ||
      first > 600 ||
      last > 600 ||
      (duration > 0 && first + last + 30 >= duration)
    ) {
      setMessage('请设置 0–600 秒，并至少保留 30 秒正片。');
      return;
    }
    onConfig({
      enable: true,
      intro_time: Math.round(first),
      outro_time: last > 0 ? -Math.round(last) : 0,
    });
    setMessage('已按本影片保存，后续各集自动使用。');
  };
  return (
    <section
      aria-label='智能播放'
      className='shrink-0 border-t border-white/10 pt-3'
    >
      <h2 className='mb-2 text-xs font-semibold text-gray-300'>智能播放</h2>
      <div className='flex items-center justify-between gap-2 py-1 text-xs text-gray-400'>
        <span>自动播放下一集</span>
        <button
          role='switch'
          aria-checked={autoNext}
          aria-label='自动播放下一集'
          onClick={() => onAutoNext(!autoNext)}
          className={`relative h-5 w-9 rounded-full ${
            autoNext ? 'bg-green-400' : 'bg-gray-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              autoNext ? 'left-4' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      <div className='flex items-center justify-between gap-2 py-1 text-xs text-gray-400'>
        <span>自动跳过片头片尾</span>
        <button
          role='switch'
          aria-checked={config.enable}
          aria-label='自动跳过片头片尾'
          onClick={() => onConfig({ ...config, enable: !config.enable })}
          className={`relative h-5 w-9 rounded-full ${
            config.enable ? 'bg-green-400' : 'bg-gray-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white ${
              config.enable ? 'left-4' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      <details className='mt-2 text-xs text-gray-400'>
        <summary className='cursor-pointer text-green-300'>
          设置跳过时长 · {config.intro_time}s / {-config.outro_time}s
        </summary>
        <div className='mt-3 grid grid-cols-2 gap-2'>
          <label>
            片头（秒）
            <input
              aria-label='片头时长（秒）'
              type='number'
              min='0'
              max='600'
              value={intro}
              onChange={(event) => setIntro(event.target.value)}
              className='mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-2 text-sm text-white'
            />
          </label>
          <label>
            片尾（秒）
            <input
              aria-label='片尾时长（秒）'
              type='number'
              min='0'
              max='600'
              value={outro}
              onChange={(event) => setOutro(event.target.value)}
              className='mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-2 text-sm text-white'
            />
          </label>
        </div>
        <div className='mt-2 flex flex-wrap gap-2'>
          <button
            onClick={() => save()}
            className='rounded bg-green-400/15 px-2 py-1.5 text-green-300'
          >
            保存并开启
          </button>
          <button
            onClick={() => save(90, 90)}
            className='rounded bg-white/5 px-2 py-1.5'
          >
            90 秒模板
          </button>
        </div>
        <div className='mt-2 flex flex-wrap gap-2'>
          <button
            onClick={() => save(getPosition().time, Number(outro))}
            className='rounded border border-white/10 px-2 py-1.5'
          >
            当前为正片开始
          </button>
          <button
            onClick={() => {
              const position = getPosition();
              if (position.duration > 0)
                save(Number(intro), position.duration - position.time);
            }}
            className='rounded border border-white/10 px-2 py-1.5'
          >
            当前为片尾开始
          </button>
        </div>
        <p className='mt-2 text-[11px] leading-relaxed text-gray-500'>
          按秒数跳过，不是自动识别剧情。0
          秒表示不跳过；短视频及不合理时长不自动跳过。
        </p>
        {message && (
          <p role='status' className='mt-2 text-[11px] text-amber-200'>
            {message}
          </p>
        )}
      </details>
    </section>
  );
}
