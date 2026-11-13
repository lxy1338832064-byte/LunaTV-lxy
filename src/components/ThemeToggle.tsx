'use client';
import { Palette } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
const AppearanceDialog = dynamic(() => import('./AppearanceDialog'));
export function ThemeToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label='切换外观风格'
        className='flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800'
      >
        <Palette className='h-5 w-5' />
      </button>
      {open && <AppearanceDialog onClose={() => setOpen(false)} />}
    </>
  );
}
