import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import {
  LOCAL_DEMO_OPERATOR_ID,
  authorizeDemoOperator,
  isSessionOperator,
  localDemoLoginEnabled,
  operatorAuthConfigured as policyAuthConfigured,
  sessionSecret,
  signInAllowed,
} from './auth-policy.mts';

// Policy lives in auth-policy.mts (unit-tested); this file only wires it into NextAuth.

export function operatorAuthConfigured(): boolean {
  return policyAuthConfigured(process.env);
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Demo credentials are registered only in `next dev`, never in a production build.
    ...(localDemoLoginEnabled(process.env)
      ? [
          CredentialsProvider({
            id: 'credentials',
            name: 'Local demo operator',
            credentials: {
              email: { label: 'Email / Username', type: 'text' },
              password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
              return authorizeDemoOperator(credentials, process.env);
            },
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            authorization: { params: { scope: 'read:user' } },
          }),
        ]
      : []),
  ],
  secret: sessionSecret(process.env),
  session: { strategy: 'jwt', maxAge: 60 * 60 },
  useSecureCookies: process.env.NODE_ENV === 'production',
  callbacks: {
    async signIn({ account, user }) {
      return signInAllowed(account, user, process.env);
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'github') {
        token.operatorId = account.providerAccountId;
      } else if (account?.provider === 'credentials' && user?.id === LOCAL_DEMO_OPERATOR_ID) {
        token.operatorId = LOCAL_DEMO_OPERATOR_ID;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      // The role is recomputed against the current allowlist on each session read.
      if (!isSessionOperator(token.operatorId, process.env)) {
        session.user = undefined;
        return session;
      }
      session.user = {
        name: (token.name as string | undefined) ?? session.user?.name ?? 'Operator',
        email: (token.email as string | undefined) ?? session.user?.email ?? null,
      };
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  // Never serialize OAuth error objects, tokens, or provider profiles into logs.
  logger: { error() {}, warn() {}, debug() {} },
};
