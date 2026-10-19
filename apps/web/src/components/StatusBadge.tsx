import React from 'react';
import { CheckCircle2, Zap, Circle, AlertTriangle, AlertOctagon } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const norm = status?.toUpperCase() || 'UNKNOWN';

  let bg = 'bg-slate-800/80 text-slate-300 border-slate-700';
  let Icon = Circle;

  switch (norm) {
    case 'AVAILABLE':
    case 'OK':
    case 'RESOLVED':
      bg = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80';
      Icon = CheckCircle2;
      break;
    case 'CHARGING':
    case 'ACTIVE':
      bg = 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80';
      Icon = Zap;
      break;
    case 'IDLE':
    case 'UNPLUGGED':
      bg = 'bg-slate-900/80 text-slate-400 border-slate-800';
      Icon = Circle;
      break;
    case 'WARNING':
    case 'ACKNOWLEDGED':
    case 'RESOLVING':
      bg = 'bg-amber-950/70 text-amber-300 border-amber-800/80';
      Icon = AlertTriangle;
      break;
    case 'FAULT':
    case 'CRITICAL':
    case 'OPEN':
    case 'ALERT':
      bg = 'bg-rose-950/80 text-rose-300 border-rose-800';
      Icon = AlertOctagon;
      break;
    default:
      bg = 'bg-slate-800/80 text-slate-400 border-slate-700';
      Icon = Circle;
  }

  const iconSize = size === 'sm' ? 12 : 14;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${padding} ${bg} tabular-nums`}
      role="status"
    >
      <Icon size={iconSize} aria-hidden="true" className="shrink-0" />
      <span>{norm}</span>
    </span>
  );
}
