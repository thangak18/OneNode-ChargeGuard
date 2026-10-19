import {promises as dns} from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';
import {MongoClient,MongoServerError} from 'mongodb';
import {loadLocalEnv,validateConfig} from '../src/config/config';
async function probe(host:string,port:number,secure:boolean):Promise<string> {
  return new Promise(resolve=>{
    let socket:net.Socket;
    const finish=(value:string)=>{socket.destroy();resolve(value);};
    socket=secure?tls.connect({host,port,servername:host,rejectUnauthorized:true},()=>finish((socket as tls.TLSSocket).authorized?'PASS_CERT_VERIFIED':'FAIL_CERT')):net.connect({host,port},()=>finish('PASS'));
    socket.setTimeout(5000,()=>finish('TIMEOUT'));
    socket.once('error',(error:NodeJS.ErrnoException)=>finish(error.code==='ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'?error.code:'NETWORK_OR_CERTIFICATE_ERROR'));
  });
}
async function main():Promise<void> {
  loadLocalEnv();const config=validateConfig(process.env);const host=new URL(config.mongoUri).hostname;
  const servers=await dns.resolveSrv(`_mongodb._tcp.${host}`);
  console.log('ATLAS_DNS_SRV PASS',servers.length);
  const results=await Promise.all(servers.map(async(server,i)=>({node:i+1,tcp:await probe(server.name,server.port,false),tls:await probe(server.name,server.port,true)})));
  console.log(JSON.stringify({transport:results}));
  if(results.some(result=>result.tls!=='PASS_CERT_VERIFIED')) {console.log('ATLAS_AUTH_AND_PING SKIPPED_TLS_FAILED');process.exitCode=1;return;}
  const client=new MongoClient(config.mongoUri,{serverSelectionTimeoutMS:10000});
  try {
    await client.connect();const db=client.db(config.mongoDatabase);
    if((await db.admin().ping()).ok!==1) throw new Error('Ping failed');
    console.log('ATLAS_AUTHENTICATED_PING PASS');
    const status=await db.admin().command({connectionStatus:1,showPrivileges:true});
    const expected=status.authInfo.authenticatedUsers.length===1 && status.authInfo.authenticatedUsers[0].user==='chargeguard_dev' && status.authInfo.authenticatedUserRoles.length===1 && status.authInfo.authenticatedUserRoles[0].role==='chargeguard_rw' && status.authInfo.authenticatedUserPrivileges.every((p:{resource:{db:string}})=>p.resource.db==='chargeguard');
    if(!expected)throw new Error('Unexpected application identity or privileges');
    console.log('ATLAS_SCOPED_APPLICATION_USER PASS');
    await db.collection('stations').findOne({_id:{$exists:false}},{projection:{_id:1}});
    console.log('ATLAS_DATABASE_READ PASS');
  } catch(error) {
    console.log('ATLAS_AUTH_OR_COMMAND FAIL',error instanceof MongoServerError && error.code===18?'AUTHENTICATION':error instanceof MongoServerError && error.code===13?'AUTHORIZATION':'CONNECTION_OR_COMMAND');
    process.exitCode=1;
  } finally {await client.close();}
}
void main().catch(()=>{console.error('ATLAS_DIAGNOSTIC FAIL (details withheld)');process.exitCode=1;});
