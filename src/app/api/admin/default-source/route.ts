import { NextRequest, NextResponse } from 'next/server';

import {
  DefaultSourceError,
  updateAccountDefaultSources,
} from '@/lib/account-default-source';
import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const json = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) return json({ error: '请先登录' }, 401);
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  )
    return json({ error: '当前存储模式不支持管理员配置' }, 400);
  try {
    const body = await request.json();
    if (!Array.isArray(body.usernames))
      return json({ error: '请选择目标用户' }, 400);
    await updateAccountDefaultSources(
      auth.username,
      body.usernames,
      body.sourceKey,
      true
    );
    return json({ ok: true });
  } catch (error) {
    return json(
      {
        error: error instanceof DefaultSourceError ? error.message : '保存失败',
      },
      error instanceof DefaultSourceError ? error.status : 500
    );
  }
}
