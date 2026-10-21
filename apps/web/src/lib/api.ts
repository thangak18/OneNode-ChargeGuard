export interface Station {
  _id: string;
  name: string;
  capacityKW?: number;
}

export interface Charger {
  _id: string;
  stationId: string;
  connectorId: string;
  status: string;
  ratedPowerKW?: number;
}

export interface TelemetryReading {
  eventId?: string;
  ts: string;
  meta: {
    stationId: string;
    chargerId: string;
  };
  currentA?: number;
  temperatureC?: number;
  chargingState?: 'CHARGING' | 'IDLE' | 'FAULT' | 'AVAILABLE' | 'UNPLUGGED' | string;
  faultCode?: string;
  sourceEnergyKWh?: number;
  provenance: {
    sourceType: 'ACN_REPLAY' | 'DERIVED' | 'SYNTHETIC';
    fields: Record<string, string>;
    assumptions?: string;
  };
}

export interface IncidentAction {
  _id?: string;
  incidentId: string;
  actor: string;
  action: 'baseline' | 'fault_injected' | 'investigate' | 'acknowledged' | 'recovery_requested' | 'resolved' | string;
  at: string;
  synthetic?: boolean;
}

export interface Incident {
  _id: string;
  stationId?: string;
  chargerId: string;
  scenario: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVING' | 'RESOLVED';
  detectedAt: string;
  acknowledgedAt?: string;
  recoveryTelemetryAt?: string;
  resolvedAt?: string;
  synthetic?: boolean;
  evidence?: Array<{ type: string; detail: string; faultCode?: string }>;
  actions?: IncidentAction[];
}

export interface StationSummary {
  station: { id: string; name: string };
  window: { from: string; to: string };
  chargers: Array<{
    chargerId: string;
    connectorId: string;
    configuredStatus: string;
    telemetry: {
      sampleCount: number;
      averageCurrentA: number;
      lastSeenAt: string;
    } | null;
  }>;
  sampleCount: number;
}

const API_BASE = '/api/v1';

type PendingRead = {promise: Promise<unknown>; controller: AbortController};
const pendingReads = new Map<string, PendingRead>();
let retryAt = 0;
export const READ_ACTIVITY_EVENT = 'chargeguard-read-activity';
export function pendingReadCount(): number { return pendingReads.size; }
export function readRetryAt(): number { return retryAt; }
function notifyReads(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(READ_ACTIVITY_EVENT));
}
export function cancelPendingReads(): void {
  for (const item of pendingReads.values()) item.controller.abort();
  pendingReads.clear(); notifyReads();
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cancelPendingReads();
  });
}
async function performRequest<T>(url: string, options: RequestInit, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    ...options, signal, cache:'no-store',
    headers: {'Accept':'application/json','Content-Type':'application/json',...options.headers},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const delay = Number(res.headers.get('retry-after'));
    if (['GET','HEAD'].includes(options.method ?? 'GET') && [429,503].includes(res.status) && Number.isFinite(delay) && delay > 0) {
      retryAt = Math.max(retryAt, Date.now() + Math.min(delay,60)*1000);
    }
    throw new Error(typeof body.message === 'string' ? body.message : `API request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}
function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const isRead = ['GET','HEAD'].includes(options.method ?? 'GET');
  if (!isRead) return performRequest<T>(url,options,AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(25_000)]));
  const existing = pendingReads.get(url);
  if (existing) return existing.promise as Promise<T>;
  const controller = new AbortController();
  const promise = performRequest<T>(url,options,AbortSignal.any([controller.signal,...(options.signal?[options.signal]:[]),AbortSignal.timeout(95_000)]))
    .finally(() => {if(pendingReads.get(url)?.promise === promise)pendingReads.delete(url);notifyReads();});
  pendingReads.set(url,{promise,controller}); notifyReads();
  return promise;
}

export const api = {
  // Health
  checkHealth: () => request<{ status: string }>('/health/live'),
  checkReady: () => request<{ status: string }>('/health/ready'),

  // Stations & Chargers
  getStations: () => request<Station[]>('/stations'),
  getChargers: () => request<Charger[]>('/chargers'),
  getCharger: (id: string) => request<Charger>(`/chargers/${id}`),

  // Analytics & Summary
  getStationSummary: (stationId = 'demo-station-01') =>
    request<StationSummary>(`/analytics/stations/${stationId}/summary`),
  getLatestTelemetry: (stationId?: string) =>
    request<TelemetryReading[]>(`/analytics/latest${stationId ? `?stationId=${stationId}` : ''}`),
  getChargingStates: () => request<Array<{ state: string; count: number }>>('/analytics/states'),
  getTelemetryHistory: (chargerId: string, from: string, to: string, limit = 100) =>
    request<TelemetryReading[]>(
      `/telemetry/history?chargerId=${encodeURIComponent(chargerId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`,
    ),

  // Incidents
  getIncidents: (status?: string, chargerId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (chargerId) params.set('chargerId', chargerId);
    const qs = params.toString();
    return request<Incident[]>(`/incidents${qs ? `?${qs}` : ''}`);
  },
  getIncident: (id: string) => request<Incident>(`/incidents/${id}`),
  acknowledgeIncident: (id: string, actor = 'operator-ui') =>
    request<Incident>(`/incidents/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    }),
  resolveIncident: (id: string, actor = 'operator-ui') =>
    request<Incident>(`/incidents/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    }),

  // Demo Controls
  triggerFault: (chargerIndex = 1, scenario = 'SIM_OVERHEAT') =>
    request<{
      incidentId: string;
      status: string;
      chargerId: string;
      scenario: string;
      detectedAt: string;
      synthetic: boolean;
      duplicate?: boolean;
      message: string;
    }>('/demo/trigger-fault', {
      method: 'POST',
      body: JSON.stringify({ chargerIndex, scenario }),
    }),
  recoverFault: (incidentId: string) =>
    request<{
      incidentId: string;
      status: string;
      recoveredAt: string;
      message: string;
    }>('/demo/recover', {
      method: 'POST',
      body: JSON.stringify({ incidentId }),
    }),
  resetBaseline: () =>
    request<{
      success: boolean;
      message: string;
      run: string;
    }>('/demo/reset', {
      method: 'POST',
    }),
};
