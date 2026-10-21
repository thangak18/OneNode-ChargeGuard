import { NestFactory } from '@nestjs/core';
import { createApplication } from './bootstrap';
import { loadLocalEnv, validateConfig } from './config/config';

async function main(){
  loadLocalEnv();
  const cfg=validateConfig(process.env);
  const app=await createApplication(NestFactory);
  // Vercel detects src/main.ts and manages this single listener.
  await app.listen(cfg.port, process.env.VERCEL === '1' ? '0.0.0.0' : '127.0.0.1');
}
void main().catch(()=>{
  process.stderr.write(JSON.stringify({timestamp:new Date().toISOString(),status:'error',service:'chargeguard-api',message:'application.startup_failed'})+'\n');
  process.exitCode=1;
});
