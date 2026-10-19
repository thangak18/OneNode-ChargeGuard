import {resolve} from 'node:path';
import {readLocalHistory,HISTORICAL_SESSIONS} from '../src/adapters/local-history';
async function main(){
  const samples=[];
  for(const session of HISTORICAL_SESSIONS){const data=await readLocalHistory(resolve(__dirname,'../../..'),session);samples.push({session,rowsParsed:data.rowsParsed,pointsEmitted:data.pointsEmitted,hashVerified:data.hashVerified,uniqueExportedEvseIds:data.uniqueExportedEvseIds,physicalIdentityVerified:data.physicalIdentityVerified});}
  console.log(JSON.stringify({mode:'LOCAL_READ_ONLY_NO_CLOUD',samples,rowsParsed:samples.reduce((n,s)=>n+s.rowsParsed,0),pointsEmitted:samples.reduce((n,s)=>n+s.pointsEmitted,0)},null,2));
}
void main().catch(()=>{console.error('LOCAL_HISTORY_CHECK FAIL (source details withheld)');process.exitCode=1;});
