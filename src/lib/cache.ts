// 高速メモリキャッシュ
interface CacheEntry<T> {
  data: T;
  expiry: number;
  createdAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// デフォルト: 30分間キャッシュ（長めに設定）
const DEFAULT_TTL = 30 * 60 * 1000;

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
    createdAt: Date.now(),
  });
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// キャッシュの状態を取得
export function getCacheStatus(key: string): { exists: boolean; age: number | null; ttlRemaining: number | null } {
  const entry = cache.get(key);
  if (!entry) {
    return { exists: false, age: null, ttlRemaining: null };
  }
  
  const now = Date.now();
  return {
    exists: true,
    age: now - entry.createdAt,
    ttlRemaining: entry.expiry - now,
  };
}

