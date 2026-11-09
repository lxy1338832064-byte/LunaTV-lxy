/** @jest-environment node */
import { createWorkLimiter } from './limit-work';

test('active work is bounded and slots are released after failures', async () => {
  const run = createWorkLimiter(2);
  let active = 0;
  let maximum = 0;
  const jobs = Array.from({ length: 8 }, (_, index) =>
    run(async () => {
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      if (index === 2) throw new Error('bad image');
      return index;
    })
  );
  const results = await Promise.allSettled(jobs);
  expect(maximum).toBe(2);
  expect(
    results.filter((result) => result.status === 'fulfilled')
  ).toHaveLength(7);
  expect(await run(async () => 'recovered')).toBe('recovered');
});

test('full queues reject additional work instead of growing indefinitely', async () => {
  const run = createWorkLimiter(1, 1);
  let release: () => void = () => undefined;
  const first = run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  const second = run(async () => 2);
  await expect(run(async () => 3)).rejects.toThrow('queue full');
  release();
  await first;
  await expect(second).resolves.toBe(2);
});

test('expired queued jobs are removed without consuming the next free slot', async () => {
  jest.useFakeTimers();
  const run = createWorkLimiter(1, 2, 50);
  let release: () => void = () => undefined;
  const first = run(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  const second = expect(run(async () => 'expired')).rejects.toThrow(
    'queue timeout'
  );
  jest.advanceTimersByTime(51);
  await second;
  release();
  await first;
  await expect(run(async () => 'ok')).resolves.toBe('ok');
  jest.useRealTimers();
});
