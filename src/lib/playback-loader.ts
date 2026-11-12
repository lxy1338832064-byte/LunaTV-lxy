/* eslint-disable @typescript-eslint/no-explicit-any */
import type Hls from 'hls.js';

// Share the playback manifest transformation with the node probe.
export function createPlaybackLoader(HlsClass: typeof Hls) {
  return class PlaybackLoader extends HlsClass.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        // 拦截manifest和level请求
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (
            response: any,
            stats: any,
            context: any
          ) {
            // 如果是m3u8文件，处理内容以移除广告分段
            if (response.data && typeof response.data === 'string') {
              // 过滤掉广告段 - 实现更精确的广告过滤逻辑
              response.data = response.data
                .split('\n')
                .filter(
                  (line: string) => !line.includes('#EXT-X-DISCONTINUITY')
                )
                .join('\n');
            }
            return onSuccess(response, stats, context, null);
          };
        }
        // 执行原始load方法
        load(context, config, callbacks);
      };
    }
  };
}
