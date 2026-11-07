'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { api, Charger, TelemetryReading, Incident } from '@/lib/api';
import { errorMessage, startPolling } from '@/lib/utils';
import { Notice } from '@/components/Notice';
import { derivedKW, scenarioLabel, timeAgo } from '@/lib/labels';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Clock,
  Gauge,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

const HISTORY_WINDOW_MIN = 30;
const HISTORY_POINTS = 100;

/** Small muted pill for channels that are not measured. */
function Unavailable({ label = 'Unavailable' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-700/80 bg-slate-800/50 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-slate-400">
      {label}
    </span>
  );
}

function ChargerDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialChargerId = searchParams.get('id') || 'demo-charger-01';

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selectedId, setSelectedId] = useState(initialChargerId);
  const [charger, setCharger] = useState<Charger | null>(null);
  const [history, setHistory] = useState<TelemetryReading[]>([]);
  const [chargerIncidents, setChargerIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock] = useState<Date | null>(null);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const allChargers = await api.getChargers();
      setChargers(allChargers);

      const targetId = selectedId || (allChargers[0]?._id ?? 'demo-charger-01');
      const [chargerDetail, incs] = await Promise.all([
        api.getCharger(targetId),
        api.getIncidents(undefined, targetId),
      ]);
      setCharger(chargerDetail);
      setChargerIncidents(incs);

      // The history endpoint sorts ascending and truncates at `limit`, so a
      // wide window returns the OLDEST samples. Query a recent window with
      // headroom, then keep the newest points; widen only if it is empty.
      const to = new Date(Date.now() + 60_000).toISOString();
      const recentFrom = new Date(Date.now() - HISTORY_WINDOW_MIN * 60_000).toISOString();
      let hist = await api.getTelemetryHistory(targetId, recentFrom, to, 500);
      if (hist.length === 0) {
        const dayFrom = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        hist = await api.getTelemetryHistory(targetId, dayFrom, to, 500);
      }
      setHistory(hist.slice(-HISTORY_POINTS));

      setError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to fetch charger telemetry'));
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [selectedId]);

  useEffect(() => startPolling(loadData, 7000), [loadData]);
  useEffect(() => startPolling(() => setClock(new Date()), 15_000), []);

  const latestReading = history.length > 0 ? history[history.length - 1] : null;
  const currentA = latestReading?.currentA;
  const derivedPowerKW = currentA === undefined ? null : derivedKW(currentA).toFixed(2);
  const stateSourceType =
    latestReading?.provenance.fields.chargingState === 'SYNTHETIC'
      ? 'SYNTHETIC'
      : latestReading?.provenance.fields.chargingState === 'DERIVED'
        ? 'DERIVED'
        : latestReading?.provenance.sourceType;
  const latestSeenAt = latestReading ? new Date(latestReading.ts) : null;
  const isStale =
    clock !== null &&
    latestSeenAt !== null &&
    Number.isFinite(latestSeenAt.getTime()) &&
    clock.getTime() - latestSeenAt.getTime() > 60_000;

  const chartData = history.map((h) => ({
    time: new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    currentA: h.currentA ?? null,
    state: h.chargingState ?? 'UNKNOWN',
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <Navbar onRefresh={() => loadData(true)} isRefreshing={isRefreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <Zap size={20} className="text-cyan-400" aria-hidden="true" />
            Charger Detail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pick a connector to see its live current, estimated power, recent history and incidents.
          </p>
        </div>

        {/* Connector selector */}
        <div role="group" aria-label="Select connector" className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto pb-1">
          {chargers.length === 0 &&
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-36 shrink-0 rounded-lg" aria-hidden="true" />)}
          {chargers.map((c) => {
            const active = c._id === selectedId;
            const statusDot =
              c.status === 'FAULT' ? 'bg-rose-500' : c.status === 'CHARGING' || c.status === 'AVAILABLE' ? 'bg-emerald-400' : 'bg-slate-500';
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => {
                  if (c._id === selectedId) return;
                  setError(null);
                  setLoading(true);
                  setCharger(null);
                  setHistory([]);
                  setChargerIncidents([]);
                  setSelectedId(c._id);
                  router.replace(`/chargers?id=${encodeURIComponent(c._id)}`, { scroll: false });
                }}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-2 h-10 px-3.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  active
                    ? 'bg-cyan-950/80 text-cyan-200 border-cyan-600/80 shadow-sm shadow-cyan-950'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
                {c._id}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        )}

        {/* Charger Header Card */}
        <section aria-labelledby="charger-title" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="charger-title" className="text-lg font-semibold font-mono text-slate-100">{selectedId}</h2>
                <StatusBadge status={isStale ? 'STALE' : latestReading?.chargingState || charger?.status || 'UNKNOWN'} />
                {latestReading?.provenance?.sourceType && (
                  <ProvenanceBadge sourceType={latestReading.provenance.sourceType} />
                )}
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Station</dt>
                  <dd className="font-mono text-slate-300">{charger?.stationId ?? '—'}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Port</dt>
                  <dd className="font-mono text-slate-300">{charger?.connectorId ?? '—'}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Rated</dt>
                  <dd className="font-mono text-slate-300">{charger?.ratedPowerKW ? `${charger.ratedPowerKW} kW (simulated)` : '—'}</dd>
                </div>
              </dl>
              <p className={`text-[11px] mt-2 font-mono flex items-center gap-1.5 ${isStale ? 'text-amber-300' : 'text-slate-500'}`}>
                <Clock size={11} aria-hidden="true" />
                {latestSeenAt && Number.isFinite(latestSeenAt.getTime())
                  ? <>Last reading {timeAgo(latestReading?.ts, clock?.getTime())}{isStale ? ' — no update for over 60 s' : ''}</>
                  : 'No telemetry yet'}
              </p>
            </div>

            {/* Key readings: current + estimated power */}
            <div className="grid grid-cols-2 gap-3 lg:w-[22rem] shrink-0">
              <div className="rounded-lg border border-cyan-900/60 bg-slate-950/70 px-4 py-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity size={11} aria-hidden="true" /> Current
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none ${currentA === undefined ? 'text-slate-500' : 'text-cyan-300'}`}>
                    {loading && currentA === undefined ? '…' : currentA === undefined ? '—' : currentA.toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">A</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">Measured · latest sample</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Gauge size={11} aria-hidden="true" /> Power
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-none ${derivedPowerKW === null ? 'text-slate-500' : 'text-slate-100'}`}>
                    {derivedPowerKW === null ? '—' : `≈${derivedPowerKW}`}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">kW</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">Estimated at 240 V</div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Telemetry Chart */}
        <section aria-labelledby="history-heading" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 id="history-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity size={16} className="text-cyan-400 shrink-0" aria-hidden="true" />
                Current over time
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Amperes (A), latest {HISTORY_POINTS} samples · dashed line = 0.5 A charging threshold
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-mono text-slate-400 tabular-nums">
              {history.length} samples
            </span>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {loading ? (
              <div className="skeleton h-full w-full rounded-lg" aria-label="Loading history" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={48}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    unit=" A"
                    width={48}
                  />
                  <ReferenceLine y={0.5} stroke="#64748b" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.375rem',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                    formatter={(value) => [
                      value === null || value === undefined ? 'No reading' : `${value} A  (≈ ${derivedKW(Number(value)).toFixed(2)} kW)`,
                      'Current',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="currentA"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#currentGradient)"
                    name="Current (A)"
                    isAnimationActive={false}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-800 text-center px-4">
                <p className="text-xs font-medium text-slate-300">No telemetry in the last 24 hours</p>                <p className="text-[11px] text-slate-500">{selectedId} has not reported any samples in this window.</p>
              </div>
            )}
          </div>
        </section>

        {/* Sensor Channels & Provenance Table */}
        <section aria-labelledby="channels-heading" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="mb-3">
            <h2 id="channels-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Server size={16} className="text-cyan-400" aria-hidden="true" />
              Sensor channels &amp; data origin
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              What each value is, and whether it was measured, simulated or calculated.
            </p>
          </div>

          <p id="sensor-provenance-scroll-hint" className="mb-2 text-[11px] text-slate-500 lg:sr-only">
            Swipe sideways (or focus the table and use ← →) to see all columns.
          </p>
          <div
            className="overflow-x-auto focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none"
            role="region"
            aria-label="Sensor channels and data provenance"
            aria-describedby="sensor-provenance-scroll-hint"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              const container = event.currentTarget;
              const step = event.key === 'ArrowRight' ? 120 : -120;
              const next = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + step));
              if (next !== container.scrollLeft) {
                event.preventDefault();
                container.scrollLeft = next;
              }
            }}
          >
            <table className="w-full min-w-[640px] text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Channel / Field</th>
                  <th scope="col" className="px-4 py-2.5">Latest Reading</th>
                  <th scope="col" className="px-4 py-2.5">Data Provenance</th>
                  <th scope="col" className="px-4 py-2.5">Technical Disclosure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Charging Current</td>
                  <td className="px-4 py-3 text-cyan-400 font-bold tabular-nums">{currentA === undefined ? 'N/A' : `${currentA.toFixed(2)} A`}</td>
                  <td className="px-4 py-3">
                    {latestReading?.currentA === undefined ? <Unavailable /> : <ProvenanceBadge sourceType={latestReading.provenance.sourceType} />}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Historical ACN current, when replayed, or synthetic current; see the provenance label.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Charging State</td>
                  <td className="px-4 py-3">{latestReading?.chargingState ? <StatusBadge status={latestReading.chargingState} size="sm" /> : 'N/A'}</td>
                  <td className="px-4 py-3">
                    {latestReading?.chargingState && stateSourceType
                      ? <ProvenanceBadge sourceType={stateSourceType} />
                      : <Unavailable />}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Derived by application logic: Current &gt; 0.5 A indicates CHARGING.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Energy Delivered</td>
                  <td className="px-4 py-3 tabular-nums">
                    {latestReading?.sourceEnergyKWh !== undefined ? `${latestReading.sourceEnergyKWh.toFixed(2)} kWh` : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    {latestReading?.sourceEnergyKWh !== undefined ? <ProvenanceBadge sourceType={latestReading.provenance.sourceType} /> : <Unavailable />}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Source-reported counter where present; decreases are flagged automatically.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Voltage (V)</td>
                  <td className="px-4 py-3 text-slate-500">—</td>
                  <td className="px-4 py-3">
                    <Unavailable label="Not measured" />
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Unavailable in this telemetry record; never inferred from another field.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Power (kW)</td>
                  <td className="px-4 py-3 tabular-nums">{derivedPowerKW === null ? 'N/A' : `~${derivedPowerKW} kW`}</td>
                  <td className="px-4 py-3">{derivedPowerKW === null ? <Unavailable /> : <ProvenanceBadge sourceType="DERIVED" />}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Estimated from current at an assumed 240 V split-phase supply: P = 240 V × I ÷ 1000.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Temperature (°C)</td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">
                    {latestReading?.temperatureC === undefined ? '—' : `${latestReading.temperatureC.toFixed(1)} °C`}
                  </td>
                  <td className="px-4 py-3">
                    {latestReading?.temperatureC === undefined
                      ? <Unavailable label="Not measured" />
                      : <ProvenanceBadge sourceType={latestReading.provenance.fields.temperatureC === 'SYNTHETIC' ? 'SYNTHETIC' : latestReading.provenance.sourceType} />}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Synthetic values are demonstrations only; EV hardware temperature sensors are not connected.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Associated Incidents */}
        <section aria-labelledby="charger-incidents-heading" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="charger-incidents-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertOctagon size={16} className="text-rose-400" aria-hidden="true" />
              Incident history
            </h2>
            {chargerIncidents.length > 0 && (
              <span className="text-[11px] font-mono text-slate-400">{chargerIncidents.length} total</span>
            )}
          </div>
          {loading ? (
            <div className="skeleton h-14 rounded-lg" aria-hidden="true" />
          ) : chargerIncidents.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
              No incidents recorded for {selectedId}.
            </p>
          ) : (
            <ul className="space-y-2">
              {chargerIncidents.map((inc) => (
                <li key={inc._id}>
                  <Link
                    href={`/incidents?selected=${inc._id}`}
                    className="group flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100">{scenarioLabel(inc.scenario)}</span>
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Detected {new Date(inc.detectedAt).toLocaleString()}
                        {inc.resolvedAt && ` · Resolved ${new Date(inc.resolvedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-slate-500 group-hover:text-cyan-400 transition-colors" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ChargerDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading charger detail…</div>}>
      <ChargerDetailContent />
    </Suspense>
  );
}
