import { NextRequest, NextResponse } from 'next/server';

import {
  DefaultSourceError,
  loadDefaultSourceConfig,
  updateAccountDefaultSources,
} from '@/lib/account-default-source';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { accountDefaultSource } from '@/lib/default-source-policy';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) return json({ error: '请先登录' }, 401);
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  )
    return json({ supported: false });
  try {
    const config = await loadDefaultSourceConfig();
    const user = config.UserConfig.Users.find(
      (user) => user.username === auth.username
    );
    if (auth.username !== process.env.USERNAME && (!user || user.banned))
      return json({ error: '账号不可用' }, 403);
    return json(accountDefaultSource(config, auth.username));
  } catch {
    return json({ error: '暂时无法读取默认播放源' }, 503);
  }
}
export async function POST(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) return json({ error: '请先登录' }, 401);
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  )
    return json({ error: '当前模式仅支持浏览器本地设置' }, 400);
  try {
    const body = await request.json();
    return json(
      await updateAccountDefaultSources(
        auth.username,
        [auth.username],
        body.sourceKey,
        false,
        body.migrateOnly === true
      )
    );
  } catch (error) {
    return json(
      {
        error: error instanceof DefaultSourceError ? error.message : '保存失败',
      },
      error instanceof DefaultSourceError ? error.status : 500
    );
  }
}
