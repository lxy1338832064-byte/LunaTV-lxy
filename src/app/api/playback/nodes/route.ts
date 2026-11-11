import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';

export async function GET(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username) return NextResponse.json({}, { status: 401 });
  const sites = await getAvailableApiSites(auth.username);
  return NextResponse.json(
    sites.map(({ key, name }) => ({ key, name })),
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
