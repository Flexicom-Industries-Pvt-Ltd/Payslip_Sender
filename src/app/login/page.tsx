'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Building2,
} from 'lucide-react';
import type { WorkspaceBranding } from '@/components/layout/workspace-context';
import {
  applyFaviconToDocument,
  applyWorkspaceCssTheme,
} from '@/components/layout/workspace-context';
import { buildMonogramFaviconSvg } from '@/lib/theme-utils';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSlug = searchParams.get('workspace') || searchParams.get('w') || '';

  const [loginMode, setLoginMode] = useState<'workspace' | 'super_admin'>('workspace');
  const [workspaceSlug, setWorkspaceSlug] = useState(urlSlug);
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [brandedWorkspace, setBrandedWorkspace] = useState<WorkspaceBranding | null>(null);
  const [loadingBrand, setLoadingBrand] = useState(Boolean(urlSlug));

  useEffect(() => {
    setWorkspaceSlug(urlSlug);
    if (!urlSlug) {
      setBrandedWorkspace(null);
      setLoadingBrand(false);
      document.title = 'Enterprise Payslip Portal | Sign In';
      applyFaviconToDocument(buildMonogramFaviconSvg('HR', '#0F172A'));
      return;
    }

    let cancelled = false;
    setLoadingBrand(true);
    fetch(`/api/workspaces/public?slug=${encodeURIComponent(urlSlug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.workspace) {
          setBrandedWorkspace(data.workspace);
          applyWorkspaceCssTheme(data.workspace);
          document.title = `${data.workspace.name} | HR Portal Sign In`;
          const iconHref =
            data.workspace.iconUrl ||
            data.workspace.logoUrl ||
            buildMonogramFaviconSvg(data.workspace.name, data.workspace.primaryColor);
          applyFaviconToDocument(iconHref);
        } else {
          setBrandedWorkspace(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBrandedWorkspace(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBrand(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter your passcode');
      return;
    }
    if (loginMode === 'workspace' && !workspaceSlug.trim()) {
      // Allow signing in directly with Super Admin passcode even without slug
      // or prompt clearly if it fails
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: loginMode,
          workspaceSlug: loginMode === 'workspace' ? workspaceSlug.trim() : undefined,
          passcode: passcode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      if (loginMode === 'super_admin') {
        router.push('/admin/workspaces');
      } else {
        router.push('/employees');
      }
      router.refresh();
    } catch {
      setError('Connection error occurred while logging in');
      setLoading(false);
    }
  };

  const accentColor = brandedWorkspace?.primaryColor || '#78B338';
  const isSterling = brandedWorkspace?.slug === 'sterling-distillers';

  const brandInitials = (brandedWorkspace?.name || 'HR')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-12 select-none overflow-hidden font-sans">
      {/* LEFT COLUMN: Clean White Authentication Panel */}
      <div className="lg:col-span-5 bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between border-r border-slate-200/80 relative z-10">
        {/* Top Company Brand */}
        <div className="flex items-center justify-between gap-3">
          {brandedWorkspace ? (
            brandedWorkspace.logoUrl ? (
              <img
                src={brandedWorkspace.logoUrl}
                alt={brandedWorkspace.legalName || brandedWorkspace.name}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {brandInitials}
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {brandedWorkspace.name}
                </span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 leading-none">
                  Payslip Portal
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Multi-Company HR Workspace
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center Form */}
        <div className="my-auto py-8 max-w-sm w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {brandedWorkspace
                ? `Sign In to ${brandedWorkspace.name}`
                : loginMode === 'super_admin'
                ? 'Platform Super Admin'
                : 'Sign In to HR Workspace'}
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {brandedWorkspace
                ? 'Confidential employee payslip distribution and payroll records management.'
                : loginMode === 'super_admin'
                ? 'Create and manage company workspaces, themes, logos, and access.'
                : 'Enter your Company Workspace Code and HR administrator passcode.'}
            </p>
          </div>

          {/* Mode Tabs only when not locked to a branded URL */}
          {!urlSlug && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('workspace');
                  setError('');
                }}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
                  loginMode === 'workspace'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Company Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('super_admin');
                  setError('');
                }}
                className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
                  loginMode === 'super_admin'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Super Admin
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {loginMode === 'workspace' && !brandedWorkspace && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company Workspace Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={workspaceSlug}
                    onChange={(e) => setWorkspaceSlug(e.target.value)}
                    placeholder="e.g. sterling-distillers"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400 font-mono"
                    autoFocus={!urlSlug}
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Passcode
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={
                    loginMode === 'super_admin'
                      ? 'Enter super admin passcode'
                      : 'Enter administrator passcode'
                  }
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:bg-white focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                  style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                  autoFocus={Boolean(urlSlug) || loginMode === 'super_admin'}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || loadingBrand}
              className="w-full py-2.5 px-4 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-60 cursor-pointer hover:opacity-95"
              style={{ backgroundColor: accentColor }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Confidential Internal Portal • Authorized Personnel Only</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
          <span>© 2026 {brandedWorkspace?.name || 'Enterprise Payroll Platform'}</span>
          <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Branded Company Showcase (Sterling preserves plant showcase; new workspaces show clean company branding) */}
      <div className="hidden lg:flex lg:col-span-7 bg-[#F8FAF6] p-10 xl:p-14 flex-col justify-between overflow-y-auto">
        {isSterling ? (
          <>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-medium text-slate-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#78B338]" />
                <span>Purba Bardhaman Plant • West Bengal</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Grain-Based Dedicated Ethanol Plant
              </span>
            </div>

            <div className="my-8 space-y-5 max-w-xl">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-white">
                <img
                  src="/sterling-project-1.jpg"
                  alt="Sterling Distillers Dedicated Ethanol Facility, Purba Bardhaman"
                  className="w-full h-64 object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent flex items-end p-5">
                  <div>
                    <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-[#9DE04B] mb-1">
                      Explore Our Plant
                    </span>
                    <p className="text-sm font-medium text-white drop-shadow-sm">
                      160 KLPD Grain-Based Dedicated Ethanol Plant — Purba Bardhaman, West Bengal
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Empowering your future with ETHANOL
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  At Sterling, we manufacture Ethanol, a clean-burning, high-octane renewable fuel that is blended with gasoline. As part of the Ethanol Blended Petrol Programme (EBP) under the Government of India&apos;s National Policy on Biofuels, Sterling Distillers is committed to sustainable bio-energy and reducing India&apos;s carbon footprint.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-slate-900">Ethanol</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Clean-burning, high-octane renewable fuel blended with gasoline
                  </span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-slate-900">DDGS</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Nutrient-rich animal feed co-product from dry milling
                  </span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-slate-900">CO2</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                    High-purity captured industrial gas for commercial utilization
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-200/70">
              <span>Sterling Distillers Private Limited</span>
              <span>Salt Lake, Sector-1, Kolkata — 700064</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-medium text-slate-700 shadow-2xs">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <span>
                  {brandedWorkspace?.tagline ||
                    (brandedWorkspace
                      ? `${brandedWorkspace.name} HR Workspace`
                      : 'Dedicated Company Workspaces')}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Confidential Payroll Distribution
              </span>
            </div>

            <div className="my-auto max-w-lg space-y-5">
              <div className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                {brandedWorkspace?.logoUrl && (
                  <img
                    src={brandedWorkspace.logoUrl}
                    alt={brandedWorkspace.name}
                    className="h-12 w-auto object-contain"
                  />
                )}
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {brandedWorkspace?.legalName ||
                    brandedWorkspace?.name ||
                    'Enterprise Payslip Distribution'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {brandedWorkspace
                    ? `Welcome to the official employee payslip distribution portal for ${
                        brandedWorkspace.legalName || brandedWorkspace.name
                      }. Manage your employee roster, dispatch individual PDF salary slips securely, and track full delivery audit logs.`
                    : 'Each company workspace operates in complete isolation with its own branding, employee directory, mail server configuration, and delivery audit logs.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-slate-900">Employee Roster</span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                    12-month delivery matrix & spreadsheet import
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-slate-900">Direct Dispatch</span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                    Individual encrypted PDF delivery with zero CC/BCC
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                  <span className="block text-xs font-bold text-slate-900">Audit Trail</span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                    Complete SMTP delivery telemetry and CSV export
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-200/70">
              <span>{brandedWorkspace?.legalName || 'Multi-Tenant HR Portal'}</span>
              <span>Private & Isolated Workspace</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
