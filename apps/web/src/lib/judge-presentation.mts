export type JudgeAction = {actor:string;action:string;at:string;cycle?:number};
export type JudgeObservation = {at:string;currentA:number;chargingState:string;sourceType:'SYNTHETIC';cycle?:number};
export type JudgeRun = {_id:string;stationId:string;chargerId:string;synthetic:true;status:string;revision:number;cycle?:number;actions:JudgeAction[];observations?:JudgeObservation[]};

const validCycle=(cycle:unknown)=>cycle===undefined||(Number.isSafeInteger(cycle)&&Number(cycle)>=1&&Number(cycle)<=20);
export const lifecycle=['BASELINE','OPEN','ACKNOWLEDGED','RESOLVING','RESOLVED'] as const;
export const judgeOperations=[
 {key:'fault',label:'Trigger synthetic fault',status:'BASELINE'},
 {key:'acknowledge',label:'Acknowledge incident',status:'OPEN'},
 {key:'recover',label:'Request synthetic recovery',status:'ACKNOWLEDGED'},
 {key:'resolve',label:'Resolve recorded incident',status:'RESOLVING'},
 {key:'reset',label:'Re-arm next cycle',status:'RESOLVED'},
] as const;
export const activeCycle=(run:JudgeRun)=>run.cycle??1;
export const isJudgeStateFresh=(verifiedAt:number,now:number)=>verifiedAt>0&&now>=verifiedAt&&now-verifiedAt<60_000;
export function canJudgeAct(run:JudgeRun,cycle:number,operation:string,ready:boolean,canRearm=false){
 return ready&&run.revision<100&&(operation!=='reset'||activeCycle(run)<20)&&(operation!=='reset'||canRearm)&&cycle===activeCycle(run)&&judgeOperations.some(op=>op.key===operation&&op.status===run.status);
}

/** Validate a read document before it appears in the operator console. Never invent samples. */
export function parseJudgeRun(value:unknown):JudgeRun {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid judge run');
 const r=value as Record<string,unknown>;
 if(typeof r._id!=='string'||!/^judge-[a-f0-9]{24}$/.test(r._id)||r.stationId!=='demo-station-01'||
   typeof r.chargerId!=='string'||!/^demo-charger-0[1-5]$/.test(r.chargerId)||r.synthetic!==true||
   typeof r.status!=='string'||!['BASELINE','OPEN','ACKNOWLEDGED','RESOLVING','RESOLVED'].includes(r.status)||
   !Number.isSafeInteger(r.revision)||Number(r.revision)<0||Number(r.revision)>100||!validCycle(r.cycle)||!Array.isArray(r.actions)||r.actions.length>100||
   !r.actions.every(a=>a&&validCycle(a.cycle)&&(a.cycle??1)<=Number(r.cycle??1)&&typeof a.actor==='string'&&/^github:[1-9][0-9]*$/.test(a.actor)&&
    typeof a.action==='string'&&['fault','acknowledge','recover','resolve','reset'].includes(a.action)&&typeof a.at==='string'&&!Number.isNaN(Date.parse(a.at)))||
   (r.observations!==undefined&&(!Array.isArray(r.observations)||r.observations.length>100||!r.observations.every(o=>
    o&&validCycle(o.cycle)&&(o.cycle??1)<=Number(r.cycle??1)&&typeof o.at==='string'&&!Number.isNaN(Date.parse(o.at))&&typeof o.currentA==='number'&&Number.isFinite(o.currentA)&&
    ['FAULT','CHARGING'].includes(o.chargingState)&&o.sourceType==='SYNTHETIC'))))throw new Error('Invalid judge run');
 return r as JudgeRun;
}

/** Only recorded cycles are offered; missing history is never reconstructed. */
export function runCycles(run:JudgeRun){
 return [...new Set([activeCycle(run),...run.actions.map(a=>a.cycle??1),...(run.observations??[]).map(o=>o.cycle??1)])].sort((a,b)=>b-a);
}
export function cycleStatus(run:JudgeRun,cycle=activeCycle(run)):string|null{
 if(cycle===activeCycle(run))return run.status;
 const last=run.actions.filter(a=>(a.cycle??1)===cycle).at(-1);
 const statuses:Record<string,string>={fault:'OPEN',acknowledge:'ACKNOWLEDGED',recover:'RESOLVING',resolve:'RESOLVED',reset:'BASELINE'};
 return last?statuses[last.action]??null:null;
}
export function runTimeline(run:JudgeRun,cycle=activeCycle(run)){return run.actions.filter(a=>(a.cycle??1)===cycle).map(a=>({at:a.at,action:a.action,actor:a.actor,sourceType:'SYNTHETIC' as const}));}
export function runChartSamples(run:JudgeRun,cycle=activeCycle(run)){return (run.observations??[]).filter(o=>(o.cycle??1)===cycle).map(o=>({at:o.at,currentA:o.currentA,state:o.chargingState,sourceType:o.sourceType}));}
