export type JudgeAction = {actor:string;action:string;at:string};
export type JudgeObservation = {at:string;currentA:number;chargingState:string;sourceType:'SYNTHETIC'};
export type JudgeRun = {_id:string;stationId:string;chargerId:string;synthetic:true;status:string;revision:number;actions:JudgeAction[];observations?:JudgeObservation[]};

/** Validate a read document before it appears in the operator console. Never invent samples. */
export function parseJudgeRun(value:unknown):JudgeRun {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid judge run');
 const r=value as Record<string,unknown>;
 if(typeof r._id!=='string'||!/^judge-[a-f0-9]{24}$/.test(r._id)||r.stationId!=='demo-station-01'||
   typeof r.chargerId!=='string'||!/^demo-charger-0[1-5]$/.test(r.chargerId)||r.synthetic!==true||
   typeof r.status!=='string'||!['BASELINE','OPEN','ACKNOWLEDGED','RESOLVING','RESOLVED'].includes(r.status)||
   !Number.isSafeInteger(r.revision)||!Array.isArray(r.actions)||r.actions.length>100||
   !r.actions.every(a=>a&&typeof a.actor==='string'&&/^github:[1-9][0-9]*$/.test(a.actor)&&
    typeof a.action==='string'&&['fault','acknowledge','recover','resolve','reset'].includes(a.action)&&typeof a.at==='string'&&!Number.isNaN(Date.parse(a.at)))||
   (r.observations!==undefined&&(!Array.isArray(r.observations)||r.observations.length>100||!r.observations.every(o=>
    o&&typeof o.at==='string'&&!Number.isNaN(Date.parse(o.at))&&typeof o.currentA==='number'&&Number.isFinite(o.currentA)&&
    ['FAULT','CHARGING'].includes(o.chargingState)&&o.sourceType==='SYNTHETIC'))))throw new Error('Invalid judge run');
 return r as JudgeRun;
}

export function runTimeline(run:JudgeRun){return run.actions.map(a=>({at:a.at,action:a.action,actor:a.actor,sourceType:'SYNTHETIC' as const}));}
export function runChartSamples(run:JudgeRun){return (run.observations??[]).map(o=>({at:o.at,currentA:o.currentA,state:o.chargingState,sourceType:o.sourceType}));}
