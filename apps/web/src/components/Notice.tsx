import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info' | 'warning';

const TONES: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  success: { box: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-100', icon: 'text-emerald-400', Icon: CheckCircle2 },
  error: { box: 'bg-rose-950/60 border-rose-800/80 text-rose-100', icon: 'text-rose-400', Icon: AlertTriangle },
  info: { box: 'bg-cyan-950/50 border-cyan-800/70 text-cyan-100', icon: 'text-cyan-400', Icon: Info },
  warning: { box: 'bg-amber-950/50 border-amber-800/70 text-amber-100', icon: 'text-amber-400', Icon: AlertTriangle },
};

interface NoticeProps {
  tone: Tone;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
}

/** Inline status banner used for success / error / info feedback. */
export function Notice({ tone, title, children, onDismiss, action }: NoticeProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-xs leading-relaxed animate-in ${t.box}`}
    >
      <t.Icon size={16} className={`mt-px shrink-0 ${t.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">
        {title && <span className="font-semibold">{title} </span>}
        <span className="opacity-90">{children}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-m-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
