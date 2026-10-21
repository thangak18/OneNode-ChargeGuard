import { Resolver } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { MongoClient } from 'mongodb';
import type { AppConfig } from '../config/config';

const errorCodes = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'EBADRESP', 'ENODATA', 'ETIMEOUT', 'ECONNREFUSED',
  'ECONNRESET', 'ETIMEDOUT', 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',
  'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE', 'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
]);
export function safeDiagnosticError(error: unknown): string {
  const code = error && typeof error === 'object' ? (error as {code?:unknown}).code : undefined;
  return typeof code === 'string' && errorCodes.has(code) ? code :
    code === 18 ? 'AUTHENTICATION_FAILED' : code === 13 ? 'AUTHORIZATION_FAILED' : 'UNCLASSIFIED_ERROR';
}
export function assertAtlasTarget(host: string, port: number): void {
  if (!/^[a-z0-9.-]+\.mongodb\.net$/i.test(host) || port !== 27017) throw new Error('Invalid diagnostic target');
}
export function ipv4Allowed(address: string, cidrs: string[]): boolean {
  const number = (ip:string):number => ip.split('.').reduce((value,part)=>(value*256+Number(part))>>>0,0);
  if (net.isIP(address) !== 4) return false;
  return cidrs.some(cidr=>{
    const [ip,bitsText,...extra]=cidr.trim().split('/');
    const bits=bitsText === undefined ? 32 : Number(bitsText);
    if (extra.length || net.isIP(ip)!==4 || !/^\d+$/.test(bitsText??'32') || !Number.isInteger(bits) || bits<0 || bits>32) return false;
    const mask=bits===0?0:(0xffffffff << (32-bits))>>>0;
    return ((number(address)&mask)>>>0)===((number(ip)&mask)>>>0);
  });
}

type Probe = {status:'PASS'|'FAIL'; code?:string; certificateReceived?:boolean; certificateVerified?:boolean; protocol?:string|null};
/** Fixed Atlas destination only; default Node trust store and hostname verification remain enabled. */
export async function probeAtlasTransport(host:string,port:number,mode:'tcp'|'tls'|'tls12'):Promise<Probe> {
  assertAtlasTarget(host,port);
  return new Promise(resolve=>{
    let socket:net.Socket;
    let complete=false;
    const finish=(result:Probe):void=>{if(complete)return;complete=true;socket.destroy();resolve(result);};
    const certificateReceived=():boolean=>{
      try{return !!(socket as tls.TLSSocket).getPeerCertificate()?.raw;}catch{return false;}
    };
    if(mode==='tcp') socket=net.connect({host,port,family:4},()=>finish({status:'PASS'}));
    else {
      const options:tls.ConnectionOptions & {family:4}={host,port,family:4,servername:host,rejectUnauthorized:true,minVersion:'TLSv1.2',...(mode==='tls12'?{maxVersion:'TLSv1.2' as const}:{})};
      socket=tls.connect(options,()=>{
      const secure=socket as tls.TLSSocket;
      finish({status:secure.authorized?'PASS':'FAIL',certificateReceived:certificateReceived(),certificateVerified:secure.authorized,protocol:secure.getProtocol()});
      });
    }
    socket.setTimeout(3000,()=>finish({status:'FAIL',code:'ETIMEDOUT',...(mode==='tcp'?{}:{certificateReceived:certificateReceived(),certificateVerified:false})}));
    socket.once('error',error=>finish({status:'FAIL',code:safeDiagnosticError(error),...(mode==='tcp'?{}:{certificateReceived:certificateReceived(),certificateVerified:false})}));
  });
}

export async function diagnoseAtlas(settings:AppConfig,env:NodeJS.ProcessEnv=process.env) {
  const resolver=new Resolver({timeout:2500,tries:1});
  if(env.MONGODB_DNS_SERVERS)resolver.setServers(env.MONGODB_DNS_SERVERS.split(',').map(value=>value.trim()));
  const hostname=new URL(settings.mongoUri).hostname;
  assertAtlasTarget(hostname,27017);
  const result:Record<string,unknown>={configuration:{canonicalDatabase:settings.mongoDatabase==='chargeguard',expectedApplicationUser:decodeURIComponent(new URL(settings.mongoUri).username)==='chargeguard_dev'},timestamp:new Date().toISOString(),runtime:process.version,dnsSrv:{status:'NOT_TESTED'},dnsTxt:{status:'NOT_TESTED'},transport:[],authentication:'NOT_TESTED',ping:'NOT_TESTED',databaseRead:'NOT_TESTED',networkAccess:{status:'NOT_ASSESSED'},writesPerformed:false};
  let records:Awaited<ReturnType<typeof resolver.resolveSrv>>;
  try {records=await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);result.dnsSrv={status:records.length?'PASS':'FAIL',nodeCount:records.length};}
  catch(error){result.dnsSrv={status:'FAIL',code:safeDiagnosticError(error)};return result;}
  try {const txt=await resolver.resolveTxt(hostname);result.dnsTxt={status:'PASS',recordCount:txt.length};}
  catch(error){result.dnsTxt={status:'FAIL',code:safeDiagnosticError(error)};}
  if(!records.length || records.some(server=>{try{assertAtlasTarget(server.name,server.port);return false;}catch{return true;}}))return result;
  const transport=await Promise.all(records.slice(0,3).map(async(server,index)=>{
    const [ipv4,ipv6,tcp,secure,secure12]=await Promise.all([
      resolver.resolve4(server.name).then(values=>({status:'PASS',addressCount:values.length})).catch(error=>({status:'FAIL',code:safeDiagnosticError(error)})),
      resolver.resolve6(server.name).then(values=>({status:'PASS',addressCount:values.length})).catch(error=>({status:'FAIL',code:safeDiagnosticError(error)})),
      probeAtlasTransport(server.name,server.port,'tcp'),probeAtlasTransport(server.name,server.port,'tls'),probeAtlasTransport(server.name,server.port,'tls12'),
    ]);
    return {node:index+1,ipv4,ipv6,tcp,tls:secure,tls12:secure12};
  }));
  result.transport=transport;
  // Optional comparison against a read-only Atlas UI snapshot, never a rule update.
  // The egress address stays in memory and is never returned, hashed or logged.
  const observedRules=env.ATLAS_DIAGNOSTIC_ALLOWED_CIDRS?.split(',').map(value=>value.trim()).filter(Boolean);
  if(observedRules?.length) {
    try {
      const response=await fetch('https://api.ipify.org?format=json',{signal:AbortSignal.timeout(2500),redirect:'error'});
      if(!response.ok || Number(response.headers.get('content-length')??0)>512)throw new Error('Unavailable');
      const data=await response.json() as {ip?:unknown};
      if(typeof data.ip!=='string'||net.isIP(data.ip)!==4)throw new Error('Unavailable');
      result.networkAccess={status:'ASSESSED',egressMatchesObservedRules:ipv4Allowed(data.ip,observedRules),ruleCount:observedRules.length,note:'External HTTPS egress observation; MongoDB socket NAT identity is not independently proven.'};
    } catch {result.networkAccess={status:'OBSERVATION_UNAVAILABLE'};}
  }
  // Do not send credentials until verified secure transport has succeeded.
  if(!transport.length || transport.some(node=>node.tls.status!=='PASS'))return result;
  const client=new MongoClient(settings.mongoUri,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,socketTimeoutMS:5000,maxPoolSize:1,minPoolSize:0});
  try {
    await client.connect();
    const db=client.db(settings.mongoDatabase);
    const status=await db.admin().command({connectionStatus:1,showPrivileges:true},{timeoutMS:3000});
    const expected=status.authInfo?.authenticatedUsers?.length===1 && status.authInfo.authenticatedUsers[0].user==='chargeguard_dev';
    result.authentication=expected?'PASS_EXPECTED_APPLICATION_USER':'FAIL_UNEXPECTED_IDENTITY';
    if(!expected)return result;
    const roles=status.authInfo.authenticatedUserRoles ?? [];
    const privileges=status.authInfo.authenticatedUserPrivileges ?? [];
    result.authorization={expectedCustomRoleOnly:roles.length===1 && roles[0].role==='chargeguard_rw',broadRolesAbsent:roles.every((r:{role:string})=>!['atlasAdmin','root','readWriteAnyDatabase','dbAdminAnyDatabase','userAdminAnyDatabase','clusterAdmin'].includes(r.role)),privilegesScopedToChargeguard:privileges.length>0 && privileges.every((p:{resource:{db?:string;cluster?:boolean}})=>p.resource.db==='chargeguard' && !p.resource.cluster)};
    result.ping=(await db.admin().command({ping:1},{timeoutMS:3000})).ok===1?'PASS':'FAIL';
    const charger=await db.collection('chargers').findOne({}, {projection:{_id:1},maxTimeMS:3000});
    result.databaseRead={status:'PASS',chargerPresent:!!charger};
  } catch(error){result.driverFailure=safeDiagnosticError(error);}
  finally {await client.close().catch(()=>{});}
  return result;
}
