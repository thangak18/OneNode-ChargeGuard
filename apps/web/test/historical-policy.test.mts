import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canReadHistorical} from '../src/lib/historical-policy.mts';
function request(headers:Record<string,string>={},method='GET'){return new Request('http://127.0.0.1:3000/api/historical',{method,headers:{host:'127.0.0.1:3000',...headers}});}
test('historical access is explicit, loopback, read-only and never production',()=>{
  assert.equal(canReadHistorical(request(),'development','true'),true);
  for(const [env,flag] of [['production','true'],['development',undefined],['test','true']])assert.equal(canReadHistorical(request(),env,flag),false);
  assert.equal(canReadHistorical(request({},'POST'),'development','true'),false);
  const invalidHeaders:Array<Record<string,string>>=[{origin:'https://external.example'},{host:'external.example'},{'sec-fetch-site':'cross-site'}];
  for(const headers of invalidHeaders)assert.equal(canReadHistorical(request(headers),'development','true'),false);
});

test('Next loopback alias normalization preserves strict request-origin and port checks',()=>{
  const normalized=new Request('http://localhost:3000/api/historical',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}});
  assert.equal(canReadHistorical(normalized,'development','true'),true);
  const wrongPort=new Request('http://localhost:3000/api/historical',{headers:{host:'127.0.0.1:4000'}});
  assert.equal(canReadHistorical(wrongPort,'development','true'),false);
  const credentials=new Request('http://localhost:3000/api/historical',{headers:{host:'user@127.0.0.1:3000'}});
  assert.equal(canReadHistorical(credentials,'development','true'),false);
});
