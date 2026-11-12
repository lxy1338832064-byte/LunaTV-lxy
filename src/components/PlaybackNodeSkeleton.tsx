let lastCount = 17;
export function rememberNodeCount(count: number) {
  lastCount = Math.min(200, Math.max(0, count));
}

export default function PlaybackNodeSkeleton() {
  return (
    <div role='status' aria-label='正在加载播放节点' aria-busy='true'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold text-white'>请选择播放节点</h3>
        <span className='text-xs text-gray-400'>正在加载节点列表…</span>
      </div>
      <div aria-hidden='true' className='playback-node-grid grid gap-2'>
        {Array.from({ length: lastCount }, (_, index) => (
          <div
            key={index}
            className='flex h-[80px] min-w-0 flex-col justify-between rounded-lg border border-white/10 bg-white/5 p-2.5'
          >
            <span className='h-3 w-3/5 rounded bg-white/10' />
            <span className='h-3 w-2/5 rounded bg-white/10' />
            <span className='h-2 w-1/2 rounded bg-white/5' />
          </div>
        ))}
      </div>
      <div aria-hidden='true' className='mt-3 h-4' />
    </div>
  );
}
