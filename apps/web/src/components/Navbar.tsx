'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Activity, AlertOctagon, Sliders, Database, RefreshCw, Menu, X } from 'lucide-react';

interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
}

export function Navbar({ onRefresh, isRefreshing, lastUpdated }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Overview', icon: Activity },
    { href: '/chargers', label: 'Charger Detail', icon: Zap },
    { href: '/incidents', label: 'Incidents', icon: AlertOctagon },
    { href: '/demo', label: 'Demo Controls', icon: Sliders },
  ];

  return (
    <header className="glass-panel border-b border-slate-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-slate-100 hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md p-1 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-900/30 group-hover:shadow-cyan-800/40 transition-shadow">
                <Zap size={18} className="fill-cyan-400/20 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-base flex items-center gap-1.5">
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

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none ${
                    active
                      ? 'bg-slate-800/90 text-cyan-400 border border-slate-700/80 shadow-sm shadow-cyan-950/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-500'} />
                  {link.label}
                  {active && (
                    <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-cyan-400" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status Indicators & Refresh */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-400" aria-label="Configured services">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-800/80 bg-slate-900/60">
                <Database size={12} className="text-slate-500" />
                MongoDB Atlas · Singapore
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-800/80 bg-slate-900/60">
                <Activity size={12} className="text-slate-500" />
                Datadog · US1
              </span>
            </div>

            {/* Refresh Action */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh telemetry data"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80 hover:border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {lastUpdated && (
              <span className="hidden sm:inline text-[11px] font-mono text-slate-500 tabular-nums">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <nav className="lg:hidden py-3 border-t border-slate-800/80 space-y-1 animate-in" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-cyan-400 bg-slate-800/60 border border-slate-700/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
