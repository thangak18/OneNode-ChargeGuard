'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeCallbackPath } from '@/lib/labels';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  Zap,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';

// Demo credentials exist only in `next dev`; production builds sign in with GitHub.
const LOCAL_DEMO_LOGIN = process.env.NODE_ENV === 'development';

const GUEST_CAN = ['Live telemetry & charts', 'Incident queue & audit trail', 'Charger history'];
const OPERATOR_CAN = ['Report incidents', 'Acknowledge & resolve', 'Run incident drills'];

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackPath = safeCallbackPath(searchParams.get('callbackUrl'));
  const { data: session, status } = useSession();
  const [email, setEmail] = useState(LOCAL_DEMO_LOGIN ? 'operator@chargeguard.com' : '');
  const [password, setPassword] = useState(LOCAL_DEMO_LOGIN ? 'admin' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAuthenticated = status === 'authenticated';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please provide both username/email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: callbackPath,
      });

      if (res?.error) {
        setErrorMessage('Invalid credentials. Use operator@chargeguard.com / admin (or admin / admin).');
      } else if (res?.ok) {
        router.push(callbackPath);
        router.refresh();
      }
    } catch {
      setErrorMessage('An unexpected error occurred during sign-in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signIn('github', { callbackUrl: callbackPath });
    } catch {
      setErrorMessage('GitHub sign-in is unavailable right now. Please try again later.');
      setLoading(false);
    }
  };

  const handleFillCredentials = (presetUser: string, presetPass: string) => {
    setEmail(presetUser);
    setPassword(presetPass);
    setErrorMessage(null);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/85 p-6 sm:p-8 backdrop-blur-md shadow-2xl shadow-black/60 animate-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-950/40 mb-3">
            <Zap size={22} className="fill-cyan-400/20 text-cyan-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-base gradient-text">CHARGEGUARD</span>
            <span className="text-[9px] uppercase font-mono px-1.5 py-px rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-semibold">
              v1.0
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-1">
            EV Fleet Observability
          </span>
        </div>

        {/* Title & Description */}
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-100">{isAuthenticated ? 'You\'re signed in' : 'Operator sign-in'}</h1>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            {isAuthenticated
              ? 'Your operator session is active on this device.'
              : 'Monitoring is open to everyone. Sign in to take action on incidents and drills.'}
          </p>
        </div>

        {/* If Authenticated: Profile & Sign Out */}
        {status === 'loading' ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2" role="status">
            <Loader2 size={16} className="animate-spin text-cyan-400" aria-hidden="true" />
            Checking session…
          </div>
        ) : isAuthenticated ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 text-xs text-emerald-300 space-y-2"
            >
              <div className="flex items-center gap-2 font-medium text-emerald-200">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Authenticated Operator Session</span>
              </div>
              <div className="pl-6 space-y-1 text-slate-300 text-[11px]">
                <p>
                  <strong className="text-slate-100">Identity:</strong>{' '}
                  {session?.user?.name || 'Lead Operations Engineer'}
                </p>
                <p>
                  <strong className="text-slate-100">Email:</strong>{' '}
                  {session?.user?.email || 'operator@chargeguard.com'}
                </p>
                <p className="text-slate-400">
                  <strong className="text-slate-200">Access:</strong> Full — report, acknowledge, resolve and run drills
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href={callbackPath}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2.5 text-xs transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none"
              >
                <span>{callbackPath === '/' ? 'Go to Operations Overview' : 'Continue where you left off'}</span>
                <ArrowRight size={14} />
              </Link>

              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: '/login' })}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none cursor-pointer"
              >
                <LogOut size={14} className="text-slate-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : !LOCAL_DEMO_LOGIN ? (
          /* Production: GitHub operator sign-in only (allowlisted accounts) */
          <div className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-rose-800/70 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2 text-left"
              >
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleGitHubSignIn()}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-4 py-3 text-sm transition-all shadow-sm shadow-cyan-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none"
            >
              {loading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
              <span>{loading ? 'Redirecting to GitHub…' : 'Sign in with GitHub'}</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Only allowlisted operator accounts can sign in. Everyone else can keep browsing read-only.
            </p>
          </div>
        ) : (
          /* Local development only: demo operator form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Preset Credentials Pill */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-cyan-400" />
                  Demo operator accounts
                </span>
                <span className="text-[10px] text-slate-500">Tap to fill</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFillCredentials('operator@chargeguard.com', 'admin')}
                  className="px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-mono transition-colors"
                >
                  operator@chargeguard.com / admin
                </button>
                <button
                  type="button"
                  onClick={() => handleFillCredentials('admin', 'admin')}
                  className="px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-mono transition-colors"
                >
                  admin / admin
                </button>
              </div>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-rose-800/70 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2 animate-in text-left"
              >
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email / Username Input */}
            <div>
              <label htmlFor="login-username" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={14} />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@chargeguard.com"
                  required
                  autoComplete="username"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition-colors outline-none"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={14} />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg pl-9 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition-colors outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium px-4 py-3 text-sm transition-all shadow-sm shadow-cyan-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign in as Operator</span>
              )}
            </button>
          </form>
        )}

        {/* Guest vs Operator comparison */}
        {!isAuthenticated && status !== 'loading' && (
          <div className="mt-6 grid grid-cols-2 gap-2.5 text-[11px]">
            <div className="rounded-lg border border-amber-800/40 bg-amber-950/15 p-3">
              <div className="mb-1.5 font-semibold text-amber-300">Guest · read-only</div>
              <ul className="space-y-1 text-slate-400">
                {GUEST_CAN.map((t) => (
                  <li key={t} className="flex gap-1.5"><Check size={12} className="mt-px shrink-0 text-slate-500" aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-3">
              <div className="mb-1.5 font-semibold text-emerald-300">Operator · adds</div>
              <ul className="space-y-1 text-slate-300">
                {OPERATOR_CAN.map((t) => (
                  <li key={t} className="flex gap-1.5"><Check size={12} className="mt-px shrink-0 text-emerald-400" aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <Link
            href={callbackPath}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md py-1 px-2 outline-none group"
          >
            <ArrowLeft
              size={14}
              className="group-hover:-translate-x-0.5 transition-transform text-slate-500 group-hover:text-cyan-400"
            />
            <span>{isAuthenticated ? 'Back to dashboard' : 'Continue as guest (read-only)'}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <LoginCard />
    </Suspense>
  );
}
