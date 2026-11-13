'use client';
import { usePathname } from 'next/navigation';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  Appearance,
  appearanceKey,
  applyAppearance,
  defaultAppearance,
  readAppearance,
} from '@/lib/appearance';
const Context = createContext<{
  value: Appearance;
  save: (value: Appearance) => boolean;
}>({
  value: defaultAppearance,
  save: (_value: Appearance) => false,
});
export const useAppearance = () => useContext(Context);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(defaultAppearance);
  const pathname = usePathname();
  useEffect(() => {
    const sync = () => {
      const next = readAppearance();
      setValue(next);
      applyAppearance(next);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, [pathname]);
  const save = (next: Appearance) => {
    setValue(next);
    applyAppearance(next);
    try {
      localStorage.setItem(appearanceKey(), JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  };
  return (
    <Context.Provider value={{ value, save }}>{children}</Context.Provider>
  );
}
