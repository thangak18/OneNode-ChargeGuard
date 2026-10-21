'use client';
import { signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
export default function LoginPage() {
  return <main className="max-w-xl mx-auto p-8 space-y-4"><h1 className="text-xl font-semibold">Operator sign-in</h1><p>GitHub operator access requires owner configuration and an explicit account allowlist. This deployment remains read-only, including after sign-in, until backend connectivity and action authorization are verified.</p><button className="p-3 border rounded" onClick={()=>void signIn('github', {callbackUrl:'/'})}>Sign in with GitHub</button><button className="p-3 border rounded ml-2" onClick={()=>void signOut({callbackUrl:'/'})}>Sign out</button><p><Link href="/">Return to preview</Link></p></main>;
}
