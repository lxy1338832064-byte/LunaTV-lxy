/** Bound active thumbnail fetches/decodes and the time spent waiting for a slot. */
export function createWorkLimiter(
  limit: number,
  maxQueued = 64,
  waitMs = 30000
) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function run<T>(work: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      if (queue.length >= maxQueued) throw new Error('Thumbnail queue full');
      await new Promise<void>((resolve, reject) => {
        const start = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          const index = queue.indexOf(start);
          if (index !== -1) queue.splice(index, 1);
          reject(new Error('Thumbnail queue timeout'));
        }, waitMs);
        queue.push(start);
      });
    } else {
      active++;
    }
    try {
      return await work();
    } finally {
      const next = queue.shift();
      if (next) next(); // Transfer the occupied slot directly to the next job.
      else active--;
    }
  };
}
