'use client';

import React, { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import {
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
  Lock,
  Unlock,
  Pencil,
  XCircle,
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

  // Stored backup to restore if user cancels editing
  const [savedFormData, setSavedFormData] = useState<SMTPFormData>({
    host: '',
    port: 587,
    user: '',
    password: '',
    from: '',
    secure: false,
  });

  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
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
        const initial = {
          host: s.host || '',
          port: s.port || 587,
          user: s.user || '',
          password: '', // Keep empty unless typing new one
          from: s.from || '',
          secure: Boolean(s.secure),
        };
        setFormData(initial);
        setSavedFormData(initial);
        setHasStoredPassword(Boolean(s.hasPassword));
        setIsConfigured(Boolean(s.isConfigured));
        setLastSavedTime(s.updatedAt || null);

        // If already configured in database, lock it by default!
        if (s.isConfigured) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
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
    if (isLocked) return;
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

  // Cancel editing and revert to previously saved data
  const handleCancelEdit = () => {
    setFormData(savedFormData);
    setIsLocked(true);
    setSaveErrorMsg('');
  };

  // Save SMTP Settings Dynamically
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

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

      setSaveSuccessMsg('SMTP settings saved successfully! Configuration is now locked and protected.');
      setIsConfigured(data.smtp.isConfigured);
      setHasStoredPassword(data.smtp.hasPassword);
      setLastSavedTime(new Date().toISOString());

      // Update backup and clear password input
      const lockedData: SMTPFormData = {
        host: formData.host,
        port: formData.port,
        user: formData.user,
        password: '',
        from: formData.from || formData.user,
        secure: formData.secure,
      };
      setFormData(lockedData);
      setSavedFormData(lockedData);

      // Lock configuration immediately upon save
      setIsLocked(true);

      setTimeout(() => setSaveSuccessMsg(''), 5000);
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
            Configure outgoing mail server credentials. Saved permanently to the Neon PostgreSQL database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConfigured && isLocked && (
            <button
              type="button"
              onClick={() => setIsLocked(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:border-[#78B338] hover:text-[#78B338] rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Settings</span>
            </button>
          )}

          <button
            onClick={fetchSMTPConfig}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Config</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#F2F8EA] text-[#78B338] border border-[#D6EDBC]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Outgoing Mail Server Details</h3>
              <p className="text-[11px] text-slate-500">
                Encrypted Nodemailer transport used to deliver confidential payslips to employee inboxes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConfigured ? (
              <>
                <Badge variant="success">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Configured & Ready</span>
                </Badge>
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>Locked</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs animate-pulse">
                    <Unlock className="w-3 h-3 text-amber-600" />
                    <span>Editing Mode</span>
                  </span>
                )}
              </>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Configuration Needed</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Locked State Security Banner */}
        {isConfigured && isLocked && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 shrink-0 shadow-2xs">
                <Lock className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <span className="font-bold text-slate-900">Settings are locked & uneditable</span>
                <p className="text-[11px] text-slate-500">
                  SMTP configuration is securely fixed to prevent accidental modification. Click &quot;Edit Configuration&quot; to make updates.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLocked(false)}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:border-[#78B338] hover:text-[#78B338] text-slate-800 rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0"
            >
              <Pencil className="w-3.5 h-3.5 text-[#78B338]" />
              <span>Unlock to Edit</span>
            </button>
          </div>
        )}

        {/* Editing State Active Banner */}
        {isConfigured && !isLocked && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-700 shrink-0">
                <Unlock className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <span className="font-bold text-amber-950">Editing Mode Unlocked</span>
                <p className="text-[11px] text-amber-800">
                  You can now modify the fields below. Once finished, click &quot;Save &amp; Lock Configuration&quot; to re-lock.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* Quick Provider Presets */}
        <div className={`p-3.5 bg-gradient-to-r from-slate-50/80 to-[#F2F8EA]/30 rounded-xl border border-slate-200/80 transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#78B338]" />
              <span>One-Click Provider Quick Fill:</span>
            </span>
            {isLocked && (
              <span className="text-[10px] text-slate-400 font-medium italic">
                (Unlock below to use quick fill)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => applyPreset('zoho')}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#96D055] hover:bg-[#F2F8EA] rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>🏢 Zoho Workspace / Mail</span>
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={() => applyPreset('gmail')}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50/50 rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>📨 Gmail</span>
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={() => applyPreset('outlook')}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>SMTP Host Server *</span>
                {isLocked && <span className="text-[10px] text-slate-400 font-normal">Fixed</span>}
              </label>
              <input
                type="text"
                required
                disabled={isLocked}
                placeholder="e.g. smtppro.zoho.com or smtp.gmail.com"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl font-mono transition-all shadow-2xs ${
                  isLocked
                    ? 'bg-slate-100/80 border border-slate-200 text-slate-600 cursor-not-allowed select-none'
                    : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Port Number *</span>
                {isLocked && <span className="text-[10px] text-slate-400 font-normal">Fixed</span>}
              </label>
              <input
                type="number"
                required
                disabled={isLocked}
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
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl font-mono transition-all shadow-2xs ${
                  isLocked
                    ? 'bg-slate-100/80 border border-slate-200 text-slate-600 cursor-not-allowed select-none'
                    : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>SMTP Username / Email Address *</span>
                {isLocked && <span className="text-[10px] text-slate-400 font-normal">Fixed</span>}
              </label>
              <input
                type="email"
                required
                disabled={isLocked}
                placeholder="e.g. hr@sterlingdistillers.com"
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl transition-all shadow-2xs ${
                  isLocked
                    ? 'bg-slate-100/80 border border-slate-200 text-slate-600 cursor-not-allowed select-none'
                    : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>SMTP Password or App Password *</span>
                {isLocked && <span className="text-[10px] text-emerald-600 font-semibold">Protected in DB</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={isLocked}
                  placeholder={
                    isLocked
                      ? '•••••••••••••••• (Encrypted in Cloud Database)'
                      : hasStoredPassword
                      ? '•••••••••••• (Leave blank to keep existing password)'
                      : 'Enter SMTP or App Password'
                  }
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-3.5 py-2.5 pr-9 text-xs rounded-xl transition-all shadow-2xs ${
                    isLocked
                      ? 'bg-slate-100/80 border border-slate-200 text-slate-500 cursor-not-allowed select-none'
                      : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900'
                  }`}
                />
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Sender &quot;From&quot; Header Display</span>
              {isLocked && <span className="text-[10px] text-slate-400 font-normal">Fixed</span>}
            </label>
            <input
              type="text"
              disabled={isLocked}
              placeholder='e.g. Sterling Distillers HR <sales@sterlingdistillers.com>'
              value={formData.from}
              onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              className={`w-full px-3.5 py-2.5 text-xs rounded-xl transition-all shadow-2xs ${
                isLocked
                  ? 'bg-slate-100/80 border border-slate-200 text-slate-600 cursor-not-allowed select-none'
                  : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900'
              }`}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The friendly display name employees will see in their inbox.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="secureToggle"
              disabled={isLocked}
              checked={formData.secure}
              onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
              className={`w-4 h-4 rounded text-[#78B338] focus:ring-[#96D055] border-slate-300 ${
                isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            />
            <label
              htmlFor="secureToggle"
              className={`text-xs font-semibold ${isLocked ? 'text-slate-500 cursor-not-allowed' : 'text-slate-700 cursor-pointer'}`}
            >
              Use Direct SSL/TLS (Check if using port 465, uncheck for port 587 STARTTLS)
            </label>
          </div>

          {lastSavedTime && (
            <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Last permanently saved to cloud database: {new Date(lastSavedTime).toLocaleString()}</span>
            </p>
          )}

          {/* Bottom Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Credentials are encrypted &amp; stored persistently in Neon PostgreSQL.</span>
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Test Connection is ALWAYS available so Admin can verify handshake */}
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={testingSmtp || (!formData.host && !formData.user)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Send className="w-3.5 h-3.5 text-[#78B338]" />
                <span>{testingSmtp ? 'Testing Handshake...' : 'Test Connection'}</span>
              </button>

              {isLocked ? (
                /* When Locked: Provide explicit Unlock button */
                <button
                  type="button"
                  onClick={() => setIsLocked(false)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#96D055]" />
                  <span>Edit Configuration</span>
                </button>
              ) : (
                /* When Unlocked: Provide Cancel and Save & Lock buttons */
                <>
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={saving || !formData.host || !formData.user}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-[#78B338] hover:bg-[#689F2E] text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save & Lock'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
