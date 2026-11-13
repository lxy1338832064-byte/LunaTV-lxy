import { getAuthInfoFromBrowserCookie } from './auth';
export type Appearance = {
  style: 'kitty' | 'classic';
  accent: 'rose' | 'lilac' | 'peach';
};
export const defaultAppearance: Appearance = { style: 'kitty', accent: 'rose' };
export function normalizeAppearance(
  value: Partial<Appearance> | null
): Appearance {
  return {
    style: value?.style === 'classic' ? 'classic' : 'kitty',
    accent:
      value?.accent === 'lilac' || value?.accent === 'peach'
        ? value.accent
        : 'rose',
  };
}
export function appearanceKey() {
  return `lunatv.appearance:${
    getAuthInfoFromBrowserCookie()?.username || 'local'
  }`;
}
export function readAppearance(): Appearance {
  try {
    return normalizeAppearance(
      JSON.parse(localStorage.getItem(appearanceKey()) || 'null')
    );
  } catch {
    return defaultAppearance;
  }
}
export function applyAppearance(value: Appearance) {
  document.documentElement.dataset.appearance = value.style;
  document.documentElement.dataset.accent = value.accent;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', value.style === 'kitty' ? '#fff5f9' : '#101214');
}
export const appearanceBootstrap = `(function(){try{var c=document.cookie.split(';').map(function(s){return s.trim()}).find(function(s){return s.indexOf('auth=')===0});var u='local';if(c){try{var a=decodeURIComponent(c.slice(5));if(a.includes('%'))a=decodeURIComponent(a);u=JSON.parse(a).username||u}catch(e){}}var v=JSON.parse(localStorage.getItem('lunatv.appearance:'+u)||'null')||{};document.documentElement.dataset.appearance=v.style==='classic'?'classic':'kitty';document.documentElement.dataset.accent=['rose','lilac','peach'].includes(v.accent)?v.accent:'rose'}catch(e){document.documentElement.dataset.appearance='kitty'}})();`;
