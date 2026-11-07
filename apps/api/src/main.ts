import { listenHost } from './config/runtime';
import { NestFactory } from '@nestjs/core';
import { createApplication } from './bootstrap';
import { loadLocalEnv, validateConfig } from './config/config';
import { startSyntheticTicker, syntheticTickerEnabled, SYNTHETIC_TICK_MS } from './demo/synthetic-ticker';

async function main(){
  loadLocalEnv();
  const cfg=validateConfig(process.env);
  const app=await createApplication(NestFactory);
  // One listener on the provider-assigned port; local development stays loopback.
  await app.listen(cfg.port, listenHost(process.env));
  // Hosted Render API: keep the public read-only dashboard fed with labelled
  // SYNTHETIC readings while the instance is awake (see synthetic-ticker.ts).
  if (syntheticTickerEnabled(process.env)) {
    startSyntheticTicker(app);
    process.stdout.write(JSON.stringify({timestamp:new Date().toISOString(),status:'info',service:'chargeguard-api',message:'synthetic_ticker.started',interval_ms:SYNTHETIC_TICK_MS})+'\n');
  }
}
void main().catch(()=>{
  process.stderr.write(JSON.stringify({timestamp:new Date().toISOString(),status:'error',service:'chargeguard-api',message:'application.startup_failed'})+'\n');
  process.exitCode=1;
});
