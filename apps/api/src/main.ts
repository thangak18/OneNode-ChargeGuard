import { createApplication } from './bootstrap';
import { loadLocalEnv, validateConfig } from './config/config';

async function main(){
  loadLocalEnv();
  const cfg=validateConfig(process.env);
  const app=await createApplication();
  await app.listen(cfg.port,'127.0.0.1');
}
void main().catch(()=>{
  process.stderr.write(JSON.stringify({timestamp:new Date().toISOString(),status:'error',service:'chargeguard-api',message:'application.startup_failed'})+'\n');
  process.exitCode=1;
});
