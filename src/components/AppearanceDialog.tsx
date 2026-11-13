'use client';
import { Check, Heart, Moon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAppearance } from './AppearanceProvider';
export default function AppearanceDialog({ onClose }: { onClose: () => void }) {
  const { value, save } = useAppearance();
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className='fixed inset-0 z-[1800] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        ref={panel}
        role='dialog'
        aria-modal='true'
        aria-label='外观风格'
        tabIndex={-1}
        className='w-full max-w-lg rounded-3xl border border-gray-700 bg-gray-900 p-5 text-gray-200 shadow-2xl outline-none'
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key !== 'Tab') return;
          const buttons = Array.from(
              panel.current?.querySelectorAll<HTMLButtonElement>('button') || []
            ),
            first = buttons[0],
            last = buttons[buttons.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className='mb-5 flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-xl font-bold'>装扮我的放映室</h2>
            <p className='mt-1 text-sm text-gray-400'>选一个今天喜欢的风格 ♡</p>
          </div>
          <button
            aria-label='关闭外观设置'
            onClick={onClose}
            className='rounded-full p-2 hover:bg-gray-800'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          {(['kitty', 'classic'] as const).map((style) => (
            <button
              key={style}
              aria-pressed={value.style === style}
              onClick={() =>
                setMessage(
                  save({ ...value, style })
                    ? '已保存，刷新后仍使用你的选择。'
                    : '已切换，本次浏览期间生效。'
                )
              }
              className={`overflow-hidden rounded-2xl border-2 text-left ${
                value.style === style ? 'border-green-400' : 'border-gray-700'
              }`}
            >
              <span
                className={`flex h-28 items-center justify-center ${
                  style === 'kitty'
                    ? 'appearance-kitty-preview'
                    : 'appearance-classic-preview'
                }`}
              >
                {style === 'kitty' ? (
                  <span className='kitty-emblem' aria-hidden='true' />
                ) : (
                  <Moon className='h-12 w-12' />
                )}
              </span>
              <span className='flex items-center justify-between gap-2 p-3 text-sm font-semibold'>
                {style === 'kitty' ? 'Hello Kitty · 甜心粉' : '经典 · 深色影院'}
                {value.style === style && (
                  <Check className='h-4 w-4 shrink-0 text-green-400' />
                )}
              </span>
            </button>
          ))}
        </div>
        {value.style === 'kitty' && (
          <fieldset className='mt-5'>
            <legend className='mb-2 text-sm font-medium'>我的强调色</legend>
            <div className='flex flex-wrap gap-2'>
              {(
                [
                  { key: 'rose', label: '樱花粉' },
                  { key: 'lilac', label: '糖果紫' },
                  { key: 'peach', label: '蜜桃粉' },
                ] as const
              ).map((accent) => (
                <button
                  key={accent.key}
                  aria-pressed={value.accent === accent.key}
                  onClick={() =>
                    setMessage(
                      save({ ...value, accent: accent.key })
                        ? '配色已保存。'
                        : '配色仅本次生效。'
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs ${
                    value.accent === accent.key
                      ? 'border-green-400 bg-green-400/10 text-green-400'
                      : 'border-gray-700 text-gray-400'
                  }`}
                >
                  <Heart className='h-3 w-3' />
                  {accent.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <p className='mt-4 text-xs leading-relaxed text-gray-500'>
          默认使用甜心粉。外观按账号保存在当前浏览器，不影响其他用户；视频画面保持原色。
        </p>
        <p role='status' className='mt-2 min-h-[20px] text-xs text-green-400'>
          {message}
        </p>
      </div>
    </div>,
    document.body
  );
}
