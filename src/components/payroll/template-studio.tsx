'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Check,
  FileText,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  DEFAULT_CONFIG_BASE,
  EMPLOYEE_FIELD_LABELS,
  PRESET_STYLE_META,
  parsePayslipTemplateConfig,
  type EmployeeFieldKey,
  type PayHeadDefinition,
  type PayslipPresetStyle,
  type PayslipTemplateConfig,
  type PayslipTemplateRecord,
} from '@/lib/payslip-template-presets';

interface TemplateStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: PayslipTemplateRecord | null;
  isMasterMode: boolean;
  companyName?: string;
  primaryColor?: string;
  onSaved: () => void;
}

export function TemplateStudioModal({
  isOpen,
  onClose,
  template,
  isMasterMode,
  companyName = 'Top Group',
  primaryColor = '#0F172A',
  onSaved,
}: TemplateStudioModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [presetStyle, setPresetStyle] = useState<PayslipPresetStyle>('CLASSIC_CORPORATE');
  const [config, setConfig] = useState<PayslipTemplateConfig>(
    parsePayslipTemplateConfig(DEFAULT_CONFIG_BASE)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setPresetStyle(template.presetStyle);
      setConfig(parsePayslipTemplateConfig(template.config));
    } else {
      setName(isMasterMode ? 'New Top Group Format' : 'Custom Company Payslip');
      setDescription('');
      setPresetStyle('CLASSIC_CORPORATE');
      setConfig(parsePayslipTemplateConfig(DEFAULT_CONFIG_BASE));
    }
    setError('');
  }, [isOpen, template, isMasterMode]);

  const refreshLivePreview = useCallback(async () => {
    if (!isOpen) return;
    try {
      setPreviewLoading(true);
      const res = await fetch('/api/payroll/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          preview: true,
          companyName,
          primaryColor,
          presetStyle,
          templateConfig: config,
          month: 'October',
          year: '2026',
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const nextUrl = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch {
      // ignore preview error
    } finally {
      setPreviewLoading(false);
    }
  }, [isOpen, companyName, primaryColor, presetStyle, config]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      refreshLivePreview();
    }, 450);
    return () => clearTimeout(t);
  }, [isOpen, refreshLivePreview]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (!isOpen) return null;

  const toggleEmployeeField = (key: EmployeeFieldKey) => {
    setConfig((prev) => {
      const exists = prev.employeeFields.includes(key);
      return {
        ...prev,
        employeeFields: exists
          ? prev.employeeFields.filter((f) => f !== key)
          : [...prev.employeeFields, key],
      };
    });
  };

  const updateHead = (
    section: 'earningsHeads' | 'deductionsHeads',
    idx: number,
    patch: Partial<PayHeadDefinition>
  ) => {
    setConfig((prev) => {
      const list = [...prev[section]];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, [section]: list };
    });
  };

  const addHead = (section: 'earningsHeads' | 'deductionsHeads') => {
    setConfig((prev) => {
      const count = prev[section].length + 1;
      const key =
        (section === 'earningsHeads' ? 'earning_' : 'deduction_') +
        Date.now().toString(36).slice(-4);
      return {
        ...prev,
        [section]: [
          ...prev[section],
          {
            key,
            label:
              section === 'earningsHeads'
                ? `Custom Allowance ${count}`
                : `Custom Deduction ${count}`,
            defaultValue: 0,
            formula: '',
          },
        ],
      };
    });
  };

  const removeHead = (section: 'earningsHeads' | 'deductionsHeads', idx: number) => {
    setConfig((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const isEditingExisting = Boolean(template?.id);
      const url = isEditingExisting
        ? `/api/templates/${template!.id}`
        : '/api/templates';
      const method = isEditingExisting ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isMaster: isMasterMode,
          name: name.trim(),
          description: description.trim() || null,
          presetStyle,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save template.');
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error saving template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[93vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {template
                  ? `Edit Payslip Format: ${template.name}`
                  : isMasterMode
                  ? 'Create Top Group Master Payslip Format'
                  : 'Create Company Payslip Format'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure layout style, fields, formulas &amp; compliance text with live A4 PDF preview
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-column Designer + Live PDF Preview */}
        <form onSubmit={handleSave} className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* LEFT: Configuration Controls */}
          <div className="lg:col-span-6 p-6 overflow-y-auto space-y-5 border-r border-slate-100">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {error}
              </div>
            )}

            {/* Name & Preset */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Format Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Corporate Staff Payslip"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency &amp; Numbering
                  </label>
                  <select
                    value={`${config.currency.code}|${config.currency.symbol}|${config.currency.numberFormat}`}
                    onChange={(e) => {
                      const [code, symbol, numberFormat] = e.target.value.split('|') as any;
                      setConfig((prev) => ({
                        ...prev,
                        currency: { ...prev.currency, code, symbol, numberFormat },
                      }));
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden"
                  >
                    <option value="INR|Rs.|en-IN">INR (Rs.) — Indian 1,25,000.00</option>
                    <option value="USD|$|en-US">USD ($) — US 125,000.00</option>
                    <option value="EUR|EUR|en-US">EUR — European</option>
                    <option value="GBP|GBP|en-US">GBP — British Pound</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Visual Layout Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_STYLE_META.map((p) => {
                    const active = presetStyle === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPresetStyle(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{p.name}</span>
                          {active && <Check className="w-3.5 h-3.5 text-slate-900" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                          {p.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Header & Company Metadata */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Header, Address &amp; Watermark
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Logo Alignment
                  </label>
                  <select
                    value={config.header.logoPosition}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        header: { ...prev.header, logoPosition: e.target.value as any },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="left">Left Aligned</option>
                    <option value="center">Centered</option>
                    <option value="hidden">Hide Logo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Background Watermark
                  </label>
                  <input
                    type="text"
                    placeholder="Optional (e.g. CONFIDENTIAL)"
                    value={config.header.watermarkText}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        header: { ...prev.header, watermarkText: e.target.value },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="Slip Title (e.g. PAYSLIP FOR THE MONTH OF {{MONTH}} {{YEAR}})"
                value={config.header.slipTitle}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    header: { ...prev.header, slipTitle: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                placeholder="Registered / Plant Address (shown under company name)"
                value={config.header.companyAddress}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    header: { ...prev.header, companyAddress: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                placeholder="Compliance Line (e.g. CIN: U12345WB2020PTC | PF Code: WB/12345)"
                value={config.header.registrationLine}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    header: { ...prev.header, registrationLine: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>

            {/* Employee Fields Selection */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Visible Employee &amp; Statutory Fields
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(EMPLOYEE_FIELD_LABELS) as EmployeeFieldKey[]).map((key) => {
                  const checked = config.employeeFields.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleEmployeeField(key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        checked
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {EMPLOYEE_FIELD_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Earnings Heads */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Earnings Pay Heads &amp; Formulas
                </span>
                <button
                  type="button"
                  onClick={() => addHead('earningsHeads')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Earning</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {config.earningsHeads.map((head, idx) => (
                  <div key={head.key} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={head.label}
                      onChange={(e) => updateHead('earningsHeads', idx, { label: e.target.value })}
                      placeholder="Label"
                      className="col-span-5 px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={head.formula || ''}
                      onChange={(e) => updateHead('earningsHeads', idx, { formula: e.target.value })}
                      placeholder="Formula e.g. ROUND(BASIC*0.4)"
                      className="col-span-4 px-2 py-1.5 text-[10px] font-mono bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="number"
                      value={head.defaultValue ?? 0}
                      onChange={(e) =>
                        updateHead('earningsHeads', idx, {
                          defaultValue: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="Default"
                      className="col-span-2 px-2 py-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeHead('earningsHeads', idx)}
                      className="col-span-1 p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions Heads */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Deductions Pay Heads &amp; Formulas
                </span>
                <button
                  type="button"
                  onClick={() => addHead('deductionsHeads')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Deduction</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {config.deductionsHeads.map((head, idx) => (
                  <div key={head.key} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={head.label}
                      onChange={(e) => updateHead('deductionsHeads', idx, { label: e.target.value })}
                      placeholder="Label"
                      className="col-span-5 px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={head.formula || ''}
                      onChange={(e) => updateHead('deductionsHeads', idx, { formula: e.target.value })}
                      placeholder="Formula e.g. MIN(ROUND(BASIC*0.12),1800)"
                      className="col-span-4 px-2 py-1.5 text-[10px] font-mono bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="number"
                      value={head.defaultValue ?? 0}
                      onChange={(e) =>
                        updateHead('deductionsHeads', idx, {
                          defaultValue: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="Default"
                      className="col-span-2 px-2 py-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeHead('deductionsHeads', idx)}
                      className="col-span-1 p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Variables supported: <span className="font-mono">BASIC, GROSS, PAID_DAYS, TOTAL_DAYS</span> &amp; <span className="font-mono">ROUND(), MIN(), MAX(), CEIL()</span>
              </p>
            </div>

            {/* Footer Options */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Footer, Amount in Words &amp; Signatory
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.currency.showAmountInWords}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        currency: { ...prev.currency, showAmountInWords: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Amount in Words</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableProRata}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, enableProRata: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Pro-Rata by Paid Days</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.footer.showAttendanceSummary}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, showAttendanceSummary: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Attendance Bar</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.footer.showSignatory}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        footer: { ...prev.footer, showSignatory: e.target.checked },
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Signatory Block</span>
                </label>
              </div>
              <input
                type="text"
                placeholder="Footer declaration note"
                value={config.footer.declarationNote}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    footer: { ...prev.footer, declarationNote: e.target.value },
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* RIGHT: Live A4 PDF Preview */}
          <div className="lg:col-span-6 bg-slate-100/80 p-5 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Live A4 PDF Preview (Sample Data)
              </span>
              <button
                type="button"
                onClick={refreshLivePreview}
                disabled={previewLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${previewLoading ? 'animate-spin' : ''}`} />
                <span>Refresh PDF</span>
              </button>
            </div>

            <div className="flex-1 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs relative">
              {pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full min-h-[460px]"
                  title="Payslip PDF Live Preview"
                />
              ) : (
                <div className="h-full min-h-[460px] flex items-center justify-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Rendering A4 PDF preview...
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-200/70">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{template ? 'Save Format Changes' : 'Save Payslip Format'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
