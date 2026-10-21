'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MetricCard, MetricCardSkeleton } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { api, StationSummary, Incident } from '@/lib/api';
import { errorMessage, startPolling } from '@/lib/utils';
import {
  Zap,
  Activity,
  AlertTriangle,
  Server,
  ArrowRight,
  CheckCircle2,
  Clock,
  Radio,
  Sliders,
  Gauge,
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
} from 'recharts';

export default function OverviewPage() {
  const [summary, setSummary] = useState<StationSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      setError(errorMessage(err, 'Failed to fetch operational telemetry from NestJS backend'));
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
    return Number.isFinite(age) && age >= 0 && age <= 60_000;
  };
  const freshChargers = chargers.filter(hasFreshTelemetry);
  const staleCount = chargers.filter((charger) => charger.telemetry && !hasFreshTelemetry(charger)).length;
  const noSignalCount = chargers.filter((charger) => !charger.telemetry).length;
  const activeCount = freshChargers.filter((charger) => charger.telemetry.averageCurrentA > 0.5).length;
  const idleCount = Math.max(0, freshChargers.length - activeCount);
  const activeIncidents = incidents.filter((incident) =>
    ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'].includes(incident.status),
  );
  const freshnessStatus =
    freshChargers.length === 0
      ? staleCount > 0 ? 'STALE' : 'NO DATA'
      : staleCount > 0 || noSignalCount > 0 ? 'PARTIAL' : 'FRESH';
  const freshnessVariant = freshnessStatus === 'FRESH' ? 'cyan' : 'amber';
  const freshnessSubtitle = `${freshChargers.length} fresh · ${staleCount} stale · ${noSignalCount} no signal`;
  const totalCurrentA = freshChargers.reduce((acc, charger) => acc + charger.telemetry.averageCurrentA, 0);
  // Derived power assuming 240V split-phase standard: P = (V * I) / 1000 kW (disclosed assumption)
  const derivedPowerKW = ((240 * totalCurrentA) / 1000).toFixed(2);

  // Recharts chart data
  const chartData = chargers.map((c) => ({
    name: `#${c.connectorId.replace('virtual-', '')}`,
    fullName: c.chargerId,
    currentA: hasFreshTelemetry(c) ? Number(c.telemetry.averageCurrentA.toFixed(2)) : null,
    status: c.configuredStatus,
    isFault: c.configuredStatus === 'FAULT',
  }));
  const hasChartTelemetry = chartData.some((charger) => charger.currentA !== null);

  const openIncidents = activeIncidents;
  const activeIncidentChargers = new Set(activeIncidents.map((incident) => incident.chargerId));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar onRefresh={() => loadData(true)} isRefreshing={isRefreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 grid-bg">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Operations Overview</h1>
          <p className="text-xs text-slate-400 mt-1">Five virtual connectors · API data refreshes every 6 seconds</p>
        </div>

        {/* Banner: Simulation & Provenance Disclosure */}
        <div className="glass-panel rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300 animate-in">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Radio size={16} className="text-cyan-400 shrink-0" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping opacity-60" />
            </div>
            <span>
              <strong className="text-slate-100">Current data:</strong>{' '}
              Synthetic virtual-charger telemetry. Historical ACN replay is separate and not active in this snapshot.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0" aria-label="Supported provenance labels">
            <span className="sr-only">Supported provenance labels</span>
            <ProvenanceBadge sourceType="ACN_REPLAY" />
            <ProvenanceBadge sourceType="DERIVED" />
            <ProvenanceBadge sourceType="SYNTHETIC" />
          </div>
        </div>

        {/* Error notification if backend unavailable */}
        {error && (
          <div
            className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between animate-in"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-400" />
              <span>
                <strong>Backend Communication Alert:</strong> {error}. {process.env.NODE_ENV === 'production' ? 'Cloud data connection is unavailable; this preview cannot display operational records yet.' : 'Ensure NestJS API is running on port 3001.'}
              </span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 rounded-lg text-[11px] font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Metric Overview Row */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Telemetry Freshness"
              value={freshnessStatus}
              variant={freshnessVariant}
              subtitle={freshnessSubtitle}
              icon={<Radio size={16} />}
              animationDelay={50}
            />
            <MetricCard
              title="Active Current"
              value={freshChargers.length > 0 ? totalCurrentA.toFixed(1) : 'N/A'}
              unit={freshChargers.length > 0 ? 'A' : undefined}
              variant="cyan"
              subtitle={freshChargers.length > 0 ? `Derived power ~${derivedPowerKW} kW (240V)` : 'No fresh telemetry to aggregate'}
              icon={<Zap size={16} />}
              animationDelay={100}
            />
            <MetricCard
              title="Connectors"
              value={`${activeCount} / ${chargers.length || 5}`}
              unit="ACTIVE"
              variant="default"
              subtitle={`${idleCount} below threshold · ${staleCount + noSignalCount} stale/unobserved`}
              icon={<Activity size={16} />}
              animationDelay={150}
            />
            <MetricCard
              title="Telemetry Records"
              value={summary?.sampleCount || 0}
              unit="SAMPLES"
              variant="default"
              subtitle="MongoDB time-series collection"
              icon={<Server size={16} />}
              animationDelay={200}
            />
          </div>
        )}

        {/* Main 2-Column Section: Live Current Chart & Quick Incident Alert */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Current Chart (2 cols) */}
          <div className="lg:col-span-2 glow-card bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm animate-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Gauge size={16} className="text-cyan-400" />
                  Charging Current by Virtual Connector
                </h2>
                <p className="text-[11px] text-slate-400/80 mt-0.5">
                  Mean amperes observed in current telemetry window
                </p>
              </div>
              <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-950/60 border border-cyan-800/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                API refresh · 6s
              </span>
            </div>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="skeleton h-48 w-full rounded-lg" />
                </div>
              ) : hasChartTelemetry ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="barGradientFault" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      unit="A"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}
                      formatter={(value, _name, entry) => [
                        `${value} A`,
                        entry.payload?.fullName || 'Current',
                      ]}
                    />
                    <Bar dataKey="currentA" radius={[6, 6, 0, 0]} name="Current (A)">
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.isFault ? 'url(#barGradientFault)' : 'url(#barGradient)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No telemetry available for this station window.
                </div>
              )}
            </div>
          </div>

          {/* Right: Active Incidents & Demo Action (1 col) */}
          <div className="glow-card bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm animate-in" style={{ animationDelay: '200ms' }}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  Active Incident Queue
                </h2>
                <Link
                  href="/incidents"
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
                >
                  View All <ArrowRight size={12} />
                </Link>
              </div>

              {openIncidents.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 mb-3 shadow-sm">
                    <CheckCircle2 size={22} />
                  </div>
                  <p className="text-xs font-medium text-slate-200">No Active Incidents</p>
                  <p className="text-[11px] text-slate-400/80 mt-1.5 max-w-[200px] leading-relaxed">
                    This does not confirm physical charger health. Check telemetry freshness below.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openIncidents.slice(0, 3).map((inc) => (
                    <div
                      key={inc._id}
                      className="p-3 rounded-lg border border-rose-900/50 bg-rose-950/20 text-xs space-y-1.5 hover:border-rose-800/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-rose-300">{inc.chargerId}</span>
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                      <p className="text-slate-300 font-medium">{inc.scenario}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{new Date(inc.detectedAt).toLocaleTimeString()}</span>
                        <Link
                          href={`/incidents?selected=${inc._id}`}
                          className="text-cyan-400 hover:underline"
                        >
                          Investigate
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Demo CTA */}
            <div className="pt-4 mt-4 border-t border-slate-800/60">
              <Link
                href="/demo"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-cyan-950 to-cyan-900 hover:from-cyan-900 hover:to-cyan-800 border border-cyan-800/60 text-cyan-300 text-xs font-medium transition-all shadow-sm hover:shadow-cyan-950/30"
              >
                <Sliders size={14} />
                Open Demo Incident Simulator
              </Link>
            </div>
          </div>
        </div>

        {/* 5 Virtual Connectors Grid */}
        <section aria-labelledby="connectors-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="connectors-heading" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server size={16} className="text-cyan-400" />
              Virtual Connectors (Station demo-station-01)
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              5 Bounded Connectors
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {chargers.map((charger, idx) => {
              const fresh = hasFreshTelemetry(charger);
              const currentA = fresh ? charger.telemetry?.averageCurrentA ?? null : null;
              const isFault = charger.configuredStatus === 'FAULT' || activeIncidentChargers.has(charger.chargerId);
              const isCharging = currentA !== null && currentA > 0.5;
              const isStale = Boolean(charger.telemetry && !fresh);
              const displayStatus = isFault
                ? 'FAULT'
                : isStale
                  ? 'WARNING'
                  : currentA === null
                    ? 'NO DATA'
                    : isCharging
                      ? 'CHARGING'
                      : 'IDLE';
              const barWidth = Math.min(100, ((currentA ?? 0) / 12) * 100); // 12A as reference max

              return (
                <Link
                  key={charger.chargerId}
                  href={`/chargers?id=${charger.chargerId}`}
                  className={`glow-card ${isFault ? 'glow-card-rose' : ''} relative overflow-hidden bg-slate-900/90 border border-slate-800 hover:border-cyan-700/50 rounded-xl p-4 transition-all shadow-sm group focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none flex flex-col justify-between animate-in`}
                  style={{ animationDelay: `${250 + idx * 50}ms` }}
                >
                  {/* Subtle top gradient accent */}
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

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                        {charger.chargerId}
                      </span>
                      <StatusBadge status={displayStatus} size="sm" />
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Mean current</span>
                      <span className={`text-lg font-bold font-mono tabular-nums ${isFault ? 'text-rose-400' : 'text-slate-100'}`}>
                        {currentA === null ? 'N/A' : <>{currentA.toFixed(1)} <span className="text-xs text-slate-400 font-normal">A</span></>}
                      </span>
                    </div>

                    {/* Mini current bar */}
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isFault ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-cyan-400'
                        }`}
                        style={{ width: `${barWidth}%` }}
                        role="meter"
                        aria-valuenow={currentA ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={12}
                        aria-label={currentA === null ? `${charger.chargerId} current unavailable` : `${charger.chargerId} current: ${currentA.toFixed(1)} A`}
                      />
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {isStale ? 'Stale >60s' : charger.telemetry?.lastSeenAt
                        ? new Date(charger.telemetry.lastSeenAt).toLocaleTimeString()
                        : 'No signal'}
                    </span>
                    <ArrowRight size={12} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
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
          <p className="text-[10px] text-slate-600">
            Powered by MongoDB Atlas · Datadog US1 · NestJS · Next.js
          </p>
        </footer>
      </main>
    </div>
  );
}
