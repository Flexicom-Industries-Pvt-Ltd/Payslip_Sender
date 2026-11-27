'use client';

import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useWorkspace } from '@/components/layout/workspace-context';
import { TemplateStudioModal } from '@/components/payroll/template-studio';
import { Modal } from '@/components/ui/modal';
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
} from '@/lib/workspace-permissions';
import {
  type PayslipTemplateRecord,
} from '@/lib/payslip-template-presets';
import {
  computePayslipTotals,
  formatCurrencyAmount,
  type PayrollSlipEntry,
} from '@/lib/payslip-calculator';
import {
  buildDefaultEmailBody,
  DEFAULT_EMAIL_SUBJECT,
  interpolateTemplate,
  MONTHS,
} from '@/lib/email-templates';
import {
  Calculator,
  FileSpreadsheet,
  Upload,
  Plus,
  Trash2,
  Eye,
  Download,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  FileText,
  Lock,
  Save,
  FolderArchive,
  Users,
  Pencil,
  Sliders,
} from 'lucide-react';

interface DispatchStatusItem {
  status: 'PENDING' | 'SENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export default function PayslipGeneratorPage() {
  const { workspace, role, refreshWorkspace } = useWorkspace();
  const perms = workspace.permissions || DEFAULT_WORKSPACE_PERMISSIONS;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const canExcel = isSuperAdmin || perms.allowExcelImport;
  const canManual = isSuperAdmin || perms.allowManualSalary;
  const canDesign = isSuperAdmin || perms.allowTemplateDesigner;
  const canDownload = isSuperAdmin || perms.allowBulkDownload;
  const canUseFormulas = isSuperAdmin || perms.allowFormulaAutoCalc;

  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [inputMode, setInputMode] = useState<'excel' | 'manual'>(
    canExcel ? 'excel' : 'manual'
  );

  // Templates
  const [templates, setTemplates] = useState<PayslipTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [designerOpen, setDesignerOpen] = useState(false);
  const [designerTemplate, setDesignerTemplate] = useState<PayslipTemplateRecord | null>(null);

  // Payroll rows & runs
  const [entries, setEntries] = useState<PayrollSlipEntry[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<
    'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED'
  >('DRAFT');
  const [savedRuns, setSavedRuns] = useState<any[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Excel Mapper modal state
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRawRows, setExcelRawRows] = useState<Record<string, any>[]>([]);
  const [excelMapping, setExcelMapping] = useState<Record<string, string>>({});
  const [mapperOpen, setMapperOpen] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

  // Row detail modal
  const [editingEntryIdx, setEditingEntryIdx] = useState<number | null>(null);

  // PDF Preview modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Actions state
  const [savingRun, setSavingRun] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dispatchMap, setDispatchMap] = useState<Record<string, DispatchStatusItem>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    try {
      const now = new Date();
      setSelectedMonth(MONTHS[now.getMonth()]);
      setSelectedYear(String(now.getFullYear()));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!canExcel && canManual) setInputMode('manual');
    else if (canExcel && !canManual) setInputMode('excel');
  }, [canExcel, canManual]);

  const loadWorkspacePayrollAssets = async () => {
    try {
      const [tplRes, runRes] = await Promise.all([
        fetch('/api/templates', { cache: 'no-store' }),
        fetch('/api/payroll/runs', { cache: 'no-store' }),
      ]);
      const [tplData, runData] = await Promise.all([tplRes.json(), runRes.json()]);
      if (tplData?.success && Array.isArray(tplData.templates)) {
        setTemplates(tplData.templates);
        if (
          !selectedTemplateId ||
          !tplData.templates.some((t: PayslipTemplateRecord) => t.id === selectedTemplateId)
        ) {
          const def =
            tplData.templates.find((t: PayslipTemplateRecord) => t.isDefault) ||
            tplData.templates[0];
          if (def) setSelectedTemplateId(def.id);
        }
      }
      if (runData?.success && Array.isArray(runData.runs)) {
        setSavedRuns(runData.runs);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (workspace.id) {
      loadWorkspacePayrollAssets();
    }
  }, [workspace.id]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || templates[0] || null,
    [templates, selectedTemplateId]
  );

  // Build default earnings/deductions map from active template
  const buildDefaultsForTemplate = () => {
    const earnings: Record<string, number> = {};
    const deductions: Record<string, number> = {};
    if (activeTemplate) {
      for (const h of activeTemplate.config.earningsHeads) {
        earnings[h.key] = h.defaultValue ?? 0;
      }
      for (const h of activeTemplate.config.deductionsHeads) {
        deductions[h.key] = h.defaultValue ?? 0;
      }
    }
    return { earnings, deductions };
  };

  // Load Directory Employees into Salary Grid
  const handleLoadFromDirectory = async () => {
    try {
      setLoadingDirectory(true);
      setFeedback(null);
      const res = await fetch('/api/employees', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', text: data.error || 'Failed to load employees.' });
        return;
      }

      const defaults = buildDefaultsForTemplate();
      const loaded: PayrollSlipEntry[] = (data.employees || []).map((emp: any) => {
        let savedStruct: Record<string, number> = {};
        if (emp.salaryStructureJson) {
          try {
            savedStruct = JSON.parse(emp.salaryStructureJson);
          } catch {
            savedStruct = {};
          }
        }
        const earnings = { ...defaults.earnings };
        const deductions = { ...defaults.deductions };
        if (activeTemplate) {
          for (const h of activeTemplate.config.earningsHeads) {
            if (savedStruct[h.key] !== undefined) earnings[h.key] = Number(savedStruct[h.key]) || 0;
          }
          for (const h of activeTemplate.config.deductionsHeads) {
            if (savedStruct[h.key] !== undefined)
              deductions[h.key] = Number(savedStruct[h.key]) || 0;
          }
        }
        return {
          employeeId: emp.employeeId,
          name: emp.name,
          email: emp.email,
          department: emp.department || '',
          designation: emp.designation || '',
          location: emp.location || '',
          dateOfJoining: emp.dateOfJoining || '',
          pan: emp.pan || '',
          uan: emp.uan || '',
          esicNo: emp.esicNo || '',
          bankName: emp.bankName || '',
          bankAccount: emp.bankAccount || '',
          ifscCode: emp.ifscCode || '',
          totalDays: 30,
          paidDays: 30,
          lopDays: 0,
          earnings,
          deductions,
        };
      });

      setEntries(loaded);
      setActiveRunId(null);
      setRunStatus('DRAFT');
      setDispatchMap({});
      setFeedback({
        type: 'success',
        text: `Loaded ${loaded.length} employees into payroll grid. Edit salaries or click Auto-Calculate Formulas.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error loading employees' });
    } finally {
      setLoadingDirectory(false);
    }
  };

  const handleAddBlankRow = () => {
    const defaults = buildDefaultsForTemplate();
    setEntries((prev) => [
      ...prev,
      {
        employeeId: `EMP${String(prev.length + 1).padStart(3, '0')}`,
        name: '',
        email: '',
        department: '',
        totalDays: 30,
        paidDays: 30,
        lopDays: 0,
        earnings: defaults.earnings,
        deductions: defaults.deductions,
      },
    ]);
  };

  const handleRecalculateFormulas = () => {
    if (!activeTemplate) return;
    setEntries((prev) =>
      prev.map((entry) => {
        // Recompute heads that have formulas defined by stripping current value for formula heads
        const cleanEarn = { ...entry.earnings };
        const cleanDed = { ...entry.deductions };
        for (const h of activeTemplate.config.earningsHeads) {
          if (h.formula?.trim()) delete cleanEarn[h.key];
        }
        for (const h of activeTemplate.config.deductionsHeads) {
          if (h.formula?.trim()) delete cleanDed[h.key];
        }
        const computed = computePayslipTotals(
          { ...entry, earnings: cleanEarn, deductions: cleanDed },
          activeTemplate.config,
          canUseFormulas
        );
        const nextEarn: Record<string, number> = { ...entry.earnings };
        const nextDed: Record<string, number> = { ...entry.deductions };
        for (const r of computed.earningsRows) nextEarn[r.key] = r.amount;
        for (const r of computed.deductionsRows) nextDed[r.key] = r.amount;
        return { ...entry, earnings: nextEarn, deductions: nextDed };
      })
    );
    setFeedback({
      type: 'success',
      text: 'Recalculated HRA, PF, ESIC, and Pro-Rata formulas across all rows.',
    });
  };

  // Excel File Selection -> Open Column Mapper
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFeedback(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        setFeedback({ type: 'error', text: 'Uploaded spreadsheet has no sheets.' });
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet], {
        defval: '',
      });
      if (rows.length === 0) {
        setFeedback({ type: 'error', text: 'Spreadsheet has no data rows.' });
        return;
      }

      const headers = Object.keys(rows[0]);
      setExcelHeaders(headers);
      setExcelRawRows(rows);

      // Build smart auto-mapping using saved workspace mapping first, then header heuristics
      const saved = perms.savedExcelMapping || {};
      const nextMap: Record<string, string> = {};

      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const autoMatch = (candidates: string[]): string => {
        for (const h of headers) {
          if (candidates.some((c) => normalize(h) === normalize(c) || normalize(h).includes(normalize(c)))) {
            return h;
          }
        }
        return '';
      };

      nextMap.employeeId = saved.employeeId || autoMatch(['Employee ID', 'empid', 'empcode', 'id']);
      nextMap.name = saved.name || autoMatch(['Employee Name', 'Name', 'Full Name']);
      nextMap.email = saved.email || autoMatch(['Email', 'Email Address', 'mail']);
      nextMap.department = saved.department || autoMatch(['Department', 'Dept']);
      nextMap.designation = saved.designation || autoMatch(['Designation', 'Role', 'Title']);
      nextMap.totalDays = saved.totalDays || autoMatch(['Total Days', 'Month Days']);
      nextMap.paidDays = saved.paidDays || autoMatch(['Paid Days', 'Worked Days', 'Present Days']);
      nextMap.lopDays = saved.lopDays || autoMatch(['LOP Days', 'LOP', 'Absent']);
      nextMap.pan = saved.pan || autoMatch(['PAN']);
      nextMap.uan = saved.uan || autoMatch(['UAN', 'PF No']);
      nextMap.bankAccount = saved.bankAccount || autoMatch(['Bank Account', 'Account No', 'Bank A/C']);

      if (activeTemplate) {
        for (const h of activeTemplate.config.earningsHeads) {
          const mapKey = `earn:${h.key}`;
          nextMap[mapKey] = saved[mapKey] || autoMatch([h.label, h.key]);
        }
        for (const h of activeTemplate.config.deductionsHeads) {
          const mapKey = `ded:${h.key}`;
          nextMap[mapKey] = saved[mapKey] || autoMatch([h.label, h.key]);
        }
      }

      setExcelMapping(nextMap);
      setMapperOpen(true);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to read spreadsheet' });
    }
  };

  const handleApplyExcelMapping = async (saveForCompany: boolean) => {
    if (!excelMapping.employeeId) {
      setFeedback({ type: 'error', text: 'Please map the Employee ID column.' });
      return;
    }

    if (saveForCompany) {
      setSavingMapping(true);
      try {
        await fetch('/api/workspaces/current', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ savedExcelMapping: excelMapping }),
        });
        await refreshWorkspace();
      } catch {
        // ignore
      } finally {
        setSavingMapping(false);
      }
    }

    // Fetch employee directory to enrich emails/names if missing from Excel
    let dirMap = new Map<string, any>();
    try {
      const empRes = await fetch('/api/employees', { cache: 'no-store' });
      const empData = await empRes.json();
      if (empData?.success) {
        dirMap = new Map(
          (empData.employees || []).map((e: any) => [e.employeeId.toLowerCase(), e])
        );
      }
    } catch {
      // ignore
    }

    const mapped: PayrollSlipEntry[] = excelRawRows
      .map((row) => {
        const empId = String(row[excelMapping.employeeId] ?? '').trim();
        if (!empId) return null;
        const dirEmp = dirMap.get(empId.toLowerCase());

        const totalDays = excelMapping.totalDays
          ? Number(row[excelMapping.totalDays]) || 30
          : 30;
        const paidDays = excelMapping.paidDays
          ? Number(row[excelMapping.paidDays]) || totalDays
          : totalDays;
        const lopDays = excelMapping.lopDays
          ? Number(row[excelMapping.lopDays]) || Math.max(0, totalDays - paidDays)
          : Math.max(0, totalDays - paidDays);

        const earnings: Record<string, number> = {};
        const deductions: Record<string, number> = {};

        if (activeTemplate) {
          for (const h of activeTemplate.config.earningsHeads) {
            const col = excelMapping[`earn:${h.key}`];
            if (col && row[col] !== '' && row[col] !== undefined) {
              earnings[h.key] = Number(row[col]) || 0;
            } else {
              earnings[h.key] = h.defaultValue ?? 0;
            }
          }
          for (const h of activeTemplate.config.deductionsHeads) {
            const col = excelMapping[`ded:${h.key}`];
            if (col && row[col] !== '' && row[col] !== undefined) {
              deductions[h.key] = Number(row[col]) || 0;
            } else {
              deductions[h.key] = h.defaultValue ?? 0;
            }
          }
        }

        return {
          employeeId: empId,
          name:
            (excelMapping.name && String(row[excelMapping.name] ?? '').trim()) ||
            dirEmp?.name ||
            empId,
          email:
            (excelMapping.email && String(row[excelMapping.email] ?? '').trim()) ||
            dirEmp?.email ||
            '',
          department:
            (excelMapping.department && String(row[excelMapping.department] ?? '').trim()) ||
            dirEmp?.department ||
            '',
          designation:
            (excelMapping.designation && String(row[excelMapping.designation] ?? '').trim()) ||
            dirEmp?.designation ||
            '',
          pan:
            (excelMapping.pan && String(row[excelMapping.pan] ?? '').trim()) ||
            dirEmp?.pan ||
            '',
          uan:
            (excelMapping.uan && String(row[excelMapping.uan] ?? '').trim()) ||
            dirEmp?.uan ||
            '',
          bankAccount:
            (excelMapping.bankAccount && String(row[excelMapping.bankAccount] ?? '').trim()) ||
            dirEmp?.bankAccount ||
            '',
          totalDays,
          paidDays,
          lopDays,
          earnings,
          deductions,
        } as PayrollSlipEntry;
      })
      .filter((x): x is PayrollSlipEntry => x !== null);

    setEntries(mapped);
    setActiveRunId(null);
    setRunStatus('DRAFT');
    setMapperOpen(false);
    setDispatchMap({});
    setFeedback({
      type: 'success',
      text: `Imported ${mapped.length} salary rows using "${activeTemplate?.name || 'Active Template'}".`,
    });
  };

  // Preview single PDF
  const handlePreviewPdf = async (entry: PayrollSlipEntry, download = false) => {
    if (!activeTemplate) return;
    try {
      setPreviewLoading(true);
      const res = await fetch('/api/payroll/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          preview: !download,
          download,
          templateId: activeTemplate.id,
          month: selectedMonth,
          year: selectedYear,
          entry,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', text: err.error || 'Failed to generate PDF' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `Payslip_${entry.employeeId}_${selectedMonth}_${selectedYear}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setPreviewTitle(`${entry.name} (${entry.employeeId}) — ${selectedMonth} ${selectedYear}`);
        setPreviewPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  // Save Payroll Run / Maker-Checker submit
  const handleSaveRun = async (submitForApproval = false) => {
    if (entries.length === 0) return;
    setSavingRun(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRunId || undefined,
          month: selectedMonth,
          year: selectedYear,
          templateId: activeTemplate?.id || null,
          sourceMode: inputMode === 'excel' ? 'EXCEL' : 'MANUAL',
          submitForApproval,
          entries,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', text: data.error || 'Failed to save payroll run' });
        return;
      }
      setActiveRunId(data.run.id);
      setRunStatus(data.run.status);
      await loadWorkspacePayrollAssets();
      setFeedback({
        type: 'success',
        text: submitForApproval
          ? 'Submitted payroll run for Top Group Admin approval.'
          : 'Payroll run draft saved.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Network error saving run' });
    } finally {
      setSavingRun(false);
    }
  };

  const handleApproveCurrentRun = async () => {
    if (!activeRunId) return;
    const res = await fetch(`/api/payroll/runs/${activeRunId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setRunStatus('APPROVED');
      await loadWorkspacePayrollAssets();
      setFeedback({ type: 'success', text: 'Payroll run approved and unlocked for dispatch.' });
    }
  };

  // Download Bulk ZIP
  const handleDownloadZip = async () => {
    if (!activeTemplate || entries.length === 0) return;
    setZipLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/payroll/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'zip',
          download: true,
          templateId: activeTemplate.id,
          month: selectedMonth,
          year: selectedYear,
          entries,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', text: err.error || 'Failed to generate ZIP' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslips_${workspace.slug}_${selectedMonth}_${selectedYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setZipLoading(false);
    }
  };

  const isApprovalBlocked =
    !isSuperAdmin &&
    perms.requireMakerChecker &&
    runStatus !== 'APPROVED' &&
    runStatus !== 'COMPLETED';

  // Generate PDFs and Email All
  const handleDispatchAllEmails = async () => {
    if (!activeTemplate || entries.length === 0) return;
    if (isApprovalBlocked) {
      setFeedback({
        type: 'error',
        text: 'Maker-Checker approval is required from Top Group Admin before sending emails.',
      });
      return;
    }

    const validEntries = entries.filter((e) => e.email && e.email.includes('@'));
    if (validEntries.length === 0) {
      setFeedback({ type: 'error', text: 'No rows have valid employee email addresses.' });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const batchRes = await fetch('/api/payroll/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'base64_batch',
          templateId: activeTemplate.id,
          month: selectedMonth,
          year: selectedYear,
          entries: validEntries,
        }),
      });
      const batchData = await batchRes.json();
      if (!batchRes.ok || !batchData.success) {
        setFeedback({ type: 'error', text: batchData.error || 'Failed to generate PDF batch' });
        setSending(false);
        return;
      }

      const subjectTpl = workspace.defaultSubject || DEFAULT_EMAIL_SUBJECT;
      const bodyTpl =
        workspace.defaultBody || buildDefaultEmailBody(workspace.legalName || workspace.name);

      const statusNext: Record<string, DispatchStatusItem> = {};
      for (const e of validEntries) {
        statusNext[e.employeeId] = { status: 'PENDING' };
      }
      setDispatchMap({ ...statusNext });

      let sentOk = 0;
      let sentFail = 0;

      for (const item of batchData.files as Array<{
        employeeId: string;
        filename: string;
        base64: string;
      }>) {
        const entry = validEntries.find((e) => e.employeeId === item.employeeId);
        if (!entry) continue;

        statusNext[entry.employeeId] = { status: 'SENDING' };
        setDispatchMap({ ...statusNext });

        const byteChars = atob(item.base64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const pdfFile = new Blob([bytes], { type: 'application/pdf' });

        const fd = new FormData();
        fd.append('pdfFile', pdfFile, item.filename);
        fd.append('employeeId', entry.employeeId);
        fd.append('employeeName', entry.name);
        fd.append('toEmail', entry.email);
        fd.append('month', selectedMonth);
        fd.append('year', selectedYear);
        if (activeRunId) fd.append('payrollRunId', activeRunId);

        fd.append(
          'subject',
          interpolateTemplate(subjectTpl, {
            employee_name: entry.name,
            employee_id: entry.employeeId,
            month: selectedMonth,
            year: selectedYear,
          })
        );
        fd.append(
          'body',
          interpolateTemplate(bodyTpl, {
            employee_name: entry.name,
            employee_id: entry.employeeId,
            month: selectedMonth,
            year: selectedYear,
          })
        );

        const sendRes = await fetch('/api/send-payslip', { method: 'POST', body: fd });
        const sendData = await sendRes.json();

        if (sendRes.ok && sendData.success) {
          sentOk++;
          statusNext[entry.employeeId] = { status: 'SUCCESS' };
        } else {
          sentFail++;
          statusNext[entry.employeeId] = {
            status: 'FAILED',
            errorMessage: sendData.error || 'Failed',
          };
        }
        setDispatchMap({ ...statusNext });
        await new Promise((r) => setTimeout(r, 250));
      }

      setFeedback({
        type: sentFail === 0 ? 'success' : 'error',
        text: `Dispatch finished: ${sentOk} sent, ${sentFail} failed.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Dispatch failed' });
    } finally {
      setSending(false);
    }
  };

  const currencySymbol = activeTemplate?.config.currency.symbol || 'Rs.';
  const currencyLocale = activeTemplate?.config.currency.numberFormat || 'en-IN';

  return (
    <DashboardShell>
      {/* Top Studio Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand" />
            <span>Payslip Generator &amp; Salary Studio</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Import any salary Excel, edit salaries directly, generate formatted A4 PDFs, and email employees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-800"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-800"
          >
            {['2025', '2026', '2027', '2028'].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 max-w-[220px]"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Format: {t.name}
              </option>
            ))}
          </select>

          {canDesign && (
            <button
              type="button"
              onClick={() => {
                setDesignerTemplate(activeTemplate && activeTemplate.workspaceId ? activeTemplate : null);
                setDesignerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Design Format</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Governance Notice Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {canExcel && (
            <button
              type="button"
              onClick={() => setInputMode('excel')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                inputMode === 'excel'
                  ? 'bg-brand text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Salary Excel</span>
            </button>
          )}
          {canManual && (
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                inputMode === 'manual'
                  ? 'bg-brand text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manual Salary Grid</span>
            </button>
          )}

          <a
            href={`/api/payroll/excel-template?templateId=${encodeURIComponent(
              activeTemplate?.id || ''
            )}`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Exact Excel Format</span>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {perms.requirePdfPassword && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              <Lock className="w-3 h-3" />
              <span>PDF Password Active ({perms.pdfPasswordRule})</span>
            </span>
          )}
          {perms.requireMakerChecker && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              <span>Status: {runStatus.replace('_', ' ')}</span>
            </span>
          )}
          {savedRuns.length > 0 && (
            <select
              value={activeRunId || ''}
              onChange={(e) => {
                const run = savedRuns.find((r) => r.id === e.target.value);
                if (run) {
                  setActiveRunId(run.id);
                  setRunStatus(run.status);
                  setSelectedMonth(run.month);
                  setSelectedYear(run.year);
                  if (run.templateId) setSelectedTemplateId(run.templateId);
                  setEntries(run.entries || []);
                  setDispatchMap({});
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium"
            >
              <option value="">Load Saved Run ({savedRuns.length})</option>
              {savedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.month} {r.year} • {r.entries?.length || 0} slips ({r.status})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* INPUT ACTION BAR */}
      {inputMode === 'excel' && canExcel && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand p-6 text-center transition-colors">
          <div className="max-w-lg mx-auto space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-light text-brand border border-brand-border flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Upload Any Monthly Salary Register (.xlsx, .xls, .csv)
            </h3>
            <p className="text-xs text-slate-500">
              Your columns can be mapped visually in 1 step and saved for future months. Or download our exact template above.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-xs cursor-pointer mt-1">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Choose Salary Spreadsheet</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelFileSelect}
              />
            </label>
          </div>
        </div>
      )}

      {inputMode === 'manual' && canManual && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Pre-fill the grid from your employee directory or add single payslip rows manually.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadFromDirectory}
              disabled={loadingDirectory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {loadingDirectory ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Users className="w-3.5 h-3.5" />
              )}
              <span>Load Directory Employees</span>
            </button>
            <button
              type="button"
              onClick={handleAddBlankRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>
        </div>
      )}

      {/* LIVE PAYROLL TABLE */}
      {entries.length > 0 && activeTemplate && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-900">
                Payroll Sheet ({entries.length} Employees • {selectedMonth} {selectedYear})
              </span>
              {canUseFormulas && (
                <button
                  type="button"
                  onClick={handleRecalculateFormulas}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Calc Formulas</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveRun(false)}
                disabled={savingRun}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingRun ? 'Saving...' : 'Save Draft'}</span>
              </button>

              {perms.requireMakerChecker && !isSuperAdmin && runStatus !== 'APPROVED' && (
                <button
                  type="button"
                  onClick={() => handleSaveRun(true)}
                  disabled={savingRun}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Submit for Admin Approval</span>
                </button>
              )}

              {perms.requireMakerChecker && isSuperAdmin && activeRunId && runStatus !== 'APPROVED' && (
                <button
                  type="button"
                  onClick={handleApproveCurrentRun}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve Payroll Run</span>
                </button>
              )}

              {canDownload && (
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={zipLoading || isApprovalBlocked}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {zipLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderArchive className="w-3.5 h-3.5" />
                  )}
                  <span>Download All ZIP</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDispatchAllEmails}
                disabled={sending || isApprovalBlocked}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{sending ? 'Sending Emails...' : 'Send Payslips via Email'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Emp ID</th>
                  <th className="py-2.5 px-3">Employee Name</th>
                  <th className="py-2.5 px-3">Paid / Total</th>
                  <th className="py-2.5 px-3">Basic</th>
                  <th className="py-2.5 px-3 text-right">Gross</th>
                  <th className="py-2.5 px-3 text-right">Deductions</th>
                  <th className="py-2.5 px-3 text-right">Net Pay</th>
                  <th className="py-2.5 px-3 text-center">Dispatch</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry, idx) => {
                  const totals = computePayslipTotals(
                    entry,
                    activeTemplate.config,
                    canUseFormulas
                  );
                  const dStatus = dispatchMap[entry.employeeId];
                  const basicKey = activeTemplate.config.earningsHeads[0]?.key || 'basic';

                  return (
                    <tr key={`${entry.employeeId}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        <input
                          type="text"
                          value={entry.employeeId}
                          onChange={(e) => {
                            const next = [...entries];
                            next[idx] = { ...entry, employeeId: e.target.value };
                            setEntries(next);
                          }}
                          className="w-20 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{entry.name || 'Unnamed'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {entry.email || 'No email'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={entry.paidDays}
                            onChange={(e) => {
                              const paid = Math.max(0, Number(e.target.value) || 0);
                              const next = [...entries];
                              next[idx] = {
                                ...entry,
                                paidDays: paid,
                                lopDays: Math.max(0, entry.totalDays - paid),
                              };
                              setEntries(next);
                            }}
                            className="w-12 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-center"
                          />
                          <span className="text-slate-400">/ {entry.totalDays}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={entry.earnings[basicKey] ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const next = [...entries];
                            next[idx] = {
                              ...entry,
                              earnings: { ...entry.earnings, [basicKey]: val },
                            };
                            setEntries(next);
                          }}
                          className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                        {formatCurrencyAmount(totals.grossEarnings, currencySymbol, currencyLocale)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-rose-600">
                        {formatCurrencyAmount(
                          totals.totalDeductions,
                          currencySymbol,
                          currencyLocale
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyAmount(totals.netPay, currencySymbol, currencyLocale)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!dStatus ? (
                          <span className="text-[10px] text-slate-400">Ready</span>
                        ) : dStatus.status === 'SUCCESS' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Sent
                          </span>
                        ) : dStatus.status === 'FAILED' ? (
                          <span
                            title={dStatus.errorMessage}
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            Failed
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-600">
                            {dStatus.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingEntryIdx(idx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                            title="Edit All Pay Heads & Statutory Info"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreviewPdf(entry, false)}
                            disabled={previewLoading}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand cursor-pointer"
                            title="Preview Formatted A4 PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canDownload && (
                            <button
                              type="button"
                              onClick={() => handlePreviewPdf(entry, true)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setEntries((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                            title="Remove Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Excel Column Mapper Modal */}
      <Modal
        isOpen={mapperOpen}
        onClose={() => setMapperOpen(false)}
        title="Map Salary Spreadsheet Columns"
        description="Match your Excel columns once and optionally save this mapping for future months."
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto p-1">
            {[
              { key: 'employeeId', label: 'Employee ID *' },
              { key: 'name', label: 'Employee Name' },
              { key: 'email', label: 'Email Address' },
              { key: 'department', label: 'Department' },
              { key: 'designation', label: 'Designation' },
              { key: 'totalDays', label: 'Total Month Days' },
              { key: 'paidDays', label: 'Paid Days' },
              { key: 'lopDays', label: 'LOP Days' },
              { key: 'pan', label: 'PAN' },
              { key: 'uan', label: 'UAN' },
              { key: 'bankAccount', label: 'Bank A/C' },
              ...(activeTemplate?.config.earningsHeads.map((h) => ({
                key: `earn:${h.key}`,
                label: `Earning: ${h.label}`,
              })) || []),
              ...(activeTemplate?.config.deductionsHeads.map((h) => ({
                key: `ded:${h.key}`,
                label: `Deduction: ${h.label}`,
              })) || []),
            ].map((field) => (
              <div key={field.key} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {field.label}
                </label>
                <select
                  value={excelMapping[field.key] || ''}
                  onChange={(e) =>
                    setExcelMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="">-- Skip / Use Default --</option>
                  {excelHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setMapperOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleApplyExcelMapping(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Import Once ({excelRawRows.length} rows)
            </button>
            <button
              type="button"
              disabled={savingMapping}
              onClick={() => handleApplyExcelMapping(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-hover cursor-pointer"
            >
              {savingMapping ? 'Saving...' : 'Save Mapping & Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Single Employee Pay Heads & Statutory Info Modal */}
      <Modal
        isOpen={editingEntryIdx !== null}
        onClose={() => setEditingEntryIdx(null)}
        title={
          editingEntryIdx !== null && entries[editingEntryIdx]
            ? `Edit Salary Slip: ${entries[editingEntryIdx].name || entries[editingEntryIdx].employeeId}`
            : 'Edit Salary Slip'
        }
        maxWidth="2xl"
      >
        {editingEntryIdx !== null && entries[editingEntryIdx] && activeTemplate && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={entries[editingEntryIdx].name}
                  onChange={(e) => {
                    const next = [...entries];
                    next[editingEntryIdx] = { ...next[editingEntryIdx], name: e.target.value };
                    setEntries(next);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={entries[editingEntryIdx].email}
                  onChange={(e) => {
                    const next = [...entries];
                    next[editingEntryIdx] = { ...next[editingEntryIdx], email: e.target.value };
                    setEntries(next);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={entries[editingEntryIdx].designation || ''}
                  onChange={(e) => {
                    const next = [...entries];
                    next[editingEntryIdx] = {
                      ...next[editingEntryIdx],
                      designation: e.target.value,
                    };
                    setEntries(next);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 space-y-2">
                <div className="font-bold text-emerald-800">Earnings</div>
                {activeTemplate.config.earningsHeads.map((h) => (
                  <div key={h.key} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">{h.label}</span>
                    <input
                      type="number"
                      value={entries[editingEntryIdx].earnings[h.key] ?? 0}
                      onChange={(e) => {
                        const next = [...entries];
                        next[editingEntryIdx] = {
                          ...next[editingEntryIdx],
                          earnings: {
                            ...next[editingEntryIdx].earnings,
                            [h.key]: Number(e.target.value) || 0,
                          },
                        };
                        setEntries(next);
                      }}
                      className="w-24 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-right"
                    />
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/70 space-y-2">
                <div className="font-bold text-rose-800">Deductions</div>
                {activeTemplate.config.deductionsHeads.map((h) => (
                  <div key={h.key} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">{h.label}</span>
                    <input
                      type="number"
                      value={entries[editingEntryIdx].deductions[h.key] ?? 0}
                      onChange={(e) => {
                        const next = [...entries];
                        next[editingEntryIdx] = {
                          ...next[editingEntryIdx],
                          deductions: {
                            ...next[editingEntryIdx].deductions,
                            [h.key]: Number(e.target.value) || 0,
                          },
                        };
                        setEntries(next);
                      }}
                      className="w-24 px-2 py-1 bg-white border border-slate-200 rounded font-mono text-right"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingEntryIdx(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Live A4 PDF Preview Modal */}
      <Modal
        isOpen={Boolean(previewPdfUrl)}
        onClose={() => {
          if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
          setPreviewPdfUrl(null);
        }}
        title={previewTitle || 'Formatted A4 Payslip Preview'}
        maxWidth="4xl"
      >
        {previewPdfUrl && (
          <div className="h-[72vh] rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
            <iframe
              src={`${previewPdfUrl}#view=FitH`}
              className="w-full h-full"
              title="Payslip A4 PDF Preview"
            />
          </div>
        )}
      </Modal>

      {/* Company Payslip Template Designer Modal (only if permitted) */}
      <TemplateStudioModal
        isOpen={designerOpen}
        onClose={() => setDesignerOpen(false)}
        template={designerTemplate}
        isMasterMode={false}
        companyName={workspace.name}
        primaryColor={workspace.primaryColor}
        onSaved={loadWorkspacePayrollAssets}
      />
    </DashboardShell>
  );
}
