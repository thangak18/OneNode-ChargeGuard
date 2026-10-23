import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseJudgeRun,runChartSamples,runTimeline,activeCycle,runCycles,cycleStatus,canJudgeAct,judgeOperations,isJudgeStateFresh} from '../src/lib/judge-presentation.mts';

const id='judge-'+'a'.repeat(24);
const recorded={_id:id,stationId:'demo-station-01',chargerId:'demo-charger-01',synthetic:true,
 status:'RESOLVING',revision:3,
 actions:[{actor:'github:123',action:'fault',at:'2026-10-23T01:00:00.000Z'},
          {actor:'github:123',action:'acknowledge',at:'2026-10-23T01:01:00.000Z'}],
 observations:[{at:'2026-10-23T01:00:00.000Z',currentA:0,chargingState:'FAULT',sourceType:'SYNTHETIC'},
               {at:'2026-10-23T01:02:00.000Z',currentA:8.25,chargingState:'CHARGING',sourceType:'SYNTHETIC'}]};

test('judge view exposes only actual stored timeline and clearly attributed synthetic observations',()=>{
 const run=parseJudgeRun(recorded);
 assert.deepEqual(runChartSamples(run).map(({at,currentA,state,sourceType})=>[at,currentA,state,sourceType]),[
  ['2026-10-23T01:00:00.000Z',0,'FAULT','SYNTHETIC'],
  ['2026-10-23T01:02:00.000Z',8.25,'CHARGING','SYNTHETIC']]);
 assert.deepEqual(runTimeline(run).map(({action,actor,sourceType})=>[action,actor,sourceType]),[
  ['fault','github:123','SYNTHETIC'],['acknowledge','github:123','SYNTHETIC']]);
 const empty=parseJudgeRun({...recorded,observations:undefined,actions:[]});
 assert.deepEqual(runChartSamples(empty),[]);assert.deepEqual(runTimeline(empty),[]);
});
test('judge presentation rejects malformed, unauthorized or mislabeled records',()=>{
 for(const changed of [{owner:'secret',chargerId:'unknown'}, {synthetic:false},{observations:[{...recorded.observations[0],sourceType:'ACN_REPLAY'}]},
  {actions:[{...recorded.actions[0],actor:'browser-supplied'}]},{observations:[{...recorded.observations[0],currentA:NaN}]},
  {status:'invented'}, {_id:'demo-58a1983cae09'}])assert.throws(()=>parseJudgeRun({...recorded,...changed}));
});

test('legacy runs and missing event cycles belong to cycle 1',()=>{
 const legacy=parseJudgeRun(recorded);
 assert.equal(activeCycle(legacy),1);
 assert.deepEqual(runCycles(legacy),[1]);
 assert.equal(runTimeline(legacy,1).length,2);
 assert.equal(runChartSamples(legacy,1).length,2);
 assert.deepEqual(runTimeline(legacy,2),[]);
 assert.deepEqual(runChartSamples(legacy,2),[]);
});

const cycling={...recorded,cycle:2,status:'BASELINE',revision:5,
 actions:[...recorded.actions,{actor:'github:123',action:'resolve',at:'2026-10-23T01:03:00.000Z',cycle:1},
  {actor:'github:123',action:'reset',at:'2026-10-23T01:04:00.000Z',cycle:2}]};

test('re-arm displays an empty active cycle and retains archived evidence without adding samples',()=>{
 const original=structuredClone(cycling);
 const run=parseJudgeRun(cycling);
 assert.deepEqual(runCycles(run),[2,1]);
 assert.equal(activeCycle(run),2);
 assert.equal(cycleStatus(run), 'BASELINE');
 assert.equal(cycleStatus(run,1),'RESOLVED');
 assert.deepEqual(runChartSamples(run),[]);
 assert.equal(runChartSamples(run,1).length,2);
 assert.deepEqual(runTimeline(run).map(a=>a.action),['reset']);
 assert.deepEqual(runTimeline(run,1).map(a=>a.action),['fault','acknowledge','resolve']);
 assert.deepEqual(cycling,original);
});

test('selected cycle filters every sample and action even with equal timestamps',()=>{
 const run=parseJudgeRun({...cycling,status:'OPEN',actions:[...cycling.actions,{...recorded.actions[0],cycle:2}],
  observations:[...recorded.observations,{...recorded.observations[0],cycle:2,currentA:3.75}]});
 assert.deepEqual(runChartSamples(run).map(s=>s.currentA),[3.75]);
 assert.deepEqual(runChartSamples(run,1).map(s=>s.currentA),[0,8.25]);
 assert.deepEqual(runTimeline(run).map(a=>a.action),['reset','fault']);
 assert.equal(cycleStatus(run),'OPEN');
 assert.equal(cycleStatus(run,99),null);
});

test('cycle choices include only recorded history and the active cycle',()=>{
 const run=parseJudgeRun({...recorded,cycle:5,actions:[],observations:[]});
 assert.deepEqual(runCycles(run),[5]);
 assert.equal(cycleStatus(run,1),null);
 assert.deepEqual(runChartSamples(run),[]);
});

test('cycles must be positive safe integers and evidence cannot belong to a future cycle',()=>{
 for(const cycle of [null,0,-1,1.5,21,'2',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>parseJudgeRun({...recorded,cycle}));
  assert.throws(()=>parseJudgeRun({...cycling,actions:[{...recorded.actions[0],cycle}]}));
  assert.throws(()=>parseJudgeRun({...cycling,observations:[{...recorded.observations[0],cycle}]}));
 }
 assert.throws(()=>parseJudgeRun({...recorded,actions:[{...recorded.actions[0],cycle:2}]}));
 assert.throws(()=>parseJudgeRun({...cycling,observations:[{...recorded.observations[0],cycle:3}]}));
 assert.throws(()=>parseJudgeRun({...recorded,revision:-1}));
 assert.equal(activeCycle(parseJudgeRun({...recorded,cycle:1})),1);
});

test('only the next lifecycle action is eligible; re-arm additionally requires explicit session permission',()=>{
 const transitions={BASELINE:'fault',OPEN:'acknowledge',ACKNOWLEDGED:'recover',RESOLVING:'resolve',RESOLVED:'reset'};
 for(const [status,next] of Object.entries(transitions)){
  const run=parseJudgeRun({...cycling,status});
  for(const {key} of judgeOperations){
   assert.equal(canJudgeAct(run,2,key,true,true),key===next);
   assert.equal(canJudgeAct(run,1,key,true,true),false,'archives are always read only');
   assert.equal(canJudgeAct(run,2,key,false,true),false,'loading, stale, busy or uncertain state blocks actions');
  }
  assert.equal(canJudgeAct(run,2,'unknown',true,true),false);
 }
 const resolved=parseJudgeRun({...cycling,status:'RESOLVED'});
 assert.equal(canJudgeAct(resolved,2,'reset',true),false);
 assert.equal(canJudgeAct(resolved,2,'reset',true,false),false);
 assert.equal(canJudgeAct(resolved,2,'fault',true,true),false);
 assert.equal(canJudgeAct(parseJudgeRun({...recorded,status:'BASELINE'}),1,'fault',true),true);
});

test('verified state expires after one minute and invalid verification times fail closed',()=>{
 assert.equal(isJudgeStateFresh(1000,1000),true);
 assert.equal(isJudgeStateFresh(1000,60999),true);
 assert.equal(isJudgeStateFresh(1000,61000),false);
 assert.equal(isJudgeStateFresh(0,1000),false);
 assert.equal(isJudgeStateFresh(1000,999),false);
 assert.equal(isJudgeStateFresh(NaN,1000),false);
});

// Exercise the page handlers with local in-memory fetch and hook state. No server
// or browser session is used, and every POST below is intercepted by this harness.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as presentation from '../src/lib/judge-presentation.mts';
const require=createRequire(import.meta.url);
const ts=require('typescript') as typeof import('typescript');
const pageCode=ts.transpileModule(readFileSync(new URL('../src/app/judge/page.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
}).outputText;

type Element={type:unknown;props:Record<string,unknown>};
function pageHarness(options:{canMutate?:boolean;canRearm?:boolean;status?:string}={}){
 let stored={...cycling,status:options.status??'BASELINE'};
 const slots:unknown[]=[];
 let cursor=0;
 let failPost=false,failRead=false;
 let confirm=true;
 let releasePost:(()=>void)|undefined;
 let holdPost=false;
 const requests:{url:string;init?:RequestInit}[]=[];
 const jsx=(type:unknown,props:Record<string,unknown>):Element=>({type,props});
 const hooks={
  useState:(initial:unknown)=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],(value:unknown)=>{slots[index]=value;}];},
  useRef:(initial:unknown)=>{const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
  useCallback:(callback:unknown)=>callback,useEffect:()=>{},
 };
 const compiledModule={exports:{} as {default:()=>Element}};
 runInNewContext(pageCode,{
  module:compiledModule,exports:compiledModule.exports,Date,JSON,Error,Number,Promise,
  window:{confirm:()=>confirm},
  fetch:async(url:string,init?:RequestInit)=>{
   requests.push({url,init});
   if(init?.method==='POST'){
    if(holdPost)await new Promise<void>(resolve=>{releasePost=resolve;});
    if(failPost)throw new Error('Simulated lost response');
    const operation=url.split('/').at(-1)!;
    stored={...stored,revision:stored.revision+1,cycle:operation==='reset'?stored.cycle+1:stored.cycle,
     status:({fault:'OPEN',acknowledge:'ACKNOWLEDGED',recover:'RESOLVING',resolve:'RESOLVED',reset:'BASELINE'} as Record<string,string>)[operation]};
    return new Response('{}');
   }
   if(failRead)throw new Error('Simulated unavailable read');
   if(url==='/api/judge/session')return Response.json({authorized:true,canMutate:options.canMutate??true,canRearm:options.canRearm});
   if(url==='/api/judge/runs')return Response.json([stored]);
   return Response.json(stored);
  },
  require:(name:string)=>{
   if(name==='react')return hooks;
   if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
   if(name==='@/lib/judge-presentation.mts')return presentation;
   if(name==='@/lib/api')return {api:{getChargers:async()=>[]}};
   return new Proxy({}, {get:(_,key)=>String(key)});
  },
 });
 function render(){cursor=0;return compiledModule.exports.default();}
 function elements(node:unknown):Element[]{
  if(Array.isArray(node))return node.flatMap(elements);
  if(!node||typeof node!=='object'||!('props' in node))return [];
  const element=node as Element;
  return [element,...elements(element.props.children)];
 }
 function textOf(node:unknown):string{
  if(Array.isArray(node))return node.map(textOf).join('');
  if(node&&typeof node==='object'&&'props' in node)return textOf((node as Element).props.children);
  return typeof node==='string'||typeof node==='number'?String(node):'';
 }
 function button(label:string){
  const found=elements(render()).find(e=>e.type==='button'&&textOf(e.props.children).trim()===label);
  assert.ok(found,`Missing button: ${label}`);return found.props;
 }
 const click=(label:string)=>(button(label).onClick as ()=>void)();
 const idle=()=>new Promise<void>(resolve=>setImmediate(resolve));
 return {button,click,idle,requests,
  setFailPost:(value:boolean)=>{failPost=value;},setFailRead:(value:boolean)=>{failRead=value;},
  setConfirm:(value:boolean)=>{confirm=value;},holdPost:()=>{holdPost=true;},release:()=>releasePost?.(),
  posts:()=>requests.filter(r=>r.init?.method==='POST'),
 };
}

test('page acquires a synchronous lock and sends displayed revision/cycle exactly once',async()=>{
 const page=pageHarness();page.click('Refresh');await page.idle();
 page.holdPost();
 const fault=page.button('Trigger synthetic fault');
 assert.equal(fault.disabled,false);
 (fault.onClick as ()=>void)();(fault.onClick as ()=>void)();
 assert.equal(page.posts().length,1);
 assert.equal(page.button('Trigger synthetic fault').disabled,true);
 assert.equal(page.button('Refresh').disabled,true);
 assert.deepEqual(JSON.parse(String(page.posts()[0].init?.body)),{expectedRevision:5,expectedCycle:2});
 page.release();await page.idle();
 assert.equal(page.button('Acknowledge incident').disabled,false);
});

test('fault and re-arm confirmations can cancel; re-arm fails closed without its session flag',async()=>{
 for(const operation of [{status:'BASELINE',label:'Trigger synthetic fault'},{status:'RESOLVED',label:'Re-arm next cycle'}]){
  const page=pageHarness({status:operation.status,canRearm:true});
  page.click('Refresh');await page.idle();page.setConfirm(false);
  page.click(operation.label);await page.idle();assert.equal(page.posts().length,0);
  page.setConfirm(true);page.click(operation.label);await page.idle();assert.equal(page.posts().length,1);
 }
 for(const canRearm of [undefined,false]){
  const page=pageHarness({status:'RESOLVED',canRearm});page.click('Refresh');await page.idle();
  assert.equal(page.button('Re-arm next cycle').disabled,true);
  page.click('Re-arm next cycle');await page.idle();assert.equal(page.posts().length,0);
 }
 const production=pageHarness({canMutate:false,canRearm:true});production.click('Refresh');await production.idle();
 assert.equal(production.button('Trigger synthetic fault').disabled,true);
 production.click('Trigger synthetic fault');assert.equal(production.posts().length,0);
});

test('POST error reads back once, never retries, and stays disabled until explicit successful refresh',async()=>{
 const page=pageHarness();page.click('Refresh');await page.idle();
 page.setFailPost(true);page.click('Trigger synthetic fault');await page.idle();
 assert.equal(page.posts().length,1);
 assert.equal(page.requests.at(-1)?.url,`/api/judge/runs/${id}`);
 assert.equal(page.requests.at(-1)?.init?.method,undefined);
 assert.equal(page.button('Trigger synthetic fault').disabled,true);
 page.click('Trigger synthetic fault');assert.equal(page.posts().length,1);
 page.setFailRead(true);page.click('Refresh');await page.idle();
 page.setFailRead(false);page.click('Refresh');await page.idle();
 assert.equal(page.button('Trigger synthetic fault').disabled,false);
 assert.equal(page.posts().length,1);
});

test('a committed POST followed by failed readback remains locked until explicit refresh',async()=>{
 const page=pageHarness();page.click('Refresh');await page.idle();
 page.holdPost();page.click('Trigger synthetic fault');page.setFailRead(true);page.release();await page.idle();
 assert.equal(page.posts().length,1);
 page.setFailRead(false);page.click('Refresh');await page.idle();
 assert.equal(page.button('Acknowledge incident').disabled,false);
 assert.equal(page.posts().length,1);
});


test('backend bounds allow final records but block further writes at revision 100 and re-arm at cycle 20',()=>{
 const final=parseJudgeRun({...cycling,cycle:20,revision:100,status:'RESOLVED'});
 assert.equal(activeCycle(final),20);
 assert.equal(canJudgeAct(final,20,'reset',true,true),false);
 for(const {key,status} of judgeOperations){
  assert.equal(canJudgeAct({...final,status},20,key,true,true),false);
 }
 assert.equal(canJudgeAct({...final,revision:99},20,'reset',true,true),false);
 assert.equal(canJudgeAct({...final,revision:99,status:'BASELINE'},20,'fault',true),true);
 assert.equal(canJudgeAct({...final,cycle:19,revision:99},19,'reset',true,true),true);
 assert.throws(()=>parseJudgeRun({...cycling,revision:101}));
 assert.throws(()=>parseJudgeRun({...cycling,cycle:21}));
});
