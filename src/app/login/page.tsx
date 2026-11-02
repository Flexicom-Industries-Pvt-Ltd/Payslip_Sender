'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Loader2, Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the administrator passcode');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please verify passcode.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Connection error occurred while logging in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-12 select-none overflow-hidden font-sans">
      {/* LEFT COLUMN: Clean White Minimalist Authentication Panel */}
      <div className="lg:col-span-5 bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between border-r border-slate-200/80 relative z-10">
        {/* Top Company Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/sterling-logo.jpg"
            alt="Sterling Distillers Private Limited"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Center Form */}
        <div className="my-auto py-8 max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sign In to HR Portal
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Confidential employee payslip distribution and payroll records management.
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Passcode
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter administrator passcode"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#78B338] focus:bg-white focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                  autoFocus
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
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#78B338] hover:bg-[#689F2E] active:scale-[0.99] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-60 cursor-pointer"
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

          {/* Privacy & Confidentiality Notice */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Confidential Internal Portal • Authorized Personnel Only</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
          <span>© 2026 Sterling Distillers</span>
          <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Official Sterling Distillers Plant & Corporate Profile */}
      <div className="hidden lg:flex lg:col-span-7 bg-[#F8FAF6] p-10 xl:p-14 flex-col justify-between overflow-y-auto">
        {/* Top Facility Location Header */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-medium text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#78B338]" />
            <span>Purba Bardhaman Plant • West Bengal</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">Grain-Based Dedicated Ethanol Plant</span>
        </div>

        {/* Center Showcase */}
        <div className="my-8 space-y-5 max-w-xl">
          {/* Authentic Plant Photograph from Official Website */}
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

          {/* Authentic Corporate Mission from sterlingdistillers.com */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Empowering your future with ETHANOL
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              At Sterling, we manufacture Ethanol, a clean-burning, high-octane renewable fuel that is blended with gasoline. As part of the Ethanol Blended Petrol Programme (EBP) under the Government of India&apos;s National Policy on Biofuels, Sterling Distillers is committed to sustainable bio-energy and reducing India&apos;s carbon footprint.
            </p>
          </div>

          {/* Authentic Products & Co-Products from sterlingdistillers.com */}
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

        {/* Corporate Office Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-200/70">
          <span>Sterling Distillers Private Limited</span>
          <span>Salt Lake, Sector-1, Kolkata — 700064</span>
        </div>
      </div>
    </div>
  );
}
