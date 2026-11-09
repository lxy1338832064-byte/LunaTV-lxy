'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

// Mount lower homepage sections shortly before they scroll into view. Native image
// lazy loading alone may eagerly request posters several screens below the fold.
export default function DeferredSection({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref}>
      {visible ? (
        children
      ) : (
        <div aria-hidden className='mb-6 h-[360px] rounded-xl bg-gray-900/20' />
      )}
    </div>
  );
}
