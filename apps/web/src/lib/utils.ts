/**
 * Shared helpers for the ChargeGuard web app.
 */

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length) return err;
  return fallback;
}

/**
 * Run a polling-style data loader on a fixed interval without triggering the
 * `react-hooks/set-state-in-effect` lint rule (which flags setState called
 * synchronously inside an effect body). The first load is deferred to a
 * macrotask so the effect body itself never calls setState synchronously.
 *
 * Returns a cleanup function for use in the effect.
 */
export function startPolling(load: () => void, intervalMs: number): () => void {
  const timer = setTimeout(() => load(), 0);
  const interval = setInterval(() => load(), intervalMs);
  return () => {
    clearTimeout(timer);
    clearInterval(interval);
  };
}
