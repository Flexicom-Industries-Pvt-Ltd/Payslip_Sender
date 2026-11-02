'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-[#141212] flex flex-col justify-between items-center p-6 relative overflow-hidden select-none">
      {/* Subtle Ambient Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#78B338]/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Spacer */}
      <div className="w-full flex justify-end max-w-sm pt-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-[#1E1B1B] text-stone-400 border border-stone-800">
          <span className="w-1.5 h-1.5 rounded-full bg-[#78B338] animate-pulse" />
          <span>v1.0.0</span>
        </span>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[380px] z-10">
        <div className="bg-[#1C1919] rounded-2xl border border-stone-800/90 shadow-2xl p-7 sm:p-8 backdrop-blur-md">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md p-2.5 mb-4 ring-1 ring-white/10 transition-transform hover:scale-105 duration-200">
              <img
                src="/sterling-favicon.png"
                alt="Sterling Distillers"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-lg font-semibold text-white tracking-tight">
              Sterling Distillers
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Confidential HR Payslip Portal
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.2" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter administrator passcode"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#121111] border border-stone-700/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#78B338] focus:border-[#78B338] transition-all text-white placeholder:text-stone-500"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#78B338] hover:bg-[#689F2E] active:scale-[0.99] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Footnote */}
          <div className="mt-6 pt-5 border-t border-stone-800/80 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
            <span>Encrypted Session • Zero Storage</span>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="text-center text-xs text-stone-400 z-10">
        © 2026 Sterling Distillers Private Limited. All rights reserved.
      </div>
    </div>
  );
}
