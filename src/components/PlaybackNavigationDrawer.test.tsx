import { fireEvent, render, screen } from '@testing-library/react';

import PlaybackNavigationDrawer from './PlaybackNavigationDrawer';

jest.mock('./Sidebar', () => ({
  __esModule: true,
  default: ({ onToggle }: { onToggle: () => void }) => (
    <div>
      <button onClick={onToggle}>收起导航菜单</button>
      <a href='/search'>搜索</a>
    </div>
  ),
}));

test('navigation opens accessibly, traps focus and restores scrolling and focus on close', () => {
  const previousMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const close = jest.fn();
  const view = render(<PlaybackNavigationDrawer onClose={close} />);
  try {
    const first = screen.getByRole('button', { name: '收起导航菜单' });
    const last = screen.getByRole('link', { name: '搜索' });
    expect(screen.getByRole('dialog', { name: '导航菜单' })).toHaveAttribute(
      'aria-modal',
      'true'
    );
    expect(document.activeElement).toBe(first);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '关闭导航菜单' }));
    expect(close).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.activeElement).toBe(opener);
  } finally {
    view.unmount();
    opener.remove();
    window.matchMedia = previousMatchMedia;
  }
});
