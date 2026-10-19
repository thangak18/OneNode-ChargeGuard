import {createReadStream} from 'node:fs';
import {access} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import type {TelemetryInput} from '../telemetry/telemetry.schema';

export interface SessionReference {
  localPath: string;
  virtualStationId: string;
  virtualChargerId: string;
  /** Optional stable, pseudonymous label; never use a source user identifier. */
  sessionLabel?: string;
}

export interface ReplayOptions {
  replayStartedAt: Date;
  /** Source seconds per replay second: 600 = 10 minutes of source per second. */
  speed: number;
  /** Sample no more often than this many source seconds. */
  minIntervalSeconds: number;
  maxEvents: number;
  /** Local audit only. Called after each source timestamp/current/energy row is validated. */
  onSourceRow?: (sourceEventAt:string)=>void;
}

export interface HistoricalTelemetryAdapter {
  readonly source: 'ACN_REPLAY';
  loadSession(reference: SessionReference, options: ReplayOptions): AsyncIterable<TelemetryInput>;
}

/** Parses a CSV record with escaped double quotes. Raw records are never logged. */
function csvFields(line:string):string[] {
  const fields:string[]=[];
  let field='';let quoted=false;
  for(let i=0;i<line.length;i++) {
    const ch=line[i];
    if(ch==='"') {
      if(quoted && line[i+1]==='"') {field+='"';i++;}
      else quoted=!quoted;
    } else if(ch===',' && !quoted) {fields.push(field);field='';}
    else field+=ch;
  }
  if(quoted) throw new Error('Malformed ACN CSV record');
  fields.push(field);
  return fields;
}

function numberOrUndefined(value:string, field:string):number|undefined {
  if(!value.trim()) return undefined;
  const parsed=Number(value);
  if(!Number.isFinite(parsed) || parsed<0) throw new Error(`Invalid ACN ${field} value`);
  return parsed;
}

/** Streams local CSV.gz inputs. Processing permission is enforced separately at any cloud boundary. */
export class LocalAcnCsvAdapter implements HistoricalTelemetryAdapter {
  readonly source='ACN_REPLAY' as const;

  async *loadSession(reference:SessionReference, options:ReplayOptions):AsyncIterable<TelemetryInput> {
    const {localPath,virtualStationId,virtualChargerId}=reference;
    if(!localPath.endsWith('.csv.gz')) throw new Error('Expected a local ACN .csv.gz file');
    if(!Number.isFinite(options.speed) || options.speed<=0 || options.speed>86400 ||
       !Number.isInteger(options.minIntervalSeconds) || options.minIntervalSeconds<1 ||
       !Number.isInteger(options.maxEvents) || options.maxEvents<1 || options.maxEvents>1000 ||
       !Number.isFinite(options.replayStartedAt.getTime())) throw new Error('Invalid bounded replay options');

    const sessionLabel=reference.sessionLabel??basename(localPath,'.csv.gz');
    const sessionId=`acn-${createHash('sha256').update(sessionLabel).digest('hex').slice(0,24)}`;
    await access(localPath).catch(()=>{throw new Error('Local ACN file is unavailable');});
    const source=createReadStream(localPath);
    const decoded=createGunzip();
    source.on('error',error=>decoded.destroy(error));
    const rows=createInterface({input:source.pipe(decoded),crlfDelay:Infinity});
    let streamFailed=false;
    decoded.on('error',()=>{streamFailed=true;rows.close();});
    let columnCount=0;
    let sourceRows=0;
    let columns:Record<string,number>|undefined;
    let firstSourceTime:number|undefined;
    let previousSourceTime:number|undefined;
    let lastEmittedTime:number|undefined;
    let previousEnergy:number|undefined;
    let resetSinceEmission=false;
    let emitted=0;
    try {
      for await (const line of rows) {
        if(!columns) {
          const headers=csvFields(line.replace(/^\uFEFF/,''));
          const headerIndexes=Object.fromEntries(headers.map((header,i)=>[header.trim(),i]));
          if(new Set(headers).size!==headers.length) throw new Error('Duplicate ACN CSV headers');
          columnCount=headers.length;
          columns=headerIndexes;
          if(!['','Charging Current (A)','Charging State','Energy Delivered (kWh)'].every(key=>key in headerIndexes))
            throw new Error('Missing expected ACN CSV columns');
          continue;
        }
        if(!line.trim()) continue;
        const values=csvFields(line);
        if(values.length!==columnCount) throw new Error('Malformed ACN CSV row width');
        if(++sourceRows>100000) throw new Error('ACN source row limit exceeded');
        const columnIndexes=columns;
        const read=(column:string)=>values[columnIndexes[column]]?.trim()??'';
        const sourceTime=Date.parse(read(''));
        if(!Number.isFinite(sourceTime) || !/(?:[zZ]|[+-]\d\d:\d\d)$/.test(read('')))
          throw new Error('ACN timestamp requires an explicit timezone');
        if(previousSourceTime!==undefined && sourceTime<=previousSourceTime)
          throw new Error('ACN timestamps must be strictly increasing');
        firstSourceTime??=sourceTime;
        previousSourceTime=sourceTime;
        const energy=numberOrUndefined(read('Energy Delivered (kWh)'),'energy');
        if(energy!==undefined && previousEnergy!==undefined && energy<previousEnergy)
          resetSinceEmission=true;
        if(energy!==undefined) previousEnergy=energy;
        const current=numberOrUndefined(read('Charging Current (A)'),'current');
        options.onSourceRow?.(new Date(sourceTime).toISOString());
        if(lastEmittedTime!==undefined && sourceTime-lastEmittedTime<options.minIntervalSeconds*1000) continue;
        const sourceState=read('Charging State');
        const fields:TelemetryInput['provenance']['fields']={};
        const event:TelemetryInput={
          eventId:`acn-${createHash('sha256').update(`${sessionId}:${new Date(sourceTime).toISOString()}`).digest('hex').slice(0,32)}`,
          ts:new Date(options.replayStartedAt.getTime()+Math.floor((sourceTime-firstSourceTime)/options.speed)).toISOString(),
          sourceEventAt:new Date(sourceTime).toISOString(),
          meta:{stationId:virtualStationId,chargerId:virtualChargerId},
          provenance:{sourceType:'ACN_REPLAY',datasetVersion:'ACN-Data-Static@abb7cf15',transformVersion:'local-acn-replay-v1',sessionId,fields}
        };
        if(current!==undefined) {
          event.currentA=current;fields.currentA='MEASURED';
          event.chargingState=current>0.5?'CHARGING':'NOT_CHARGING';
          fields.chargingState='DERIVED';
          event.provenance.assumptions='App chargingState is derived from historical currentA > 0.5 A; virtual charger mapping is synthetic.';
        }
        if(sourceState) {event.sourceChargingState=sourceState;fields.sourceChargingState='SOURCE_REPORTED';}
        if(energy!==undefined) {event.sourceEnergyKWh=energy;fields.sourceEnergyKWh='SOURCE_REPORTED';}
        if(resetSinceEmission) {event.qualityFlags=['ENERGY_COUNTER_DECREASE'];resetSinceEmission=false;}
        if(!Object.keys(fields).length) throw new Error('ACN row has no usable measurements');
        lastEmittedTime=sourceTime;
        yield event;
        if(++emitted>=options.maxEvents) break;
      }
      if(streamFailed) throw new Error('Unreadable ACN gzip stream');
    } finally {rows.close();source.destroy();decoded.destroy();}
    if(!columns) throw new Error('Empty ACN CSV');
  }
}

export const ACN_SOURCE_LIMITATIONS = Object.freeze({
  sourceCurrentAvailable: true,
  sourceStateAvailable: true,
  sourceEnergyMayReset: true,
  voltageMeasured: false,
  powerMeasured: false,
  temperatureMeasured: false,
  sessionsRepresentUniqueChargers: false
});
