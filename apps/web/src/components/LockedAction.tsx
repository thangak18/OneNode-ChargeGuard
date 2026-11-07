'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';

interface LockedActionProps {
  /** Verb shown to the guest, e.g. "Acknowledge" → "Sign in to acknowledge". */
  action: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Guest-mode stand-in for an operator-only button. Looks like the action it
 * replaces (so the workflow stays discoverable) but routes to sign-in and
 * returns the user to the current page afterwards.
 */
export function LockedAction({ action, size = 'md', className = '' }: LockedActionProps) {
  const pathname = usePathname() || '/';
  const href = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs';
  return (
    <Link
      href={href}
      title={`Operator sign-in required to ${action.toLowerCase()}`}
      className={`group inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 bg-slate-900/70 font-medium text-slate-300 transition-colors hover:border-cyan-700 hover:bg-slate-800/80 hover:text-cyan-200 ${pad} ${className}`}
    >
      <Lock size={12} className="shrink-0 text-amber-400 transition-colors group-hover:text-cyan-400" aria-hidden="true" />
      <span>Sign in to {action.toLowerCase()}</span>
    </Link>
  );
}
