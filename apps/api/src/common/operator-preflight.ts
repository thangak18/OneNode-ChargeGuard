/** Dormant preparation only. Not a guard/provider; production middleware still denies writes. */
import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify } from 'jose';
import type { Collection } from 'mongodb';

export const DEMO_OPERATIONS = ['fault', 'acknowledge', 'recover', 'resolve', 'reset'] as const;
export type DemoOperation = typeof DEMO_OPERATIONS[number];
export type BoundAction = {
  operation: DemoOperation; method: 'POST'; path: string; body: Uint8Array;
  origin: string; stationId: string; chargerId: string; runId: string; incidentId?: string;
};
export type OperatorPolicy = { secret: Uint8Array; issuer: string; audience: string; origin: string; githubIds: ReadonlySet<string> };
export type OperatorIdentity = { subject: string; nonce: string; expiresAt: number; operation: DemoOperation };
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const routes: Record<Exclude<DemoOperation,'acknowledge'|'resolve'>,string> = {
  fault:'/api/v1/demo/trigger-fault', recover:'/api/v1/demo/recover', reset:'/api/v1/demo/reset'
};
const pinned = 'demo-58a1983cae09';

/** Requires trusted route-derived context and original body bytes, never browser-declared identity. */
export async function verifyOperatorAssertion(token: string, action: BoundAction, policy: OperatorPolicy): Promise<OperatorIdentity> {
  if (policy.secret.byteLength < 32 || !policy.issuer.startsWith('https://') || !policy.audience ||
      !policy.origin.startsWith('https://') || action.origin !== policy.origin || action.method !== 'POST' ||
      !DEMO_OPERATIONS.includes(action.operation) || action.body.byteLength > 8192 ||
      action.stationId !== 'demo-station-01' || !/^demo-charger-0[1-5]$/.test(action.chargerId) ||
      !/^judge-[a-f0-9]{24}$/.test(action.runId) || action.incidentId === pinned) throw new Error('Operator action denied');
  const needsIncident=['acknowledge','recover','resolve'].includes(action.operation);
  if (needsIncident && !action.path.startsWith('/api/v1/judge/runs/') && (!action.incidentId || !/^demo-[a-f0-9]{12}$/.test(action.incidentId))) throw new Error('Operator action denied');
  const path = action.operation === 'acknowledge' || action.operation === 'resolve'
    ? `/api/v1/incidents/${action.incidentId}/${action.operation}` : routes[action.operation];
  if (action.path !== path && action.path !== `/api/v1/judge/runs/${action.runId}/${action.operation}`) throw new Error('Operator action denied');
  try {
    const {payload} = await jwtVerify(token, policy.secret, {algorithms:['HS256'],issuer:policy.issuer,audience:policy.audience,requiredClaims:['sub','iat','exp','jti']});
    const now=Math.floor(Date.now()/1000);
    if (typeof payload.sub !== 'string' || !/^github:[1-9][0-9]*$/.test(payload.sub) ||
        !policy.githubIds.has(payload.sub.slice(7)) || typeof payload.iat !== 'number' || typeof payload.exp !== 'number' ||
        payload.iat > now || payload.exp-payload.iat > 60 || payload.exp <= payload.iat ||
        typeof payload.jti !== 'string' || !/^[a-f0-9]{32}$/.test(payload.jti) ||
        payload.operation !== action.operation || payload.method !== action.method || payload.path !== action.path ||
        payload.stationId !== action.stationId || payload.chargerId !== action.chargerId || payload.runId !== action.runId ||
        payload.incidentId !== action.incidentId || typeof payload.bodySha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(payload.bodySha256) ||
        !timingSafeEqual(Buffer.from(payload.bodySha256,'hex'),Buffer.from(digest(action.body),'hex'))) throw new Error();
    return {subject:payload.sub,nonce:payload.jti,expiresAt:payload.exp,operation:action.operation};
  } catch { throw new Error('Operator assertion rejected'); }
}

type PolicyRecord = {_id: string; count?: number; expiresAt: Date};
/** Dedicated future policy collection only; constructor does not create indexes/collections.
 * Atomic upsert + unique _id provides a durable shared counter. TTL is cleanup, never authorization.
 * This helper is intentionally NOT wired to Atlas or AppModule. Consumed nonces fail closed on errors.
 */
export class DurableOperatorBudget {
  constructor(private readonly records: Collection<PolicyRecord>) {}
  async consume(identity: OperatorIdentity, maxPerMinute: number, now = Date.now()): Promise<void> {
    if (!Number.isInteger(maxPerMinute) || maxPerMinute < 1 || maxPerMinute > 10 ||
        identity.expiresAt*1000 <= now || !/^github:[1-9][0-9]*$/.test(identity.subject) ||
        !/^[a-f0-9]{32}$/.test(identity.nonce) || !DEMO_OPERATIONS.includes(identity.operation)) throw new Error('Operator budget denied');
    try {
      await this.records.insertOne({_id:'nonce:'+digest(identity.subject+':'+identity.nonce),expiresAt:new Date(identity.expiresAt*1000)});
      const window = Math.floor(now/60000);
      const key = 'quota:'+digest(identity.subject+':'+identity.operation+':'+window);
      // Conditional update cannot exceed the configured budget across processes.
      // Once full, upsert collides with the existing unique _id and is denied.
      await this.records.updateOne({_id:key,count:{$lt:maxPerMinute}},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((window+2)*60000)}},{upsert:true});
    } catch { throw new Error('Operator budget denied'); }
  }
}
