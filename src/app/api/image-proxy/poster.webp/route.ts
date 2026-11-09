import { GET as getImage } from '../route';

export const runtime = 'nodejs';

// An actual image extension lets standard Cloudflare caching recognize thumbnails.
// Authentication still runs through the same middleware as the legacy endpoint.
export function GET(request: Request) {
  const url = new URL(request.url);
  if (!url.searchParams.has('w')) url.searchParams.set('w', '240');
  return getImage(new Request(url, request));
}
