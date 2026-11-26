'use client';

import React, { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useWorkspace } from '@/components/layout/workspace-context';
import { Badge } from '@/components/ui/badge';
import { THEME_PRESETS, deriveThemePalette } from '@/lib/theme-utils';
import { compressLogoToTinyBase64 } from '@/lib/image-optimizer';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Server,
  ShieldCheck,
  Lock,
  Unlock,
  Pencil,
  XCircle,
  Palette,
  Upload,
  Save,
  Building2,
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
  const { workspace, refreshWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'smtp' | 'branding'>('smtp');

  const [formData, setFormData] = useState<SMTPFormData>({
    host: '',
    port: 587,
    user: '',
    password: '',
    from: '',
    secure: false,
  });

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Branding state
  const [brandForm, setBrandForm] = useState({
    name: workspace.name,
    legalName: workspace.legalName || workspace.name,
    tagline: workspace.tagline || '',
    logoUrl: workspace.logoUrl || '',
    iconUrl: workspace.iconUrl || '',
    primaryColor: workspace.primaryColor || '#78B338',
  });
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMessage, setBrandMessage] = useState('');
  const [brandError, setBrandError] = useState('');

  useEffect(() => {
    setBrandForm({
      name: workspace.name,
      legalName: workspace.legalName || workspace.name,
      tagline: workspace.tagline || '',
      logoUrl: workspace.logoUrl || '',
      iconUrl: workspace.iconUrl || '',
      primaryColor: workspace.primaryColor || '#78B338',
    });
  }, [workspace]);

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
          password: '',
          from: s.from || '',
          secure: Boolean(s.secure),
        };
        setFormData(initial);
        setSavedFormData(initial);
        setHasStoredPassword(Boolean(s.hasPassword));
        setIsConfigured(Boolean(s.isConfigured));
        setLastSavedTime(s.updatedAt || null);
        setIsLocked(Boolean(s.isConfigured));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSMTPConfig();
  }, [workspace.id]);

  const applyPreset = (preset: 'zoho' | 'gmail' | 'outlook') => {
    if (isLocked) return;
    const hrLabel = `${workspace.name} HR`;
    const domain = `${workspace.slug}.com`;

    if (preset === 'zoho') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtppro.zoho.com',
        port: 465,
        secure: true,
        from: prev.user ? `${hrLabel} <${prev.user}>` : `${hrLabel} <hr@${domain}>`,
      }));
    } else if (preset === 'gmail') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        from: prev.user ? `${hrLabel} <${prev.user}>` : `${hrLabel} <hr@${domain}>`,
      }));
    } else if (preset === 'outlook') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        from: prev.user ? `${hrLabel} <${prev.user}>` : `${hrLabel} <hr@${domain}>`,
      }));
    }
  };

  const handleCancelEdit = () => {
    setFormData(savedFormData);
    setIsLocked(true);
    setSaveErrorMsg('');
  };

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
          password: formData.password,
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
      setIsLocked(true);

      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

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
          password: formData.password,
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

  const handleBrandImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'iconUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const kind = field === 'iconUrl' ? 'icon' : 'logo';
      const optimized = await compressLogoToTinyBase64(file, kind);
      setBrandForm((prev) => ({
        ...prev,
        [field]: optimized.dataUrl,
      }));
    } catch (err: any) {
      setBrandError(err.message || 'Failed to compress image');
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBrand(true);
    setBrandMessage('');
    setBrandError('');

    try {
      const res = await fetch('/api/workspaces/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBrandError(data.error || 'Failed to update branding');
        return;
      }
      await refreshWorkspace();
      setBrandMessage('Workspace branding and color theme updated!');
      setTimeout(() => setBrandMessage(''), 4000);
    } catch (err: any) {
      setBrandError(err.message || 'Error updating branding');
    } finally {
      setSavingBrand(false);
    }
  };

  const previewPalette = deriveThemePalette(brandForm.primaryColor);

  return (
    <DashboardShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {activeTab === 'smtp' ? (
              <Mail className="w-5 h-5 text-brand" />
            ) : (
              <Palette className="w-5 h-5 text-brand" />
            )}
            <span>Workspace Settings — {workspace.name}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage outgoing mail server (SMTP) and white-label company theme for this workspace.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('smtp')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'smtp'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-brand" />
            <span>Email Server (SMTP)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-brand" />
            <span>Branding & Theme</span>
          </button>
        </div>
      </div>

      {activeTab === 'smtp' ? (
        <div className="max-w-4xl bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-brand-light text-brand border border-brand-border">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Outgoing Mail Server Details</h3>
                <p className="text-[11px] text-slate-500">
                  Dedicated SMTP credentials isolated to {workspace.name}
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

              <button
                onClick={fetchSMTPConfig}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                title="Reload SMTP Config"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isConfigured && isLocked && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 shrink-0 shadow-2xs">
                  <Lock className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <span className="font-bold text-slate-900">Settings are locked & uneditable</span>
                  <p className="text-[11px] text-slate-500">
                    SMTP configuration is securely fixed to prevent accidental modification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocked(false)}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:border-brand hover:text-brand text-slate-800 rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5 text-brand" />
                <span>Unlock to Edit</span>
              </button>
            </div>
          )}

          {isConfigured && !isLocked && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-700 shrink-0">
                  <Unlock className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <span className="font-bold text-amber-950">Editing Mode Unlocked</span>
                  <p className="text-[11px] text-amber-800">
                    Modify the fields below, then click &quot;Save &amp; Lock&quot; to persist.
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

          <div
            className={`p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 transition-opacity ${
              isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => applyPreset('zoho')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-brand hover:bg-brand-light rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
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
                      : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white text-slate-900'
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
                      : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white text-slate-900'
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
                  placeholder={`e.g. hr@${workspace.slug}.com`}
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl transition-all shadow-2xs ${
                    isLocked
                      ? 'bg-slate-100/80 border border-slate-200 text-slate-600 cursor-not-allowed select-none'
                      : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>SMTP Password or App Password *</span>
                  {isLocked && (
                    <span className="text-[10px] text-emerald-600 font-semibold">Protected in DB</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    disabled={isLocked}
                    placeholder={
                      isLocked
                        ? '•••••••••••••••• (Saved in Cloud Database)'
                        : hasStoredPassword
                        ? '•••••••••••• (Leave blank to keep existing password)'
                        : 'Enter SMTP or App Password'
                    }
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full px-3.5 py-2.5 pr-9 text-xs rounded-xl transition-all shadow-2xs ${
                      isLocked
                        ? 'bg-slate-100/80 border border-slate-200 text-slate-500 cursor-not-allowed select-none'
                        : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white text-slate-900'
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
                placeholder={`e.g. ${workspace.name} HR or ${workspace.name} HR <hr@${workspace.slug}.com>`}
                value={formData.from}
                onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl transition-all shadow-2xs ${
                  isLocked
                    ? 'bg-slate-100/80 border border-slate-200 text-slate-600 cursor-not-allowed select-none'
                    : 'bg-slate-50/70 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white text-slate-900'
                }`}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Friendly sender name employees will see in their inbox.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="secureToggle"
                disabled={isLocked}
                checked={formData.secure}
                onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                className={`w-4 h-4 rounded text-brand focus:ring-brand border-slate-300 ${
                  isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              />
              <label
                htmlFor="secureToggle"
                className={`text-xs font-semibold ${
                  isLocked ? 'text-slate-500 cursor-not-allowed' : 'text-slate-700 cursor-pointer'
                }`}
              >
                Use Direct SSL/TLS (Check if using port 465, uncheck for port 587 STARTTLS)
              </label>
            </div>

            {lastSavedTime && (
              <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Last permanently saved to cloud database: {new Date(lastSavedTime).toLocaleString()}
                </span>
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || (!formData.host && !formData.user)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5 text-brand" />
                  <span>{testingSmtp ? 'Testing Handshake...' : 'Test Connection'}</span>
                </button>

                {isLocked ? (
                  <button
                    type="button"
                    onClick={() => setIsLocked(false)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-brand" />
                    <span>Edit Configuration</span>
                  </button>
                ) : (
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
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
      ) : (
        <div className="max-w-4xl bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="p-3 rounded-xl bg-brand-light text-brand border border-brand-border">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Company Branding & Theme</h3>
              <p className="text-[11px] text-slate-500">
                Customize your workspace logo, icon, display name, and accent color theme
              </p>
            </div>
          </div>

          {brandMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{brandMessage}</span>
            </div>
          )}

          {brandError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{brandError}</span>
            </div>
          )}

          <form onSubmit={handleSaveBranding} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Company Display Name
                </label>
                <input
                  type="text"
                  required
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={brandForm.legalName}
                  onChange={(e) => setBrandForm({ ...brandForm, legalName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Location / Tagline
              </label>
              <input
                type="text"
                value={brandForm.tagline}
                onChange={(e) => setBrandForm({ ...brandForm, tagline: e.target.value })}
                placeholder="e.g. Corporate Headquarters • Kolkata"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Sidebar Logo</span>
                  <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleBrandImageUpload(e, 'logoUrl')}
                    />
                  </label>
                </div>
                {brandForm.logoUrl && (
                  <div className="h-12 bg-white rounded-lg border border-slate-200 p-1.5 flex items-center justify-center">
                    <img src={brandForm.logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Collapsed Emblem / Favicon</span>
                  <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>Upload Icon</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleBrandImageUpload(e, 'iconUrl')}
                    />
                  </label>
                </div>
                {brandForm.iconUrl && (
                  <div className="h-12 bg-white rounded-lg border border-slate-200 p-1.5 flex items-center justify-center">
                    <img src={brandForm.iconUrl} alt="Icon" className="h-9 w-9 object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Primary Brand Color Theme</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandForm.primaryColor}
                    onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
                  />
                  <input
                    type="text"
                    value={brandForm.primaryColor}
                    onChange={(e) => setBrandForm({ ...brandForm, primaryColor: e.target.value })}
                    className="w-20 px-2 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded-lg uppercase"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {THEME_PRESETS.map((preset) => {
                  const selected =
                    brandForm.primaryColor.toUpperCase() === preset.primaryColor.toUpperCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setBrandForm({ ...brandForm, primaryColor: preset.primaryColor })}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                        selected
                          ? 'bg-white border-slate-900 text-slate-900 shadow-2xs'
                          : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: preset.primaryColor }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingBrand}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: previewPalette.primaryColor }}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingBrand ? 'Saving Branding...' : 'Save Branding & Apply Theme'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
