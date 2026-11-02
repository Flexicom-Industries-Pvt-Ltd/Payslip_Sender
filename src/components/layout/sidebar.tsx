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
  X,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useSidebar } from './sidebar-context';

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
    name: 'Audit Logs',
    href: '/logs',
    icon: ScrollText,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
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
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-[#221E1E] text-stone-300 flex flex-col shrink-0 border-r border-[#332D2D] select-none transition-all duration-300 ease-in-out`}
      >
        {/* Brand Header */}
        <div
          className={`h-20 flex items-center ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          } border-b border-[#332D2D] transition-all`}
        >
          {isCollapsed ? (
            /* Collapsed Small Logo: ONLY the company emblem, NO writing */
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-xs p-1.5 transition-all">
              <img
                src="/sterling-favicon.png"
                alt="Sterling Distillers Emblem"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            /* Expanded Full Logo: Emblem + Sterling Distillers Private Limited text */
            <div className="w-full bg-white rounded-lg px-2.5 py-1.5 flex items-center justify-center shadow-xs transition-all">
              <img
                src="/sterling-logo.jpg"
                alt="Sterling Distillers Private Limited"
                className="h-9 w-auto max-w-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Navigation items */}
        <div className="flex-1 py-6 px-3 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-1">
            {isCollapsed ? (
              <div className="my-2 border-t border-[#332D2D] mx-2" />
            ) : (
              <div className="px-3 mb-2 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                HR Operations
              </div>
            )}

            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                  } rounded-lg text-sm font-medium transition-all ${
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
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>

          {/* Bottom Collapse Toggle inside Sidebar */}
          <div className="pt-4 border-t border-[#332D2D] mt-4">
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
              } rounded-lg text-xs font-medium text-stone-400 hover:text-white hover:bg-[#342F2F] transition-all cursor-pointer`}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-stone-400" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-stone-400" />
                  <span>Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Install Desktop App button at bottom of navbar - ONLY visible in web browser, NEVER in Electron */}
        {!isDesktopApp && (
          <div className="p-3 border-t border-[#332D2D]">
            {isCollapsed ? (
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                title="Install Desktop App"
                className="w-full flex items-center justify-center p-2.5 rounded-lg bg-[#78B338] hover:bg-[#689F2E] text-white shadow-xs transition-all cursor-pointer group"
              >
                <Download className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#78B338] hover:bg-[#689F2E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer group"
              >
                <Download className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                <span>Install Now</span>
              </button>
            )}
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
            <div className="p-6 space-y-4">
              {/* Setup Steps */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-1">
                  Quick 3-Step Setup:
                </span>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#78B338] text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Download the <strong>.exe installer</strong> below.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#78B338] text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Run setup and select Desktop shortcut.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#78B338] text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
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
