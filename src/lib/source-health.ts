import { createAsyncCache } from './async-cache';
import { API_CONFIG, ApiSite } from './config';

export interface SourceHealth {
  key: string;
  name: string;
  status: 'available' | 'unavailable' | 'unknown';
  latencyMs: number | null;
  checkedAt: number | null;
  message: string;
}

type ProbeResult = Omit<SourceHealth, 'key' | 'name'>;
const healthCache = createAsyncCache<ProbeResult>(60000, 256);

export async function probeSource(site: ApiSite): Promise<SourceHealth> {
  const result = await healthCache.get(
    JSON.stringify([site.key, site.api]),
    async () => {
      const start = Date.now();
      try {
        // Use the same API operation as real searches, with an unlikely keyword to limit response size.
        const response = await fetch(
          `${site.api}${API_CONFIG.search.path}${encodeURIComponent(
            '__lunatv_service_check__'
          )}`,
          {
            signal: AbortSignal.timeout(3500),
            cache: 'no-store',
            headers: API_CONFIG.search.headers,
          }
        );
        if (!response.ok) {
          await response.body?.cancel();
          return {
            status: 'unavailable' as const,
            latencyMs: Date.now() - start,
            checkedAt: Date.now(),
            message: `接口返回 ${response.status}`,
          };
        }
        const body: unknown = await response.json();
        const valid =
          typeof body === 'object' &&
          body !== null &&
          'list' in body &&
          Array.isArray(body.list);
        return {
          status: valid ? ('available' as const) : ('unavailable' as const),
          latencyMs: Date.now() - start,
          checkedAt: Date.now(),
          message: valid ? '接口响应正常' : '接口返回格式异常',
        };
      } catch (error) {
        const timedOut =
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError');
        return {
          status: 'unavailable' as const,
          latencyMs: Date.now() - start,
          checkedAt: Date.now(),
          message: timedOut ? '检测超时' : '暂时无法连接接口',
        };
      }
    }
  );
  return { key: site.key, name: site.name, ...result };
}

export async function getSourceHealth(
  sites: ApiSite[]
): Promise<SourceHealth[]> {
  const results: SourceHealth[] = new Array(sites.length);
  const deadline = Date.now() + 7500;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, sites.length) }, async () => {
      while (cursor < sites.length) {
        const index = cursor++;
        const site = sites[index];
        results[index] =
          Date.now() < deadline
            ? await probeSource(site)
            : {
                key: site.key,
                name: site.name,
                status: 'unknown',
                latencyMs: null,
                checkedAt: null,
                message: '本轮未检测，可稍后刷新',
              };
      }
    })
  );
  return results;
}
