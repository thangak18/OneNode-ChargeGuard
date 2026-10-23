import {test} from 'node:test';import assert from 'node:assert/strict';import {CloudTransport} from '../src/observability/cloud-transport';
test('cloud intake restricts destinations, fields, tags and batches; coalesces flushes',async()=>{
 const seen:{url:string;body:any}[]=[];const transport=new CloudTransport('test-only-key-abcdefghijkl',async(url,init)=>{seen.push({url:String(url),body:JSON.parse(String(init?.body))});return new Response(null,{status:202});});
 transport.log(JSON.stringify({service:'chargeguard-api',env:'prod',message:'demo.action',password:'never-send',incident_id:'demo-111111111111'}));
 transport.log(JSON.stringify({service:'unrelated',env:'prod'}));transport.metric('fault.simulated',1,'c',['run:unbounded','charger_id:demo-charger-01']);
 await Promise.all([transport.flush(),transport.flush()]);assert.equal(seen.length,2);assert.equal(seen[0].body[0].password,undefined);assert.equal(seen[1].body.series[0].interval,1);assert.ok(!JSON.stringify(seen).includes('unbounded'));assert.ok(seen.every(x=>x.url.startsWith('https://')));
});
test('cloud intake bounds queues and does not retry authentication failures',async()=>{
 let calls=0;const t=new CloudTransport('test-only-key-abcdefghijkl',async()=>{calls++;return new Response(null,{status:403});});for(let i=0;i<120;i++)t.metric('fault.simulated',1,'c',[]);await t.flush();assert.equal(calls,1);assert.equal(t.dropped,20);assert.equal(t.failed,1);
});
test('cloud transport retries transient status once and bounds network failures',async()=>{
 let calls=0;const t=new CloudTransport('test-only-key-abcdefghijkl',async()=>{calls++;return new Response(null,{status:calls===1?429:202,headers:{'retry-after':'0'}});});t.metric('ingestion.success',1,'c',[]);await t.flush();assert.equal(calls,2);
 let signalSeen=false;const failing=new CloudTransport('test-only-key-abcdefghijkl',async(_url,init)=>{signalSeen=!!init?.signal;throw new Error('private upstream details');});failing.metric('fault.simulated',1,'c',[]);await failing.flush();assert.equal(failing.failed,1);assert.equal(signalSeen,true);
});
