/** Reviewed, single-run production scope. BOTH deployment flags default to deny. */
export const JUDGE_PRODUCTION_RUN = 'judge-4afc45f4427ab21f48d61c89';
export const JUDGE_PRODUCTION_OWNER = '138879141';
const operations = new Set(['fault','acknowledge','recover','resolve','reset']);
export function canEnableProductionJudgeWrites(env:Record<string,string|undefined>,operator:string|null):boolean {
 return env.NODE_ENV==='production' && env.JUDGE_PROD_WRITES_ENABLED==='true' && env.JUDGE_ROUTES_ENABLED==='true' &&
  operator===JUDGE_PRODUCTION_OWNER && env.NEXTAUTH_URL==='https://chargeguard-web.vercel.app' &&
  !!env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length>=32 &&
  !!env.OPERATOR_ASSERTION_SECRET && env.OPERATOR_ASSERTION_SECRET.length>=32 &&
  !!env.JUDGE_WRITE_API_KEY && env.JUDGE_WRITE_API_KEY.length>=32 &&
  env.JUDGE_WRITE_API_KEY!==env.NEST_READ_API_KEY && env.JUDGE_WRITE_API_KEY!==env.NEST_API_KEY;
}
export function mayWriteJudgeAction(env:Record<string,string|undefined>,operator:string|null,run:string,action:string):boolean {
 if(!operations.has(action))return false;
 if(env.NODE_ENV==='production')return canEnableProductionJudgeWrites(env,operator)&&run===JUDGE_PRODUCTION_RUN;
 return env.JUDGE_ROUTES_ENABLED==='true';
}
