/** Deliberately pinned to the ONE run explicitly provisioned by the owner.
 * Changing this scope requires a new security review and owner authorization.
 */
export const PRODUCTION_JUDGE_RUN = 'judge-4afc45f4427ab21f48d61c89';
export const PRODUCTION_JUDGE_OWNER = '138879141';
export const PRODUCTION_JUDGE_ORIGIN = 'https://chargeguard-web.vercel.app';
const actions = new Set(['fault', 'acknowledge', 'recover', 'resolve', 'reset']);

export function isScopedJudgeWrite(env: NodeJS.ProcessEnv, method: string, path: string): boolean {
  if (method !== 'POST' || env.JUDGE_PROD_WRITES_ENABLED !== 'true' || env.JUDGE_ROUTES_ENABLED !== 'true' ||
      env.OPERATOR_ORIGIN !== PRODUCTION_JUDGE_ORIGIN ||
      !(env.OPERATOR_GITHUB_IDS ?? '').split(',').map(v => v.trim()).includes(PRODUCTION_JUDGE_OWNER) ||
      !env.OPERATOR_ASSERTION_SECRET || env.OPERATOR_ASSERTION_SECRET.length < 32 ||
      !env.JUDGE_WRITE_API_KEY || env.JUDGE_WRITE_API_KEY.length < 32 ||
      env.JUDGE_WRITE_API_KEY === env.BFF_READ_API_KEY || env.JUDGE_WRITE_API_KEY === env.INGEST_API_KEY) return false;
  const prefix = `/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/`;
  return path.startsWith(prefix) && actions.has(path.slice(prefix.length));
}
