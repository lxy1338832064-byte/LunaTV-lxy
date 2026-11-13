import {
  appearanceBootstrap,
  appearanceKey,
  defaultAppearance,
  normalizeAppearance,
  readAppearance,
} from './appearance';
import { getAuthInfoFromBrowserCookie } from './auth';
jest.mock('./auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
afterEach(() => localStorage.clear());
test('new or malformed preferences default to Kitty and reject arbitrary styles', () => {
  expect(readAppearance()).toEqual(defaultAppearance);
  localStorage.setItem(appearanceKey(), '{invalid');
  expect(readAppearance()).toEqual(defaultAppearance);
  expect(
    normalizeAppearance({
      style: 'custom' as 'kitty',
      accent: 'invalid' as 'rose',
    })
  ).toEqual(defaultAppearance);
});
test('preferences are isolated per account and retain classic and accent choices', () => {
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
  });
  localStorage.setItem(
    appearanceKey(),
    JSON.stringify({ style: 'classic', accent: 'lilac' })
  );
  expect(readAppearance()).toEqual({ style: 'classic', accent: 'lilac' });
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'bob',
  });
  expect(readAppearance()).toEqual(defaultAppearance);
});
test('first-paint bootstrap uses the saved signed-in account preference', () => {
  document.cookie = `auth=${encodeURIComponent(
    JSON.stringify({ username: 'alice' })
  )}`;
  localStorage.setItem(
    'lunatv.appearance:alice',
    JSON.stringify({ style: 'classic', accent: 'peach' })
  );
  new Function(appearanceBootstrap)();
  expect(document.documentElement.dataset.appearance).toBe('classic');
  expect(document.documentElement.dataset.accent).toBe('peach');
  document.cookie = 'auth=;max-age=0';
});
