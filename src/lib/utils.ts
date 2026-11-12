/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { createPlaybackLoader } from './playback-loader';

function getDoubanImageProxyConfig(): {
  proxyType:
    | 'server'
    | 'cmliussss-cdn-tencent'
    | 'cmliussss-cdn-ali'
    | 'custom';
  proxyUrl: string;
} {
  let doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  // 兼容历史数据：直连和豆瓣官方精品 CDN 统一使用服务器代理
  if (doubanImageProxyType === 'direct' || doubanImageProxyType === 'img3') {
    doubanImageProxyType = 'server';
  }
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    default:
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
}

/** Stable, small WebP URLs that Cloudflare can cache as image resources. */
export function processPosterUrl(
  originalUrl: string,
  width: 240 | 360 | 480 = 240
): string {
  const processed = processImageUrl(originalUrl);
  const target = processed.startsWith('/api/image-proxy?')
    ? new URLSearchParams(processed.split('?')[1]).get('url')
    : processed;
  if (target && /^https?:\/\//i.test(target)) {
    return `/api/image-proxy/poster.webp?w=${width}&url=${encodeURIComponent(
      target
    )}`;
  }
  return processed;
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string,
  signal?: AbortSignal
): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  try {
    const { default: Hls } = await import('hls.js');
    if (signal?.aborted) throw new Error('测速已取消');
    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      let pingTime = 0;

      // 固定使用hls.js加载
      const hls = new Hls({
        maxBufferLength: 1,
        maxMaxBufferLength: 2,
        lowLatencyMode: false,
        loader:
          localStorage.getItem('enable_blockad') !== 'false'
            ? createPlaybackLoader(Hls)
            : Hls.DefaultConfig.loader,
      });

      // 统一的资源释放，重复调用安全
      let released = false;
      const cleanup = () => {
        if (released) return;
        released = true;
        signal?.removeEventListener('abort', onAbort);
        try {
          hls.destroy();
        } catch (e) {
          // ignore
        }
        video.remove();
      };

      // 设置超时处理
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('测速超时，尚未确认可用性'));
      }, 12000);

      const onAbort = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('测速已取消'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasPlayableData = false;

      let fragmentStartTime = 0;

      // 检查是否可以返回结果
      const checkAndResolve = () => {
        if (released) return;
        if (
          hasPlayableData &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          const width =
            video.videoWidth || hls.levels?.[hls.currentLevel]?.width || 0;
          // 无论能否取到尺寸，都必须释放 hls 实例与 video 元素，
          // 否则测速结束后实例仍会在后台持续拉流，造成内存与带宽泄漏
          cleanup();
          if (width && width > 0) {
            // 根据视频宽度判断视频质量等级，使用经典分辨率的宽度作为分割点
            const quality =
              width >= 3840
                ? '4K' // 4K: 3840x2160
                : width >= 2560
                ? '2K' // 2K: 2560x1440
                : width >= 1920
                ? '1080p' // 1080p: 1920x1080
                : width >= 1280
                ? '720p' // 720p: 1280x720
                : width >= 854
                ? '480p'
                : 'SD'; // 480p: 854x480

            resolve({
              quality,
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          } else {
            // webkit 无法获取尺寸，直接返回
            resolve({
              quality: '未知',
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          }
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated &&
          data.frag?.sn !== 'initSegment'
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const loading =
              data.part?.stats?.loading ||
              data.frag?.stats?.loading ||
              data.stats?.loading;
            if (
              loading &&
              Number.isFinite(loading.first) &&
              Number.isFinite(loading.start)
            )
              pingTime = Math.max(0, loading.first - loading.start);
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;
            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      let networkRecoveries = 0;
      let mediaRecoveries = 0;
      // Retry within the same overall deadline, as the player does.
      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);
        if (data.fatal) {
          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            networkRecoveries++ < 1
          ) {
            hls.startLoad();
            return;
          }
          if (
            data.type === Hls.ErrorTypes.MEDIA_ERROR &&
            mediaRecoveries++ < 1
          ) {
            hls.recoverMediaError();
            return;
          }
          clearTimeout(timeout);
          cleanup();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      // 监听视频元数据加载完成
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        hasPlayableData = true;
        checkAndResolve();
      });
      video.onloadedmetadata = () => {
        hasPlayableData = true;
        checkAndResolve(); // 尝试返回结果
      };
      hls.attachMedia(video);
      hls.loadSource(m3u8Url);
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
