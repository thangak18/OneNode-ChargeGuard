/** ChargeGuard-only US1 intake. No Agent or workspace forwarding. Disabled unless explicitly configured. */
export class CloudTransport {
  private logs:object[]=[];private metrics:object[]=[];private running?:Promise<void>;
  dropped=0;failed=0;
  constructor(private key:string,private send:typeof fetch=fetch) {if(key.length<16)throw new Error('Cloud intake key required');}
  log(line:string){try{const item=JSON.parse(line);if(item.service!=='chargeguard-api'||item.env!=='prod')return;
    // Only sanitized logger output is accepted; allowlist again at the transport boundary.
    if(!['ingestion.request','telemetry.accepted','fault.simulated','observability.delivery_unavailable','framework.log','framework.error','framework.warning','application.startup_failed','database.connected','database.unavailable','demo.action'].includes(item.message))return;
    const safe:Record<string,unknown>={};for(const k of ['timestamp','status','service','env','message','demo_id','incident_id','station_id','charger_id','action','outcome','duration_ms','status_code'])if(item[k]!==undefined)safe[k]=item[k];
    this.enqueue(this.logs,safe);}catch{this.dropped++;}}
  metric(name:string,value:number,type:'c'|'g'|'ms',tags:string[]){
    if(!/^(ingestion\.(success|failure|processing_ms)|telemetry\.(accepted|duplicate)|charger\.(current_a|operational_status)|fault\.simulated)$/.test(name)||!Number.isFinite(value))return;
    const safeTags=tags.filter(t=>/^(mode:(batch|single)|status_class:[1-5]xx|outcome:(success|failure)|source:(synthetic|derived|acn_replay)|origin:(synthetic|derived|measured|source_reported)|station_id:demo-station-01|charger_id:demo-charger-0[1-5]|status:(available|charging|not_charging|idle|fault|offline)|asset_scope:other)$/.test(t));
    // Latency is a per-event gauge here, deliberately not Agent histogram percentile semantics.
    this.enqueue(this.metrics,{metric:'chargeguard.'+name+(type==='ms'?'.sample':''),type:type==='c'?1:3,...(type==='c'?{interval:1}:{}),points:[{timestamp:Math.floor(Date.now()/1000),value}],tags:['service:chargeguard-api','env:prod',...safeTags]});
  }
  private enqueue(queue:object[],item:object){if(queue.length>=100){this.dropped++;return;}queue.push(item);}
  flush():Promise<void>{if(!this.running)this.running=this.drain().finally(()=>{this.running=undefined;});return this.running;}
  private async drain(){for(const [queue,url,wrap] of [[this.logs,'https://http-intake.logs.datadoghq.com/api/v2/logs',false],[this.metrics,'https://api.datadoghq.com/api/v2/series',true]] as const){
    const batch=queue.splice(0,100);if(!batch.length)continue;
    for(let attempt=0;attempt<2;attempt++)try{const r=await this.send(url,{method:'POST',headers:{'DD-API-KEY':this.key,'Content-Type':'application/json'},body:JSON.stringify(wrap?{series:batch}:batch),signal:AbortSignal.timeout(3000),redirect:'error'});await r.body?.cancel();if(r.ok)break;
      // Never loop on auth errors. Retries only for transient statuses; delivery is best effort.
      if(attempt===1||![429,500,502,503,504].includes(r.status)){this.failed++;break;}
      await new Promise(resolve=>setTimeout(resolve,Math.min(5000,Math.max(250,Number(r.headers.get('retry-after')??'1')*1000)||1000)));
    }catch{this.failed++;break;}
  }}
}
