'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { api, Incident } from '@/lib/api';
import { errorMessage, startPolling } from '@/lib/utils';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';

function IncidentsContent() {
  const searchParams = useSearchParams();
  const selectedParam = searchParams.get('selected');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs keep the polling callback stable while still reading the latest
  // selection, so the interval isn't torn down and rebuilt on every update.
  const selectedRef = useRef<Incident | null>(null);
  useEffect(() => {
    selectedRef.current = selectedIncident;
  }, [selectedIncident]);
  const autoSelectedRef = useRef(false);

  const loadData = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      try {
        const incs = await api.getIncidents();
        setIncidents(incs);

        // Refresh the currently selected incident so its audit timeline stays
        // live across polls, without overriding a manual selection.
        const currentId = selectedRef.current?._id ?? selectedParam;
        if (currentId && incs.some((i) => i._id === currentId)) {
          const detail = await api.getIncident(currentId);
          setSelectedIncident(detail);
        } else if (!autoSelectedRef.current && incs.length > 0) {
          // First load only: auto-select the most recent incident.
          autoSelectedRef.current = true;
          const detail = await api.getIncident(incs[0]._id);
          setSelectedIncident(detail);
        } else if (selectedParam) {
          autoSelectedRef.current = true;
        }
        setError(null);
        setLastUpdated(new Date());
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to load incidents queue'));
      } finally {
        setLoading(false);
        if (isManual) setIsRefreshing(false);
      }
    },
    [selectedParam],
  );

  useEffect(() => startPolling(loadData, 7000), [loadData]);

  const selectIncident = async (id: string) => {
    try {
      const detail = await api.getIncident(id);
      setSelectedIncident(detail);
      setActionSuccess(null);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load incident details'));
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    setActionSuccess(null);
    try {
      await api.acknowledgeIncident(selectedIncident._id, 'operator-console');
      setActionSuccess(`Incident ${selectedIncident._id} acknowledged. Status set to ACKNOWLEDGED.`);
      await selectIncident(selectedIncident._id);
      await loadData();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to acknowledge incident'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    setActionSuccess(null);
    try {
      await api.resolveIncident(selectedIncident._id, 'operator-console');
      setActionSuccess(`Incident ${selectedIncident._id} marked as RESOLVED.`);
      await selectIncident(selectedIncident._id);
      await loadData();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to resolve incident'));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredIncidents = incidents.filter((i) => {
    if (statusFilter === 'ALL') return true;
    return i.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar onRefresh={() => loadData(true)} isRefreshing={isRefreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <AlertOctagon size={20} className="text-rose-400" />
              Incident Management & Response Queue
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Full lifecycle tracking: DETECT → INVESTIGATE → RESOLVE with append-only API audit actions in MongoDB
            </p>
          </div>

          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-medium self-start sm:self-auto transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Sliders size={14} />
            Simulate New Incident
          </Link>
        </div>

        {/* Feedback alerts */}
        {actionSuccess && (
          <div role="status" className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              {actionSuccess}
            </span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              {error}
            </span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVING', 'RESOLVED'].map((filter) => {
            const count =
              filter === 'ALL'
                ? incidents.length
                : incidents.filter((i) => i.status === filter).length;
            const active = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{filter}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2-Column Layout: Incident Queue & Detail Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Incident List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800">
                Loading incidents queue…
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800">
                No incidents found for filter &ldquo;{statusFilter}&rdquo;.
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const active = selectedIncident?._id === inc._id;
                return (
                  <button
                    type="button"
                    key={inc._id}
                    onClick={() => selectIncident(inc._id)}
                    aria-pressed={active}
                    className={`w-full text-left p-4 rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none ${
                      active
                        ? 'bg-slate-900 border-cyan-500 shadow-sm shadow-cyan-950/40'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-slate-200">{inc._id}</span>
                      <StatusBadge status={inc.status} size="sm" />
                    </div>

                    <div className="text-xs font-medium text-slate-100">{inc.scenario}</div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80">
                      <span>Charger: <strong className="text-slate-300">{inc.chargerId}</strong></span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(inc.detectedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Selected Incident Detail & Action Timeline (7 cols) */}
          <div className="lg:col-span-7">
            {selectedIncident ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-sm space-y-5">
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold font-mono text-slate-100">{selectedIncident._id}</h2>
                      <StatusBadge status={selectedIncident.status} />
                      {selectedIncident.synthetic && <ProvenanceBadge sourceType="SYNTHETIC" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Scenario: <strong className="text-slate-200">{selectedIncident.scenario}</strong> • Target: <strong className="text-cyan-400">{selectedIncident.chargerId}</strong>
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {selectedIncident.status === 'OPEN' && (
                      <button
                        onClick={handleAcknowledge}
                        disabled={process.env.NODE_ENV === 'production' || actionLoading}
                        className="px-3 py-1.5 rounded-md bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-800 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving…' : 'Acknowledge'}
                      </button>
                    )}

                    {selectedIncident.status === 'RESOLVING' && selectedIncident.recoveryTelemetryAt && (
                      <button
                        onClick={handleResolve}
                        disabled={process.env.NODE_ENV === 'production' || actionLoading}
                        className="px-3 py-1.5 rounded-md bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving…' : 'Resolve Incident'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Datadog Correlation Note */}
                <div className="bg-slate-950/80 border border-slate-800 rounded p-3 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px] text-cyan-400 font-semibold">
                    <span>Recorded Datadog US1 Correlation</span>
                    <span>Monitor IDs: 334137536 / 334137944</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Historical monitor query; verify its current status and alert delivery directly in Datadog US1:
                    <code className="mt-1 block w-full max-w-full text-slate-300 break-all">sum(last_1m):sum:chargeguard.fault.simulated{'{'}service:chargeguard-api{'}'}.as_count() &gt;= 1</code>
                  </p>
                </div>

                {/* Audit Action Timeline */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-cyan-400" />
                    Incident Audit Action Timeline
                  </h3>

                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                    {selectedIncident.actions && selectedIncident.actions.length > 0 ? (
                      selectedIncident.actions.map((act, idx) => (
                        <div key={idx} className="relative flex items-start gap-3 pl-1">
                          <div className="w-5 h-5 rounded-full bg-slate-900 border border-cyan-500 flex items-center justify-center shrink-0 z-10 text-[10px] font-bold text-cyan-400">
                            {idx + 1}
                          </div>
                          <div className="bg-slate-950/80 border border-slate-800/80 rounded p-2.5 flex-1 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-bold text-slate-200 uppercase text-[11px]">
                                {act.action}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {new Date(act.at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Actor: <span className="text-slate-300">{act.actor}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 pl-8">
                        No secondary actions logged yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence Details */}
                <div className="pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Diagnostic Telemetry Evidence
                  </h3>
                  <div className="bg-slate-950/80 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-300 space-y-1">
                    <div>Detected Timestamp: <span className="text-cyan-400">{new Date(selectedIncident.detectedAt).toISOString()}</span></div>
                    {selectedIncident.acknowledgedAt && (
                      <div>Acknowledged At: <span className="text-amber-400">{new Date(selectedIncident.acknowledgedAt).toISOString()}</span></div>
                    )}
                    {selectedIncident.resolvedAt && (
                      <div>Resolved At: <span className="text-emerald-400">{new Date(selectedIncident.resolvedAt).toISOString()}</span></div>
                    )}
                    <div>Telemetry State: <span className="text-rose-400">Synthetic FAULT (Current = 0 A)</span></div>
                    <div>Fault Code: <span className="text-rose-400">{selectedIncident.evidence?.[0]?.faultCode ?? 'Unavailable'}</span></div>
                    <div className="font-sans text-slate-400">{selectedIncident.evidence?.[0]?.detail ?? 'No diagnostic evidence recorded.'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-12 text-center text-xs text-slate-400">
                Select an incident from the queue to view full investigation timeline and resolution controls.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading Incidents…</div>}>
      <IncidentsContent />
    </Suspense>
  );
}
