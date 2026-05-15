import { supabaseAdmin } from "@/lib/supabase/server";

const DEFAULT_TTL_SEC = 24 * 60 * 60;

export interface CachedRow<T> {
  payload: T;
  updatedAt: string;
  stale: boolean;
  ageSec: number;
}

export async function readCache<T>(
  key: string,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<CachedRow<T> | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("market_cache")
      .select("payload, updated_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    const updatedAt = data.updated_at as string;
    const ageSec = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
    return {
      payload: data.payload as T,
      updatedAt,
      ageSec,
      stale: ageSec > ttlSec,
    };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, payload: T): Promise<void> {
  const supabase = supabaseAdmin();
  await supabase
    .from("market_cache")
    .upsert({ key, payload, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

/**
 * Read cache, falling back to `compute` when missing OR stale. Always returns
 * fresh data on the first call, but never blocks page rendering on a refetch
 * when the cache is still warm enough (within ttlSec).
 */
export async function cachedOr<T>(
  key: string,
  ttlSec: number,
  compute: () => Promise<T>,
): Promise<{ data: T; cached: boolean; updatedAt: string | null; ageSec: number }> {
  const hit = await readCache<T>(key, ttlSec);
  if (hit && !hit.stale) {
    return { data: hit.payload, cached: true, updatedAt: hit.updatedAt, ageSec: hit.ageSec };
  }
  // Stale (or missing): compute fresh, persist, return.
  const fresh = await compute();
  try {
    await writeCache(key, fresh);
  } catch {
    /* best-effort; ignore write failures so the page still serves */
  }
  return { data: fresh, cached: false, updatedAt: new Date().toISOString(), ageSec: 0 };
}
