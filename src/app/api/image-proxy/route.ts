import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { createWorkLimiter } from '@/lib/limit-work';
import { checkImageProxyTarget, isImageContentType } from '@/lib/proxy-guard';

export const runtime = 'nodejs';

// Bounded, process-local thumbnail cache. No account or playback data is cached.
const thumbnails = new Map<string, { data: Uint8Array; expires: number }>();
const inFlight = new Map<string, Promise<Uint8Array>>();
let cacheBytes = 0;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const limitThumbnails = createWorkLimiter(6);

async function fetchImage(url: string) {
  let target = url;
  const signal = AbortSignal.timeout(8000);
  for (let hop = 0; hop < 4; hop++) {
    if (checkImageProxyTarget(target)) throw new Error('Invalid image target');
    const response = await fetch(target, {
      signal,
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        Referer: 'https://movie.douban.com/',
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/*',
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw new Error('Missing redirect');
      target = new URL(location, target).href;
      continue;
    }
    if (
      !response.ok ||
      !isImageContentType(response.headers.get('content-type')) ||
      !response.body
    ) {
      await response.body?.cancel();
      throw new Error('Image unavailable');
    }
    return response;
  }
  throw new Error('Too many redirects');
}

async function createThumbnail(
  url: string,
  width: number
): Promise<Uint8Array> {
  const response = await fetchImage(url);
  if (!response.body) throw new Error('Missing image body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new Error('Image too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const result = await sharp(Buffer.concat(chunks), {
    limitInputPixels: 25000000,
  })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer();
  return new Uint8Array(result);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url || checkImageProxyTarget(url))
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  const widthParam = searchParams.get('w');
  const width = Number(widthParam);
  if (widthParam && ![240, 360, 480].includes(width))
    return NextResponse.json(
      { error: 'Invalid thumbnail width' },
      { status: 400 }
    );
  try {
    const headers = {
      'Cache-Control':
        'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    };
    // Preserve the original-image API used by external clients.
    if (!widthParam) {
      const image = await fetchImage(url);
      return new Response(image.body, {
        headers: {
          ...headers,
          'Content-Type': image.headers.get('content-type') || 'image/jpeg',
        },
      });
    }
    const key = `${width}:${url}`;
    const cached = thumbnails.get(key);
    let data = cached && cached.expires > Date.now() ? cached.data : undefined;
    if (data && cached) {
      thumbnails.delete(key);
      thumbnails.set(key, cached);
    }
    if (!data) {
      let pending = inFlight.get(key);
      if (!pending) {
        pending = limitThumbnails(() => createThumbnail(url, width))
          .then((bytes) => {
            const previous = thumbnails.get(key);
            if (previous) {
              cacheBytes -= previous.data.byteLength;
              thumbnails.delete(key);
            }
            while (
              cacheBytes + bytes.byteLength > MAX_CACHE_BYTES &&
              thumbnails.size
            ) {
              const oldest = thumbnails.keys().next().value;
              if (!oldest) break;
              cacheBytes -= thumbnails.get(oldest)?.data.byteLength || 0;
              thumbnails.delete(oldest);
            }
            if (bytes.byteLength <= MAX_CACHE_BYTES) {
              thumbnails.set(key, {
                data: bytes,
                expires: Date.now() + 86400000,
              });
              cacheBytes += bytes.byteLength;
            }
            return bytes;
          })
          .finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
      }
      data = await pending;
    }
    const etag = `"${createHash('sha256')
      .update(data)
      .digest('hex')
      .slice(0, 32)}"`;
    const imageHeaders = {
      ...headers,
      ETag: etag,
      'Content-Type': 'image/webp',
    };
    if (
      request.headers
        .get('if-none-match')
        ?.split(',')
        .map((tag) => tag.trim())
        .some((tag) => tag === etag || tag === `W/${etag}` || tag === '*')
    ) {
      return new Response(null, { status: 304, headers: imageHeaders });
    }
    return new Response(data, {
      headers: { ...imageHeaders, 'Content-Length': String(data.byteLength) },
    });
  } catch {
    return NextResponse.json(
      { error: '图片暂时无法加载，请重试' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
