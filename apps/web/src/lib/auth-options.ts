import type { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import { isOperatorId } from './operator-policy.mts';

export function operatorAuthConfigured(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET &&
    process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32 &&
    process.env.NEXTAUTH_URL?.startsWith('https://') && process.env.OPERATOR_GITHUB_IDS);
}

export const authOptions: NextAuthOptions = {
  providers: [GitHubProvider({clientId: process.env.GITHUB_CLIENT_ID ?? '', clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '', authorization: {params: {scope: 'read:user'}}})],
  secret: process.env.NEXTAUTH_SECRET,
  session: {strategy: 'jwt', maxAge: 60 * 60},
  useSecureCookies: process.env.NODE_ENV === 'production',
  callbacks: {
    async signIn({account}) {
      return operatorAuthConfigured() && account?.provider === 'github' &&
        isOperatorId(account.providerAccountId, process.env.OPERATOR_GITHUB_IDS);
    },
    async jwt({token, account}) {
      if (account?.provider === 'github') token.operatorId = account.providerAccountId;
      return token;
    },
    async session({session, token}) {
      // A role is recomputed against the current allowlist on each session read.
      if (!isOperatorId(token.operatorId, process.env.OPERATOR_GITHUB_IDS)) session.user = undefined;
      return session;
    },
  },
  // Never serialize OAuth error objects, tokens, or provider profiles into logs.
  logger: {error() {}, warn() {}, debug() {}},
};
