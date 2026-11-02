'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Mail,
  FileText,
  Server,
  Zap,
  Sparkles,
  Building2,
} from 'lucide-react';

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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#181616] select-none overflow-hidden font-sans">
      {/* LEFT COLUMN: Dedicated Sleek Authentication Terminal */}
      <div className="lg:col-span-5 bg-[#1F1C1C] border-r border-stone-800/80 p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative z-10">
        {/* Top Branding */}
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-xs ring-1 ring-white/10">
              <img
                src="/sterling-favicon.png"
                alt="Sterling Distillers"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight block">
                Sterling Distillers
              </span>
              <span className="text-[11px] text-stone-400 block -mt-0.5">
                Payslip Distribution System
              </span>
            </div>
          </div>
        </div>

        {/* Center Login Form */}
        <div className="my-auto py-8 max-w-sm w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
              Sign in with your HR administrator credentials to manage confidential monthly payroll dispatches.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Administrator Passcode
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter administrator passcode"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#141212] border border-stone-700/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#78B338] focus:border-[#78B338] transition-all text-white placeholder:text-stone-500"
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
              className="w-full py-2.5 px-4 bg-[#78B338] hover:bg-[#689F2E] active:scale-[0.99] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Authorization...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Features List */}
          <div className="mt-8 pt-6 border-t border-stone-800/80 space-y-2.5 text-[11px] text-stone-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#78B338] shrink-0" />
              <span>Encrypted Cloud Session Authentication</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#78B338] shrink-0" />
              <span>Zero Permanent Storage of Salary Slip PDFs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#78B338] shrink-0" />
              <span>Zoho SMTP Direct Delivery Relay</span>
            </div>
          </div>
        </div>

        {/* Left Footer */}
        <div className="pt-4 flex items-center justify-between text-xs text-stone-500">
          <span>© 2026 Sterling Distillers</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#141212] text-stone-400 border border-stone-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78B338]" />
            <span>v1.0.0</span>
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: Rich Minimalist Branded Visual Showcase */}
      <div className="lg:col-span-7 hidden lg:flex flex-col justify-between p-12 lg:p-16 relative bg-gradient-to-br from-[#272323] via-[#1C1919] to-[#121111] overflow-hidden">
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#332D2D_1px,transparent_1px),linear-gradient(to_bottom,#332D2D_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />

        {/* Soft Ambient Glowing Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#78B338]/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#96D055]/10 blur-[130px] rounded-full pointer-events-none" />

        {/* Top Header Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-stone-300 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#78B338]" />
            <span>Confidential HR Payroll Infrastructure</span>
          </span>

          <span className="text-xs font-mono text-stone-500">
            ISO 27001 Security Standard
          </span>
        </div>

        {/* Centerpiece: Floating Glassmorphic Dispatch Telemetry Showcase */}
        <div className="relative z-10 my-auto py-6 max-w-lg w-full mx-auto">
          {/* Main Showcase Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Top Card Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#78B338] text-white flex items-center justify-center shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Automated Delivery Pipeline
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Real-time PDF Matching & Zoho SMTP Dispatch
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">
                  Delivery Rate
                </span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  100% OK
                </span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">
                  Protocol
                </span>
                <span className="text-xs font-bold text-white font-mono truncate block mt-0.5">
                  Zoho SSL:465
                </span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">
                  Storage Policy
                </span>
                <span className="text-xs font-bold text-amber-300 truncate block mt-0.5">
                  Zero Retain
                </span>
              </div>
            </div>

            {/* Simulated Live Dispatch Notification */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#78B338]/20 text-[#78B338] font-bold text-[10px] flex items-center justify-center">
                    SD
                  </div>
                  <span className="font-semibold text-white">Employee Salary Slip Sent</span>
                </div>
                <span className="text-stone-400 font-mono text-[10px]">Nov 2, 2026</span>
              </div>

              <div className="text-[11px] text-stone-300 bg-white/5 p-2 rounded-lg font-mono flex items-center justify-between">
                <span className="truncate">Payslip_E1_November.pdf</span>
                <span className="text-emerald-400 text-[10px] font-bold">250 ACCEPTED</span>
              </div>
            </div>
          </div>

          {/* Floating Pill Badges around Showcase */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] bg-white/5 text-stone-300 border border-white/10 backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-[#78B338]" />
              <span>Confidential Individual Routing</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] bg-white/5 text-stone-300 border border-white/10 backdrop-blur-md">
              <Server className="w-3.5 h-3.5 text-[#96D055]" />
              <span>Neon PostgreSQL Cloud Sync</span>
            </span>
          </div>
        </div>

        {/* Bottom Corporate Signature */}
        <div className="relative z-10 border-t border-white/10 pt-4 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-stone-500" />
            <span>Sterling Distillers Private Limited</span>
          </div>
          <span className="italic text-stone-500 text-[11px]">
            Confidential Internal Operations
          </span>
        </div>
      </div>
    </div>
  );
}
