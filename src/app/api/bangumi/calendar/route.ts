import { NextResponse } from 'next/server';

import { createAsyncCache } from '@/lib/async-cache';
import { getCacheTime } from '@/lib/config';

export const runtime = 'nodejs';
const calendarCache = createAsyncCache<unknown[]>(10 * 60 * 1000, 1);

export async function GET() {
  try {
    const data = await calendarCache.get('calendar', async () => {
      const response = await fetch('https://api.bgm.tv/calendar', {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const result: unknown = await response.json();
      if (!Array.isArray(result)) throw new Error('Invalid calendar data');
      return result;
    });
    const cacheTime = await getCacheTime();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取番剧日历失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
