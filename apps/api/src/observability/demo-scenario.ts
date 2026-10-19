import type {TelemetryInput} from '../telemetry/telemetry.schema';
export function demoReading(run:string,sequence:number,charger:number,fault:boolean,ts=new Date()):TelemetryInput {
  if(!/^[a-f0-9]{12}$/.test(run) || !Number.isInteger(sequence) || sequence<0 || !Number.isInteger(charger) || charger<1 || charger>5) throw new Error('Invalid bounded demo input');
  return {eventId:`b2-${run}-${sequence}-${charger}`,ts:ts.toISOString(),meta:{stationId:'demo-station-01',chargerId:`demo-charger-${String(charger).padStart(2,'0')}`},currentA:fault?0:8.25,chargingState:fault?'FAULT':'CHARGING',...(fault?{faultCode:'SIMULATED_DEMO_FAULT'}:{}),provenance:{sourceType:'SYNTHETIC',fields:{currentA:'SYNTHETIC',chargingState:'SYNTHETIC',...(fault?{faultCode:'SYNTHETIC' as const}:{})},assumptions:'Controlled Phase B.2 monitoring demonstration. All readings, faults and operator actions are synthetic, not physical EV charger observations.'}};
}
