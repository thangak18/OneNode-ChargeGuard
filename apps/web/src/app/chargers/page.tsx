'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { api, Charger, TelemetryReading, Incident } from '@/lib/api';
import { errorMessage, startPolling } from '@/lib/utils';
import {
  Activity,
  AlertOctagon,
  Server,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function ChargerDetailContent() {
  const searchParams = useSearchParams();
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
        api.getIncidents(undefined, targetId).catch(() => []),
      ]);
      setCharger(chargerDetail);
      setChargerIncidents(incs);

      // Fetch 24-hour history for time-series chart
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const hist = await api.getTelemetryHistory(targetId, from, to, 100).catch(() => []);
      setHistory(hist);

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
  const derivedPowerKW = currentA === undefined ? null : ((240 * currentA) / 1000).toFixed(2);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar onRefresh={() => loadData(true)} isRefreshing={isRefreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Charger Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mr-2 shrink-0">
            Select Connector:
          </span>
          {chargers.map((c) => {
            const active = c._id === selectedId;
            return (
              <button
                key={c._id}
                onClick={() => setSelectedId(c._id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 shrink-0 ${
                  active
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-sm'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {c._id}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between"
            role="alert"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {/* Charger Header Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg font-bold font-mono text-slate-100">{selectedId}</h1>
                <StatusBadge status={latestReading?.chargingState || charger?.status || 'UNKNOWN'} />
                {latestReading?.provenance?.sourceType && (
                  <ProvenanceBadge sourceType={latestReading.provenance.sourceType} />
                )}
                {isStale && <StatusBadge status="WARNING" size="sm" />}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span>Station: <strong>{charger?.stationId ?? 'N/A'}</strong></span>
                <span>•</span>
                <span>Connector Port: <strong>{charger?.connectorId ?? 'N/A'}</strong></span>
                <span>•</span>
                <span>Rated Limit: <strong>{charger?.ratedPowerKW ?? 'N/A'}{charger?.ratedPowerKW ? ' kW (Simulation)' : ''}</strong></span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Last telemetry: {latestSeenAt && Number.isFinite(latestSeenAt.getTime()) ? latestSeenAt.toLocaleString() : 'Unavailable'}
                {isStale ? ' · Stale (>60 seconds)' : ''}
              </p>
            </div>

            {/* Live Current Reading */}
            <div className="flex items-baseline gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-md self-start md:self-auto">
              <span className="text-xs font-mono text-slate-400 uppercase">Live Output</span>
              <span className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                {currentA === undefined ? (
                  'N/A'
                ) : (
                  <>
                    {currentA.toFixed(2)} <span className="text-sm font-normal text-slate-400">A</span>
                  </>
                )}
              </span>
              <span className="text-xs font-mono text-slate-400">
                ({derivedPowerKW === null ? 'N/A' : `~${derivedPowerKW} kW`})
              </span>
            </div>
          </div>
        </div>

        {/* Main Telemetry Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                Historical Telemetry Stream (Amperes over Time)
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                MongoDB time-series collection <code className="text-cyan-400">telemetry</code>
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {history.length} data points
            </span>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Loading time-series history…
              </div>
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
                      borderRadius: '0.375rem',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                    formatter={(value) => [`${value} A`, 'Current']}
                  />
                  <Area
                    type="monotone"
                    dataKey="currentA"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#currentGradient)"
                    name="Current (A)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No telemetry points recorded in the last 24 hours for {selectedId}.
              </div>
            )}
          </div>
        </div>

        {/* Sensor Channels & Provenance Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Server size={16} className="text-cyan-400" />
              Sensor Channels & Data Provenance Lineage
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Schema Disclosures
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
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
                    {latestReading?.currentA === undefined ? 'UNAVAILABLE' : <ProvenanceBadge sourceType={latestReading.provenance.sourceType} />}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Measured current from Caltech ACN-Data sample or synthetic stimulus.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Charging State</td>
                  <td className="px-4 py-3">{latestReading?.chargingState ? <StatusBadge status={latestReading.chargingState} size="sm" /> : 'N/A'}</td>
                  <td className="px-4 py-3"><ProvenanceBadge sourceType="DERIVED" /></td>
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
                    {latestReading?.sourceEnergyKWh !== undefined ? <ProvenanceBadge sourceType={latestReading.provenance.sourceType} /> : 'UNAVAILABLE'}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Reported counter from source. Resets/decreases flagged automatically.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Voltage (V)</td>
                  <td className="px-4 py-3 text-slate-400 italic">N/A (Unavailable)</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-slate-400">UNMEASURED</span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Not measured by ACN-Data source. Omitted rather than fabricated.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Power (kW)</td>
                  <td className="px-4 py-3 tabular-nums">{derivedPowerKW === null ? 'N/A' : `~${derivedPowerKW} kW`}</td>
                  <td className="px-4 py-3">{derivedPowerKW === null ? 'UNAVAILABLE' : <ProvenanceBadge sourceType="DERIVED" />}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Estimated using standard 240V split-phase calculation ($P = V \times I / 1000$).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-200">Temperature (°C)</td>
                  <td className="px-4 py-3 text-slate-400 italic">
                    {latestReading?.faultCode ? 'SIMULATED FAULT' : 'N/A (Unmeasured)'}
                  </td>
                  <td className="px-4 py-3">{latestReading?.faultCode ? <ProvenanceBadge sourceType="SYNTHETIC" /> : 'UNMEASURED'}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-sans">
                    Synthetic fault signal only; EV hardware temperature sensors not connected.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Associated Incidents */}
        {chargerIncidents.length > 0 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertOctagon size={16} className="text-rose-400" />
              Incident History for {selectedId}
            </h2>
            <div className="space-y-2">
              {chargerIncidents.map((inc) => (
                <div
                  key={inc._id}
                  className="p-3 rounded border border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">{inc._id}</span>
                      <StatusBadge status={inc.status} size="sm" />
                      <span className="text-slate-400 font-mono text-[11px] break-all">{inc.scenario}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Detected: {new Date(inc.detectedAt).toLocaleString()}
                      {inc.resolvedAt && ` • Resolved: ${new Date(inc.resolvedAt).toLocaleString()}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ChargerDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading Charger Detail…</div>}>
      <ChargerDetailContent />
    </Suspense>
  );
}
