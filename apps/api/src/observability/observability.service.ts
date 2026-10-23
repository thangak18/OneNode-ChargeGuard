import { CloudTransport } from './cloud-transport';
import { isHostedRuntime } from '../config/runtime';
import { LoggerService, OnModuleDestroy } from '@nestjs/common';
import { createSocket, Socket } from 'node:dgram';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { z } from 'zod';
import type { TelemetryInput } from '../telemetry/telemetry.schema';

const station = 'demo-station-01';
const chargers = new Set(Array.from({length:5},(_,i)=>`demo-charger-${String(i+1).padStart(2,'0')}`));
export const states = ['AVAILABLE','CHARGING','NOT_CHARGING','IDLE','FAULT','OFFLINE'] as const;
export type ObsConfig = {enabled:boolean; port:number; env:string; logFile?:string; stdout:boolean};
export function observabilityConfig(env:NodeJS.ProcessEnv):ObsConfig {
  if (isHostedRuntime(env) && (env.DD_METRICS_ENABLED === 'true' || env.CHARGEGUARD_LOG_FILE)) throw new Error('Local Agent and file logging are unavailable on hosted runtimes; use stdout and an approved cloud integration.');
  const result=z.object({
    DD_METRICS_ENABLED:z.enum(['true','false']).default('false'),
    DD_DOGSTATSD_PORT:z.coerce.number().int().min(1).max(65535).default(8125),
    DD_AGENT_HOST:z.literal('127.0.0.1').default('127.0.0.1'),
    DD_ENV:z.enum(['dev','test','staging','prod']).default('dev'),
    CHARGEGUARD_LOG_FILE:z.string().min(1).optional()
  }).safeParse(env);
  if(!result.success) throw new Error('Invalid observability configuration (values withheld)');
  if(result.data.CHARGEGUARD_LOG_FILE && !isAbsolute(result.data.CHARGEGUARD_LOG_FILE)) throw new Error('CHARGEGUARD_LOG_FILE must be absolute');
  return {enabled:result.data.DD_METRICS_ENABLED==='true',port:result.data.DD_DOGSTATSD_PORT,env:result.data.DD_ENV,logFile:result.data.CHARGEGUARD_LOG_FILE,stdout:true};
}

/** Fixed metric names, fixed local destination, bounded tags. Observability never blocks ingestion. */
export class ObservabilityService implements OnModuleDestroy {
  private socket?:Socket;
  private cloud?:CloudTransport;
  private cloudTimer?:ReturnType<typeof setInterval>;
  private pending=new Set<Promise<void>>();
  private warned=false;
  constructor(readonly config:ObsConfig) {
    if(process.env.DD_CLOUD_ENABLED==='true' && config.env==='prod') {
      this.cloud=new CloudTransport(process.env.DD_API_KEY??'');
      this.cloudTimer=setInterval(()=>{void this.cloud?.flush();},5000);this.cloudTimer.unref();
    }
    if(config.enabled) {
      this.socket=createSocket('udp4');
      this.socket.on('error',()=>this.deliveryWarning());
      this.socket.unref();
    }
  }
  private deliveryWarning():void {
    if(!this.warned) {this.warned=true;this.record('warning','observability.delivery_unavailable');}
  }
  private metric(name:string,value:number,type:'c'|'g'|'ms',tags:string[]=[]):void {
    this.cloud?.metric(name,value,type,tags);
    if(!this.socket || !Number.isFinite(value)) return;
    const packet=`chargeguard.${name}:${value}|${type}|#service:chargeguard-api,env:${this.config.env},${tags.join(',')}`.replace(/,$/,'');
    let done!:()=>void;
    const promise=new Promise<void>(resolve=>{done=resolve;});
    this.pending.add(promise);
    try {this.socket.send(packet,this.config.port,'127.0.0.1',error=>{if(error)this.deliveryWarning();this.pending.delete(promise);done();});}
    catch {this.pending.delete(promise);done();this.deliveryWarning();}
  }
  /** Request counters include guard/schema rejection; a batch is one HTTP request. */
  ingestionRequest(status:number,durationMs:number,batch:boolean):void {
    const success=status>=200 && status<300;
    const tags=[`mode:${batch?'batch':'single'}`,`status_class:${Math.floor(status/100)}xx`];
    this.metric(`ingestion.${success?'success':'failure'}`,1,'c',tags);
    this.metric('ingestion.processing_ms',durationMs,'ms',[...tags,`outcome:${success?'success':'failure'}`]);
    this.record(success?'info':'warning','ingestion.request',{status_code:status,duration_ms:durationMs,mode:batch?'batch':'single',outcome:success?'success':'failure'});
  }
  accepted(input:TelemetryInput,duplicate:boolean):void {
    const source=input.provenance.sourceType.toLowerCase();
    const tags=[`source:${source}`];
    const match=/^b2-([a-f0-9]{12})-/.exec(input.eventId);
    const context=match?{demo_id:match[1],incident_id:`demo-${match[1]}`,station_id:input.meta.stationId,charger_id:input.meta.chargerId}:{};
    this.metric(`telemetry.${duplicate?'duplicate':'accepted'}`,1,'c',tags);
    if(duplicate) return; // A retry must not create a second fault/current observation.
    const assetTags=input.meta.stationId===station && chargers.has(input.meta.chargerId)
      ? [`station_id:${station}`,`charger_id:${input.meta.chargerId}`] : ['asset_scope:other'];
    if(input.currentA!==undefined) this.metric('charger.current_a',input.currentA,'g',[...tags,...assetTags,`origin:${input.provenance.fields.currentA!.toLowerCase()}`]);
    if(input.chargingState) {
      // One-hot update resets previous states. Observed telemetry state, not verified hardware availability.
      for(const state of states) this.metric('charger.operational_status',state===input.chargingState?1:0,'g',[...tags,...assetTags,`status:${state.toLowerCase()}`]);
    }
    const syntheticFault=(input.chargingState==='FAULT' && input.provenance.fields.chargingState==='SYNTHETIC') ||
      (input.faultCode!==undefined && input.provenance.fields.faultCode==='SYNTHETIC');
    if(syntheticFault) {
      this.metric('fault.simulated',1,'c',assetTags);
      this.record('warning','fault.simulated',{...context,source:'synthetic',asset_scope:assetTags[0]==='asset_scope:other'?'other':'demo'});
    }
    this.record('info','telemetry.accepted',{...context,source,asset_scope:assetTags[0]==='asset_scope:other'?'other':'demo'});
  }
  /** Only explicitly allowed operational fields reach disk/stdout; never raw errors, payloads or headers. */
  record(level:'info'|'warning'|'error',event:string,fields:Record<string,unknown>={}):void {
    const allowedEvents=['ingestion.request','telemetry.accepted','fault.simulated','observability.delivery_unavailable','framework.log','framework.error','framework.warning','application.startup_failed','database.connected','database.unavailable','demo.action'];
    const safe:Record<string,unknown>={};
    for(const key of ['status_code','duration_ms']) if(typeof fields[key]==='number' && Number.isFinite(fields[key])) safe[key]=fields[key];
    const values:Record<string,string[]>={mode:['single','batch'],outcome:['success','failure'],source:['synthetic','derived','acn_replay'],asset_scope:['demo','other'],action:['baseline','fault_injected','investigate','recovery_requested','resolved']};
    for(const [key,options] of Object.entries(values)) if(typeof fields[key]==='string' && options.includes(fields[key] as string)) safe[key]=fields[key];
    if(typeof fields.demo_id==='string' && /^[a-f0-9]{12}$/.test(fields.demo_id)) safe.demo_id=fields.demo_id;
    if(typeof fields.incident_id==='string' && /^demo-[a-f0-9]{12}$/.test(fields.incident_id)) safe.incident_id=fields.incident_id;
    if(fields.station_id===station) safe.station_id=station;
    if(typeof fields.charger_id==='string' && chargers.has(fields.charger_id)) safe.charger_id=fields.charger_id;
    const line=JSON.stringify({timestamp:new Date().toISOString(),status:level,service:'chargeguard-api',env:this.config.env,message:allowedEvents.includes(event)?event:'framework.log',...safe})+'\n';
    this.cloud?.log(line);
    if(this.config.stdout) process.stdout.write(line);
    if(this.config.logFile) {
      try {
        mkdirSync(dirname(this.config.logFile),{recursive:true});
        if(existsSync(this.config.logFile) && statSync(this.config.logFile).size>=5*1024*1024) renameSync(this.config.logFile,this.config.logFile+'.1');
        appendFileSync(this.config.logFile,line,{mode:0o644});
      } catch {if(!this.warned) {this.warned=true;process.stderr.write('{"status":"warning","service":"chargeguard-api","message":"observability.delivery_unavailable"}\n');}}
    }
  }
  async flush():Promise<void> {await Promise.all([...this.pending]);await this.cloud?.flush();}
  async onModuleDestroy():Promise<void> {
    if(this.cloudTimer)clearInterval(this.cloudTimer);
    await this.flush();
    // A never-used UDP socket has not auto-bound; close can throw in that case.
    try {this.socket?.close();} catch { /* no bound socket to close */ }
    this.socket=undefined;
  }
}

/** Framework message arguments may contain raw errors/configuration: intentionally not serialized. */
export class JsonFrameworkLogger implements LoggerService {
  constructor(private readonly obs:ObservabilityService){}
  log(message:unknown,..._args:unknown[]):void {this.obs.record('info',message==='MongoDB connected, server ping succeeded'?'database.connected':'framework.log');}
  error(message:unknown,..._args:unknown[]):void {this.obs.record('error',message==='MongoDB connection/ping failed (sensitive details omitted)'?'database.unavailable':'framework.error');}
  warn(..._args:unknown[]):void {this.obs.record('warning','framework.warning');}
  debug(..._args:unknown[]):void {}
  verbose(..._args:unknown[]):void {}
  fatal(..._args:unknown[]):void {this.obs.record('error','framework.error');}
}
