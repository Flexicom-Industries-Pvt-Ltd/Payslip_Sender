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
  Building2,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { useSidebar } from './sidebar-context';
import { useWorkspace } from './workspace-context';

const BASE_NAV_ITEMS = [
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
  const { isCollapsed } = useSidebar();
  const { workspace, role, availableWorkspaces, switchWorkspace, switching } = useWorkspace();
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
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

  const navItems =
    role === 'SUPER_ADMIN'
      ? [
          ...BASE_NAV_ITEMS,
          {
            name: 'Workspaces',
            href: '/admin/workspaces',
            icon: Building2,
          },
        ]
      : BASE_NAV_ITEMS;

  const initials = (workspace.name || 'CO')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const collapsedImg = workspace.iconUrl || workspace.logoUrl;
  const expandedImg = workspace.logoUrl;

  return (
    <>
      <aside
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-[#221E1E] text-stone-300 flex flex-col shrink-0 border-r border-[#332D2D] select-none transition-all duration-300 ease-in-out relative`}
      >
        {/* Brand Header */}
        <div
          className={`h-20 flex items-center ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          } border-b border-[#332D2D] transition-all`}
        >
          {isCollapsed ? (
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-xs p-1.5 transition-all overflow-hidden">
              {collapsedImg ? (
                <img
                  src={collapsedImg}
                  alt={`${workspace.name} Emblem`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-brand text-white flex items-center justify-center font-bold text-sm">
                  {initials}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full bg-white rounded-lg px-2.5 py-1.5 flex items-center justify-center shadow-xs transition-all min-h-[48px] overflow-hidden">
              {expandedImg ? (
                <img
                  src={expandedImg}
                  alt={workspace.legalName || workspace.name}
                  className="h-9 w-auto max-w-full object-contain"
                />
              ) : (
                <div className="flex items-center gap-2.5 px-1 w-full">
                  <div className="w-7 h-7 rounded-md bg-brand text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {initials}
                  </div>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {workspace.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Super Admin Workspace Switcher */}
        {role === 'SUPER_ADMIN' && availableWorkspaces.length > 0 && !isCollapsed && (
          <div className="px-3 pt-3 relative">
            <button
              type="button"
              onClick={() => setShowSwitcher((prev) => !prev)}
              disabled={switching}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#2C2727] hover:bg-[#352F2F] border border-[#3E3737] text-xs text-stone-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: workspace.primaryColor }}
                />
                <span className="font-semibold truncate">{workspace.name}</span>
              </div>
              {switching ? (
                <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              )}
            </button>

            {showSwitcher && (
              <div className="absolute left-3 right-3 top-14 z-40 bg-[#2C2727] border border-[#443C3C] rounded-xl shadow-xl py-1.5 max-h-64 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Switch Workspace
                </div>
                {availableWorkspaces.map((ws) => {
                  const active = ws.id === workspace.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        setShowSwitcher(false);
                        switchWorkspace(ws.id);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#3A3333] text-white font-semibold'
                          : 'text-stone-300 hover:bg-[#352F2F] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: ws.primaryColor }}
                        />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                    </button>
                  );
                })}
                <div className="border-t border-[#3E3737] mt-1 pt-1 px-1.5">
                  <Link
                    href="/admin/workspaces"
                    onClick={() => setShowSwitcher(false)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-brand hover:bg-[#352F2F] transition-colors"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Manage All Workspaces</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation items */}
        <div className="flex-1 py-5 px-3 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-1">
            {isCollapsed ? (
              <div className="my-2 border-t border-[#332D2D] mx-2" />
            ) : (
              <div className="px-3 mb-2 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                HR Operations
              </div>
            )}

            {navItems.map((item) => {
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
                      ? 'bg-brand text-white shadow-xs font-semibold'
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
        </div>

        {/* Install Desktop App button at bottom of navbar - ONLY visible in web browser, NEVER in Electron */}
        {!isDesktopApp && (
          <div className="p-3 border-t border-[#332D2D]">
            {isCollapsed ? (
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                title="Install Desktop App"
                className="w-full flex items-center justify-center p-2.5 rounded-lg bg-brand hover:bg-brand-hover text-white shadow-xs transition-all cursor-pointer group"
              >
                <Download className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-xs transition-all cursor-pointer group"
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
            <div className="relative bg-[#221E1E] p-6 text-white border-b border-[#332D2D]">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
                  {collapsedImg ? (
                    <img
                      src={collapsedImg}
                      alt={workspace.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-brand text-white flex items-center justify-center font-bold text-base">
                      {initials}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {workspace.name} Desktop
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Windows 10/11 Native Application
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Install the standalone desktop application for dedicated native access without
                using a web browser.
              </p>

              <div className="flex flex-col gap-2.5">
                <a
                  href="/api/download/desktop"
                  download={`${workspace.name.replace(/\s+/g, '-')}-Payslip-Portal-Setup.exe`}
                  onClick={() => setShowInstallModal(false)}
                  className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Desktop Installer (.exe)</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
