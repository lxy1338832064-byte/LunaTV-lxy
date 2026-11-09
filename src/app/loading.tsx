export default function Loading() {
  return (
    <div
      role='status'
      aria-label='正在加载页面'
      className='mx-auto max-w-7xl space-y-8 px-6 py-24'
    >
      <p className='text-sm text-gray-500 dark:text-gray-400'>正在加载页面…</p>
      <div className='h-8 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800' />
      <div className='grid grid-cols-3 gap-4 sm:grid-cols-5'>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className='aspect-[2/3] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800'
          />
        ))}
      </div>
    </div>
  );
}
