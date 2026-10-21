import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAtlasTarget, ipv4Allowed, probeAtlasTransport, safeDiagnosticError } from '../src/database/atlas-diagnostics';
import { AtlasDiagnosticsController } from '../src/health/atlas-diagnostics.controller';

test('diagnostics never return arbitrary error messages or codes',()=>{
  assert.equal(safeDiagnosticError({code:'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',message:'private infrastructure'}),'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR');
  assert.equal(safeDiagnosticError({code:'private-value',message:'private infrastructure'}),'UNCLASSIFIED_ERROR');
  assert.equal(safeDiagnosticError({code:18}),'AUTHENTICATION_FAILED');
  assert.equal(safeDiagnosticError({code:13}),'AUTHORIZATION_FAILED');
});
test('diagnostic targets are restricted to Atlas names and the MongoDB port',async()=>{
  assert.doesNotThrow(()=>assertAtlasTarget('node.example.mongodb.net',27017));
  for(const [host,port] of [['127.0.0.1',27017],['169.254.169.254',27017],['example.mongodb.net.attacker.test',27017],['example.mongodb.net',443]] as const) {
    assert.throws(()=>assertAtlasTarget(host,port));
    await assert.rejects(probeAtlasTransport(host,port,'tls'));
  }
});
test('observed IPv4 allowlist comparisons support exact addresses and CIDRs without modification',()=>{
  assert.equal(ipv4Allowed('192.0.2.17',['192.0.2.17/32']),true);
  assert.equal(ipv4Allowed('192.0.2.18',['192.0.2.17/32']),false);
  assert.equal(ipv4Allowed('192.0.2.17',['192.0.2.0/24']),true);
  assert.equal(ipv4Allowed('192.0.2.17',['192.0.3.0/24']),false);
  assert.equal(ipv4Allowed('192.0.2.17',['malformed','192.0.2.17/33','192.0.2.17/']),false);
  assert.equal(ipv4Allowed('::1',['192.0.2.17/32']),false);
});
test('diagnostic controller is disabled by default even before any network probe',async()=>{
  const previous=process.env.ATLAS_DIAGNOSTICS_ENABLED;delete process.env.ATLAS_DIAGNOSTICS_ENABLED;
  try {
    const controller=new AtlasDiagnosticsController({mongoUri:'unused',mongoDatabase:'chargeguard',port:3001,nodeEnv:'test'});
    await assert.rejects(controller.inspect(),/Not Found/);
  } finally {if(previous!==undefined)process.env.ATLAS_DIAGNOSTICS_ENABLED=previous;}
});

test('diagnostic enablement requires an unexpired deadline no more than thirty minutes away',async()=>{
  const keys=['VERCEL','ATLAS_DIAGNOSTICS_ENABLED','ATLAS_DIAGNOSTICS_UNTIL'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{VERCEL:'1',ATLAS_DIAGNOSTICS_ENABLED:'true'});
  try {
    const controller=new AtlasDiagnosticsController({mongoUri:'unused',mongoDatabase:'chargeguard',port:3001,nodeEnv:'test'});
    for(const deadline of ['', 'invalid',new Date(Date.now()-1000).toISOString(),new Date(Date.now()+31*60*1000).toISOString()]) {
      process.env.ATLAS_DIAGNOSTICS_UNTIL=deadline;
      await assert.rejects(controller.inspect(),/Not Found/);
    }
  } finally {for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
