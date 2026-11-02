import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-12 pt-6 pb-2 border-t border-slate-200/70 text-slate-400 select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] leading-relaxed">
        {/* Left: Copyright */}
        <div className="flex items-center gap-2 text-slate-500">
          <span className="font-semibold text-slate-700">Sterling Distillers</span>
          <span className="text-slate-300">•</span>
          <span>© 2026 Sterling Distillers Private Limited. All rights reserved.</span>
        </div>

        {/* Center / Security Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-[10px]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#78B338]" />
          <span>Confidential Payroll &amp; Secure Ephemeral PDF Distribution</span>
        </div>

        {/* Right: Version and Release Info */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Release Build</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white text-slate-600 border border-slate-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78B338] animate-pulse"></span>
            <span>v1.0.0</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
