import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fetchWithDeadline, upstreamTimeoutMs, isJsonResponse } from '../src/lib/upstream-policy.mts';
import { startSerialPolling } from '../src/lib/polling.mts';
import { api, pendingReadCount, cancelPendingReads } from '../src/lib/api.ts';
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('read budget supports a Render wake-up without lengthening or retrying writes',()=>{
  const render=new URL('https://fixture.onrender.com');
  assert.ok(upstreamTimeoutMs(render,'GET')>60_000 && upstreamTimeoutMs(render,'GET')<120_000);
  assert.equal(upstreamTimeoutMs(render,'POST'),20_000);
  assert.equal(upstreamTimeoutMs(new URL('http://localhost:3001'),'GET'),20_000);
  assert.equal(isJsonResponse('text/html; charset=utf-8'),false);
  assert.equal(isJsonResponse('application/problem+json'),true);
});
test('controlled HTTP delay verifies timeout, caller cancellation and no redirect following',async()=>{
  const server=createServer((req,res)=>{
    if(req.url==='/redirect'){res.writeHead(302,{Location:'/delayed'});res.end();return;}
    setTimeout(()=>{if(!res.destroyed){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');}},70);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('Fixture unavailable');
  const base=`http://127.0.0.1:${address.port}`;
  try {
    const successful=await fetchWithDeadline(new URL(base+'/delayed'),{},new AbortController().signal,2000);
    assert.deepEqual(await successful.json(),{ok:true});
    await assert.rejects(fetchWithDeadline(new URL(base+'/delayed'),{},new AbortController().signal,5),{name:'TimeoutError'});
    const controller=new AbortController();
    const cancelled=fetchWithDeadline(new URL(base+'/delayed'),{},controller.signal,2000);controller.abort();
    await assert.rejects(cancelled,{name:'AbortError'});
    const redirect=await fetchWithDeadline(new URL(base+'/redirect'),{},new AbortController().signal,2000);
    assert.equal(redirect.status,302);await redirect.body?.cancel();
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('serial polling does not overlap a slow loader and stops while hidden or disposed',async()=>{
  let calls=0,allow=false,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const stop=startSerialPolling(async()=>{calls++;await gate;},2,()=>allow);
  try {
    await sleep(12);assert.equal(calls,0);allow=true;
    await sleep(15);assert.equal(calls,1);
    await sleep(12);assert.equal(calls,1);
    stop();release();await sleep(12);assert.equal(calls,1);
  } finally {stop();release();}
});
test('client coalesces duplicate reads, cancels them on cleanup, and never retries mutations',async()=>{
  const original=globalThis.fetch;let calls=0;let deliver!:(r:Response)=>void;
  try {
    globalThis.fetch=async(_input,init)=>{calls++;return new Promise<Response>((resolve,reject)=>{deliver=resolve;init?.signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});};
    const first=api.getChargers(),second=api.getChargers();assert.equal(calls,1);assert.equal(pendingReadCount(),1);
    deliver(Response.json([]));assert.deepEqual(await first,[]);assert.deepEqual(await second,[]);assert.equal(pendingReadCount(),0);
    const aborted=api.getStations();cancelPendingReads();await assert.rejects(aborted,{name:'AbortError'});assert.equal(pendingReadCount(),0);
    calls=0;globalThis.fetch=async()=>{calls++;return Response.json({message:'Unavailable'},{status:503});};
    await assert.rejects(api.triggerFault(),/Unavailable/);assert.equal(calls,1);
  } finally {cancelPendingReads();globalThis.fetch=original;}
});
