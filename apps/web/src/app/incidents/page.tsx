'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { Notice } from '@/components/Notice';
import { LockedAction } from '@/components/LockedAction';
import { LifecycleStepper } from '@/components/LifecycleStepper';
import { api, Incident } from '@/lib/api';
import { errorMessage, startPolling } from '@/lib/utils';
import {
  AUDIT_ACTION_LABEL,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUS_STEPS,
  SCENARIOS,
  scenarioLabel,
  timeAgo,
} from '@/lib/labels';
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ShieldCheck,
  Plus,
  X,
  Lightbulb,
  Loader2,
} from 'lucide-react';

const STATUS_RAIL: Record<string, string> = {
  OPEN: 'bg-rose-500',
  ACKNOWLEDGED: 'bg-amber-400',
  RESOLVING: 'bg-amber-400',
  RESOLVED: 'bg-emerald-500',
};

/** Plain-language guidance for what should happen next in the lifecycle. */
function nextStepHint(incident: Incident): string {
  switch (incident.status) {
    case 'OPEN':
      return 'Acknowledge this incident to take ownership and start the investigation.';
    case 'ACKNOWLEDGED':
      return 'Waiting for recovery telemetry from the connector. In a drill, send it from the Incident Drill page.';
    case 'RESOLVING':
      return incident.recoveryTelemetryAt
        ? 'Recovery telemetry received. Confirm the connector is healthy, then resolve to close the incident.'
        : 'Waiting for recovery telemetry before the incident can be resolved.';
    case 'RESOLVED':
      return 'Incident closed. The full audit trail is preserved below.';
    default:
      return '';
  }
}

function IncidentsContent() {
  const searchParams = useSearchParams();
  const selectedParam = searchParams.get('selected');
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const operatorActor = session?.user?.email || 'operator@chargeguard.com';
  const mutationsLocked = process.env.NODE_ENV === 'production';

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportChargerIndex, setReportChargerIndex] = useState(1);
  const [reportScenario, setReportScenario] = useState('SIM_OVERHEAT');
  const [reportLoading, setReportLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const modalFirstFieldRef = useRef<HTMLSelectElement>(null);

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

  // Modal: Escape closes, first field receives focus.
  useEffect(() => {
    if (!showReportModal) return;
    modalFirstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !reportLoading) setShowReportModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showReportModal, reportLoading]);

  const selectIncident = async (id: string, reveal = false) => {
    try {
      const detail = await api.getIncident(id);
      setSelectedIncident(detail);
      setActionSuccess(null);
      // On stacked (mobile/tablet) layouts, bring the detail panel into view.
      if (reveal && typeof window !== 'undefined' && window.innerWidth < 1024) {
        requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to load incident details'));
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportLoading(true);
    setError(null);
    try {
      const res = await api.triggerFault(reportChargerIndex, reportScenario);
      setShowReportModal(false);
      setStatusFilter('ALL');
      // Load the full incident (with its audit trail), not the list summary,
      // so the detail panel shows the "Fault detected" entry immediately.
      // (selectIncident clears the success banner, so set it afterwards.)
      if (res.incidentId) await selectIncident(res.incidentId);
      setActionSuccess(`${scenarioLabel(res.scenario)} reported on ${res.chargerId}. It is now at the top of the queue.`);
      await loadData();
    } catch (err) {
      setError(errorMessage(err, 'Failed to dispatch incident report'));
    } finally {
      setReportLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedIncident) return;
    setActionLoading(true);
    setActionSuccess(null);
    try {
      await api.acknowledgeIncident(selectedIncident._id, operatorActor);
      await selectIncident(selectedIncident._id);
      setActionSuccess(`Acknowledged. You now own incident ${selectedIncident._id}.`);
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
      await api.resolveIncident(selectedIncident._id, operatorActor);
      await selectIncident(selectedIncident._id);
      setActionSuccess(`Incident ${selectedIncident._id} resolved and closed.`);
      await loadData();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to resolve incident'));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredIncidents = incidents.filter((i) => statusFilter === 'ALL' || i.status === statusFilter);
  const now = lastUpdated?.getTime();
  const stepIndex = selectedIncident
    ? Math.max(0, INCIDENT_STATUS_STEPS.indexOf(selectedIncident.status))
    : 0;
  const canAcknowledge = selectedIncident?.status === 'OPEN';
  const canResolve = selectedIncident?.status === 'RESOLVING' && Boolean(selectedIncident.recoveryTelemetryAt);

  const reportButton = isAuthenticated ? (
    <button
      type="button"
      onClick={() => setShowReportModal(true)}
      disabled={mutationsLocked}
      title={mutationsLocked ? 'Read-only in the production preview' : undefined}
      className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus size={14} aria-hidden="true" />
      Report incident
    </button>
  ) : (
    <LockedAction action="Report incidents" />
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <Navbar onRefresh={() => loadData(true)} isRefreshing={isRefreshing} lastUpdated={lastUpdated} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              <AlertOctagon size={20} className="text-rose-400" aria-hidden="true" />
              Incidents
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Triage queue for charger faults. Each incident moves Open → Acknowledged → Resolving → Resolved, and every action is audit-logged in MongoDB Atlas.
            </p>
          </div>
          <div className="self-start sm:self-auto">{reportButton}</div>
        </div>

        {/* Feedback alerts */}
        {actionSuccess && (
          <Notice tone="success" onDismiss={() => setActionSuccess(null)}>
            {actionSuccess}
          </Notice>
        )}
        {error && (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        )}

        {/* Status Filter Tabs */}
        <div role="toolbar" aria-label="Filter incidents by status" className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto pb-1">
          {['ALL', ...INCIDENT_STATUS_STEPS].map((filter) => {
            const count = filter === 'ALL' ? incidents.length : incidents.filter((i) => i.status === filter).length;
            const active = statusFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-cyan-950/70 text-cyan-200 border-cyan-700/70'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                {filter !== 'ALL' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_RAIL[filter]}`} aria-hidden="true" />}
                <span>{INCIDENT_STATUS_LABEL[filter]}</span>
                <span
                  className={`min-w-5 text-center text-[10px] font-mono px-1.5 py-px rounded-full ${
                    active ? 'bg-cyan-900/70 text-cyan-100' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Whole-queue empty state */}
        {!loading && incidents.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-14 text-center flex flex-col items-center animate-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 mb-4">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">No incidents on record</h2>
            <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">
              All connectors are operating without reported faults. When a fault is detected or reported, it appears here for triage.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
              >
                Run an incident drill <ArrowRight size={13} aria-hidden="true" />
              </Link>
              {reportButton}
            </div>
          </div>
        ) : (
          /* 2-Column Layout: Incident Queue & Detail */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            {/* Left: Incident List */}
            <section aria-label="Incident queue" className="lg:col-span-5 xl:col-span-4 space-y-2.5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[92px] rounded-lg" aria-hidden="true" />)
              ) : filteredIncidents.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40">
                  <p className="text-xs text-slate-300">No {INCIDENT_STATUS_LABEL[statusFilter].toLowerCase()} incidents.</p>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className="mt-2 text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
                  >
                    Show all incidents
                  </button>
                </div>
              ) : (
                filteredIncidents.map((inc) => {
                  const active = selectedIncident?._id === inc._id;
                  return (
                    <button
                      type="button"
                      key={inc._id}
                      onClick={() => selectIncident(inc._id, true)}
                      aria-pressed={active}
                      className={`relative w-full overflow-hidden text-left pl-4 pr-3.5 py-3 rounded-lg border transition-colors ${
                        active
                          ? 'bg-slate-900 border-cyan-600/80 ring-1 ring-cyan-600/40'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_RAIL[inc.status] ?? 'bg-slate-700'}`} aria-hidden="true" />
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100 leading-tight">{scenarioLabel(inc.scenario)}</span>
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                        <span className="truncate text-slate-300">{inc.chargerId}</span>
                        <span className="flex items-center gap-1 shrink-0" title={new Date(inc.detectedAt).toLocaleString()}>
                          <Clock size={11} aria-hidden="true" />
                          {timeAgo(inc.detectedAt, now)}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] font-mono text-slate-500 truncate">{inc._id}</div>
                    </button>
                  );
                })
              )}
            </section>

            {/* Right: Selected Incident Detail */}
            <div ref={detailRef} className="lg:col-span-7 xl:col-span-8 scroll-mt-20">
              {loading ? (
                <div className="skeleton h-80 rounded-xl" aria-hidden="true" />
              ) : selectedIncident ? (
                <article
                  aria-labelledby="incident-detail-title"
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-5"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id="incident-detail-title" className="text-base font-semibold text-slate-100">
                          {scenarioLabel(selectedIncident.scenario)}
                        </h2>
                        <StatusBadge status={selectedIncident.status} />
                        {selectedIncident.synthetic && <ProvenanceBadge sourceType="SYNTHETIC" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          Connector{' '}
                          <Link href={`/chargers?id=${selectedIncident.chargerId}`} className="font-mono text-cyan-400 hover:text-cyan-300 hover:underline">
                            {selectedIncident.chargerId}
                          </Link>
                        </span>
                        <span>Detected {timeAgo(selectedIncident.detectedAt, now)}</span>
                        <span className="font-mono text-slate-500">{selectedIncident._id}</span>
                      </p>
                    </div>

                    {/* Actions */}
                    {(canAcknowledge || canResolve) && (
                      <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
                        {isAuthenticated ? (
                          <button
                            type="button"
                            onClick={canAcknowledge ? handleAcknowledge : handleResolve}
                            disabled={mutationsLocked || actionLoading}
                            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              canAcknowledge
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {actionLoading ? (
                              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 size={14} aria-hidden="true" />
                            )}
                            {actionLoading ? 'Saving…' : canAcknowledge ? 'Acknowledge' : 'Resolve incident'}
                          </button>
                        ) : (
                          <LockedAction action={canAcknowledge ? 'Acknowledge' : 'Resolve'} />
                        )}
                        {isAuthenticated && mutationsLocked && (
                          <span className="text-[10px] text-slate-500">Read-only in production preview</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Lifecycle progress + next step */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                    <LifecycleStepper
                      ariaLabel="Incident lifecycle"
                      current={stepIndex}
                      complete={selectedIncident.status === 'RESOLVED'}
                      steps={[
                        { label: 'Open', caption: 'Detect', tone: 'rose' },
                        { label: 'Acknowledged', caption: 'Own', tone: 'amber' },
                        { label: 'Resolving', caption: 'Recover', tone: 'amber' },
                        { label: 'Resolved', caption: 'Close', tone: 'emerald' },
                      ]}
                    />
                    <p className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                      <Lightbulb size={14} className="mt-px shrink-0 text-cyan-400" aria-hidden="true" />
                      <span>
                        <span className="font-semibold text-slate-100">Next step: </span>
                        {nextStepHint(selectedIncident)}
                        {!isAuthenticated && selectedIncident.status !== 'RESOLVED' && (
                          <span className="text-slate-400"> Guests can follow along; operator sign-in is needed to act.</span>
                        )}
                      </span>
                    </p>
                  </div>

                  {/* Audit Action Timeline */}
                  <section aria-labelledby="audit-heading">
                    <h3 id="audit-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-cyan-400" aria-hidden="true" />
                      Audit trail
                    </h3>
                    {selectedIncident.actions && selectedIncident.actions.length > 0 ? (
                      <ol className="relative space-y-2.5 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-slate-800">
                        {selectedIncident.actions.map((act, idx) => (
                          <li key={act._id ?? idx} className="relative flex items-start gap-3">
                            <span className="mt-2 w-[19px] h-[19px] rounded-full bg-slate-900 border border-cyan-600 flex items-center justify-center shrink-0 z-10 text-[9px] font-bold text-cyan-300">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/70 px-3 py-2">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <span className="text-xs font-semibold text-slate-200">
                                  {AUDIT_ACTION_LABEL[act.action] ?? act.action}
                                </span>
                                <time className="font-mono text-[10px] text-slate-400" dateTime={act.at} title={new Date(act.at).toISOString()}>
                                  {new Date(act.at).toLocaleTimeString()}
                                </time>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                by <span className="text-slate-300">{act.actor}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-slate-400">No actions logged yet.</p>
                    )}
                  </section>

                  {/* Evidence */}
                  <section aria-labelledby="evidence-heading" className="pt-4 border-t border-slate-800">
                    <h3 id="evidence-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Diagnostic evidence
                    </h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-[11px]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Detected</dt>
                        <dd className="font-mono text-slate-200 tabular-nums">{new Date(selectedIncident.detectedAt).toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Telemetry state</dt>
                        <dd className="font-mono text-rose-300">Synthetic FAULT · 0 A</dd>
                      </div>
                      {selectedIncident.acknowledgedAt && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-400">Acknowledged</dt>
                          <dd className="font-mono text-amber-300 tabular-nums">{new Date(selectedIncident.acknowledgedAt).toLocaleString()}</dd>
                        </div>
                      )}
                      {selectedIncident.resolvedAt && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-400">Resolved</dt>
                          <dd className="font-mono text-emerald-300 tabular-nums">{new Date(selectedIncident.resolvedAt).toLocaleString()}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Fault code</dt>
                        <dd className="font-mono text-rose-300">{selectedIncident.evidence?.[0]?.faultCode ?? 'Unavailable'}</dd>
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-slate-800/70 text-slate-400 leading-relaxed">
                        {selectedIncident.evidence?.[0]?.detail ?? 'No diagnostic evidence recorded.'}
                      </div>
                    </dl>
                  </section>

                  {/* Datadog correlation (secondary detail) */}
                  <details className="group rounded-lg border border-slate-800 bg-slate-950/50 text-xs">
                    <summary className="flex items-center justify-between gap-2 px-3 py-2.5 list-none [&::-webkit-details-marker]:hidden">
                      <span className="font-medium text-slate-300">Datadog monitor correlation</span>
                      <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="px-3 pb-3 space-y-1.5 text-[11px] text-slate-400">
                      <p>
                        Monitor IDs <span className="font-mono text-slate-300">334137536</span> /{' '}
                        <span className="font-mono text-slate-300">334137944</span> (Datadog US1). Recorded query — verify current status and alert delivery directly in Datadog:
                      </p>
                      <code className="block w-full max-w-full rounded bg-slate-900 px-2 py-1.5 text-slate-300 break-all">
                        sum(last_1m):sum:chargeguard.fault.simulated{'{'}service:chargeguard-api{'}'}.as_count() &gt;= 1
                      </code>
                    </div>
                  </details>
                </article>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center text-xs text-slate-400">
                  Select an incident from the queue to see its lifecycle, audit trail and actions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Incident Modal */}
        {showReportModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !reportLoading) setShowReportModal(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-modal-title"
              className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="report-modal-title" className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <AlertOctagon size={18} className="text-rose-400" aria-hidden="true" />
                    Report an incident
                  </h2>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Log a fault reported by a technician or driver. It opens a new incident in the queue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="-m-1 p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label htmlFor="report-charger" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Connector
                  </label>
                  <select
                    id="report-charger"
                    ref={modalFirstFieldRef}
                    value={reportChargerIndex}
                    onChange={(e) => setReportChargerIndex(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        demo-charger-0{n} · Connector #{n} (11 kW)
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset>
                  <legend className="block text-xs font-medium text-slate-300 mb-1.5">What happened?</legend>
                  <div className="space-y-2">
                    {SCENARIOS.map((sc) => (
                      <label
                        key={sc.code}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          reportScenario === sc.code ? 'border-rose-600/70 bg-rose-950/30' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-scenario"
                          value={sc.code}
                          checked={reportScenario === sc.code}
                          onChange={() => setReportScenario(sc.code)}
                          className="mt-0.5 accent-rose-500"
                        />
                        <span>
                          <span className="block text-xs font-medium text-slate-100">{sc.label}</span>
                          <span className="block text-[11px] text-slate-400">{sc.detail}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Creates a new incident and an append-only audit entry in MongoDB Atlas.
                </p>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2.5 sm:py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportLoading}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors disabled:opacity-60"
                  >
                    {reportLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                    {reportLoading ? 'Reporting…' : 'Report incident'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Loading incidents…</div>}>
      <IncidentsContent />
    </Suspense>
  );
}
