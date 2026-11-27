'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  LogOut,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { useSidebar } from './sidebar-context';
import { useWorkspace } from './workspace-context';

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
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { workspace, role, switchWorkspace } = useWorkspace();
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
  }, [workspace.id]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      if (role === 'SUPER_ADMIN') {
        router.push('/admin/login');
      } else {
        router.push(`/login?workspace=${encodeURIComponent(workspace.slug)}`);
      }
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-slate-600" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-slate-600" />
          )}
        </button>
        <div className="hidden sm:flex items-center gap-2.5">
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            {workspace.name} — Payslip Dispatch Portal
          </h1>
          {role === 'SUPER_ADMIN' && (
            <button
              type="button"
              onClick={() => switchWorkspace(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title="Exit company portal and return to Platform Super Admin Console"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>All Workspaces</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
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
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200" />

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
          title="Sign out of HR Portal"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
