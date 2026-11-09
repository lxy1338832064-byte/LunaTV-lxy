'use client';

import { Loader2, User } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const buttonClass =
  'w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors';
const UserMenuContent = dynamic(() => import('./UserMenuContent'), {
  loading: () => (
    <button disabled aria-label='正在加载用户菜单' className={buttonClass}>
      <Loader2 className='h-5 w-5 animate-spin' />
    </button>
  ),
});

export function UserMenu() {
  const [activated, setActivated] = useState(false);
  if (activated) return <UserMenuContent initialOpen />;
  return (
    <button
      aria-label='User Menu'
      onClick={() => setActivated(true)}
      className={buttonClass}
    >
      <User className='h-full w-full' />
    </button>
  );
}
