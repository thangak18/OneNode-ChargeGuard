'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,ReferenceLine} from 'recharts';
import {Navbar} from '@/components/Navbar';
import {ProvenanceBadge} from '@/components/ProvenanceBadge';
import type {LocalHistory} from '@/lib/local-history';

export default function HistoryPage() {
  const [session,setSession]=useState('sample_01');const [speed,setSpeed]=useState(600);
  const [data,setData]=useState<LocalHistory|null>(null);const [error,setError]=useState<string|null>(null);
  const [playing,setPlaying]=useState(false);const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{
    const abort=new AbortController();
    fetch(`/api/historical?session=${session}&speed=${speed}`,{cache:'no-store',signal:abort.signal})
      .then(async res=>{const body=await res.json();if(!res.ok)throw new Error(body.message??'Local historical mode unavailable');return body as LocalHistory;})
      .then(body=>{if(!abort.signal.aborted){setData(body);setError(null);}}).catch(reason=>{if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:'Historical read failed');});
    return ()=>abort.abort();
  },[session,speed]);
  const duration=data?.points.length?Date.parse(data.points.at(-1)!.replayAt)-Date.parse(data.replayAnchor):0;
  useEffect(()=>{if(!playing || !duration)return;const timer=setInterval(()=>setElapsed(previous=>Math.min(duration,previous+100)),100);return()=>clearInterval(timer);},[playing,duration]);
  const point=data?.points.filter(p=>Date.parse(p.replayAt)-Date.parse(data.replayAnchor)<=elapsed).at(-1);
  function select(nextSession:string,nextSpeed:number){setPlaying(false);setElapsed(0);setData(null);setError(null);setSession(nextSession);setSpeed(nextSpeed);}
  return <div className="min-h-screen bg-slate-950 text-slate-100"><Navbar/><main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <div><h1 className="text-xl font-semibold">Local Historical ACN Analysis</h1><p className="text-sm text-slate-400 mt-2">Read-only local files. No Atlas writes, DogStatsD metrics, Datadog logs or fault controls on this path.</p></div>
    <div role="note" className="p-4 border border-amber-800 rounded-lg text-amber-200 text-sm">Reuse/third-party processing permission remains unconfirmed. Local inspection is not a license grant. Do not publish this trace, screen-share it publicly, export it or upload it to cloud services. Use the synthetic demo for public presentation.</div>
    <section aria-label="Data modes" className="grid md:grid-cols-3 gap-4 text-sm">
      <div className="p-4 bg-slate-900 rounded-lg"><ProvenanceBadge sourceType="ACN_REPLAY"/><p className="mt-2">Observed historical current and source-reported state/energy. Original timestamps stay visible. These are not live measurements.</p></div>
      <div className="p-4 bg-slate-900 rounded-lg"><ProvenanceBadge sourceType="DERIVED"/><p className="mt-2">Application charging state uses current &gt; 0.5 A. This heuristic does not establish a physical fault or availability.</p></div>
      <div className="p-4 bg-slate-900 rounded-lg"><ProvenanceBadge sourceType="SYNTHETIC"/><p className="mt-2">Operational faults and operator actions remain separate.</p><Link href="/demo" className="text-cyan-300 underline">Open synthetic incident controls</Link></div>
    </section>
    <section aria-label="Historical controls" className="flex flex-wrap gap-5 items-end">
      <label className="text-sm">Local session<select aria-label="Local session" className="block mt-1 p-2 bg-slate-900 border border-slate-700 rounded" value={session} onChange={e=>select(e.target.value,speed)}>{[1,2,3,4,5].map(i=><option key={i} value={`sample_0${i}`}>Session {i} (same source prefix)</option>)}</select></label>
      <label className="text-sm">Replay clock compression<select aria-label="Replay clock compression" className="block mt-1 p-2 bg-slate-900 border border-slate-700 rounded" value={speed} onChange={e=>select(session,Number(e.target.value))}>{[60,600,3600].map(n=><option key={n} value={n}>{n} source seconds / replay second</option>)}</select></label>
      <button disabled={!data || !duration} aria-pressed={playing} onClick={()=>{if(elapsed>=duration)setElapsed(0);setPlaying(value=>!value);}} className="p-2 border border-cyan-700 rounded disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400">{playing?'Pause local replay':'Play local replay'}</button>
    </section>
    {error&&<div role="alert" className="p-4 border border-rose-700 text-rose-200 rounded">{error}<p className="mt-2">Enable CHARGEGUARD_HISTORICAL_LOCAL=true privately in apps/web/.env.local and restart the loopback dev server. Raw samples are not included in Git.</p></div>}
    {!data&&!error&&<p role="status">Loading verified local inventory…</p>}
    {data&&<>
      <div role="status" className="text-sm text-slate-300">Checksum verified. {data.rowsParsed.toLocaleString()} source rows parsed, {data.pointsEmitted} readings selected at ≥60 source-second spacing. {data.uniqueExportedEvseIds} distinct exported EVSE prefix across five files; physical identity independently verified: no. Local alias: {data.evseAlias}.</div>
      <section aria-label="Replay cursor" className="p-4 bg-slate-900 rounded-lg space-y-3">
        <label className="block text-sm">Local replay cursor<input aria-label="Local replay cursor" type="range" min={0} max={duration} step={1} value={elapsed} onChange={e=>{setPlaying(false);setElapsed(Number(e.target.value));}} className="block w-full mt-2"/></label>
        <p className="text-sm font-mono break-all">Original event UTC: {point?.sourceEventAt??'Unavailable'}</p>
        <p className="text-sm font-mono break-all">Mapped replay clock UTC: {new Date(Date.parse(data.replayAnchor)+elapsed).toISOString()} (demonstration clock, not source time)</p>
        <p className="text-xs text-slate-400">The client timer can pause or slow in background tabs. Source instants are retained as supplied; historical timezone correctness is not independently verified. No data is ingested when the cursor moves.</p>
      </section>
      <section aria-label="Historical current visualization" className="p-4 bg-slate-900 rounded-lg"><h2 className="font-semibold mb-4">Observed historical charging current (A)</h2><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.points}><XAxis dataKey="sourceEventAt" tickFormatter={v=>new Date(v).toISOString().slice(11,19)} minTickGap={75} stroke="#94a3b8"/><YAxis unit=" A" stroke="#94a3b8"/><Tooltip labelFormatter={label=>`Original UTC: ${String(label)}`}/><Line dataKey="currentA" name="Source current (A)" stroke="#38bdf8" dot={false} connectNulls={false} isAnimationActive={false}/>{point&&<ReferenceLine x={point.sourceEventAt} stroke="#c084fc"/>}</LineChart></ResponsiveContainer></div><p className="text-xs text-slate-400 mt-2">X axis: original UTC, not replay time. Full downsampled session shown; the purple cursor selects a historical observation. Lines connect selected samples and do not reconstruct missing measurements.</p></section>
      <section aria-label="Selected field provenance" className="overflow-x-auto p-4 bg-slate-900 rounded-lg"><h2 className="font-semibold mb-3">Selected observation and provenance</h2><table className="w-full text-sm text-left tabular-nums"><thead><tr><th className="py-2">Field</th><th>Value</th><th>Origin</th></tr></thead><tbody>
        <tr><td className="py-2">Current (A)</td><td>{point?.currentA??'Unavailable'}</td><td>ACN_REPLAY / source-described MEASURED</td></tr>
        <tr><td className="py-2">Exported charging state</td><td>{point?.sourceChargingState??'Unavailable'}</td><td>SOURCE_REPORTED; semantics not independently verified</td></tr>
        <tr><td className="py-2">Exported energy counter (kWh)</td><td>{point?.sourceEnergyKWh??'Unavailable'}</td><td>SOURCE_REPORTED; can reset, not a verified session total</td></tr>
        <tr><td className="py-2">Application charging state</td><td>{point?.chargingState??'Unavailable'}</td><td><ProvenanceBadge sourceType="DERIVED"/></td></tr>
        <tr><td className="py-2">Voltage / power / temperature</td><td>Unavailable</td><td>No measurements invented or inferred</td></tr>
        <tr><td className="py-2">Quality flag</td><td>{point?.qualityFlags.join(', ')||'None flagged for this selected interval'}</td><td>Energy decreases between emitted samples are retained as flags</td></tr>
      </tbody></table></section>
    </>}
  </main></div>;
}
