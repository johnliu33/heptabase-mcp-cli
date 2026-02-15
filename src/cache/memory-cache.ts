interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL = 300; // 5 minutes
const SEARCH_TTL = 60;   // 1 minute for search results

export class MemoryCache {
  private store = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  buildKey(toolName: string, args: Record<string, unknown>): string {
    return `${toolName}:${JSON.stringify(args)}`;
  }

  getTtlForTool(toolName: string): number {
    if (toolName.startsWith('semantic_search')) return SEARCH_TTL;
    return DEFAULT_TTL;
  }
}
