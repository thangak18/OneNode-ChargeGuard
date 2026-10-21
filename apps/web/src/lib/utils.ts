import { startSerialPolling } from './polling.mts';
import { cancelPendingReads, readRetryAt } from './api';
/**
 * Shared helpers for the ChargeGuard web app.
 */

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length) return err;
  return fallback;
}

/** No hidden-tab traffic, overlap or requests retained after page cleanup. */
export function startPolling(load: () => void | Promise<unknown>, intervalMs: number): () => void {
  return startSerialPolling(load, intervalMs,
    () => (typeof document === 'undefined' || document.visibilityState !== 'hidden') && Date.now() >= readRetryAt(),
    cancelPendingReads);
}
