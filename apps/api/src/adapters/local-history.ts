import {readFile,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep,basename} from 'node:path';
import {LocalAcnCsvAdapter} from './acn.adapter';
export const ACN_REVISION='abb7cf15cc7108913e965d4375cc7270d532b65f';
export const LOCAL_REPLAY_ANCHOR='2026-10-19T00:00:00.000Z';
export const HISTORICAL_SESSIONS=Array.from({length:5},(_,i)=>`sample_${String(i+1).padStart(2,'0')}`);

type InventoryEntry={local_file:string;source_path:string;sha256:string;bytes:number;rows:number};
export async function readLocalHistory(repositoryRoot:string,session:string,speed=600) {
  if(!HISTORICAL_SESSIONS.includes(session) || !Number.isFinite(speed) || speed<1 || speed>86400) throw new Error('Invalid local historical selection');
  const directory=await realpath(resolve(repositoryRoot,'data/raw/acn'));
  const manifest=JSON.parse(await readFile(resolve(directory,'manifest.local.json'),'utf8')) as {commit:string;files:InventoryEntry[]};
  if(manifest.commit!==ACN_REVISION || !Array.isArray(manifest.files) || manifest.files.length!==5) throw new Error('Unverified ACN inventory');
  const entry=manifest.files.find(item=>item.local_file===`${session}.csv.gz`);
  if(!entry || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isInteger(entry.rows) || entry.rows<1 || entry.rows>100000) throw new Error('Invalid local ACN inventory entry');
  const path=await realpath(resolve(directory,`${session}.csv.gz`));
  if(!path.startsWith(directory+sep) || (await stat(path)).size>2_000_000) throw new Error('Historical file outside allowed bounds');
  const bytes=await readFile(path);
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256 || bytes.length!==entry.bytes) throw new Error('Local ACN checksum mismatch');
  const prefixes=manifest.files.map(item=>/^(.+?)-\d{4}-\d\d-\d\dT/.exec(basename(item.source_path))?.[1]);
  if(prefixes.some(prefix=>!prefix)) throw new Error('Unverified source identifier format');
  const uniquePrefixes=[...new Set(prefixes)].sort();
  const evseAlias=`local-evse-${String(uniquePrefixes.indexOf(prefixes[manifest.files.indexOf(entry)])+1).padStart(2,'0')}`;
  let rowsParsed=0;let firstSourceAt:string|undefined;let lastSourceAt:string|undefined;
  const points=[];
  for await(const reading of new LocalAcnCsvAdapter().loadSession({localPath:path,virtualStationId:'local-acn-site',virtualChargerId:evseAlias,sessionLabel:`${ACN_REVISION}:${entry.sha256}`},{replayStartedAt:new Date(LOCAL_REPLAY_ANCHOR),speed,minIntervalSeconds:60,maxEvents:1000,onSourceRow:at=>{rowsParsed++;firstSourceAt??=at;lastSourceAt=at;}})) {
    points.push({eventId:reading.eventId,sourceEventAt:reading.sourceEventAt!,replayAt:reading.ts,currentA:reading.currentA,sourceChargingState:reading.sourceChargingState,sourceEnergyKWh:reading.sourceEnergyKWh,chargingState:reading.chargingState,qualityFlags:reading.qualityFlags??[],provenance:reading.provenance});
  }
  if(rowsParsed!==entry.rows) throw new Error('Historical session exceeds preview bounds or inventory row count differs');
  return {session,evseAlias,uniqueExportedEvseIds:uniquePrefixes.length,physicalIdentityVerified:false,revision:ACN_REVISION,hashVerified:true,rowsParsed,pointsEmitted:points.length,minIntervalSeconds:60,speed,replayAnchor:LOCAL_REPLAY_ANCHOR,firstSourceAt,lastSourceAt,permissions:{cloudProcessing:'NOT_AUTHORIZED',publicVisualization:'NOT_CONFIRMED',redistribution:'NOT_CONFIRMED'},points};
}
export type LocalHistory=Awaited<ReturnType<typeof readLocalHistory>>;
