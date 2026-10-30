'use client';

import React, { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Save,
  Eye,
  EyeOff,
  Server,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface SMTPFormData {
  host: string;
  port: number | string;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

export default function SettingsPage() {
  const [formData, setFormData] = useState<SMTPFormData>({
    host: '',
    port: 587,
    user: '',
    password: '',
    from: '',
    secure: false,
  });

  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Status and feedback states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const fetchSMTPConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/smtp');
      const data = await res.json();
      if (data.success && data.smtp) {
        const s = data.smtp;
        setFormData({
          host: s.host || '',
          port: s.port || 587,
          user: s.user || '',
          password: '', // Keep empty unless typing new one
          from: s.from || '',
          secure: Boolean(s.secure),
        });
        setHasStoredPassword(Boolean(s.hasPassword));
        setIsConfigured(Boolean(s.isConfigured));
        setLastSavedTime(s.updatedAt || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSMTPConfig();
  }, []);

  // Quick Preset Helper
  const applyPreset = (preset: 'zoho' | 'gmail' | 'outlook') => {
    if (preset === 'zoho') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtppro.zoho.com',
        port: 465,
        secure: true,
        from: prev.user ? `Sterling Distillers HR <${prev.user}>` : 'Sterling Distillers HR <sales@sterlingdistillers.com>',
      }));
    } else if (preset === 'gmail') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        from: prev.user ? `Sterling Distillers HR <${prev.user}>` : 'Sterling Distillers HR <sterlingdistillers@gmail.com>',
      }));
    } else if (preset === 'outlook') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        from: prev.user ? `Sterling Distillers HR <${prev.user}>` : 'Sterling Distillers HR <hr@sterlingdistillers.com>',
      }));
    }
  };

  // Save SMTP Settings Dynamically
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccessMsg('');
    setSaveErrorMsg('');
    setTestResult(null);

    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host,
          port: Number(formData.port),
          user: formData.user,
          password: formData.password, // if empty, backend retains existing password
          from: formData.from || formData.user,
          secure: formData.secure,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveErrorMsg(data.error || 'Failed to save configuration');
        return;
      }

      setSaveSuccessMsg('SMTP settings saved successfully! Ready to deliver payslips.');
      setIsConfigured(data.smtp.isConfigured);
      setHasStoredPassword(data.smtp.hasPassword);
      setLastSavedTime(new Date().toISOString());

      // Clear password field after save
      setFormData((prev) => ({ ...prev, password: '' }));

      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  // Test SMTP Connection with current form values
  const handleTestSmtp = async () => {
    try {
      setTestingSmtp(true);
      setTestResult(null);

      const res = await fetch('/api/settings/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host,
          port: Number(formData.port),
          user: formData.user,
          password: formData.password, // backend falls back to stored password if blank
          secure: formData.secure,
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error occurred while contacting test endpoint.',
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <DashboardShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span>Email Server (SMTP) Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure your email service credentials dynamically. Changes are saved instantly on the
            website.
          </p>
        </div>

        <button
          onClick={fetchSMTPConfig}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Config</span>
        </button>
      </div>

      <div className="max-w-4xl bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Outgoing Mail Server Details</h3>
                <p className="text-[11px] text-slate-500">
                  Used by Nodemailer to deliver monthly salary slips to employee emails
                </p>
              </div>
            </div>

            {isConfigured ? (
              <Badge variant="success">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Configured & Ready</span>
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Configuration Needed</span>
              </Badge>
            )}
          </div>

          {/* Quick Provider Presets */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>One-Click Provider Quick Fill:</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('zoho')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>🏢 Zoho Workspace / Mail</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('gmail')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50/50 rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>📨 Gmail</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('outlook')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>💼 Microsoft 365 / Outlook</span>
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
          )}

          {saveErrorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveErrorMsg}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 shadow-2xs ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">
                  {testResult.success ? 'SMTP Connection Successful!' : 'SMTP Connection Failed'}
                </div>
                <div className="text-[11px] mt-0.5 leading-relaxed">{testResult.message}</div>
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Host Server *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. smtppro.zoho.com or smtp.gmail.com"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Port Number *
                </label>
                <input
                  type="number"
                  required
                  placeholder="465 or 587"
                  value={formData.port}
                  onChange={(e) => {
                    const portNum = Number(e.target.value);
                    setFormData({
                      ...formData,
                      port: e.target.value,
                      secure: portNum === 465,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Username / Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. hr@yourcompany.com"
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Password or App Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={
                      hasStoredPassword
                        ? '•••••••••••• (Leave blank to keep current password)'
                        : 'Enter SMTP or App Password'
                    }
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-9 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sender "From" Header Display
              </label>
              <input
                type="text"
                placeholder='e.g. Sterling Distillers HR <sales@sterlingdistillers.com>'
                value={formData.from}
                onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                The friendly display name employees will see in their inbox.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="secureToggle"
                checked={formData.secure}
                onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <label htmlFor="secureToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                Use Direct SSL/TLS (Check if using port 465, uncheck for port 587 STARTTLS)
              </label>
            </div>

            {lastSavedTime && (
              <p className="text-[11px] text-slate-400 pt-1">
                Last updated: {new Date(lastSavedTime).toLocaleString()}
              </p>
            )}

            {/* Bottom Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Credentials are encrypted & saved securely on the server.</span>
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || (!formData.host && !formData.user)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>{testingSmtp ? 'Testing Handshake...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  disabled={saving || !formData.host || !formData.user}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </div>
          </form>
      </div>
    </DashboardShell>
  );
}
