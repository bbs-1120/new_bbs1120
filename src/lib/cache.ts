// 高速メモリキャッシュ（Stale-While-Revalidate対応）
interface CacheEntry<T> {
  data: T;
  expiry: number;       // 新鮮期限（この時間までは即座に返す）
  staleExpiry: number;  // 古いデータとして使える期限（この期間はstaleデータを返しつつ再取得）
  createdAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const revalidatingKeys = new Set<string>(); // 再取得中のキー

// デフォルト: 10分間新鮮 + 50分間stale許容（合計60分）
const DEFAULT_TTL = 10 * 60 * 1000;
const DEFAULT_STALE_TTL = 50 * 60 * 1000;

export interface CacheResult<T> {
  data: T | null;
  isStale: boolean;
  shouldRevalidate: boolean;
}

// 新しいSWR対応キャッシュ取得
export function getCacheWithSWR<T>(key: string): CacheResult<T> {
  const entry = cache.get(key);
  if (!entry) {
    return { data: null, isStale: false, shouldRevalidate: false };
  }
  
  const now = Date.now();
  
  // 完全に期限切れ
  if (now > entry.staleExpiry) {
    cache.delete(key);
    return { data: null, isStale: false, shouldRevalidate: false };
  }
  
  // 新鮮期間内
  if (now <= entry.expiry) {
    return { data: entry.data as T, isStale: false, shouldRevalidate: false };
  }
  
  // Stale期間内（古いデータを返しつつ再取得を促す）
  const shouldRevalidate = !revalidatingKeys.has(key);
  return { data: entry.data as T, isStale: true, shouldRevalidate };
}

// 従来互換のキャッシュ取得（staleデータも返す）
export function getCache<T>(key: string): T | null {
  const result = getCacheWithSWR<T>(key);
  return result.data;
}

// 再取得中フラグを設定
export function markRevalidating(key: string): void {
  revalidatingKeys.add(key);
}

// 再取得中フラグを解除
export function unmarkRevalidating(key: string): void {
  revalidatingKeys.delete(key);
}

export function setCache<T>(
  key: string, 
  data: T, 
  ttl: number = DEFAULT_TTL,
  staleTtl: number = DEFAULT_STALE_TTL
): void {
  const now = Date.now();
  cache.set(key, {
    data,
    expiry: now + ttl,
    staleExpiry: now + ttl + staleTtl,
    createdAt: now,
  });
  revalidatingKeys.delete(key);
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
    revalidatingKeys.delete(key);
  } else {
    cache.clear();
    revalidatingKeys.clear();
  }
}

// キャッシュの状態を取得
export function getCacheStatus(key: string): { 
  exists: boolean; 
  age: number | null; 
  ttlRemaining: number | null;
  isStale: boolean;
  staleTtlRemaining: number | null;
} {
  const entry = cache.get(key);
  if (!entry) {
    return { exists: false, age: null, ttlRemaining: null, isStale: false, staleTtlRemaining: null };
  }
  
  const now = Date.now();
  const isStale = now > entry.expiry && now <= entry.staleExpiry;
  
  return {
    exists: true,
    age: now - entry.createdAt,
    ttlRemaining: Math.max(0, entry.expiry - now),
    isStale,
    staleTtlRemaining: Math.max(0, entry.staleExpiry - now),
  };
}

// キャッシュ統計
export function getCacheStats(): { 
  totalEntries: number; 
  freshEntries: number; 
  staleEntries: number;
  revalidatingCount: number;
} {
  let freshEntries = 0;
  let staleEntries = 0;
  const now = Date.now();
  
  cache.forEach((entry) => {
    if (now <= entry.expiry) {
      freshEntries++;
    } else if (now <= entry.staleExpiry) {
      staleEntries++;
    }
  });
  
  return {
    totalEntries: cache.size,
    freshEntries,
    staleEntries,
    revalidatingCount: revalidatingKeys.size,
  };
}

