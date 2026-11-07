'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Zap,
  Activity,
  AlertOctagon,
  Sliders,
  Database,
  RefreshCw,
  Menu,
  X,
  History,
  LogOut,
  Lock,
} from 'lucide-react';

interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
}

export function Navbar({ onRefresh, isRefreshing, lastUpdated }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const sessionLoading = status === 'loading';
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname || '/')}`;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);
  const operatorName = session?.user?.name || 'Lead Operations Engineer';
  const operatorEmail = session?.user?.email || 'operator@chargeguard.com';

  const navLinks = [
    { href: '/', label: 'Overview', icon: Activity },
    { href: '/chargers', label: 'Charger Detail', icon: Zap },
    { href: '/incidents', label: 'Incidents', icon: AlertOctagon },
    { href: '/demo', label: 'Incident Drill', icon: Sliders },
    ...(process.env.NODE_ENV === 'development' ? [{ href: '/history', label: 'Historical Local', icon: History }] : []),
  ];

  return (
    <>
      {/* Desktop Vertical Sidebar (LG+) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-slate-800/80 bg-slate-900/90 backdrop-blur-md z-40 select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <Link
            href="/"
            className="flex items-center gap-3 text-slate-100 hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-900/30 group-hover:shadow-cyan-800/40 transition-shadow">
              <Zap size={20} className="fill-cyan-400/20 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-sm flex items-center gap-1.5">
                <span className="gradient-text">CHARGEGUARD</span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-px rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-semibold">
                  v1.0
                </span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                EV Fleet Observability
              </span>
            </div>
          </Link>
        </div>

        {/* Vertical Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            Operations Menu
          </div>
          <nav className="space-y-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none ${
                    active
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700/80 shadow-sm shadow-cyan-950/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-cyan-400 shadow-sm shadow-cyan-400/50"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    size={16}
                    className={`shrink-0 transition-colors ${
                      active ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer: Refresh, Status Badges & Operator Auth */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
          {/* Refresh Button & Time */}
          {onRefresh && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh telemetry data"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}
                />
                <span>Refresh Data</span>
              </button>
              {lastUpdated && (
                <span className="text-[10px] font-mono text-slate-500 tabular-nums px-1">
                  {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* Service Status Badges */}
          <div className="space-y-1.5 text-[10px] font-mono text-slate-400" aria-label="Connected services">
            <div className="px-0.5 text-[10px] uppercase tracking-wider text-slate-500">Connected services</div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-800/80 bg-slate-900/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <Database size={12} className="text-slate-500 shrink-0" />
              <span className="truncate">MongoDB Atlas · SG</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-800/80 bg-slate-900/60">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <Activity size={12} className="text-slate-500 shrink-0" />
              <span className="truncate">Datadog · US1</span>
            </div>
          </div>

          {/* Operator / Guest Session Card */}
          <div className="pt-3 border-t border-slate-800/80">
            {sessionLoading ? (
              <div className="skeleton h-[104px] w-full rounded-lg" aria-label="Checking session" />
            ) : isAuthenticated ? (
              <div className="p-3 rounded-lg border border-emerald-600/40 bg-emerald-950/25">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                    Operator
                  </span>
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                    Full access
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-100 truncate" title={operatorName}>
                  {operatorName}
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate" title={operatorEmail}>
                  {operatorEmail}
                </div>
                <div className="mt-2.5 pt-2 border-t border-emerald-900/40 flex items-center justify-between text-[11px]">
                  <Link href="/login" className="text-slate-400 hover:text-cyan-300 transition-colors">
                    Account
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                  >
                    <LogOut size={12} aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-amber-600/40 bg-amber-950/20">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                    Guest
                  </span>
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                    Read-only
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Browse all telemetry freely. Sign in to report, triage and run drills.
                </p>
                <Link
                  href={loginHref}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
                >
                  <Lock size={12} aria-hidden="true" />
                  <span>Sign in as Operator</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header Bar (< LG) */}
      <header className="lg:hidden glass-panel border-b border-slate-800/80 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-slate-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
              <Zap size={16} className="fill-cyan-400/20" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-sm flex items-center gap-1.5">
                <span className="gradient-text">CHARGEGUARD</span>
                <span className="hidden sm:inline text-[8px] uppercase font-mono px-1 py-px rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                  v1.0
                </span>
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {!sessionLoading && (
              <Link
                href={isAuthenticated ? '/login' : loginHref}
                className={`inline-flex items-center gap-1.5 h-10 px-2.5 rounded-lg border text-[10px] font-mono font-semibold uppercase tracking-wider ${
                  isAuthenticated
                    ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                    : 'border-amber-700/60 bg-amber-950/30 text-amber-300'
                }`}
                aria-label={isAuthenticated ? 'Signed in as operator — account' : 'Guest, read-only — sign in as operator'}
              >
                {isAuthenticated ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                ) : (
                  <Lock size={11} aria-hidden="true" />
                )}
                {isAuthenticated ? 'Operator' : 'Guest'}
              </Link>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh telemetry data"
                className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-cyan-400 transition-colors disabled:opacity-60"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-cyan-400' : ''} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-slate-100 transition-colors"
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer (Vertical Links) */}
        {mobileOpen && (
          <nav
            id="mobile-navigation"
            className="p-4 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md space-y-1 animate-in"
            aria-label="Mobile Navigation"
          >
            <div className="pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold px-2">
              Operations Menu
            </div>
            {navLinks.map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-cyan-400 bg-slate-800/80 border border-slate-700/60 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-cyan-400' : 'text-slate-500'} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-800/80 flex flex-col gap-2 text-[11px] font-mono text-slate-400">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  MongoDB Atlas (SG)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Datadog (US1)
                </span>
              </div>
              {isAuthenticated ? (
                <div className="p-3 rounded-lg border border-emerald-600/40 bg-emerald-950/25 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-sans font-semibold text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
                      Operator · Full access
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{operatorEmail}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-slate-700 text-xs font-sans text-slate-300 hover:text-rose-300"
                  >
                    <LogOut size={13} aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-amber-600/40 bg-amber-950/20 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-sans font-semibold text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                      Guest · Read-only
                    </div>
                    <div className="text-[10px] font-sans text-slate-400">Sign in to report, triage and run drills</div>
                  </div>
                  <Link
                    href={loginHref}
                    onClick={() => setMobileOpen(false)}
                    className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-cyan-600 hover:bg-cyan-500 text-xs font-sans font-medium text-white"
                  >
                    <Lock size={12} aria-hidden="true" />
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
