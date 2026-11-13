'use client';

import { useCallback, useState } from 'react';

import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import PlaybackNavigationDrawer from './PlaybackNavigationDrawer';
import Sidebar from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  const playbackLayout = activePath === '/play';
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  return (
    <div className='lux-shell w-full min-h-screen'>
      {/* 移动端头部 */}
      <MobileHeader
        showBackButton={['/play', '/live'].includes(activePath)}
        playbackLayout={playbackLayout}
        onOpenMenu={playbackLayout ? () => setMenuOpen(true) : undefined}
      />
      {playbackLayout && menuOpen && (
        <PlaybackNavigationDrawer onClose={closeMenu} />
      )}

      {/* 主要布局容器 */}
      <div
        className={`flex w-full min-h-screen ${
          playbackLayout
            ? '2xl:grid 2xl:grid-cols-[auto_1fr]'
            : 'md:grid md:grid-cols-[auto_1fr] md:min-h-auto'
        }`}
      >
        {/* 侧边栏 - 桌面端显示，移动端隐藏 */}
        <div
          className={playbackLayout ? 'hidden 2xl:block' : 'hidden md:block'}
        >
          <Sidebar activePath={activePath} />
        </div>

        {/* 主内容区域 */}
        <div className='relative min-w-0 flex-1 transition-all duration-300'>
          {/* 桌面端左上角返回按钮 */}
          {['/play', '/live'].includes(activePath) && (
            <div
              className={`absolute top-3 left-1 z-20 hidden ${
                playbackLayout ? '2xl:flex' : 'md:flex'
              }`}
            >
              <BackButton />
            </div>
          )}

          {/* 桌面端顶部按钮 */}
          <div
            className={`absolute top-2 right-4 z-20 hidden ${
              playbackLayout ? '2xl:flex' : 'md:flex'
            } items-center gap-2`}
          >
            <ThemeToggle />
            <UserMenu />
          </div>

          {/* 主内容 */}
          <main
            className={`page-main flex-1 md:min-h-0 mt-12 ${
              playbackLayout ? '2xl:mt-0' : 'md:mt-0'
            }`}
          >
            {children}
          </main>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
