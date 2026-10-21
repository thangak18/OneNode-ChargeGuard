import { listenHost } from './config/runtime';
import { NestFactory } from '@nestjs/core';
import { createApplication } from './bootstrap';
import { loadLocalEnv, validateConfig } from './config/config';

async function main(){
  loadLocalEnv();
  const cfg=validateConfig(process.env);
  const app=await createApplication(NestFactory);
  // One listener on the provider-assigned port; local development stays loopback.
  await app.listen(cfg.port, listenHost(process.env));
}
void main().catch(()=>{
  process.stderr.write(JSON.stringify({timestamp:new Date().toISOString(),status:'error',service:'chargeguard-api',message:'application.startup_failed'})+'\n');
  process.exitCode=1;
});
