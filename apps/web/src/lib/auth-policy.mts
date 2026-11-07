import { isOperatorId } from './operator-policy.mts';

type Env = Record<string, string | undefined>;

/**
 * Local demo login exists only for `next dev` on a developer machine so the
 * operator UI can be exercised without GitHub OAuth. It is never available in
 * a production build (Vercel), and its identity is deliberately NOT a numeric
 * GitHub ID, so it can never satisfy OPERATOR_GITHUB_IDS or the judge/operator
 * assertion checks that protect owner-scoped data.
 */
export const LOCAL_DEMO_OPERATOR_ID = 'local-demo-operator';

const DEMO_USERS = new Set(['operator@chargeguard.com', 'admin', 'operator']);
const DEMO_PASSWORDS = new Set(['admin', 'operator123', 'chargeguard2026']);

export function localDemoLoginEnabled(env: Env): boolean {
  return env.NODE_ENV === 'development';
}

export function githubAuthConfigured(env: Env): boolean {
  return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET &&
    env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length >= 32 &&
    env.NEXTAUTH_URL?.startsWith('https://') && env.OPERATOR_GITHUB_IDS);
}

export function operatorAuthConfigured(env: Env): boolean {
  return localDemoLoginEnabled(env) || githubAuthConfigured(env);
}

/** A fixed secret is acceptable only for loopback development; production must set NEXTAUTH_SECRET. */
export function sessionSecret(env: Env): string | undefined {
  return env.NEXTAUTH_SECRET || (localDemoLoginEnabled(env) ? 'chargeguard-local-dev-only-session-secret-0001' : undefined);
}

export function authorizeDemoOperator(
  credentials: { email?: string; password?: string } | undefined,
  env: Env,
): { id: string; name: string; email: string } | null {
  if (!localDemoLoginEnabled(env)) return null;
  const user = credentials?.email?.trim().toLowerCase() ?? '';
  const pass = credentials?.password?.trim() ?? '';
  if (!DEMO_USERS.has(user) || !DEMO_PASSWORDS.has(pass)) return null;
  return {
    id: LOCAL_DEMO_OPERATOR_ID,
    name: user === 'admin' ? 'Local Demo Administrator' : 'Local Demo Operator',
    email: 'operator@chargeguard.com',
  };
}

export function signInAllowed(
  account: { provider?: string; providerAccountId?: string } | null | undefined,
  user: { id?: string } | null | undefined,
  env: Env,
): boolean {
  if (account?.provider === 'credentials') {
    return localDemoLoginEnabled(env) && user?.id === LOCAL_DEMO_OPERATOR_ID;
  }
  return githubAuthConfigured(env) && account?.provider === 'github' &&
    isOperatorId(account.providerAccountId, env.OPERATOR_GITHUB_IDS);
}

/** Only an allowlisted GitHub operator, or the local demo identity in `next dev`, gets a session user. */
export function isSessionOperator(operatorId: unknown, env: Env): boolean {
  if (localDemoLoginEnabled(env) && operatorId === LOCAL_DEMO_OPERATOR_ID) return true;
  return isOperatorId(operatorId, env.OPERATOR_GITHUB_IDS);
}
