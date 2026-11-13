'use client';

import { useEffect, useRef } from 'react';

import Sidebar from './Sidebar';

export default function PlaybackNavigationDrawer({
  onClose,
}: {
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const wide = window.matchMedia('(min-width: 1536px)');
    const closeOnWide = () => {
      if (wide.matches) onClose();
    };
    wide.addEventListener('change', closeOnWide);
    return () => {
      document.body.style.overflow = overflow;
      wide.removeEventListener('change', closeOnWide);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className='fixed inset-0 z-[1100] 2xl:hidden'>
      <button
        tabIndex={-1}
        aria-label='关闭导航菜单'
        onClick={onClose}
        className='absolute inset-0 bg-black/65'
      />
      <div
        ref={panel}
        role='dialog'
        aria-modal='true'
        aria-label='导航菜单'
        className='absolute inset-y-0 left-0 w-64'
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if (event.key !== 'Tab') return;
          const controls = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled])'
            ) || []
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <Sidebar drawer activePath='/play' onToggle={onClose} />
      </div>
    </div>
  );
}
