import NextAuth from 'next-auth';
import { authOptions, operatorAuthConfigured } from '@/lib/auth-options';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handler = NextAuth(authOptions);
async function guarded(...args: Parameters<typeof handler>) {
  if (!operatorAuthConfigured()) return Response.json({message:'Operator login is not configured. Preview remains read-only.'},{status:503});
  return handler(...args);
}
export { guarded as GET, guarded as POST };
