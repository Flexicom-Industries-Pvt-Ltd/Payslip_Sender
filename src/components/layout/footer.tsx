import React from 'react';

export function Footer() {
  return (
    <footer className="h-9 shrink-0 bg-white/95 backdrop-blur-xs border-t border-slate-200/80 px-6 lg:px-8 flex items-center justify-between text-[11px] text-slate-500 select-none z-10">
      <div className="flex items-center gap-1.5 font-medium truncate">
        <span className="font-semibold text-slate-700">Sterling Distillers</span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-400">© 2026 Sterling Distillers Private Limited. All rights reserved.</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-50 text-slate-600 border border-slate-200/90 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#78B338]"></span>
          <span>v1.0.0</span>
        </span>
      </div>
    </footer>
  );
}
