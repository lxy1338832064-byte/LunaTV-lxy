/** @jest-environment node */
import {
  Headers,
  Request,
  Response,
} from 'next/dist/compiled/@edge-runtime/primitives';
import sharp from 'sharp';

import { GET } from './route';

jest.mock('sharp', () => {
  const pipeline = {
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(async () => Buffer.from('RIFFmockWEBP')),
  };
  return jest.fn(() => pipeline);
});
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init: ResponseInit) =>
      new Response(JSON.stringify(data), init),
  },
}));
const originalFetch = global.fetch;
const originalRequest = global.Request;
const originalResponse = global.Response;
const originalHeaders = global.Headers;
global.Request = Request;
global.Response = Response;
global.Headers = Headers;
const jpeg = Buffer.from('mock JPEG input');
beforeEach(() => {
  global.fetch = jest.fn(
    async () =>
      new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } })
  );
});
afterAll(() => {
  global.fetch = originalFetch;
  global.Request = originalRequest;
  global.Response = originalResponse;
  global.Headers = originalHeaders;
});
const request = (name: string, width = 240, headers = {}) =>
  new Request(
    `http://localhost/api/image-proxy/poster.webp?w=${width}&url=${encodeURIComponent(
      `https://posters.example/${name}.jpg`
    )}`,
    { headers }
  );

test('concurrent thumbnails share one fetch, select the small variant and expose cache headers', async () => {
  const [first, second] = await Promise.all([
    GET(request('shared')),
    GET(request('shared')),
  ]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(first.headers.get('content-type')).toBe('image/webp');
  expect(first.headers.get('cache-control')).toContain('s-maxage=604800');
  const bytes = Buffer.from(await first.arrayBuffer());
  expect(await second.arrayBuffer()).toEqual(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
  );
  expect(sharp).toHaveBeenCalled();
  expect(sharp().resize).toHaveBeenCalledWith({
    width: 240,
    withoutEnlargement: true,
  });
  const cached = await GET(
    request('shared', 240, { 'If-None-Match': first.headers.get('etag') || '' })
  );
  expect(cached.status).toBe(304);
  expect((await cached.arrayBuffer()).byteLength).toBe(0);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('private redirect targets are blocked and errors do not become CDN cache entries', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1/private' },
    })
  );
  const response = await GET(request('redirect'));
  expect(response.status).toBe(502);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect((await GET(request('redirect'))).status).toBe(200);
});

test('unsupported sizes and private URLs never reach the upstream server', async () => {
  expect((await GET(request('invalid', 999))).status).toBe(400);
  expect(
    (
      await GET(
        new Request(
          'http://localhost/api/image-proxy/poster.webp?url=http://127.0.0.1/a.jpg'
        )
      )
    ).status
  ).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});
