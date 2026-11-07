import React from 'react';
import { Check } from 'lucide-react';

export type StepTone = 'cyan' | 'rose' | 'amber' | 'emerald';

export interface Step {
  label: string;
  caption?: string;
  tone: StepTone;
}

const RING: Record<StepTone, string> = {
  cyan: 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]',
  rose: 'border-rose-400 bg-rose-950 text-rose-300 shadow-[0_0_0_4px_rgba(244,63,94,0.15)]',
  amber: 'border-amber-400 bg-amber-950 text-amber-300 shadow-[0_0_0_4px_rgba(245,158,11,0.15)]',
  emerald: 'border-emerald-400 bg-emerald-950 text-emerald-300 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]',
};
const TEXT: Record<StepTone, string> = {
  cyan: 'text-cyan-300',
  rose: 'text-rose-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
};

interface LifecycleStepperProps {
  steps: Step[];
  /** 0-based index of the current step. */
  current: number;
  /** When true the current step is shown as completed too (terminal state). */
  complete?: boolean;
  ariaLabel: string;
  dense?: boolean;
}

/**
 * Horizontal connected stepper: done steps get a check, the current step is
 * highlighted in its semantic colour, upcoming steps stay muted.
 */
export function LifecycleStepper({ steps, current, complete = false, ariaLabel, dense = false }: LifecycleStepperProps) {
  return (
    <ol aria-label={ariaLabel} className="flex w-full items-start">
      {steps.map((step, i) => {
        const done = i < current || (complete && i === current);
        const active = i === current && !complete;
        const last = i === steps.length - 1;
        return (
          <li
            key={step.label}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
            aria-current={active ? 'step' : undefined}
          >
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute top-3.5 left-[calc(50%+18px)] right-[calc(-50%+18px)] h-0.5 rounded-full ${
                  i < current ? 'bg-emerald-500/60' : 'bg-slate-800'
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold font-mono transition-all duration-300 ${
                done
                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                  : active
                    ? RING[step.tone]
                    : 'border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={`mt-2 px-1 text-[11px] sm:text-xs font-semibold leading-tight ${
                active ? TEXT[step.tone] : done ? 'text-slate-200' : 'text-slate-500'
              }`}
            >
              {step.label}
            </span>
            {step.caption && !dense && (
              <span className="mt-0.5 hidden px-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 sm:block">
                {step.caption}
              </span>
            )}
            <span className="sr-only">{done ? ' (completed)' : active ? ' (current step)' : ' (upcoming)'}</span>
          </li>
        );
      })}
    </ol>
  );
}
