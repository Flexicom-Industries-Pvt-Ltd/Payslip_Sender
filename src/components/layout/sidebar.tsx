'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Send,
  MailCheck,
  Settings,
  Download,
  MonitorDown,
  X,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
  },
  {
    name: 'Payslip Distribution',
    href: '/payslips',
    icon: Send,
  },
  {
    name: 'Email Composer',
    href: '/composer',
    icon: MailCheck,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    // Detect if running inside the downloaded Electron wrapper
    const checkIsElectron = () => {
      if (typeof window === 'undefined') return false;
      const ua = navigator.userAgent || '';
      return (
        Boolean((window as any).isElectron) ||
        Boolean((window as any).electronAPI?.isDesktop) ||
        ua.includes('SterlingDesktopApp') ||
        ua.toLowerCase().includes('electron')
      );
    };

    setIsDesktopApp(checkIsElectron());
  }, []);

  return (
    <>
      <aside className="w-64 bg-[#221E1E] text-stone-300 flex flex-col shrink-0 border-r border-[#332D2D] select-none">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-4 border-b border-[#332D2D]">
          <div className="w-full bg-white rounded-lg px-2.5 py-1.5 flex items-center justify-center shadow-xs">
            <img
              src="/sterling-logo.jpg"
              alt="Sterling Distillers Private Limited"
              className="h-9 w-auto max-w-full object-contain"
            />
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
            HR Operations
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#78B338] text-white shadow-xs font-semibold'
                    : 'text-stone-300 hover:text-white hover:bg-[#342F2F]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-stone-400'
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Install Desktop App button at bottom of navbar - ONLY visible in web browser, NEVER in Electron */}
        {!isDesktopApp && (
          <div className="p-3 border-t border-[#332D2D]">
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#78B338] hover:bg-[#689F2E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer group"
            >
              <Download className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
              <span>Install Now</span>
            </button>
          </div>
        )}
      </aside>

      {/* Install Desktop App Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="relative bg-[#221E1E] p-6 text-white border-b border-[#332D2D]">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-xs">
                  <img
                    src="/sterling-favicon.png"
                    alt="Sterling Distillers"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Sterling Distillers</h3>
                  <p className="text-xs text-stone-300">Desktop Dispatch Client for Windows</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-[#78B338] shrink-0 mt-0.5" />
                  <span>
                    <strong>Native Standalone App:</strong> No browser tabs, bookmark bars, or URL distractions.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-[#78B338] shrink-0 mt-0.5" />
                  <span>
                    <strong>Clean Interface:</strong> Default menu strip (&quot;File/Edit/View&quot;) is completely removed for maximum workspace.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-[#78B338] shrink-0 mt-0.5" />
                  <span>
                    <strong>Official Company Branding:</strong> Installed with the Sterling Distillers logo on your Desktop and Start Menu.
                  </span>
                </div>
              </div>

              {/* Setup Steps */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-1">
                  Quick 3-Step Setup:
                </span>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#78B338] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <span>Download the <strong>.exe installer</strong> below.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#78B338] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                  <span>Run the installer (choose Desktop shortcut option).</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#78B338] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                  <span>Launch directly from your Desktop anytime!</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2.5">
                <a
                  href="/api/download/desktop"
                  download="Sterling-Distillers-Payslip-Portal-Setup-1.0.0.exe"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#78B338] hover:bg-[#689F2E] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Windows Installer (.exe)</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Continue using Web Browser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
