/** Bounded successful-result cache with concurrent request deduplication. */
export function createAsyncCache<T>(ttlMs: number, maxEntries: number) {
  type Entry = { value?: T; expiresAt: number; pending?: Promise<T> };
  const entries = new Map<string, Entry>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);
      if (cached?.pending) return cached.pending;
      if (cached && cached.expiresAt > Date.now()) {
        entries.delete(key);
        entries.set(key, cached);
        return Promise.resolve(cached.value as T);
      }
      const entry: Entry = { expiresAt: 0 };
      const pending = Promise.resolve()
        .then(load)
        .then(
          (value) => {
            if (entries.get(key) === entry) {
              entry.value = value;
              entry.expiresAt = Date.now() + ttlMs;
              entry.pending = undefined;
            }
            return value;
          },
          (error) => {
            if (entries.get(key) === entry) entries.delete(key);
            throw error;
          }
        );
      entry.pending = pending;
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return pending;
    },
    invalidate(key: string) {
      entries.delete(key);
    },
  };
}
