import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { getSourceHealth } from '@/lib/source-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const json = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  const auth = getAuthInfoFromCookie(request);
  if (!auth) return json({ error: '请先登录' }, 401);
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  )
    return json({ sources: [], supported: false });
  if (!auth.username) return json({ error: '请先登录' }, 401);
  try {
    const config = await getConfig();
    const viewer = config.UserConfig.Users.find(
      (user) => user.username === auth.username
    );
    if (auth.username !== process.env.USERNAME && (!viewer || viewer.banned))
      return json({ error: '账号不可用' }, 403);
    const sites = await getAvailableApiSites(auth.username);
    const sources = await getSourceHealth(sites);
    return json({ sources, supported: true });
  } catch {
    return json({ error: '暂时无法获取服务状态' }, 503);
  }
}
