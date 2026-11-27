'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useWorkspace } from '@/components/layout/workspace-context';
import { Modal } from '@/components/ui/modal';
import { slugifyWorkspaceName } from '@/lib/theme-utils';
import { compressLogoToTinyBase64 } from '@/lib/image-optimizer';
import { ColorThemePicker } from '@/components/ui/color-theme-picker';
import { buildDefaultEmailBody, DEFAULT_EMAIL_SUBJECT } from '@/lib/email-templates';
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
  isActive: true,
};

export default function AdminWorkspacesPage() {
  const router = useRouter();
  const { workspace: activeWorkspace, role, switchWorkspace, refreshWorkspace } = useWorkspace();

  const [workspaces, setWorkspaces] = useState<AdminWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<WorkspaceFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Helpers
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [revealedPasscodes, setRevealedPasscodes] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/workspaces', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Unable to load workspaces');
        return;
      }
      setWorkspaces(data.workspaces || []);
    } catch (err: any) {
      setError(err.message || 'Network error while fetching workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setSlugTouched(false);
    setForm({
      ...EMPTY_FORM,
      passcode: `HR${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (ws: AdminWorkspaceItem) => {
    setEditingId(ws.id);
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
      await fetchWorkspaces();
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
      await fetchWorkspaces();
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
      <DashboardShell>
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg mx-auto mt-12">
          <Shield className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Restricted Access</h2>
          <p className="text-xs text-slate-500 mt-1">
            Only the Platform Super Admin can create and manage multi-tenant company workspaces.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand" />
            <span>Company Workspaces (Multi-Tenant)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create isolated white-label workspaces with custom logos, color themes, SMTP, and HR passcodes for each company.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Company Workspace</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspaces Grid */}
      {loading ? (
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
            const isCurrent = ws.id === activeWorkspace.id;
            const showCode = Boolean(revealedPasscodes[ws.id]);
            const initials = ws.name
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={ws.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden flex flex-col ${
                  isCurrent ? 'border-slate-900 ring-1 ring-slate-900/10' : 'border-slate-200/80'
                }`}
              >
                {/* Top Dual Color Strip */}
                <div className="flex h-1.5 w-full">
                  <div className="w-1/3 h-full" style={{ backgroundColor: ws.secondaryColor || '#221E1E' }} />
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
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {ws.name}
                            </h3>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-900 text-white shrink-0">
                                Active
                              </span>
                            )}
                          </div>
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
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isCurrent) {
                          await switchWorkspace(ws.id);
                        } else {
                          router.push('/employees');
                        }
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: ws.primaryColor }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Open Portal' : 'Enter Workspace'}</span>
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
      )}

      {/* Create / Edit Workspace Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Company Workspace' : 'Create New Company Workspace'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Company Display Name *
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
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Workspace URL Code (Slug) *
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
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Legal Name (Footer & Email Signature)
              </label>
              <input
                type="text"
                placeholder="e.g. Flexicom Industries Pvt. Ltd."
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                HR Portal Passcode *
              </label>
              <input
                type="text"
                required
                minLength={4}
                placeholder="Minimum 4 characters"
                value={form.passcode}
                onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tagline / Plant Location (Optional — shown on Login page)
            </label>
            <input
              type="text"
              placeholder="e.g. Corporate Headquarters • Kolkata"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand focus:bg-white"
            />
          </div>

          {/* Logo & Small Icon Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Full Company Logo</span>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
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
              <input
                type="text"
                placeholder="Or paste image URL (e.g. /logo.png)"
                value={
                  form.logoUrl.startsWith('data:')
                    ? `Optimized WebP (${(form.logoUrl.length / 1024).toFixed(1)} KB)`
                    : form.logoUrl
                }
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Collapsed Icon / Emblem</span>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
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
              <input
                type="text"
                placeholder="Optional square emblem (defaults to logo)"
                value={
                  form.iconUrl.startsWith('data:')
                    ? `Optimized WebP (${(form.iconUrl.length / 1024).toFixed(1)} KB)`
                    : form.iconUrl
                }
                onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dual Primary & Secondary Color Theme Selector */}
          <ColorThemePicker
            primaryColor={form.primaryColor}
            secondaryColor={form.secondaryColor}
            companyName={form.name || 'Company Name'}
            logoUrl={form.logoUrl}
            iconUrl={form.iconUrl}
            onPrimaryChange={(hex) => setForm((prev) => ({ ...prev, primaryColor: hex }))}
            onSecondaryChange={(hex) => setForm((prev) => ({ ...prev, secondaryColor: hex }))}
          />

          {editingId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wsActiveToggle"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="wsActiveToggle" className="text-xs font-semibold text-slate-700">
                Workspace Active (Allow HR admins of this company to sign in)
              </label>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: form.primaryColor }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? 'Save Workspace Changes' : 'Create Workspace'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
