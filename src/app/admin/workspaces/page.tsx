'use client';

import React, { useEffect, useState } from 'react';
import {
  applyFaviconToDocument,
  applyWorkspaceCssTheme,
  useWorkspace,
} from '@/components/layout/workspace-context';
import { Modal } from '@/components/ui/modal';
import { buildMonogramFaviconSvg, slugifyWorkspaceName } from '@/lib/theme-utils';
import { compressLogoToTinyBase64 } from '@/lib/image-optimizer';
import { ColorThemePicker } from '@/components/ui/color-theme-picker';
import { buildDefaultEmailBody, DEFAULT_EMAIL_SUBJECT } from '@/lib/email-templates';
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  parseWorkspacePermissions,
  type PdfPasswordRule,
  type WorkspacePermissions,
} from '@/lib/workspace-permissions';
import { type PayslipTemplateRecord } from '@/lib/payslip-template-presets';
import { TemplateStudioModal } from '@/components/payroll/template-studio';
import {
  Building2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
  Users,
  Send,
  Mail,
  Upload,
  KeyRound,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  LogOut,
  X,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  Lock,
  Sliders,
} from 'lucide-react';

interface AdminWorkspaceItem {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  tagline: string | null;
  passcode: string;
  logoUrl: string | null;
  iconUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  hoverColor: string;
  lightColor: string;
  borderColor: string;
  textColor: string;
  defaultSubject: string | null;
  defaultBody: string | null;
  permissions?: WorkspacePermissions;
  isActive: boolean;
  employeeCount: number;
  dispatchCount: number;
  smtpConfigured: boolean;
}

interface WorkspaceFormState {
  name: string;
  slug: string;
  legalName: string;
  tagline: string;
  passcode: string;
  logoUrl: string;
  iconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultSubject: string;
  defaultBody: string;
  permissions: WorkspacePermissions;
  isActive: boolean;
}

const EMPTY_FORM: WorkspaceFormState = {
  name: '',
  slug: '',
  legalName: '',
  tagline: '',
  passcode: '',
  logoUrl: '',
  iconUrl: '',
  primaryColor: '#2563EB',
  secondaryColor: '#0F172A',
  defaultSubject: DEFAULT_EMAIL_SUBJECT,
  defaultBody: '',
  permissions: { ...DEFAULT_WORKSPACE_PERMISSIONS },
  isActive: true,
};

interface PendingPayrollRunItem {
  id: string;
  workspaceId: string;
  workspaceName: string;
  month: string;
  year: string;
  sourceMode: 'EXCEL' | 'MANUAL';
  entries: any[];
  updatedAt: string;
}

export default function AdminWorkspacesPage() {
  const { role, switchWorkspace, switching, refreshWorkspace } = useWorkspace();

  const [adminTab, setAdminTab] = useState<'workspaces' | 'templates' | 'approvals'>('workspaces');
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceItem[]>([]);
  const [masterTemplates, setMasterTemplates] = useState<PayslipTemplateRecord[]>([]);
  const [pendingRuns, setPendingRuns] = useState<PendingPayrollRunItem[]>([]);
  const [approvingRunId, setApprovingRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Template studio modal state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PayslipTemplateRecord | null>(null);

  // Keep Top Group Admin Portal visually neutral (never tinted by any tenant workspace)
  useEffect(() => {
    applyWorkspaceCssTheme({ primaryColor: '#0F172A', secondaryColor: '#FFFFFF' });
    document.title = 'Top Group Admin Portal | Company Workspaces';
    applyFaviconToDocument(buildMonogramFaviconSvg('TG', '#0F172A'));
  }, []);

  const [signingOut, setSigningOut] = useState(false);

  const handleAdminSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
    } catch {
      // Proceed cleanly to login even if logout request failed
    } finally {
      window.location.assign('/admin/login');
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'identity' | 'permissions'>('identity');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<WorkspaceFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Helpers
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [revealedPasscodes, setRevealedPasscodes] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError('');
      const [wsRes, tplRes, runRes] = await Promise.all([
        fetch('/api/workspaces', { cache: 'no-store' }),
        fetch('/api/templates?scope=admin', { cache: 'no-store' }),
        fetch('/api/payroll/runs?scope=pending', { cache: 'no-store' }),
      ]);
      const [wsData, tplData, runData] = await Promise.all([
        wsRes.json(),
        tplRes.json(),
        runRes.json(),
      ]);

      if (!wsRes.ok || !wsData.success) {
        setError(wsData.error || 'Unable to load workspaces');
        return;
      }
      setWorkspaces(wsData.workspaces || []);
      if (tplData?.success) {
        setMasterTemplates(
          (tplData.templates || []).filter((t: PayslipTemplateRecord) => !t.workspaceId)
        );
      }
      if (runData?.success) {
        setPendingRuns(runData.runs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while fetching workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveRun = async (runId: string) => {
    try {
      setApprovingRunId(runId);
      const res = await fetch(`/api/payroll/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchAdminData();
      } else {
        setError(data.error || 'Failed to approve payroll run');
      }
    } catch (err: any) {
      setError(err.message || 'Error approving run');
    } finally {
      setApprovingRunId(null);
    }
  };

  const handleDeleteTemplate = async (tpl: PayslipTemplateRecord) => {
    if (!window.confirm(`Delete master template "${tpl.name}"?`)) return;
    try {
      const res = await fetch(`/api/templates/${tpl.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchAdminData();
      } else {
        setError(data.error || 'Failed to delete template');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting template');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setModalTab('identity');
    setSlugTouched(false);
    setForm({
      ...EMPTY_FORM,
      permissions: { ...DEFAULT_WORKSPACE_PERMISSIONS },
      passcode: `HR${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (ws: AdminWorkspaceItem) => {
    setEditingId(ws.id);
    setModalTab('identity');
    setSlugTouched(true);
    setForm({
      name: ws.name,
      slug: ws.slug,
      legalName: ws.legalName || ws.name,
      tagline: ws.tagline || '',
      passcode: ws.passcode,
      logoUrl: ws.logoUrl || '',
      iconUrl: ws.iconUrl || '',
      primaryColor: ws.primaryColor || '#78B338',
      secondaryColor: ws.secondaryColor || '#221E1E',
      defaultSubject: ws.defaultSubject || DEFAULT_EMAIL_SUBJECT,
      defaultBody: ws.defaultBody || buildDefaultEmailBody(ws.legalName || ws.name),
      permissions: parseWorkspacePermissions(ws.permissions),
      isActive: ws.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'iconUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const kind = field === 'iconUrl' ? 'icon' : 'logo';
      const optimized = await compressLogoToTinyBase64(file, kind);
      let autoIconUrl: string | undefined;
      if (field === 'logoUrl' && !form.iconUrl) {
        const iconOptimized = await compressLogoToTinyBase64(file, 'icon');
        autoIconUrl = iconOptimized.dataUrl;
      }
      setForm((prev) => ({
        ...prev,
        [field]: optimized.dataUrl,
        ...(autoIconUrl && !prev.iconUrl ? { iconUrl: autoIconUrl } : {}),
      }));
    } catch (err: any) {
      setFormError(err.message || 'Failed to compress uploaded image');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) {
      setFormError('Company Display Name is required.');
      return;
    }
    if (!form.slug.trim()) {
      setFormError('Workspace URL Code (slug) is required.');
      return;
    }
    if (!form.passcode.trim() || form.passcode.trim().length < 4) {
      setFormError('Workspace passcode must be at least 4 characters.');
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/workspaces/${editingId}` : '/api/workspaces';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...form,
        legalName: form.legalName.trim() || form.name.trim(),
        defaultBody:
          form.defaultBody.trim() ||
          buildDefaultEmailBody(form.legalName.trim() || form.name.trim()),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to save workspace.');
        setSaving(false);
        return;
      }

      setIsModalOpen(false);
      await fetchAdminData();
      await refreshWorkspace();
    } catch (err: any) {
      setFormError(err.message || 'Network error while saving workspace.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ws: AdminWorkspaceItem) => {
    if (ws.id === 'ws_sterling') return;
    try {
      setDeletingId(ws.id);
      const res = await fetch(`/api/workspaces/${ws.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to delete workspace');
        return;
      }
      await fetchAdminData();
      await refreshWorkspace();
    } catch (err: any) {
      setError(err.message || 'Error deleting workspace');
    } finally {
      setDeletingId(null);
    }
  };

  const copyLoginUrl = (slug: string) => {
    const url = `${window.location.origin}/login?workspace=${encodeURIComponent(slug)}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (role && role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg w-full">
          <Shield className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Restricted Access</h2>
          <p className="text-xs text-slate-500 mt-1">
            Only Top Group Administrators can create and manage multi-tenant company workspaces.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Clean Neutral Top Group Admin Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-6 lg:px-10 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img
            src="/top-group-logo.svg"
            alt="Top Group Logo"
            className="w-9 h-9 rounded-xl shadow-xs shrink-0"
          />
          <div>
            <div className="text-sm font-bold text-slate-900 tracking-tight">
              Top Group Admin Portal
            </div>
            <div className="text-[11px] text-slate-500">
              Group Company Workspace Manager
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdminSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 bg-white transition-colors cursor-pointer disabled:opacity-60"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
        </button>
      </header>

      <main className="flex-1 px-6 lg:px-10 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header + Admin Tabs */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-900" />
                <span>Top Group Administration</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control company portals, govern allowed payroll workflows &amp; master payslip templates, and approve pending runs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAdminTab('workspaces')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    adminTab === 'workspaces'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Workspaces ({workspaces.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('templates')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    adminTab === 'templates'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Payslip Formats ({masterTemplates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('approvals')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    adminTab === 'approvals'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Approvals</span>
                  {pendingRuns.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      {pendingRuns.length}
                    </span>
                  )}
                </button>
              </div>

              {adminTab === 'workspaces' && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Workspace</span>
                </button>
              )}

              {adminTab === 'templates' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Master Format</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: Company Workspaces */}
          {adminTab === 'workspaces' && (
            loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-56 bg-white rounded-2xl border border-slate-200/80 animate-pulse p-6"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {workspaces.map((ws) => {
                const showCode = Boolean(revealedPasscodes[ws.id]);
                const wsPerms = parseWorkspacePermissions(ws.permissions);
                const initials = ws.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={ws.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 transition-all shadow-xs overflow-hidden flex flex-col"
                  >
                    {/* Top Dual Color Strip */}
                    <div className="flex h-1.5 w-full">
                      <div
                        className="w-1/3 h-full"
                        style={{ backgroundColor: ws.secondaryColor || '#221E1E' }}
                      />
                      <div className="w-2/3 h-full" style={{ backgroundColor: ws.primaryColor }} />
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Top Row: Logo + Name */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                              {ws.logoUrl || ws.iconUrl ? (
                                <img
                                  src={ws.iconUrl || ws.logoUrl || ''}
                                  alt={ws.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div
                                  className="w-full h-full rounded-lg text-white flex items-center justify-center font-bold text-sm"
                                  style={{ backgroundColor: ws.primaryColor }}
                                >
                                  {initials}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 truncate">
                                {ws.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate">
                                {ws.legalName || ws.name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                                Code: {ws.slug}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                              ws.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {ws.isActive ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{ws.employeeCount}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Employees</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                              <Send className="w-3 h-3 text-slate-400" />
                              <span>{ws.dispatchCount}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Logs</div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{ws.smtpConfigured ? 'Ready' : 'Setup'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">SMTP</div>
                          </div>
                        </div>

                        {/* Passcode & Branded Login Link */}
                        <div className="mt-3 space-y-2 text-[11px]">
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
                            <span className="text-slate-500 flex items-center gap-1.5">
                              <KeyRound className="w-3 h-3" />
                              <span>HR Passcode:</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-slate-800">
                                {showCode ? ws.passcode : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedPasscodes((prev) => ({
                                    ...prev,
                                    [ws.id]: !prev[ws.id],
                                  }))
                                }
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                title={showCode ? 'Hide passcode' : 'Show passcode'}
                              >
                                {showCode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => copyLoginUrl(ws.slug)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-600 transition-colors cursor-pointer"
                          >
                            <span className="truncate font-mono text-[10px]">
                              /login?workspace={ws.slug}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 shrink-0 ml-2">
                              {copiedSlug === ws.slug ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </span>
                          </button>

                          {/* Permission Governance Summary Badges */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {wsPerms.allowExcelImport && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                Excel
                              </span>
                            )}
                            {wsPerms.allowManualSalary && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                Manual Input
                              </span>
                            )}
                            {wsPerms.allowDirectPdfUpload && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                PDF Upload
                              </span>
                            )}
                            {wsPerms.allowTemplateDesigner && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                                Designer
                              </span>
                            )}
                            {wsPerms.requireMakerChecker && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                                Approval Gate
                              </span>
                            )}
                            {wsPerms.requirePdfPassword && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                                PDF Lock
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions — Consistent "Open Portal" on every company card */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={switching}
                          onClick={() => switchWorkspace(ws.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-60"
                          style={{ backgroundColor: ws.primaryColor }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Portal</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(ws)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Edit Branding & Settings"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {ws.id !== 'ws_sterling' && (
                          <button
                            type="button"
                            disabled={deletingId === ws.id}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete workspace "${ws.name}" and all its employees and logs? This cannot be undone.`
                                )
                              ) {
                                handleDelete(ws);
                              }
                            }}
                            className="p-2 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete Workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )
          )}

          {/* TAB 2: Top Group Master Payslip Formats */}
          {adminTab === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {masterTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{tpl.name}</h3>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {tpl.presetStyle.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      {tpl.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Default
                        </span>
                      )}
                    </div>

                    {tpl.description && (
                      <p className="text-xs text-slate-500 mt-3">{tpl.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                        {tpl.config.earningsHeads.length} Earnings
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                        {tpl.config.deductionsHeads.length} Deductions
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                        {tpl.config.currency.code} ({tpl.config.currency.symbol})
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplate(tpl);
                        setTemplateModalOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-black text-white cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Design / Preview PDF</span>
                    </button>
                    {tpl.id !== 'tpl_classic_corporate' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl)}
                        className="p-2 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 cursor-pointer"
                        title="Delete Format"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Maker-Checker Pending Payroll Approvals */}
          {adminTab === 'approvals' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
              {pendingRuns.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-900">All Caught Up</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    No company payroll runs are currently waiting for Top Group Admin approval.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingRuns.map((run) => (
                    <div
                      key={run.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {run.workspaceName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Approval
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Period: <strong>{run.month} {run.year}</strong> • {run.entries.length} employees • Source: {run.sourceMode}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => switchWorkspace(run.workspaceId)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Inspect Portal
                        </button>
                        <button
                          type="button"
                          disabled={approvingRunId === run.id}
                          onClick={() => handleApproveRun(run.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                        >
                          {approvingRunId === run.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Approve &amp; Release</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Workspace Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Company Workspace' : 'New Company Workspace'}
        description="Configure company identity, brand theme, and granular Top Group admin permissions."
        maxWidth="4xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Clean Modal Section Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/70">
            <button
              type="button"
              onClick={() => setModalTab('identity')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                modalTab === 'identity'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Identity &amp; Theme</span>
            </button>
            <button
              type="button"
              onClick={() => setModalTab('permissions')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                modalTab === 'permissions'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Permissions &amp; Templates</span>
            </button>
          </div>

          {modalTab === 'identity' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-start">
            {/* LEFT COLUMN: Company Details, Passcode & Brand Assets */}
            <div className="lg:col-span-6 space-y-5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Company Identity &amp; Access
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flexicom Industries"
                      value={form.name}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          name: nextName,
                          slug: slugTouched ? prev.slug : slugifyWorkspaceName(nextName),
                        }));
                      }}
                      className="w-full px-3.5 py-2 text-xs text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      URL Code (Slug) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. flexicom-industries"
                      value={form.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setForm((prev) => ({
                          ...prev,
                          slug: slugifyWorkspaceName(e.target.value),
                        }));
                      }}
                      className="w-full px-3.5 py-2 text-xs font-mono text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Legal Name
                    </label>
                    <input
                      type="text"
                      placeholder="Flexicom Industries Pvt. Ltd."
                      value={form.legalName}
                      onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      HR Passcode <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      placeholder="Min. 4 characters"
                      value={form.passcode}
                      onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs font-mono text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tagline / Location
                    <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                      (shown on company login page)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Corporate Headquarters • Kolkata"
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Brand Assets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Brand Assets
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    /login?workspace={form.slug || 'company'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Full Logo */}
                  <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center shrink-0 overflow-hidden p-1">
                          {form.logoUrl ? (
                            <img
                              src={form.logoUrl}
                              alt="Logo preview"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">
                            Company Logo
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {form.logoUrl ? 'Custom image set' : 'Sidebar header'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {form.logoUrl && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Clear logo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs">
                          <Upload className="w-3 h-3" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'logoUrl')}
                          />
                        </label>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Or paste image URL..."
                      value={
                        form.logoUrl.startsWith('data:')
                          ? `Optimized WebP (${(form.logoUrl.length / 1024).toFixed(1)} KB)`
                          : form.logoUrl
                      }
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-[11px] text-slate-700 bg-white border border-slate-200/90 rounded-lg focus:outline-hidden focus:border-slate-400"
                    />
                  </div>

                  {/* Square Emblem */}
                  <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/90 flex items-center justify-center shrink-0 overflow-hidden p-1">
                          {form.iconUrl ? (
                            <img
                              src={form.iconUrl}
                              alt="Emblem preview"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">
                            App Icon
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {form.iconUrl ? 'Custom icon set' : 'Tab & desktop'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {form.iconUrl && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, iconUrl: '' }))}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Clear icon"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs">
                          <Upload className="w-3 h-3" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'iconUrl')}
                          />
                        </label>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Optional square emblem URL..."
                      value={
                        form.iconUrl.startsWith('data:')
                          ? `Optimized ${form.iconUrl.includes('image/png') ? 'PNG' : 'Image'} (${(form.iconUrl.length / 1024).toFixed(1)} KB)`
                          : form.iconUrl
                      }
                      onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-[11px] text-slate-700 bg-white border border-slate-200/90 rounded-lg focus:outline-hidden focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {editingId && (
                <label
                  htmlFor="wsActiveToggle"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Workspace Active</div>
                    <div className="text-[11px] text-slate-400">
                      Allow company HR admins to sign in
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="wsActiveToggle"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                  />
                </label>
              )}
            </div>

            {/* RIGHT COLUMN: Live Portal Preview & Color Theme */}
            <div className="lg:col-span-6 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Portal Appearance &amp; Live Preview
                </span>
              </div>

              <ColorThemePicker
                primaryColor={form.primaryColor}
                secondaryColor={form.secondaryColor}
                companyName={form.name || 'Company Name'}
                logoUrl={form.logoUrl}
                iconUrl={form.iconUrl}
                onPrimaryChange={(hex) => setForm((prev) => ({ ...prev, primaryColor: hex }))}
                onSecondaryChange={(hex) => setForm((prev) => ({ ...prev, secondaryColor: hex }))}
              />
            </div>
          </div>
          ) : (
          /* PERMISSIONS & TEMPLATES GOVERNANCE PANEL */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Payroll Input Modes & Formats */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Permitted Payroll Input Methods
              </div>
              <div className="space-y-2.5 text-xs">
                {[
                  {
                    key: 'allowExcelImport' as const,
                    label: 'Excel / CSV Salary Import',
                    desc: 'Allow HR to import & map salary registers',
                  },
                  {
                    key: 'allowManualSalary' as const,
                    label: 'Manual Salary Entry & Grid',
                    desc: 'Allow HR to type or edit employee pay heads in-app',
                  },
                  {
                    key: 'allowDirectPdfUpload' as const,
                    label: 'Pre-Made PDF Upload',
                    desc: 'Allow bulk upload of externally generated PDFs',
                  },
                  {
                    key: 'allowFormulaAutoCalc' as const,
                    label: 'Automatic Formula Engine',
                    desc: 'Auto-calculate HRA, PF, ESIC & Pro-rata pay',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200/70 cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(form.permissions[item.key])}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permissions: { ...prev.permissions, [item.key]: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-slate-900"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Portal Locks, Security & Compliance */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Feature Locks, PDF Security &amp; Approvals
              </div>
              <div className="space-y-2 text-xs">
                {[
                  {
                    key: 'allowEmployeeCrud' as const,
                    label: 'Allow Employee Add / Edit / Import',
                  },
                  {
                    key: 'allowEmailComposer' as const,
                    label: 'Allow Editing Email Composer Template',
                  },
                  {
                    key: 'allowSmtpSettings' as const,
                    label: 'Allow Editing Company SMTP Settings',
                  },
                  {
                    key: 'allowResendSent' as const,
                    label: 'Allow Re-sending Already Sent Payslips',
                  },
                  {
                    key: 'allowBulkDownload' as const,
                    label: 'Allow PDF & Bulk ZIP Downloads (off = Email Only)',
                  },
                  {
                    key: 'requireMakerChecker' as const,
                    label: 'Require Top Group Admin Approval Before Sending',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200/70 cursor-pointer"
                  >
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(form.permissions[item.key])}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permissions: { ...prev.permissions, [item.key]: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                    />
                  </label>
                ))}

                {/* PDF Password Toggle & Rule */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 space-y-2">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Password-Protect Generated PDFs</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.permissions.requirePdfPassword}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            requirePdfPassword: e.target.checked,
                          },
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                    />
                  </label>
                  {form.permissions.requirePdfPassword && (
                    <select
                      value={form.permissions.pdfPasswordRule}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            pdfPasswordRule: e.target.value as PdfPasswordRule,
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="EMP_ID">Password = Employee ID (Uppercase)</option>
                      <option value="PAN_OR_EMP_ID">Password = PAN (fallback Employee ID)</option>
                      <option value="EMP_ID_LAST4">Password = Last 4 of Emp ID + @2026</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Payslip Format Access (Full Width) */}
            <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Assigned Payslip Formats &amp; Designer Permission
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.permissions.allowTemplateDesigner}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            allowTemplateDesigner: e.target.checked,
                          },
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>Allow Company HR to Design Custom Formats</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.permissions.allowAllMasterTemplates}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            allowAllMasterTemplates: e.target.checked,
                          },
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>Permit All Master Formats</span>
                  </label>
                </div>
              </div>

              {!form.permissions.allowAllMasterTemplates && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {masterTemplates.map((tpl) => {
                    const checked = form.permissions.assignedTemplateIds.includes(tpl.id);
                    return (
                      <label
                        key={tpl.id}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{tpl.name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextIds = e.target.checked
                                ? [...form.permissions.assignedTemplateIds, tpl.id]
                                : form.permissions.assignedTemplateIds.filter(
                                    (id) => id !== tpl.id
                                  );
                              setForm((prev) => ({
                                ...prev,
                                permissions: {
                                  ...prev.permissions,
                                  assignedTemplateIds: nextIds,
                                },
                              }));
                            }}
                            className="rounded"
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Isolated database scope &amp; branding apply immediately after saving.
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 hover:opacity-95"
                style={{ backgroundColor: form.primaryColor }}
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingId ? 'Save Changes' : 'Create Workspace'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Master Payslip Template Studio */}
      <TemplateStudioModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        template={editingTemplate}
        isMasterMode={true}
        companyName="Top Group"
        primaryColor="#0F172A"
        onSaved={fetchAdminData}
      />

      <footer className="h-10 border-t border-slate-200/80 bg-white px-6 lg:px-10 flex items-center justify-between text-[11px] text-slate-400">
        <span>Top Group Admin Portal</span>
        <span>© 2026 Top Group. All rights reserved.</span>
      </footer>
    </div>
  );
}
