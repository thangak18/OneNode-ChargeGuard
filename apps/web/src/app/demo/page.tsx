'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { startPolling } from '@/lib/utils';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { api, Incident } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import {
  Sliders,
  AlertOctagon,
  CheckCircle2,
  Play,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  Zap,
} from 'lucide-react';

export default function DemoPage() {
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
      await api.acknowledgeIncident(activeIncidentId, 'hackathon-judge');
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
      await api.resolveIncident(activeIncidentId, 'hackathon-judge');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Sliders size={20} className="text-cyan-400" />
              Demo Control Center & Incident Lifecycle Simulator
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Interactive demonstration for judges: DETECT → INVESTIGATE → RESOLVE
            </p>
          </div>

          <button
            onClick={handleReset}
            disabled={process.env.NODE_ENV === 'production' || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium self-start sm:self-auto transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Reset Baseline (All Normal)
          </button>
        </div>

        {/* Disclaimer Card */}
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-lg p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-100">
              MUGVN Hackathon Demonstration Environment
            </p>
            <p className="text-[11px] text-amber-300 leading-relaxed">
              ChargeGuard does NOT actuate physical charging hardware. All operations and fault stimuli are
              software simulations injected into the NestJS pipeline and persisted into MongoDB Atlas time-series.
              Verify current Datadog US1 monitor state directly; this UI does not confirm alert delivery.
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div role="status" className="p-3.5 rounded-lg bg-cyan-950/70 border border-cyan-800 text-cyan-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
              {statusMessage}
            </span>
            <button onClick={() => setStatusMessage(null)} className="text-cyan-400 hover:underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertOctagon size={16} className="text-rose-400 shrink-0" />
              {error}
            </span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:underline text-[11px]">
              Dismiss
            </button>
          </div>
        )}

        {/* 4-Step Interactive Lifecycle Flow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Step 1: Baseline */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 1
                ? 'bg-slate-900 border-cyan-500 shadow-sm shadow-cyan-950'
                : 'bg-slate-900/60 border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-cyan-400">Step 1</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Baseline Normal</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              The baseline reset emits synthetic 8.25 A readings. Verify monitor state directly in Datadog.
            </p>
          </div>

          {/* Step 2: Fault Injection */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 2
                ? 'bg-rose-950/40 border-rose-500 shadow-sm shadow-rose-950'
                : 'bg-slate-900/60 border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-rose-400">Step 2: DETECT</span>
              <span className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`} />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Fault Injected</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Synthetic current drops to 0 A and state switches to FAULT. Check Datadog for monitor evaluation.
            </p>
          </div>

          {/* Step 3: Recovery */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 3
                ? 'bg-amber-950/40 border-amber-500 shadow-sm shadow-amber-950'
                : 'bg-slate-900/60 border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-amber-400">Step 3: INVESTIGATE</span>
              <span className={`w-2 h-2 rounded-full ${step >= 3 ? 'bg-amber-400' : 'bg-slate-700'}`} />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Recovery Triggered</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Operator investigates logs and telemetry, then dispatches recovery telemetry.
            </p>
          </div>

          {/* Step 4: Resolved */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 4
                ? 'bg-emerald-950/40 border-emerald-500 shadow-sm shadow-emerald-950'
                : 'bg-slate-900/60 border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-emerald-400">Step 4: RESOLVE</span>
              <span className={`w-2 h-2 rounded-full ${step === 4 ? 'bg-emerald-400' : 'bg-slate-700'}`} />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Incident Closed</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Confirm monitor recovery in Datadog; the incident is marked RESOLVED after operator confirmation.
            </p>
          </div>
        </div>

        {/* Simulator Control Dashboard */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Play size={16} className="text-cyan-400" />
            Interactive Fault Injection Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="charger-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Connector
              </label>
              <select
                id="charger-select"
                value={selectedChargerIndex}
                onChange={(e) => setSelectedChargerIndex(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {[1, 2, 3, 4, 5].map((idx) => (
                  <option key={idx} value={idx}>
                    demo-charger-0{idx} (Connector #{idx})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="scenario-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                Synthetic Failure Scenario
              </label>
              <select
                id="scenario-select"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="SIM_OVERHEAT">SIM_OVERHEAT (Synthetic 72 °C stimulus; illustrative only)</option>
                <option value="SIM_POWER_LOSS">SIM_POWER_LOSS (Synthetic zero-current signal)</option>
                <option value="SIM_HARDWARE_FAULT">SIM_HARDWARE_FAULT (Synthetic generic fault signal)</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Every scenario emits a synthetic zero-current fault event. Only SIM_OVERHEAT adds a 72 °C synthetic
            stimulus; the Datadog monitor counts simulated fault events, not a temperature safety threshold.
          </p>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleTriggerFault}
              disabled={Boolean(process.env.NODE_ENV === 'production' || loading || (activeIncident && activeIncident.status !== 'RESOLVED'))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
            >
              <AlertOctagon size={14} />
              Inject Synthetic Fault
            </button>

            {activeIncident && activeIncident.status === 'OPEN' && (
              <button
                onClick={handleAcknowledge}
                disabled={process.env.NODE_ENV === 'production' || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
              >
                Acknowledge Alert
              </button>
            )}

            {activeIncident && (activeIncident.status === 'ACKNOWLEDGED' || (activeIncident.status === 'RESOLVING' && !activeIncident.recoveryTelemetryAt)) && (
              <button
                onClick={handleRecover}
                disabled={process.env.NODE_ENV === 'production' || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
              >
                <Zap size={14} />
                Send Recovery Telemetry
              </button>
            )}

            {activeIncident && activeIncident.status === 'RESOLVING' && activeIncident.recoveryTelemetryAt && (
              <button
                onClick={handleResolve}
                disabled={process.env.NODE_ENV === 'production' || loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                Confirm & Close Incident (RESOLVED)
              </button>
            )}
          </div>
        </div>

        {/* Active Incident Status Bar */}
        {activeIncident && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-100">{activeIncident._id}</span>
                <StatusBadge status={activeIncident.status} />
              </div>
              <Link
                href={`/incidents?selected=${activeIncident._id}`}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Full Investigation View <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950 p-3 rounded border border-slate-800/80">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Target</span>
                <span className="text-slate-200 font-bold">{activeIncident.chargerId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Scenario</span>
                <span className="text-slate-200 font-bold">{activeIncident.scenario}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Detected</span>
                <span className="text-slate-200">{new Date(activeIncident.detectedAt).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Actions Logged</span>
                <span className="text-cyan-400 font-bold">{activeIncident.actions?.length || 1} steps</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
