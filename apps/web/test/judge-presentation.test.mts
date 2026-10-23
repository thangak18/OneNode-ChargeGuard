import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseJudgeRun,runChartSamples,runTimeline} from '../src/lib/judge-presentation.mts';

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
