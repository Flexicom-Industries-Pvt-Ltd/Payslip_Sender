'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Mail, LogOut, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface SystemStatus {
  smtp: {
    isConfigured: boolean;
    host: string | null;
    port: number | null;
  };
  database: {
    provider: string;
    isNeon: boolean;
  };
}

export function Header() {
  const router = useRouter();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-base font-bold text-slate-900 tracking-tight hidden sm:block">
          Sterling Distillers — Payslip Dispatch Portal
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Indicators */}
        <div className="flex items-center gap-2">
          {/* SMTP Indicator */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              status?.smtp?.isConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={
              status?.smtp?.isConfigured
                ? `SMTP Active (${status.smtp.host}:${status.smtp.port})`
                : 'SMTP Not Configured - Configure in Settings'
            }
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{status?.smtp?.isConfigured ? 'SMTP Ready' : 'Configure SMTP'}</span>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            title="Refresh status"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* HR Profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-800">HR Administrator</div>
            <div className="text-[11px] text-slate-400">Payroll Officer</div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
            title="Log out from HR portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

