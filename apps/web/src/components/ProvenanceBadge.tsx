import React from 'react';
import { Database, Cpu, Sparkles } from 'lucide-react';

interface ProvenanceBadgeProps {
  sourceType: 'ACN_REPLAY' | 'DERIVED' | 'SYNTHETIC' | string;
}

export function ProvenanceBadge({ sourceType }: ProvenanceBadgeProps) {
  const norm = sourceType?.toUpperCase() || 'UNKNOWN';

  let style = 'bg-slate-800 text-slate-300 border-slate-700';
  let Icon = Database;
  let label = norm;

  switch (norm) {
    case 'ACN_REPLAY':
      style = 'bg-blue-950/70 text-blue-300 border-blue-800/80';
      Icon = Database;
      label = 'ACN REPLAY';
      break;
    case 'DERIVED':
      style = 'bg-purple-950/70 text-purple-300 border-purple-800/80';
      Icon = Cpu;
      label = 'DERIVED';
      break;
    case 'SYNTHETIC':
      style = 'bg-amber-950/70 text-amber-300 border-amber-800/80';
      Icon = Sparkles;
      label = 'SYNTHETIC';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${style}`}
      title={`Data origin: ${label}`}
    >
      <Icon size={11} aria-hidden="true" className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
