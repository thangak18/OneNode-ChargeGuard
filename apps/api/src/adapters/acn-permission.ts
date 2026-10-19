import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ACN_REVISION} from './local-history';

/** An owner attestation records scope/evidence; this is not a substitute for dataset-owner permission. */
export async function requireAcnCloudPermission(permissionPath:string,sourceFiles:string[]):Promise<void> {
  let permit;
  try {permit=JSON.parse(await readFile(permissionPath,'utf8'));} catch {throw new Error('ACN cloud replay blocked: documented processing permission is required');}
  if(permit.status!=='OWNER_CONFIRMED' || permit.revision!==ACN_REVISION || typeof permit.evidenceReference!=='string' || !permit.evidenceReference.trim() || !['atlas-processing','datadog-processing'].every(scope=>Array.isArray(permit.allowedUses)&&permit.allowedUses.includes(scope)) || !Array.isArray(permit.sha256)) throw new Error('ACN cloud replay blocked: permission scope is incomplete');
  for(const file of sourceFiles) {
    const sha=createHash('sha256').update(await readFile(file)).digest('hex');
    if(!permit.sha256.includes(sha))throw new Error('ACN cloud replay blocked: selected content is outside the permission record');
  }
}
