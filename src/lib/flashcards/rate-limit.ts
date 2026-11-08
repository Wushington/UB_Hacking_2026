/**
 * In-memory fixed-window limiter (single Node server, per spec). Returns true when the call is allowed.
 * Resets on restart; good enough to stop accidental bursts of paid Gemini calls.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
  const windows = new Map<string, { start: number; count: number }>();
  return (userId: string): boolean => {
    const t = now();
    const current = windows.get(userId);
    if (!current || t - current.start > windowMs) {
      windows.set(userId, { start: t, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}
