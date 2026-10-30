import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'info';
  className?: string;
  title?: string;
}

export function Badge({ children, variant = 'default', className = '', title }: BadgeProps) {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (variant === 'success') {
    colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (variant === 'warning') {
    colorStyles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (variant === 'destructive') {
    colorStyles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (variant === 'info') {
    colorStyles = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (variant === 'outline') {
    colorStyles = 'bg-transparent text-slate-600 border-slate-300';
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorStyles} ${className}`}
    >
      {children}
    </span>
  );
}

