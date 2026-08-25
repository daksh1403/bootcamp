interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window in-memory rate limiter. Sufficient for a single-node,
 * 50-participant event platform.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterS: number } {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < t) {
    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return { ok: true, retryAfterS: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterS: Math.ceil((b.resetAt - t) / 1000) };
  }
  return { ok: true, retryAfterS: 0 };
}

// Periodic cleanup so the map never grows unbounded during a long event day.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const t = Date.now();
    for (const [k, v] of buckets) if (v.resetAt < t - 60_000) buckets.delete(k);
  }, 5 * 60_000);
  if (typeof timer.unref === "function") timer.unref();
}
