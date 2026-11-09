'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';

const NavigationContext = createContext<(url: string, title?: string) => void>(
  () => undefined
);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [pending]);

  const navigate = (url: string, label = '') => {
    setTitle(label);
    startTransition(() => router.push(url));
  };

  return (
    <NavigationContext.Provider value={navigate}>
      {children}
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
