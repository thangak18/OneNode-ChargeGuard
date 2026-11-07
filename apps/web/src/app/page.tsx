'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MetricCard, MetricCardSkeleton } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { Notice } from '@/components/Notice';
import { api, StationSummary, Incident } from '@/lib/api';
import { errorMessage, startPolling } from '@/lib/utils';
import { derivedKW, scenarioLabel, timeAgo } from '@/lib/labels';
import {
  Zap,
  Activity,
  AlertTriangle,
  AlertOctagon,
  Server,
  ArrowRight,
  CheckCircle2,
  Clock,
  Radio,
  Gauge,
  Info,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';

const CHARGING_THRESHOLD_A = 0.5;
const METER_MAX_A = 12;
// Tolerated browser-vs-server clock difference when judging telemetry freshness.
const CLOCK_SKEW_TOLERANCE_MS = 30_000;

export default function OverviewPage() {
  const [summary, setSummary] = useState<StationSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showProvenanceInfo, setShowProvenanceInfo] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProvenanceInfo) return;
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowProvenanceInfo(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowProvenanceInfo(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showProvenanceInfo]);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [sum, incs] = await Promise.all([
        api.getStationSummary('demo-station-01'),
        api.getIncidents(),
      ]);
      setSummary(sum);
      setIncidents(incs);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to fetch operational telemetry from the API'));
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => startPolling(loadData, 6000), [loadData]);

  // Derived metrics
  const chargers = summary?.chargers || [];
  const now = lastUpdated?.getTime() ?? 0;
  const hasFreshTelemetry = (
    charger: StationSummary['chargers'][number],
  ): charger is StationSummary['chargers'][number] & {
    telemetry: NonNullable<StationSummary['chargers'][number]['telemetry']>;
  } => {
    if (!charger.telemetry) return false;
    const age = now - new Date(charger.telemetry.lastSeenAt).getTime();
    // `now` is the browser clock and lastSeenAt the server/device clock. A
    // viewer whose clock runs slightly behind sees a small negative age for
    // brand-new readings; treat that as fresh instead of flagging it stale.
    return Number.isFinite(age) && age >= -CLOCK_SKEW_TOLERANCE_MS && age <= 60_000;
  };
  const freshChargers = chargers.filter(hasFreshTelemetry);
  const staleCount = chargers.filter((charger) => charger.telemetry && !hasFreshTelemetry(charger)).length;
  const noSignalCount = chargers.filter((charger) => !charger.telemetry).length;
  const activeCount = freshChargers.filter((charger) => charger.telemetry.averageCurrentA > CHARGING_THRESHOLD_A).length;
  const idleCount = Math.max(0, freshChargers.length - activeCount);
  const activeIncidents = incidents.filter((incident) =>
    ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'].includes(incident.status),
  );
  const freshnessStatus =
    freshChargers.length === 0
      ? staleCount > 0 ? 'STALE' : 'NO DATA'
      : staleCount > 0 || noSignalCount > 0 ? 'PARTIAL' : 'FRESH';
  const freshnessVariant = freshnessStatus === 'FRESH' ? 'emerald' : 'amber';
  const totalConnectors = chargers.length || 5;
  const freshnessSubtitle =
    freshnessStatus === 'FRESH'
      ? `All ${freshChargers.length} connectors reported in the last 60 s`
      : `${freshChargers.length} fresh · ${staleCount} stale · ${noSignalCount} silent`;
  const totalCurrentA = freshChargers.reduce((acc, charger) => acc + charger.telemetry.averageCurrentA, 0);
  const derivedPowerKW = derivedKW(totalCurrentA).toFixed(2);

  // Recharts chart data
  const chartData = chargers.map((c) => ({
    name: `#${c.connectorId.replace('virtual-', '')}`,
    fullName: c.chargerId,
    currentA: hasFreshTelemetry(c) ? Number(c.telemetry.averageCurrentA.toFixed(2)) : null,
    isFault: c.configuredStatus === 'FAULT',
  }));
  const hasChartTelemetry = chartData.some((charger) => charger.currentA !== null);

  const activeIncidentChargers = new Set(activeIncidents.map((incident) => incident.chargerId));

  // One-line fleet verdict: what a first-time visitor should read first.
  const fleetHealth: { tone: 'emerald' | 'amber' | 'rose'; title: string; detail: string } =
    activeIncidents.length > 0
      ? {
          tone: 'rose',
          title: `${activeIncidents.length} active incident${activeIncidents.length > 1 ? 's' : ''} need${activeIncidents.length > 1 ? '' : 's'} attention`,
          detail: `Affected: ${[...activeIncidentChargers].join(', ')}`,
        }
      : freshnessStatus === 'FRESH'
        ? {
            tone: 'emerald',
            title: 'All systems nominal',
            detail: `${freshChargers.length}/${totalConnectors} connectors reporting · ${activeCount} charging · no active incidents`,
          }
        : {
            tone: 'amber',
            title: freshnessStatus === 'NO DATA' ? 'Waiting for telemetry' : 'Telemetry partially delayed',
            detail: `${freshChargers.length}/${totalConnectors} connectors reporting fresh data · no active incidents`,
          };
  const healthStyles = {
    emerald: { box: 'border-emerald-800/60 bg-emerald-950/30', icon: 'bg-emerald-500/15 text-emerald-400', title: 'text-emerald-200', Icon: CheckCircle2 },
    amber: { box: 'border-amber-800/60 bg-amber-950/30', icon: 'bg-amber-500/15 text-amber-400', title: 'text-amber-200', Icon: Clock },
    rose: { box: 'border-rose-800/70 bg-rose-950/40', icon: 'bg-rose-500/15 text-rose-400', title: 'text-rose-200', Icon: AlertOctagon },
  }[fleetHealth.tone];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <Navbar onRefresh={() => loadData(true)} isRefreshing={isRefreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 grid-bg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">Operations Overview</h1>
            <p className="text-xs text-slate-400 mt-1">
              Live status of 5 virtual connectors at <span className="font-mono text-slate-300">demo-station-01</span> · auto-refresh every 6 s
            </p>
          </div>

          {/* Compact Provenance Info Pill & Popover */}
          <div className="relative self-start" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setShowProvenanceInfo((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-amber-800/60 hover:border-amber-700 text-xs transition-colors shadow-sm"
              aria-expanded={showProvenanceInfo}
              aria-haspopup="dialog"
              title="What data am I looking at?"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="font-mono text-[11px] text-amber-300 font-medium tracking-wide">SYNTHETIC TELEMETRY</span>
              <Info size={13} className="text-slate-400" aria-hidden="true" />
            </button>

            {showProvenanceInfo && (
              <div
                role="dialog"
                aria-label="Data provenance disclosure"
                className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] p-4 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl z-50 text-xs animate-in"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-cyan-400" />
                    <span className="font-semibold text-slate-100">Where does this data come from?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProvenanceInfo(false)}
                    className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>

                <p className="text-slate-300 mb-3 leading-relaxed">
                  Readings on this page come from <strong className="text-slate-100">simulated virtual chargers</strong>, not physical hardware. Historical ACN replay is separate and not shown here.
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Labels you will see</div>
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5"><ProvenanceBadge sourceType="SYNTHETIC" /></div>
                    <span className="text-[11px] text-slate-400">Simulated sensor channels and fault injection.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5"><ProvenanceBadge sourceType="DERIVED" /></div>
                    <span className="text-[11px] text-slate-400">Calculated values, e.g. &ldquo;charging&rdquo; when current &gt; 0.5 A, or kW at an assumed 240 V.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5"><ProvenanceBadge sourceType="ACN_REPLAY" /></div>
                    <span className="text-[11px] text-slate-400">Real-world Caltech ACN historical sessions{process.env.NODE_ENV === 'development' ? <> (<Link href="/history" className="text-cyan-400 underline hover:text-cyan-300">Historical Local</Link>)</> : null}.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error notification if backend unavailable */}
        {error && (
          <Notice
            tone="error"
            title="Can't reach the telemetry API."
            action={
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 rounded-md text-[11px] font-medium transition-colors"
              >
                Retry
              </button>
            }
          >
            {error}.{' '}
            {process.env.NODE_ENV === 'production'
              ? 'The cloud service may be waking up — data will appear automatically.'
              : 'Make sure the NestJS API is running on port 3001.'}
          </Notice>
        )}

        {/* Fleet health verdict — the 5-second answer */}
        {loading ? (
          <div className="skeleton h-[58px] w-full rounded-xl" aria-hidden="true" />
        ) : (
          !error && (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${healthStyles.box}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${healthStyles.icon}`}>
                <healthStyles.Icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${healthStyles.title}`}>{fleetHealth.title}</p>
                <p className="text-[11px] sm:text-xs text-slate-400">{fleetHealth.detail}</p>
              </div>
              {fleetHealth.tone === 'rose' && (
                <Link
                  href="/incidents"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-xs font-medium text-white transition-colors"
                >
                  Triage <ArrowRight size={13} />
                </Link>
              )}
            </div>
          )
        )}

        {/* Metric Overview Row */}
        {loading ? (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              title="Data Freshness"
              hint="FRESH means every connector sent telemetry within the last 60 seconds."
              value={freshnessStatus}
              variant={freshnessVariant}
              subtitle={freshnessSubtitle}
              icon={<Radio size={16} />}
            />
            <MetricCard
              title="Total Current"
              hint="Sum of mean charging current across connectors with fresh telemetry. Power is estimated at an assumed 240 V."
              value={freshChargers.length > 0 ? totalCurrentA.toFixed(1) : 'N/A'}
              unit={freshChargers.length > 0 ? 'A' : undefined}
              variant="cyan"
              subtitle={freshChargers.length > 0 ? `≈ ${derivedPowerKW} kW estimated power` : 'No fresh telemetry to aggregate'}
              icon={<Zap size={16} />}
            />
            <MetricCard
              title="Charging Now"
              hint="A connector counts as charging when its mean current is above 0.5 A."
              value={`${activeCount}/${totalConnectors}`}
              unit="connectors"
              variant="default"
              subtitle={`${idleCount} idle · ${staleCount + noSignalCount} not reporting`}
              icon={<Activity size={16} />}
            />
            <MetricCard
              title="Samples Stored"
              hint="Telemetry documents in the MongoDB Atlas time-series collection for this station window."
              value={(summary?.sampleCount || 0).toLocaleString()}
              variant="default"
              subtitle="MongoDB Atlas time-series"
              icon={<Server size={16} />}
            />
          </div>
        )}

        {/* Main 2-Column Section: Live Current Chart & Quick Incident Alert */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Current Chart (2 cols) */}
          <section
            aria-labelledby="current-chart-heading"
            className="lg:col-span-2 glow-card bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 id="current-chart-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Gauge size={16} className="text-cyan-400 shrink-0" />
                  Charging current per connector
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Mean amperes (A) · dashed line = 0.5 A charging threshold
                </p>
              </div>
              <span className="hidden sm:inline-flex shrink-0 text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded-full uppercase tracking-wider items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
                Live · 6s
              </span>
            </div>

            <div className="h-56 sm:h-64 w-full">
              {loading ? (
                <div className="skeleton h-full w-full rounded-lg" />
              ) : hasChartTelemetry ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="barGradientFault" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#334155' }} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#334155' }} unit=" A" width={48} />
                    <ReferenceLine y={CHARGING_THRESHOLD_A} stroke="#64748b" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
                      formatter={(value) => [
                        `${value} A  (≈ ${derivedKW(Number(value)).toFixed(2)} kW)`,
                        'Mean current',
                      ]}
                    />
                    <Bar dataKey="currentA" radius={[6, 6, 0, 0]} name="Current (A)" maxBarSize={72} isAnimationActive={false}>
                      {chartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.isFault ? 'url(#barGradientFault)' : 'url(#barGradient)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 text-center px-4">
                  <Radio size={20} className="text-slate-600" aria-hidden="true" />
                  <p className="text-xs font-medium text-slate-300">No fresh telemetry yet</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Bars appear as soon as a connector reports within the last 60 seconds.
                  </p>
                </div>
              )}
            </div>
            {/* Accessible summary of the chart */}
            <table className="sr-only">
              <caption>Mean charging current per connector</caption>
              <tbody>
                {chartData.map((d) => (
                  <tr key={d.fullName}>
                    <th scope="row">{d.fullName}</th>
                    <td>{d.currentA === null ? 'No fresh data' : `${d.currentA} A`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Right: Active Incidents (1 col) */}
          <section
            aria-labelledby="incident-queue-heading"
            className="glow-card bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 id="incident-queue-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <AlertTriangle size={16} className={activeIncidents.length ? 'text-rose-400' : 'text-slate-500'} />
                Active incidents
              </h2>
              {!loading && (
                <span
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    activeIncidents.length
                      ? 'bg-rose-950/70 text-rose-300 border-rose-800/70'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  }`}
                >
                  {activeIncidents.length}
                </span>
              )}
            </div>

            <div className="flex-1">
              {loading ? (
                <div className="space-y-2.5">
                  <div className="skeleton h-16 w-full rounded-lg" />
                  <div className="skeleton h-16 w-full rounded-lg" />
                </div>
              ) : activeIncidents.length === 0 ? (
                <div className="h-full min-h-[10rem] py-6 text-center flex flex-col items-center justify-center">
                  <div className="w-11 h-11 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 mb-3">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-200">Queue is clear</p>
                  <p className="text-[11px] text-slate-400 mt-1.5 max-w-[15rem] leading-relaxed">
                    No faults detected or reported. Status reflects simulated telemetry only.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {activeIncidents.slice(0, 3).map((inc) => (
                    <li key={inc._id}>
                      <Link
                        href={`/incidents?selected=${inc._id}`}
                        className="group block p-3 rounded-lg border border-rose-900/50 bg-rose-950/20 hover:border-rose-700/70 hover:bg-rose-950/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-100 truncate">{scenarioLabel(inc.scenario)}</span>
                          <StatusBadge status={inc.status} size="sm" />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span className="truncate">{inc.chargerId}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {timeAgo(inc.detectedAt, now || undefined)}
                            <ArrowRight size={12} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {activeIncidents.length > 3 && (
                    <li className="text-[11px] text-slate-500 text-center">+{activeIncidents.length - 3} more</li>
                  )}
                </ul>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/60">
              <Link
                href="/incidents"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-medium transition-colors"
              >
                Open incident queue
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </div>

        {/* 5 Virtual Connectors Grid */}
        <section aria-labelledby="connectors-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 id="connectors-heading" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server size={16} className="text-cyan-400" />
              Connectors
            </h2>
            <span className="text-[11px] text-slate-500">Select a connector for its full history</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-[136px] rounded-xl" aria-hidden="true" />)}
            {!loading && chargers.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
                No connectors returned by the API yet.
              </div>
            )}
            {chargers.map((charger) => {
              const fresh = hasFreshTelemetry(charger);
              const currentA = fresh ? charger.telemetry?.averageCurrentA ?? null : null;
              const isFault = charger.configuredStatus === 'FAULT' || activeIncidentChargers.has(charger.chargerId);
              const isCharging = currentA !== null && currentA > CHARGING_THRESHOLD_A;
              const isStale = Boolean(charger.telemetry && !fresh);
              const displayStatus = isFault
                ? 'FAULT'
                : isStale
                  ? 'STALE'
                  : currentA === null
                    ? 'NO DATA'
                    : isCharging
                      ? 'CHARGING'
                      : 'IDLE';
              const barWidth = Math.min(100, ((currentA ?? 0) / METER_MAX_A) * 100);

              return (
                <Link
                  key={charger.chargerId}
                  href={`/chargers?id=${charger.chargerId}`}
                  aria-label={`${charger.chargerId}: ${displayStatus}${currentA !== null ? `, ${currentA.toFixed(1)} amperes` : ''}. Open details.`}
                  className={`glow-card ${isFault ? 'glow-card-rose border-rose-800/70' : 'border-slate-800 hover:border-cyan-700/50'} relative overflow-hidden bg-slate-900/90 border rounded-xl p-3.5 sm:p-4 transition-colors shadow-sm group flex flex-col justify-between`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-0.5 ${
                      isFault
                        ? 'bg-gradient-to-r from-transparent via-rose-500 to-transparent'
                        : isCharging
                          ? 'bg-gradient-to-r from-transparent via-cyan-500 to-transparent'
                          : 'bg-gradient-to-r from-transparent via-slate-700 to-transparent'
                    }`}
                    aria-hidden="true"
                  />

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-xs font-mono font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {charger.chargerId}
                      </span>
                      <StatusBadge status={displayStatus} size="sm" />
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold font-mono tabular-nums leading-none ${isFault ? 'text-rose-400' : currentA === null ? 'text-slate-500' : 'text-slate-100'}`}>
                          {currentA === null ? '—' : currentA.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">A</span>
                        {isFault && currentA !== null && (
                          <span
                            className="text-[10px] text-slate-500"
                            title="Mean over the recent telemetry window; it can include readings from before the fault."
                          >
                            window avg
                          </span>
                        )}
                        {currentA !== null && (
                          <span className="ml-auto text-[11px] font-mono text-slate-400 tabular-nums" title="Estimated at 240 V">
                            ≈{derivedKW(currentA).toFixed(1)} kW
                          </span>
                        )}
                      </div>

                      <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden" aria-hidden="true">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isFault ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={11} aria-hidden="true" />
                      {isStale
                        ? 'No update >60s'
                        : charger.telemetry?.lastSeenAt
                          ? timeAgo(charger.telemetry.lastSeenAt, now || undefined)
                          : 'No signal'}
                    </span>
                    <ArrowRight size={12} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/40 pt-4 pb-6 text-center space-y-1">
          <p className="text-[11px] text-slate-500 font-mono">
            ChargeGuard v1.0 — MUGVN Hackathon 2026 · Team OneNode
          </p>
          <p className="text-[10px] text-slate-500">
            Powered by MongoDB Atlas · Datadog US1 · NestJS · Next.js
          </p>
        </footer>
      </main>
    </div>
  );
}
