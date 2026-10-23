'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ShieldCheck,ShieldAlert,LockKeyhole,RotateCcw,Activity,AlertTriangle,CheckCircle2,RefreshCcw,Radio,Clock} from 'lucide-react';
import {ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';
import {Navbar} from '@/components/Navbar';
import {ProvenanceBadge} from '@/components/ProvenanceBadge';
import {api,type Charger} from '@/lib/api';
import {parseJudgeRun,runChartSamples,runTimeline,activeCycle,runCycles,cycleStatus,lifecycle,judgeOperations,canJudgeAct,isJudgeStateFresh,type JudgeRun} from '@/lib/judge-presentation.mts';

type Session={authorized:boolean;canMutate:boolean;canRearm?:boolean;readProvisioned:boolean};
const card='rounded-xl border border-slate-800 bg-slate-900/80 p-5';
function timestamp(value:string){return new Date(value).toLocaleString();}
async function json<T>(url:string,init?:RequestInit):Promise<T>{
 const res=await fetch(url,{cache:'no-store',...init});const data=await res.json().catch(()=>({message:`HTTP ${res.status}`}));
 if(!res.ok)throw new Error(typeof data.message==='string'?data.message:`HTTP ${res.status}`);return data as T;
}

export default function JudgePage(){
 const [session,setSession]=useState<Session|null>(null);
 const [runs,setRuns]=useState<JudgeRun[]>([]);
 const [runId,setRunId]=useState('');
 const [run,setRun]=useState<JudgeRun|null>(null);
 const [chargers,setChargers]=useState<Charger[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [selectedCycle,setSelectedCycle]=useState(1);
 const [uncertain,setUncertain]=useState(false);
 const [verifiedAt,setVerifiedAt]=useState(0);
 const [now,setNow]=useState(0);
 // Acquire before any await or state update: React state alone cannot block same-tick clicks.
 const requestLock=useRef(false);


 const load=useCallback(async(selected?:string)=>{
  setLoading(true);setError('');setVerifiedAt(0);
  try{
   const status=await json<Session>('/api/judge/session');setSession(status);
   if(status.authorized!==true){setRun(null);setRuns([]);setRunId('');return false;}
   const [rawRuns,assets]=await Promise.allSettled([json<unknown[]>('/api/judge/runs'),api.getChargers()]);
   if(assets.status==='fulfilled')setChargers(assets.value);
   if(rawRuns.status==='rejected')throw rawRuns.reason;
   const available=rawRuns.value.map(parseJudgeRun);setRuns(available);
   const id=selected;
   const current=id?available.find(r=>r._id===id):available[0];
   if(id&&!current)throw new Error('Selected run is no longer available');
   if(!current){setRunId('');setRun(null);return true;}
   setRunId(current._id);
   const detail=parseJudgeRun(await json<unknown>(`/api/judge/runs/${current._id}`));
   if(detail._id!==current._id||detail.chargerId!==current.chargerId)throw new Error('Run readback mismatch');
   setRun(detail);setSelectedCycle(activeCycle(detail));
   const checkedAt=Date.now();setVerifiedAt(checkedAt);setNow(checkedAt);
   return true;
  }catch(e){setRun(null);setError(e instanceof Error?e.message:'Unable to load judge state');return false;}
  finally{setLoading(false);}
 },[]);
 const refresh=useCallback(async(selected?:string)=>{
  if(requestLock.current)return;
  requestLock.current=true;
  try{if(await load(selected)){setUncertain(false);setNotice('');}}
  finally{requestLock.current=false;}
 },[load]);
 useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return ()=>window.clearTimeout(timer);},[refresh]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(timer);},[]);

 const ready=session?.authorized===true&&session?.canMutate===true&&!loading&&!busy&&!uncertain&&isJudgeStateFresh(verifiedAt,now);
 const handleAction=useCallback(async(operation:string)=>{
  const actionTime=Date.now();
  if(requestLock.current||!run||!isJudgeStateFresh(verifiedAt,actionTime)||!canJudgeAct(run,selectedCycle,operation,ready,session?.canRearm===true))return;
  requestLock.current=true;
  try{
   if(operation==='fault'&&!window.confirm(`Trigger a software-generated fault in cycle ${selectedCycle} of ${run._id}?`))return;
   if(operation==='reset'&&!window.confirm(`Re-arm ${run._id} for cycle ${activeCycle(run)+1}? All earlier cycle history will be retained.`))return;
   if(!isJudgeStateFresh(verifiedAt,Date.now())){setNow(Date.now());return;}
   setBusy(true);setError('');setNotice('');
   try{
    await json(`/api/judge/runs/${run._id}/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({expectedRevision:run.revision,expectedCycle:activeCycle(run)})});
    if(await load(run._id))setNotice(`${operation==='reset'?'Re-arm':operation} recorded. Verified state refreshed.`);
    else{setUncertain(true);setError('Action submitted, but readback failed. Explicitly refresh successfully before another action.');}
   }catch(e){
    const message=e instanceof Error?e.message:'Operation denied';
    setUncertain(true);setVerifiedAt(0);
    // Never retry a POST: a timeout may occur after a committed transition.
    try{
     const detail=parseJudgeRun(await json<unknown>(`/api/judge/runs/${run._id}`));
     if(detail._id!==run._id)throw new Error('Run readback mismatch');
     setRun(detail);setSelectedCycle(activeCycle(detail));
    }catch{ /* Keep the last view read-only until an explicit refresh succeeds. */ }
    setError(`${message}. Outcome requires review. Readback attempted; explicitly refresh successfully to enable actions.`);
   }
  }finally{requestLock.current=false;setBusy(false);}
 },[run,selectedCycle,ready,verifiedAt,session,load]);

 const archived=!!run&&selectedCycle!==activeCycle(run);
 const selectedStatus=run?cycleStatus(run,selectedCycle):null;
 const samples=run?runChartSamples(run,selectedCycle):[];
 const timeline=run?runTimeline(run,selectedCycle):[];
 const disabledReason='Production operations require separate owner approval and backend provisioning.';
 return <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"><Navbar/>
  <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-7 sm:px-6">
   <header className="flex flex-wrap items-start justify-between gap-3">
    <div><div className="flex items-center gap-2"><ShieldCheck className="text-cyan-400" size={23}/><h1 className="text-xl font-semibold">Isolated Judge Run</h1></div>
     <p className="mt-1 text-sm text-slate-400">Owner-scoped incident investigation · DETECT → INVESTIGATE → RECOVER → RESOLVE</p></div>
    <button type="button" onClick={()=>void refresh(runId)} disabled={loading||busy} className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-400"><RefreshCcw size={14} className="mr-1 inline"/> Refresh</button>
   </header>
   <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200 flex gap-3"><ShieldAlert size={18} className="shrink-0 mt-0.5"/><div><strong>Controlled synthetic workspace</strong><p className="mt-1">Judge observations are software-generated and stored in isolated run documents. Shared Phase D incidents and historical ACN measurements are separate. A run transition is not proof of a Datadog ALERT/OK transition or physical device recovery.</p></div></div>
   <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <section className={card}><h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><LockKeyhole size={15}/> Operator access</h2>
     <p className="mt-3 text-sm" role="status">{!session?'Checking session…':session.authorized?'GitHub operator verified':'Sign-in required'}</p>
     <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${session?.authorized?'border-emerald-800 text-emerald-300':'border-amber-800 text-amber-300'}`}>{session?.authorized?'Authorized identity':'Not authorized'}</span>
     {!session?.authorized&&<p className="mt-3 text-sm"><Link href="/login" className="underline text-cyan-300">Sign in with GitHub</Link> to access owner-scoped runs.</p>}
    </section>
    <section className={card}><h2 className="text-sm font-semibold flex items-center gap-2"><Radio size={15}/> Mutation policy</h2>
     <p className="mt-3 text-sm text-amber-300">{!session?'Checking permissions…':session.canMutate?'Authorized judge operations enabled':'Read-only · mutations disabled'}</p>
     <p className="mt-2 text-xs text-slate-400">{disabledReason}</p>
    </section>
    <section className={card}><h2 className="text-sm font-semibold flex items-center gap-2"><Activity size={15}/> Evidence source</h2>
     <div className="mt-3"><ProvenanceBadge sourceType="SYNTHETIC"/></div><p className="mt-2 text-xs text-slate-400">Only recorded samples and audited actions are displayed.</p>
    </section>
   </div>
   {error&&<div role="alert" className="rounded-md border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{error} <button type="button" onClick={()=>void refresh(runId)} disabled={loading||busy} className="underline text-rose-100 focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50">Refresh verified state</button></div>}
   {notice&&<div role="status" className="rounded-md border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">{notice}</div>}
   {loading&&<div role="status" className={`${card} motion-safe:animate-pulse text-sm text-slate-400`}>Loading verified judge run details…</div>}
   {!loading&&session?.authorized&&<section className={card}><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-medium text-slate-200">Run selection</h2><p className="mt-1 text-xs text-slate-400">Provisioning a new run requires owner approval and is not available from the browser.</p></div>
    <label className="min-w-0 w-full text-sm text-slate-300 sm:w-auto">Authorized run <select aria-label="Authorized judge run" value={runId} onChange={e=>void refresh(e.target.value)} disabled={!runs.length||loading||busy} className="mt-2 block w-full min-w-0 max-w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-400 sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto"><option value="">{runs.length?'Choose run':'No runs provisioned'}</option>{runs.map(r=><option key={r._id} value={r._id}>{r._id} · {r.status}</option>)}</select></label></div>
    {!runs.length&&<p className="mt-4 text-sm text-amber-300">No authorized judge run is available. One isolated run must be provisioned by the owner after separate approval.</p>}
   </section>}
   {run&&<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <section className={card}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Run details</h2><ProvenanceBadge sourceType="SYNTHETIC"/></div>
     <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Run ID</dt><dd className="font-mono text-xs break-all">{run._id}</dd></div><div><dt className="text-slate-500">Lifecycle status</dt><dd className="font-mono text-cyan-300">{selectedStatus??'Unavailable'}</dd></div><div><dt className="text-slate-500">Scoped charger</dt><dd className="font-mono">{run.chargerId}</dd></div><div><dt className="text-slate-500">Run revision</dt><dd className="font-mono tabular-nums">{run.revision}</dd></div><div><dt className="text-slate-500">Recorded software state</dt><dd className="font-mono text-amber-300">{samples.at(-1)?.state??'No observation recorded'}</dd></div><div><dt className="text-slate-500">Last scenario current</dt><dd className="font-mono tabular-nums">{samples.length?`${samples.at(-1)!.currentA} A SYNTHETIC`:'Unavailable'}</dd></div></dl>
     <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <label className="text-sm text-slate-300">Cycle <select value={selectedCycle} onChange={e=>setSelectedCycle(Number(e.target.value))} disabled={loading||busy} className="ml-2 rounded-md border border-slate-700 bg-slate-950 p-2 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-cyan-400">{runCycles(run).map(c=><option key={c} value={c}>Cycle {c} · {c===activeCycle(run)?'Active':'Archived · read only'}</option>)}</select></label>
      <span className="text-xs text-slate-300">{archived?'Archived cycle · read only':'Active cycle'}</span>
     </div>
     <ol aria-label="Synthetic incident lifecycle" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{lifecycle.map((status,index)=>{
      const current=lifecycle.findIndex(s=>s===selectedStatus);
      return <li key={status} aria-current={status===selectedStatus?'step':undefined} className={`rounded-md border p-2 text-xs ${index===current?'border-cyan-600 bg-cyan-950/40 text-cyan-200':index<current?'border-emerald-800 text-emerald-300':'border-slate-700 text-slate-400'}`}><span className="font-mono tabular-nums">{index+1}. </span>{status}<span className="mt-1 block text-[11px]">{index===current?'Current':index<current?'Passed':'Pending'}</span></li>;
     })}</ol>
     {archived&&<p className="mt-3 text-xs text-amber-300">Archived evidence only. Select the active cycle to operate.</p>}
     {session?.canMutate&&!loading&&!busy&&(!isJudgeStateFresh(verifiedAt,now)||uncertain)&&<p role="status" className="mt-3 text-xs text-amber-300">{uncertain?'Action outcome needs review.':'Verified state is stale or unavailable.'} Refresh successfully to enable actions.</p>}
     <h3 className="mt-5 text-sm font-medium text-slate-300">Selected virtual chargers</h3><div className="mt-2 flex flex-wrap gap-2">{chargers.length?chargers.map(c=><span key={c._id} className={`rounded-md border px-2 py-1 text-xs font-mono ${c._id===run.chargerId?'border-cyan-700 text-cyan-200':'border-slate-700 text-slate-400'}`}>{c._id}{c._id===run.chargerId?' · scoped':''}</span>):<span className="text-xs text-slate-500">Asset listing unavailable; scope is derived from run record.</span>}</div>
     {(run.revision>=100||activeCycle(run)>=20)&&<p role="status" className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">{run.revision>=100?'Run action limit reached (100 revisions). All lifecycle actions are disabled; recorded evidence remains available.':'Final cycle reached (20 of 20). This cycle can be completed, but re-arm is disabled.'}</p>}
     <h3 className="mt-5 text-sm font-medium text-slate-300">Lifecycle actions</h3><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {judgeOperations.map(op=><button key={op.key} type="button" onClick={()=>void handleAction(op.key)} disabled={!canJudgeAct(run,selectedCycle,op.key,ready,session?.canRearm===true)} title={!session?.canMutate?disabledReason:op.key==='reset'&&session?.canRearm!==true?'Re-arm is not enabled for this session':undefined} className={`rounded-md border px-3 py-2 text-left text-xs motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 ${op.key==='fault'?'border-rose-800 bg-rose-950 text-rose-200 enabled:hover:bg-rose-900':'border-slate-700 bg-slate-800 text-slate-100 enabled:hover:bg-slate-700'}`}>{op.key==='reset'&&<RotateCcw size={14} className="mr-1 inline"/>}{op.label}</button>)}
     </div><p className="mt-3 text-xs text-slate-400">Re-arm is available only after resolution and when enabled for this session. It starts a new cycle and retains all recorded history.</p>
    </section>
    <section className={card}><h2 className="font-semibold flex items-center gap-2"><Activity size={16} className="text-cyan-400"/> Cycle {selectedCycle} · synthetic observations</h2>
     <p className="mt-2 text-xs text-slate-400">Voltage and temperature: N/A (unmeasured). Recorded SYNTHETIC software scenario values (not sensor measurements or time-series telemetry). No data are manufactured to fill gaps.</p>
     {samples.length?<><div className="mt-4 h-56" aria-label="Recorded synthetic charging current chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={samples}><CartesianGrid stroke="#334155" strokeDasharray="3 3"/><XAxis dataKey="at" tickFormatter={v=>new Date(v as string).toLocaleTimeString()} tick={{fill:'#94a3b8',fontSize:10}}/><YAxis unit=" A" tick={{fill:'#94a3b8',fontSize:10}}/><Tooltip labelFormatter={v=>timestamp(String(v))} contentStyle={{background:'#0f172a',borderColor:'#334155'}}/><Line isAnimationActive={false} type="linear" dataKey="currentA" stroke="#22d3ee" strokeWidth={2} dot name="Current (A)"/></LineChart></ResponsiveContainer></div>
      <div className="mt-3 max-h-36 overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-slate-400"><th scope="col">Scenario time</th><th scope="col">Simulated current</th><th scope="col">State</th></tr></thead><tbody>{samples.map((s,i)=><tr key={`${s.at}-${i}`} className="border-t border-slate-800"><td className="py-2 font-mono tabular-nums">{timestamp(s.at)}</td><td className="font-mono tabular-nums">{s.currentA} A</td><td>{s.state}</td></tr>)}</tbody></table></div></>:<div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Clock size={15}/> No observations recorded for this cycle.</div>}
    </section>
    <section className={`${card} xl:col-span-2`}><h2 className="font-semibold flex items-center gap-2"><CheckCircle2 className="text-emerald-400" size={16}/> Cycle {selectedCycle} · investigation & audit timeline</h2>
     <p className="mt-2 text-xs text-slate-400">Server-derived GitHub actor IDs and timestamps, scoped to this run. No connection to historical Phase D incident records.</p>
     {timeline.length?<ol className="mt-4 space-y-3">{timeline.map((t,i)=><li key={`${t.at}-${i}`} className="flex flex-wrap justify-between gap-3 border-l-2 border-cyan-800 bg-slate-950/70 px-4 py-3 text-sm"><div><span className="font-semibold text-slate-200">{t.action==='reset'?'Re-arm cycle':t.action}</span><span className="ml-2 text-xs text-amber-300">SYNTHETIC</span><p className="mt-1 font-mono text-xs text-slate-500">Actor: {t.actor}</p></div><time className="text-xs font-mono tabular-nums text-slate-400" dateTime={t.at}>{timestamp(t.at)}</time></li>)}</ol>:<div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><AlertTriangle size={15}/> No audited actions recorded for this cycle.</div>}
    </section>
   </div>}
   <footer className="text-xs text-slate-500">Cloud Datadog collection is disabled pending approval. Fault count, incident state, monitor ALERT/OK and recovery telemetry are separate evidence streams.</footer>
  </main></div>;
}
