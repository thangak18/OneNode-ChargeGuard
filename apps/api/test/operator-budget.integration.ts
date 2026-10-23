import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient} from 'mongodb';
import {DurableOperatorBudget,type OperatorIdentity} from '../src/common/operator-preflight';
let mongod:MongoMemoryServer;let client:MongoClient;
before(async()=>{mongod=await MongoMemoryServer.create({binary:{version:'8.0.16'}});client=new MongoClient(mongod.getUri());await client.connect();});
after(async()=>{await client?.close();await mongod?.stop();});
const identity=(nonce:string):OperatorIdentity=>({subject:'github:123',nonce,expiresAt:Math.floor(Date.now()/1000)+30,operation:'fault'});
test('durable budget rejects assertion replay across independent service instances',async()=>{
 const records=client.db('isolated_policy_test').collection<{_id:string;count?:number;expiresAt:Date}>('replay');
 const first=new DurableOperatorBudget(records);const restarted=new DurableOperatorBudget(records);
 await first.consume(identity('a'.repeat(32)),3);
 await assert.rejects(restarted.consume(identity('a'.repeat(32)),3),/budget denied/);
 assert.equal(await records.countDocuments({_id:/^nonce:/}),1);
});
test('durable quota bounds concurrent requests across instances and fails closed',async()=>{
 const records=client.db('isolated_policy_test').collection<{_id:string;count?:number;expiresAt:Date}>('quotas');
 const result=await Promise.allSettled(Array.from({length:20},(_,i)=>new DurableOperatorBudget(records).consume(identity(i.toString(16).padStart(32,'0')),3)));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,3);
 const counter=await records.findOne({_id:/^quota:/});assert.equal(counter?.count,3);
 const restarted=new DurableOperatorBudget(records);await assert.rejects(restarted.consume(identity('b'.repeat(32)),3));
 const broken=new DurableOperatorBudget({insertOne:async()=>{throw new Error('Database unavailable');}} as never);
 await assert.rejects(broken.consume(identity('c'.repeat(32)),3),/budget denied/);
 await assert.rejects(restarted.consume({...identity('d'.repeat(32)),expiresAt:0},3));
});
test('ambiguous quota failure retains nonce; replay fails closed without mutating run state',async()=>{
 const records=client.db('isolated_policy_test').collection<{_id:string;count?:number;expiresAt:Date}>('partial_failure');
 const saved=identity('e'.repeat(32));
 const partial=new DurableOperatorBudget({
  insertOne: (doc: Parameters<typeof records.insertOne>[0])=>records.insertOne(doc),
  updateOne: async()=>{throw new Error('simulated quota persistence outage');},
 } as never);
 await assert.rejects(partial.consume(saved,3),/Operator budget denied/);
 assert.equal(await records.countDocuments({_id:/^nonce:/}),1);
 assert.equal(await records.countDocuments({_id:/^quota:/}),0);
 await assert.rejects(new DurableOperatorBudget(records).consume(saved,3),/Operator budget denied/);
 // Another fresh assertion is independently admitted after recovery.
 await new DurableOperatorBudget(records).consume(identity('f'.repeat(32)),3);
 assert.equal((await records.findOne({_id:/^quota:/}))?.count,1);
});
test('fixed-minute quota enforces each window but permits a documented boundary burst',async()=>{
 const records=client.db('isolated_policy_test').collection<{_id:string;count?:number;expiresAt:Date}>('boundary');
 const nearEnd=Math.floor(Date.now()/60000)*60000+59900;
 const adjacent=nearEnd+200;
 const valid=(number:number):OperatorIdentity=>({subject:'github:456',operation:'reset',
  nonce:number.toString(16).padStart(32,'0'),expiresAt:Math.floor(adjacent/1000)+120});
 const budget=new DurableOperatorBudget(records);
 for(let i=0;i<3;i++)await budget.consume(valid(i),3,nearEnd);
 await assert.rejects(budget.consume(valid(3),3,nearEnd),/Operator budget denied/);
 for(let i=4;i<7;i++)await budget.consume(valid(i),3,adjacent);
 await assert.rejects(budget.consume(valid(7),3,adjacent),/Operator budget denied/);
 const windows=await records.find({_id:/^quota:/}).toArray();
 assert.equal(windows.length,2);
 assert.ok(windows.every(w=>w.count===3));
});
