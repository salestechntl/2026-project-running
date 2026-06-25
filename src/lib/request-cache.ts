/**
 * In-flight dedup + short-lived cache for shared fetches (AppShell ↔ Home ↔ hooks).
 * Invalidated on DATA_CHANGED_EVENT when entries mutate.
 */

import { DATA_CHANGED_EVENT } from "./store";

type CacheEntry<T> = { data: T; fetchedAt: number };

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Safety TTL — primary invalidation is DATA_CHANGED_EVENT */
const DEFAULT_TTL_MS = 60_000;

export function invalidateRequestCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < ttlMs) {
    return hit.data as T;
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function cacheKeyRuns(employeeId: string): string {
  return `runs:${employeeId}`;
}

export function cacheKeyRunHistory(employeeId: string, page: number, limit: number): string {
  return `runs:history:${employeeId}:${page}:${limit}`;
}

export function cacheKeyWeightsLite(employeeId: string): string {
  return `weights:lite:${employeeId}`;
}

export function cacheKeyWeights(employeeId: string): string {
  return `weights:${employeeId}`;
}

export function cacheKeySubordinates(managerId: string): string {
  return `subordinates:${managerId}`;
}

export function cacheKeyHome(employeeId: string, monthKey: string): string {
  return `home:${employeeId}:${monthKey}`;
}

/** Invalidate when store/local mutations dispatch DATA_CHANGED without going through entries.ts */
if (typeof window !== "undefined") {
  window.addEventListener(DATA_CHANGED_EVENT, () => invalidateRequestCache());
}
