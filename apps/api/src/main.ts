import { createApplication } from './bootstrap';
import { loadLocalEnv, validateConfig } from './config/config';

async function main(){
  loadLocalEnv();
  const cfg=validateConfig(process.env);
  const app=await createApplication();
  await app.listen(cfg.port,'127.0.0.1');
}
void main().catch(()=>{
  console.error('ChargeGuard startup failed; check local configuration and database connectivity.');
  process.exitCode=1;
});
