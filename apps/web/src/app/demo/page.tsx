'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { startPolling } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Notice } from '@/components/Notice';
import { LockedAction } from '@/components/LockedAction';
import { LifecycleStepper } from '@/components/LifecycleStepper';
import { api, Incident } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { SCENARIOS, scenarioLabel } from '@/lib/labels';
import {
  Sliders,
  AlertOctagon,
  CheckCircle2,
  Play,
  RotateCcw,
  Info,
  ArrowRight,
  Zap,
  Lock,
  Loader2,
} from 'lucide-react';

const STEP_GUIDE: Record<1 | 2 | 3 | 4, { title: string; body: string }> = {
  1: {
    title: 'Baseline — all connectors normal',
    body: 'Every connector emits a steady synthetic 8.25 A. Pick a connector and a failure scenario, then inject a fault.',
  },
  2: {
    title: 'Fault detected',
    body: 'Current on the target connector drops to 0 A and an incident opens. Acknowledge it, then send recovery telemetry.',
  },
  3: {
    title: 'Recovering',
    body: 'Recovery telemetry is flowing. Check the connector is healthy (and the Datadog monitor has recovered), then close the incident.',
  },
  4: {
    title: 'Resolved — drill complete',
    body: 'The incident is closed with a full audit trail. Reset to baseline to run another drill.',
  },
};

export default function DemoPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const operatorActor = session?.user?.email || 'operator@chargeguard.com';
  const mutationsLocked = process.env.NODE_ENV === 'production';
  const [selectedChargerIndex, setSelectedChargerIndex] = useState(1);
  const [scenario, setScenario] = useState('SIM_OVERHEAT');
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll active incident if present
  useEffect(() => {
    if (!activeIncidentId) return;
    return startPolling(async () => {
      try {
        const inc = await api.getIncident(activeIncidentId);
        setActiveIncident(inc);
        setError(null);
        if (inc.status === 'RESOLVED') {
          setStep(4);
        } else if (inc.status === 'RESOLVING') {
          setStep(3);
        } else if (inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED') {
          setStep(2);
        }
      } catch {
        setError('Unable to refresh the active incident. Check the API connection and retry.');
      }
    }, 4000);
  }, [activeIncidentId]);

  const handleTriggerFault = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await api.triggerFault(selectedChargerIndex, scenario);
      setActiveIncidentId(res.incidentId);
      setStep(res.status === 'RESOLVING' ? 3 : res.status === 'RESOLVED' ? 4 : 2);
      setStatusMessage(res.message);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to trigger synthetic fault'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!activeIncidentId) return;
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      await api.acknowledgeIncident(activeIncidentId, operatorActor);
      setStatusMessage(`Incident ${activeIncidentId} acknowledged by operator.`);
      try {
        const inc = await api.getIncident(activeIncidentId);
        setActiveIncident(inc);
      } catch (err: unknown) {
        setError(`Acknowledgement was recorded, but incident details could not be refreshed: ${errorMessage(err, 'refresh failed')}`);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to acknowledge incident'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!activeIncidentId) return;
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await api.recoverFault(activeIncidentId);
      setStep(3);
      setStatusMessage(res.message);
      try {
        const inc = await api.getIncident(activeIncidentId);
        setActiveIncident(inc);
      } catch (err: unknown) {
        setError(`Recovery telemetry was submitted, but incident details could not be refreshed: ${errorMessage(err, 'refresh failed')}`);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to send recovery telemetry'));
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!activeIncidentId) return;
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      await api.resolveIncident(activeIncidentId, operatorActor);
      setStep(4);
      setStatusMessage(`Incident ${activeIncidentId} resolved and lifecycle closed with audit evidence.`);
      try {
        const inc = await api.getIncident(activeIncidentId);
        setActiveIncident(inc);
      } catch (err: unknown) {
        setError(`Incident resolution was recorded, but incident details could not be refreshed: ${errorMessage(err, 'refresh failed')}`);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to resolve incident'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await api.resetBaseline();
      if (!res.success) throw new Error(res.message || 'The API did not confirm the baseline reset.');
      setActiveIncidentId(null);
      setActiveIncident(null);
      setStep(1);
      setStatusMessage(res.message);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to reset baseline'));
    } finally {
      setLoading(false);
    }
  };

  const drillInProgress = Boolean(activeIncident && activeIncident.status !== 'RESOLVED');
  const canAcknowledge = activeIncident?.status === 'OPEN';
  const canRecover = Boolean(
    activeIncident &&
      (activeIncident.status === 'ACKNOWLEDGED' || (activeIncident.status === 'RESOLVING' && !activeIncident.recoveryTelemetryAt)),
  );
  const canResolve = Boolean(activeIncident && activeIncident.status === 'RESOLVING' && activeIncident.recoveryTelemetryAt);
  const guide = STEP_GUIDE[step];
  const selectedScenario = SCENARIOS.find((s) => s.code === scenario);

  const btnBase =
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const spinner = <Loader2 size={14} className="animate-spin" aria-hidden="true" />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <Navbar />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              <Sliders size={20} className="text-cyan-400" aria-hidden="true" />
              Incident Drill
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Rehearse the full response loop — detect, investigate, resolve — on a simulated fault. No physical equipment is affected.
            </p>
          </div>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={mutationsLocked || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium self-start transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset to baseline
            </button>
          ) : (
            <LockedAction action="Reset baseline" className="self-start" />
          )}
        </div>

        {/* Context: sandbox + role, in one compact card */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs">
          <Info size={16} className="hidden sm:block shrink-0 text-cyan-400" aria-hidden="true" />
          <p className="flex-1 text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-100">Safe sandbox.</span> Faults are software stimuli injected into the telemetry pipeline and logged in MongoDB Atlas.{' '}
            {isAuthenticated ? (
              <span className="text-emerald-300">You&apos;re signed in as an operator — all drill controls are enabled.</span>
            ) : (
              <span className="text-amber-300">You&apos;re viewing as a guest — sign in as an operator to run the drill.</span>
            )}
          </p>
          {!isAuthenticated && (
            <Link
              href="/login?callbackUrl=%2Fdemo"
              className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
            >
              <Lock size={12} aria-hidden="true" />
              Sign in
            </Link>
          )}
        </div>

        {/* Feedback */}
        {statusMessage && (
          <Notice tone="success" onDismiss={() => setStatusMessage(null)}>
            {statusMessage}
          </Notice>
        )}
        {error && (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        )}

        {/* Lifecycle progress + "what now" */}
        <section aria-labelledby="drill-progress-heading" className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 space-y-5">
          <h2 id="drill-progress-heading" className="sr-only">Drill progress</h2>
          <LifecycleStepper
            ariaLabel="Drill lifecycle"
            current={step - 1}
            complete={step === 4}
            steps={[
              { label: 'Baseline', caption: 'Normal', tone: 'cyan' },
              { label: 'Fault', caption: 'Detect', tone: 'rose' },
              { label: 'Recovery', caption: 'Investigate', tone: 'amber' },
              { label: 'Resolved', caption: 'Close', tone: 'emerald' },
            ]}
          />
          <div
            aria-live="polite"
            className={`rounded-lg border px-4 py-3 ${
              step === 1
                ? 'border-cyan-800/50 bg-cyan-950/20'
                : step === 2
                  ? 'border-rose-800/60 bg-rose-950/25'
                  : step === 3
                    ? 'border-amber-800/60 bg-amber-950/20'
                    : 'border-emerald-800/60 bg-emerald-950/25'
            }`}
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Step {step} of 4</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">{guide.title}</p>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">{guide.body}</p>
          </div>
        </section>

        {/* Controls */}
        <section aria-labelledby="drill-controls-heading" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm space-y-5">
          <h2 id="drill-controls-heading" className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Play size={16} className="text-cyan-400" aria-hidden="true" />
            Drill controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="charger-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                Target connector
              </label>
              <select
                id="charger-select"
                value={selectedChargerIndex}
                onChange={(e) => setSelectedChargerIndex(Number(e.target.value))}
                disabled={drillInProgress}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60"
              >
                {[1, 2, 3, 4, 5].map((idx) => (
                  <option key={idx} value={idx}>
                    demo-charger-0{idx} · Connector #{idx}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="scenario-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                Failure scenario
              </label>
              <select
                id="scenario-select"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                disabled={drillInProgress}
                aria-describedby="scenario-help"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-60"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p id="scenario-help" className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                {selectedScenario?.detail}. <span className="font-mono text-slate-500">{scenario}</span>
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Every scenario emits a synthetic zero-current fault event. The Datadog monitor counts simulated fault events — it is not a temperature safety threshold.
          </p>

          {/* Action buttons: the next lifecycle action is the primary button */}
          <div className="pt-4 border-t border-slate-800">
            {isAuthenticated ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5">
                {!drillInProgress && (
                  <button
                    type="button"
                    onClick={handleTriggerFault}
                    disabled={mutationsLocked || loading}
                    className={`${btnBase} bg-rose-600 hover:bg-rose-500 text-white`}
                  >
                    {loading ? spinner : <AlertOctagon size={14} aria-hidden="true" />}
                    Inject fault
                  </button>
                )}
                {canAcknowledge && (
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    disabled={mutationsLocked || loading}
                    className={`${btnBase} bg-amber-500 hover:bg-amber-400 text-slate-950`}
                  >
                    {loading ? spinner : <CheckCircle2 size={14} aria-hidden="true" />}
                    Acknowledge alert
                  </button>
                )}
                {canRecover && (
                  <button
                    type="button"
                    onClick={handleRecover}
                    disabled={mutationsLocked || loading}
                    className={`${btnBase} bg-cyan-600 hover:bg-cyan-500 text-white`}
                  >
                    {loading ? spinner : <Zap size={14} aria-hidden="true" />}
                    Send recovery telemetry
                  </button>
                )}
                {canResolve && (
                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={mutationsLocked || loading}
                    className={`${btnBase} bg-emerald-600 hover:bg-emerald-500 text-white`}
                  >
                    {loading ? spinner : <CheckCircle2 size={14} aria-hidden="true" />}
                    Resolve &amp; close incident
                  </button>
                )}
                {drillInProgress && (
                  <span className="text-[11px] text-slate-500 sm:ml-1">
                    Connector and scenario are locked until this drill is resolved or reset.
                  </span>
                )}
                {mutationsLocked && (
                  <span className="text-[11px] text-slate-500">Drill controls are read-only in the production preview.</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <LockedAction action="Inject fault" />
                <span className="text-[11px] text-slate-400">
                  Guests can explore scenarios; running a drill needs operator sign-in.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Active Incident Summary */}
        {activeIncident && (
          <section aria-labelledby="drill-incident-heading" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3 animate-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="drill-incident-heading" className="text-sm font-semibold text-slate-100">
                  Drill incident
                </h2>
                <StatusBadge status={activeIncident.status} size="sm" />
                <span className="font-mono text-[11px] text-slate-500">{activeIncident._id}</span>
              </div>
              <Link
                href={`/incidents?selected=${activeIncident._id}`}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                Open in Incidents <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
              <div>
                <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Connector</dt>
                <dd className="mt-0.5 font-mono text-slate-200 font-semibold truncate">{activeIncident.chargerId}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Scenario</dt>
                <dd className="mt-0.5 text-slate-200 font-semibold">{scenarioLabel(activeIncident.scenario)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Detected</dt>
                <dd className="mt-0.5 font-mono text-slate-200 tabular-nums">{new Date(activeIncident.detectedAt).toLocaleTimeString()}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-[10px] uppercase tracking-wider">Audit entries</dt>
                <dd className="mt-0.5 font-mono text-cyan-300 font-semibold">{activeIncident.actions?.length || 1}</dd>
              </div>
            </dl>
          </section>
        )}
      </main>
    </div>
  );
}
