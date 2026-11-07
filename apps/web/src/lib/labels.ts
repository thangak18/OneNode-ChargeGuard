/**
 * Human-readable presentation labels shared across pages.
 * Raw codes (e.g. SIM_OVERHEAT) stay visible as secondary metadata so
 * provenance is never hidden — these labels only add plain-language context.
 */

export const SCENARIOS = [
  {
    code: 'SIM_OVERHEAT',
    label: 'Connector overheat',
    detail: 'Synthetic 72 °C stimulus plus a zero-current fault event',
  },
  {
    code: 'SIM_POWER_LOSS',
    label: 'Sudden power loss',
    detail: 'Synthetic zero-current fault event',
  },
  {
    code: 'SIM_HARDWARE_FAULT',
    label: 'Hardware fault',
    detail: 'Synthetic generic fault event',
  },
] as const;

export function scenarioLabel(code: string | undefined | null): string {
  if (!code) return 'Unknown scenario';
  return SCENARIOS.find((s) => s.code === code)?.label ?? code;
}

export const INCIDENT_STATUS_STEPS = ['OPEN', 'ACKNOWLEDGED', 'RESOLVING', 'RESOLVED'] as const;

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  ALL: 'All',
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVING: 'Resolving',
  RESOLVED: 'Resolved',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  baseline: 'Baseline reset',
  fault_injected: 'Fault detected',
  investigate: 'Investigation started',
  acknowledged: 'Acknowledged',
  recovery_requested: 'Recovery telemetry received',
  resolved: 'Resolved',
};

/** "12 s ago", "4 min ago", "3 h ago" — falls back to a local time string. */
export function timeAgo(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleString();
}

/** Derived power assumption disclosed in the UI: P = 240 V × I ÷ 1000. */
export const ASSUMED_VOLTAGE_V = 240;
export function derivedKW(currentA: number): number {
  return (ASSUMED_VOLTAGE_V * currentA) / 1000;
}

/** Only allow same-origin relative redirects (prevents open-redirects). */
export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/login')) return '/';
  return raw;
}
