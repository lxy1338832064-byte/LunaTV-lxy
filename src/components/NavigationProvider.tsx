'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';

const PlaybackNodePicker = dynamic(() => import('./PlaybackNodePicker'), {
  loading: () => (
    <p role='status' className='py-6 text-gray-400'>
      正在查找播放节点…
    </p>
  ),
});

const NavigationContext = createContext<
  (url: string, title?: string, poster?: string) => void
>(() => undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState<{
    url: string;
    title: string;
    poster?: string;
  } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selection) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [selection]);
  const [title, setTitle] = useState('');
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [pending]);

  const navigate = (url: string, label = '', poster?: string) => {
    if (url.startsWith('/play?')) {
      setSelection({
        url,
        title:
          label ||
          new URL(url, window.location.origin).searchParams.get('title') ||
          '影片',
        poster,
      });
      return;
    }
    setTitle(label);
    startTransition(() => router.push(url));
  };

  return (
    <NavigationContext.Provider value={navigate}>
      {children}
      {selection && (
        <div
          className='fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm'
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelection(null);
          }}
        >
          <div
            ref={dialog}
            role='dialog'
            aria-modal='true'
            aria-labelledby='node-dialog-title'
            tabIndex={-1}
            className='max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#181b20] p-5 shadow-2xl outline-none'
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSelection(null);
              if (event.key === 'Tab') {
                const items = dialog.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled),[href],[tabindex="0"]'
                );
                if (items?.length) {
                  const first = items[0],
                    last = items[items.length - 1];
                  if (
                    event.shiftKey &&
                    (document.activeElement === first ||
                      document.activeElement === dialog.current)
                  ) {
                    event.preventDefault();
                    last.focus();
                  } else if (
                    !event.shiftKey &&
                    (document.activeElement === last ||
                      document.activeElement === dialog.current)
                  ) {
                    event.preventDefault();
                    first.focus();
                  }
                }
              }
            }}
          >
            <div className='mb-5 flex items-start gap-4 border-b border-white/10 pb-5'>
              {selection.poster && (
                <Image
                  width={64}
                  height={96}
                  src={selection.poster}
                  alt=''
                  className='h-24 w-16 rounded object-cover'
                />
              )}
              <div className='min-w-0 flex-1'>
                <h2
                  id='node-dialog-title'
                  className='text-xl font-semibold text-white'
                >
                  {selection.title}
                </h2>
                <p className='mt-2 text-sm text-gray-400'>
                  {new URL(selection.url, 'http://localhost').searchParams.get(
                    'year'
                  )}{' '}
                  · 选择测速成功的节点开始播放
                </p>
              </div>
              <button
                aria-label='关闭节点选择'
                className='h-11 w-11 shrink-0 rounded-full text-xl text-gray-300 hover:bg-white/10'
                onClick={() => setSelection(null)}
              >
                ×
              </button>
            </div>
            <PlaybackNodePicker
              url={selection.url}
              onSelect={(url) => {
                setSelection(null);
                setTitle(selection.title);
                startTransition(() => router.push(url));
              }}
            />
          </div>
        </div>
      )}
      {pending && (
        <div
          role='status'
          aria-live='polite'
          className='lux-navigation fixed left-1/2 top-16 z-[1200] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-4 overflow-hidden rounded-2xl border border-green-400 bg-green-600 px-6 py-5 text-base text-white shadow-[0_12px_48px_rgba(0,204,117,0.2)] md:top-5'
        >
          <div className='navigation-progress absolute inset-x-0 bottom-0 h-1 bg-white/20'>
            <span className='block h-full w-1/3 rounded-full bg-white/90' />
          </div>
          <span className='h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white' />
          <div className='min-w-0 flex-1'>
            <p className='truncate font-semibold'>
              {title ? `正在加载「${title}」` : '正在加载页面…'}
            </p>
            {slow && (
              <p className='mt-1 text-sm text-green-100'>
                连接较慢，请稍候。仍可选择其他内容。
              </p>
            )}
          </div>
        </div>
      )}
    </NavigationContext.Provider>
  );
}

export const useNavigation = () => useContext(NavigationContext);
