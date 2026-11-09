'use client';

import { Gauge, History, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const loading = () => (
  <p role='status' className='py-8 text-center text-sm text-gray-400'>
    正在加载…
  </p>
);
const ContinueWatching = dynamic(() => import('./ContinueWatching'), {
  loading,
});
const ServiceStatus = dynamic(() => import('./ServiceStatus'), { loading });

type Tool = 'history' | 'services';

export default function HomeQuickTools() {
  const [active, setActive] = useState<Tool | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setActive(null);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!active) return;
    closeButton.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setActive(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActive(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);

  return (
    <div ref={root}>
      {active && (
        <section
          id='home-quick-panel'
          role='region'
          aria-labelledby='home-quick-title'
          className='fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[500] overflow-hidden rounded-2xl border border-white/10 bg-[#181b20] shadow-2xl shadow-black/50 md:bottom-auto md:left-auto md:right-28 md:top-1/2 md:w-[460px] md:-translate-y-1/2'
        >
          <header className='flex items-center justify-between border-b border-white/5 px-5 py-4'>
            <div>
              <h2
                id='home-quick-title'
                className='text-base font-semibold text-white'
              >
                {active === 'history' ? '继续观看' : '资源测速'}
              </h2>
              <p className='mt-1 text-xs text-gray-500'>
                {active === 'history'
                  ? '接着上次的进度，继续好故事'
                  : '查看接口可用性与响应耗时'}
              </p>
            </div>
            <button
              ref={closeButton}
              onClick={close}
              aria-label='关闭快捷面板'
              className='rounded-full p-2 text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500'
            >
              <X className='h-5 w-5' />
            </button>
          </header>
          <div className='max-h-[calc(100dvh-280px)] overflow-y-auto overscroll-contain p-3 md:max-h-[calc(100dvh-180px)] md:p-4'>
            {active === 'history' ? (
              <ContinueWatching compact className='!mb-0' />
            ) : (
              <ServiceStatus />
            )}
          </div>
        </section>
      )}
      <nav
        aria-label='首页快捷工具'
        className='fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-3 z-[501] flex gap-1 rounded-xl border border-green-400/30 bg-[#181f1c]/95 p-1 shadow-xl shadow-black/40 ring-1 ring-green-400/10 backdrop-blur-md md:bottom-auto md:right-5 md:top-1/2 md:-translate-y-1/2 md:flex-col md:gap-2 md:rounded-2xl md:p-2'
      >
        {(
          [
            { id: 'history', label: '继续观看', Icon: History },
            { id: 'services', label: '资源测速', Icon: Gauge },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-expanded={active === id}
            aria-controls={active === id ? 'home-quick-panel' : undefined}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setActive((value) => (value === id ? null : id));
            }}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors md:h-16 md:w-16 md:flex-col md:gap-2 md:rounded-xl md:px-0 md:text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
              active === id
                ? 'bg-green-500 text-gray-950 shadow-lg shadow-green-500/20'
                : 'bg-green-400/5 text-green-300 hover:bg-green-400/15 hover:text-green-200'
            }`}
          >
            <Icon className='h-4 w-4 shrink-0 md:h-6 md:w-6' />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
