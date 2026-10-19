import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'cyan' | 'emerald' | 'amber' | 'rose';
  animationDelay?: number;
}

export function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = 'default',
  animationDelay = 0,
}: MetricCardProps) {
  let border = 'border-slate-800';
  let accent = 'text-slate-100';
  let glowClass = 'glow-card';
  let gradientOverlay = '';
  let iconBg = 'bg-slate-800/60 text-slate-400';

  switch (variant) {
    case 'cyan':
      border = 'border-cyan-800/40';
      accent = 'text-cyan-400';
      glowClass = 'glow-card';
      gradientOverlay = 'from-cyan-500/5 via-transparent to-transparent';
      iconBg = 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/40';
      break;
    case 'emerald':
      border = 'border-emerald-800/40';
      accent = 'text-emerald-400';
      glowClass = 'glow-card glow-card-emerald';
      gradientOverlay = 'from-emerald-500/5 via-transparent to-transparent';
      iconBg = 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40';
      break;
    case 'amber':
      border = 'border-amber-800/40';
      accent = 'text-amber-400';
      glowClass = 'glow-card glow-card-amber';
      gradientOverlay = 'from-amber-500/5 via-transparent to-transparent';
      iconBg = 'bg-amber-950/80 text-amber-400 border border-amber-800/40';
      break;
    case 'rose':
      border = 'border-rose-800/40';
      accent = 'text-rose-400';
      glowClass = 'glow-card glow-card-rose';
      gradientOverlay = 'from-rose-500/5 via-transparent to-transparent';
      iconBg = 'bg-rose-950/80 text-rose-400 border border-rose-800/40';
      break;
    default:
      gradientOverlay = 'from-slate-500/3 via-transparent to-transparent';
      iconBg = 'bg-slate-800/60 text-slate-400 border border-slate-700/40';
      break;
  }

  return (
    <div
      className={`${glowClass} relative overflow-hidden bg-slate-900/90 border ${border} rounded-xl p-4 shadow-sm backdrop-blur-sm animate-in`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Subtle gradient overlay */}
      {gradientOverlay && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradientOverlay} pointer-events-none`}
          aria-hidden="true"
        />
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
            {title}
          </span>
          {icon && (
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold font-mono tabular-nums ${accent} tracking-tight`}>
            {value}
          </span>
          {unit && (
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wide">
              {unit}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-400/80 mt-2 truncate leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* Skeleton variant for loading state */
export function MetricCardSkeleton() {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>
      <div className="skeleton h-7 w-24 mb-2" />
      <div className="skeleton h-3 w-32" />
    </div>
  );
}
