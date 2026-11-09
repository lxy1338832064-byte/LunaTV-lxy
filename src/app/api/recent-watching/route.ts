import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { recentResources, RecentUser } from '@/lib/recent-watching';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const json = (data: unknown, status = 200) =>
    NextResponse.json(data, { status, headers });
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) return json({ error: '请先登录' }, 401);
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  ) {
    return json({ users: [], supported: false });
  }
  try {
    const config = await getConfig();
    const viewer = config.UserConfig.Users.find(
      (user) => user.username === auth.username
    );
    const owner = auth.username === process.env.USERNAME;
    if (!owner && (!viewer || viewer.banned))
      return json({ error: '账号不可用' }, 403);
    const all = request.nextUrl.searchParams.get('scope') === 'all';
    if (all && !owner && viewer?.role !== 'admin')
      return json({ error: '权限不足' }, 403);
    const users = config.UserConfig.Users.filter(
      (user) => !user.banned && (all || user.username !== auth.username)
    );
    // Bound database concurrency so a new home section cannot flood Redis/Upstash.
    const groups: RecentUser[] = [];
    let cursor = 0;
    let failed = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, users.length) }, async () => {
        while (cursor < users.length) {
          const user = users[cursor++];
          try {
            const records = await db.getAllPlayRecords(user.username);
            groups.push({
              username: user.username,
              resources: recentResources(records),
            });
          } catch {
            failed++;
          }
        }
      })
    );
    if (failed && !groups.length)
      return json({ error: '暂时无法获取观看记录' }, 503);
    groups.sort(
      (a, b) =>
        (b.resources[0]?.watchedAt || 0) - (a.resources[0]?.watchedAt || 0) ||
        a.username.localeCompare(b.username)
    );
    return json({ users: groups, supported: true, partial: failed > 0 });
  } catch {
    return json({ error: '暂时无法获取观看记录' }, 500);
  }
}
