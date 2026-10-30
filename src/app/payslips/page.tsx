'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Modal } from '@/components/ui/modal';
import { PdfPreviewModal } from '@/components/ui/pdf-preview-modal';
import {
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
  interpolateTemplate,
  MONTHS,
} from '@/lib/email-templates';
import {
  Send,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Users,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Sparkles,
  Trash2,
  Mail,
  Lock,
  RotateCw,
  Check,
  UserCheck,
  UserX,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface EmployeeRecord {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type WorkflowStep = 'ASSIGN' | 'PREVIEW' | 'SENDING';

interface UploadedFileItem {
  id: string;
  file: File;
  filename: string;
  fileSize: number;
  assignedEmployeeId: string | null;
  assignedEmployee: EmployeeRecord | null;
}

interface SendStatusRecord {
  itemId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  status: 'PENDING' | 'SENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  messageId?: string;
}

export default function PayslipDistributionPage() {
  // Step state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('ASSIGN');

  // Month & Year selection
  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Registered employees
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Uploaded files & explicit manual assignments (NO AUTO-MATCHING)
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // filename -> employee.id

  // Email template customizations
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);

  // Preview selection
  const [previewItemIndex, setPreviewItemIndex] = useState(0);

  // PDF Preview Modal
  const [previewPdfFile, setPreviewPdfFile] = useState<File | null>(null);
  const [previewPdfFilename, setPreviewPdfFilename] = useState('');
  const [previewPdfEmployeeName, setPreviewPdfEmployeeName] = useState('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Assign Employee Modal
  const [activeAssignFile, setActiveAssignFile] = useState<UploadedFileItem | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Confirmation Modal
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);

  // Sending progress state
  const [sendStatuses, setSendStatuses] = useState<Record<string, SendStatusRecord>>({});
  const [isSendingActive, setIsSendingActive] = useState(false);
  const [sendFinished, setSendFinished] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch registered employees
  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
      }
    } catch {
      // ignore
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    try {
      const now = new Date();
      setSelectedMonth(MONTHS[now.getMonth()]);
      setSelectedYear(now.getFullYear().toString());
    } catch {
      // fallback
    }

    fetchEmployees();

    // Load saved template if available
    const savedSubject = localStorage.getItem('hr_payslip_email_subject');
    const savedBody = localStorage.getItem('hr_payslip_email_body');
    if (savedSubject) setEmailSubject(savedSubject);
    if (savedBody) setEmailBody(savedBody);
  }, []);

  // Build items array by linking files with their assigned employee
  const fileItems: UploadedFileItem[] = rawFiles.map((file) => {
    const assignedId = assignments[file.name] || null;
    const assignedEmp = assignedId ? employees.find((e) => e.id === assignedId) || null : null;

    return {
      id: `file_${file.name}_${file.size}`,
      file,
      filename: file.name,
      fileSize: file.size,
      assignedEmployeeId: assignedId,
      assignedEmployee: assignedEmp,
    };
  });

  // Calculate set of already assigned employee IDs (excluding current editing file)
  const getAvailableEmployeesForFile = (currentFilename?: string) => {
    const assignedEmpIds = new Set<string>();
    for (const [fname, empId] of Object.entries(assignments)) {
      if (fname !== currentFilename && empId) {
        assignedEmpIds.add(empId);
      }
    }

    return employees.filter((emp) => !assignedEmpIds.has(emp.id));
  };

  // Handle file uploads (UNLIMITED, no smart matching)
  const handleFileUpload = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    const fileList = Array.from(newFiles);
    const existingNames = new Set(rawFiles.map((f) => f.name));
    const filteredNew = fileList.filter((f) => !existingNames.has(f.name));

    setRawFiles((prev) => [...prev, ...filteredNew]);
  };

  // Remove uploaded file
  const handleRemoveFile = (filename: string) => {
    setRawFiles((prev) => prev.filter((f) => f.name !== filename));
    if (assignments[filename]) {
      const copy = { ...assignments };
      delete copy[filename];
      setAssignments(copy);
    }
  };

  // Clear all files
  const handleClearAll = () => {
    setRawFiles([]);
    setAssignments({});
  };

  // Open PDF preview
  const handleOpenPdfPreview = (item: UploadedFileItem) => {
    setPreviewPdfFile(item.file);
    setPreviewPdfFilename(item.filename);
    setPreviewPdfEmployeeName(item.assignedEmployee?.name || 'Unassigned');
    setIsPdfModalOpen(true);
  };

  // Open assignment modal for a specific file
  const handleOpenAssignModal = (item: UploadedFileItem) => {
    setActiveAssignFile(item);
    setAssignSearch('');
    setIsAssignModalOpen(true);
  };

  // Assign employee to file
  const handleSelectEmployeeForFile = (employeeId: string) => {
    if (!activeAssignFile) return;

    setAssignments((prev) => ({
      ...prev,
      [activeAssignFile.filename]: employeeId,
    }));
    setIsAssignModalOpen(false);
    setActiveAssignFile(null);
  };

  // Remove assignment for a file
  const handleUnassignFile = (filename: string) => {
    setAssignments((prev) => {
      const copy = { ...prev };
      delete copy[filename];
      return copy;
    });
  };

  // Load sample demo files with 1-click
  const handleLoadDemoFiles = async () => {
    try {
      const res = await fetch(
        `/api/sample-files?month=${encodeURIComponent(selectedMonth)}&year=${encodeURIComponent(
          selectedYear
        )}`
      );
      const data = await res.json();
      if (data.success && data.samples) {
        const demoFiles: File[] = data.samples.map((s: any) => {
          const byteCharacters = atob(s.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          return new File([blob], s.filename, {
            type: 'application/pdf',
            lastModified: Date.now(),
          });
        });

        // Add without auto-assigning (pure manual assignment workflow as requested)
        setRawFiles(demoFiles);
      }
    } catch {
      alert('Could not load sample test files.');
    }
  };

  // Assigned items ready to review & send
  const readyToSendItems = fileItems.filter((i) => i.assignedEmployee !== null);
  const unassignedCount = fileItems.filter((i) => i.assignedEmployee === null).length;

  // Registered employees who haven't been assigned any file yet
  const assignedEmpIdsSet = new Set(Object.values(assignments).filter(Boolean));
  const unassignedEmployees = employees.filter((e) => !assignedEmpIdsSet.has(e.id));

  // Available options for current active modal
  const availableEmployeesInModal = getAvailableEmployeesForFile(activeAssignFile?.filename).filter(
    (emp) => {
      if (!assignSearch.trim()) return true;
      const q = assignSearch.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q)
      );
    }
  );

  // Initialize sending
  const handleStartSending = async () => {
    setIsConfirmSendOpen(false);
    setCurrentStep('SENDING');
    setIsSendingActive(true);
    setSendFinished(false);

    const initialStatuses: Record<string, SendStatusRecord> = {};
    for (const item of readyToSendItems) {
      if (item.assignedEmployee) {
        initialStatuses[item.id] = {
          itemId: item.id,
          employeeId: item.assignedEmployee.employeeId,
          employeeName: item.assignedEmployee.name,
          email: item.assignedEmployee.email,
          status: 'PENDING',
        };
      }
    }
    setSendStatuses(initialStatuses);

    await dispatchBatch(readyToSendItems, initialStatuses);
  };

  // Dispatch batch sequentially
  const dispatchBatch = async (
    itemsToDispatch: UploadedFileItem[],
    currentStatusMap: Record<string, SendStatusRecord>
  ) => {
    const updatedStatuses = { ...currentStatusMap };

    for (const item of itemsToDispatch) {
      if (!item.assignedEmployee) continue;

      updatedStatuses[item.id] = {
        ...updatedStatuses[item.id],
        status: 'SENDING',
      };
      setSendStatuses({ ...updatedStatuses });

      try {
        const formData = new FormData();
        formData.append('pdfFile', item.file, item.filename);
        formData.append('employeeId', item.assignedEmployee.employeeId);
        formData.append('employeeName', item.assignedEmployee.name);
        formData.append('toEmail', item.assignedEmployee.email);
        formData.append('month', selectedMonth);
        formData.append('year', selectedYear);

        const personalizedSubject = interpolateTemplate(emailSubject, {
          employee_name: item.assignedEmployee.name,
          employee_id: item.assignedEmployee.employeeId,
          month: selectedMonth,
          year: selectedYear,
        });

        const personalizedBody = interpolateTemplate(emailBody, {
          employee_name: item.assignedEmployee.name,
          employee_id: item.assignedEmployee.employeeId,
          month: selectedMonth,
          year: selectedYear,
        });

        formData.append('subject', personalizedSubject);
        formData.append('body', personalizedBody);

        const res = await fetch('/api/send-payslip', {
          method: 'POST',
          body: formData,
        });

        const result = await res.json();

        if (res.ok && result.success) {
          updatedStatuses[item.id] = {
            ...updatedStatuses[item.id],
            status: 'SUCCESS',
            messageId: result.messageId,
          };
        } else {
          updatedStatuses[item.id] = {
            ...updatedStatuses[item.id],
            status: 'FAILED',
            errorMessage: result.error || 'Failed to dispatch email via SMTP.',
          };
        }
      } catch (err: any) {
        updatedStatuses[item.id] = {
          ...updatedStatuses[item.id],
          status: 'FAILED',
          errorMessage: err.message || 'Network communication error.',
        };
      }

      setSendStatuses({ ...updatedStatuses });
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    setIsSendingActive(false);
    setSendFinished(true);
  };

  // Retry only failed items
  const handleRetryFailed = async () => {
    const failedItemIds = new Set(
      Object.values(sendStatuses)
        .filter((s) => s.status === 'FAILED')
        .map((s) => s.itemId)
    );

    const failedItems = readyToSendItems.filter((item) => failedItemIds.has(item.id));
    if (failedItems.length === 0) return;

    setIsSendingActive(true);
    setSendFinished(false);

    const updated = { ...sendStatuses };
    for (const item of failedItems) {
      if (updated[item.id]) {
        updated[item.id] = {
          ...updated[item.id],
          status: 'PENDING',
          errorMessage: undefined,
        };
      }
    }
    setSendStatuses(updated);

    await dispatchBatch(failedItems, updated);
  };

  // Statistics for current send
  const totalInBatch = readyToSendItems.length;
  const successCount = Object.values(sendStatuses).filter((s) => s.status === 'SUCCESS').length;
  const failedCount = Object.values(sendStatuses).filter((s) => s.status === 'FAILED').length;
  const pendingCount = totalInBatch - successCount - failedCount;
  const progressPercent = totalInBatch > 0 ? Math.round(((successCount + failedCount) / totalInBatch) * 100) : 0;

  return (
    <DashboardShell>
      {/* Workflow Step Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            <span>Payslip Distribution</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload salary slip PDFs with no limits, explicitly assign to employees, and dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              currentStep === 'ASSIGN'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span>1. Upload & Assign</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              currentStep === 'PREVIEW'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span>2. Review Emails</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              currentStep === 'SENDING'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span>3. Distribution Progress</span>
          </div>
        </div>
      </div>

      {/* ================= STEP 1: UPLOAD & MANUAL ASSIGNMENT ================= */}
      {currentStep === 'ASSIGN' && (
        <div className="space-y-6">
          {/* Period Selector & Quick Actions */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Disbursement Period:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {['2024', '2025', '2026', '2027'].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {rawFiles.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Files</span>
                </button>
              )}
            </div>
          </div>

          {/* Unlimited Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFileUpload(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/20 hover:bg-blue-50/40 rounded-2xl p-7 text-center transition-all cursor-pointer group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-105 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Upload Individual Employee Payslip PDFs (No Upload Limits)
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Drop as many salary slip PDFs as you need. After uploading, you can manually assign each
              file to an employee from the available options.
            </p>
          </div>

          {/* Assignment Counters */}
          {rawFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                    Total Uploaded
                  </span>
                  <span className="text-xl font-bold text-slate-900">{fileItems.length}</span>
                </div>
                <FileText className="w-6 h-6 text-slate-400" />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wider block">
                    Assigned PDFs
                  </span>
                  <span className="text-xl font-bold text-emerald-900">
                    {readyToSendItems.length}
                  </span>
                </div>
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-700 font-semibold uppercase tracking-wider block">
                    Unassigned Files
                  </span>
                  <span className="text-xl font-bold text-amber-900">{unassignedCount}</span>
                </div>
                <UserX className="w-6 h-6 text-amber-600" />
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-indigo-700 font-semibold uppercase tracking-wider block">
                    Available in Roster
                  </span>
                  <span className="text-xl font-bold text-indigo-900">
                    {unassignedEmployees.length}
                  </span>
                </div>
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          )}

          {/* Files Assignment Table */}
          {rawFiles.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Assign Employees to Uploaded PDFs ({readyToSendItems.length} of {fileItems.length}{' '}
                    Assigned)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click "Assign Employee" on each PDF. Already assigned employees are automatically
                    removed from selection options.
                  </p>
                </div>

                <button
                  disabled={readyToSendItems.length === 0}
                  onClick={() => setCurrentStep('PREVIEW')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span>Review {readyToSendItems.length} Assigned Emails</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">PDF Filename</th>
                      <th className="py-3 px-4">Assigned Employee</th>
                      <th className="py-3 px-4">Recipient Email Address</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fileItems.map((item) => {
                      const isAssigned = item.assignedEmployee !== null;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            !isAssigned ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="truncate max-w-xs">{item.filename}</span>
                              <span className="text-[10px] text-slate-400">
                                ({(item.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {item.assignedEmployee ? (
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {item.assignedEmployee.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400">
                                    ID: {item.assignedEmployee.employeeId}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleUnassignFile(item.filename)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                                  title="Unassign employee"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenAssignModal(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <span>+ Assign Employee</span>
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {item.assignedEmployee?.email || (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isAssigned ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Assigned</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span>Unassigned</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPdfPreview(item)}
                                className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                                title="Preview PDF in memory"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>

                              {isAssigned && (
                                <button
                                  onClick={() => handleOpenAssignModal(item)}
                                  className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium text-[11px] cursor-pointer"
                                >
                                  Change
                                </button>
                              )}

                              <button
                                onClick={() => handleRemoveFile(item.filename)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Remove file"
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

          {/* Unassigned Employees in Directory Drawer */}
          {rawFiles.length > 0 && unassignedEmployees.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Employees Still Without Payslip Assigned ({unassignedEmployees.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  These employees will be marked as "Missed" if not dispatched
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
                {unassignedEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="font-mono text-[10px] text-slate-500 font-semibold">
                      {emp.employeeId}
                    </span>
                    <span className="font-medium text-slate-800">{emp.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 2: PREVIEW & REVIEW ================= */}
      {currentStep === 'PREVIEW' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep('ASSIGN')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Uploads & Assignments</span>
            </button>

            <button
              onClick={() => setIsConfirmSendOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send All {readyToSendItems.length} Payslips</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Assigned Recipient List */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col h-[600px]">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Assigned Recipients ({readyToSendItems.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">Select an employee to inspect</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 mt-2">
                {readyToSendItems.map((item, idx) => {
                  const emp = item.assignedEmployee!;
                  const isSelected = idx === previewItemIndex;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItemIndex(idx)}
                      className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 shadow-2xs'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs text-slate-900 truncate">
                          {emp.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">
                          {emp.email}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {item.filename}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {emp.employeeId}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Individual Preview Frame */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
              {readyToSendItems[previewItemIndex] ? (
                (() => {
                  const currentItem = readyToSendItems[previewItemIndex];
                  const currentEmp = currentItem.assignedEmployee!;

                  const personalizedSubject = interpolateTemplate(emailSubject, {
                    employee_name: currentEmp.name,
                    employee_id: currentEmp.employeeId,
                    month: selectedMonth,
                    year: selectedYear,
                  });

                  const personalizedBody = interpolateTemplate(emailBody, {
                    employee_name: currentEmp.name,
                    employee_id: currentEmp.employeeId,
                    month: selectedMonth,
                    year: selectedYear,
                  });

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-primary" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Email Inspection ({previewItemIndex + 1} of {readyToSendItems.length})
                          </h3>
                        </div>

                        <button
                          onClick={() => handleOpenPdfPreview(currentItem)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>View PDF ({currentItem.filename})</span>
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-slate-50/50">
                        <div className="bg-white p-4 border-b border-slate-200 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-16 font-semibold text-slate-500">To:</span>
                            <span className="font-mono text-slate-900 font-bold">
                              {currentEmp.name} &lt;{currentEmp.email}&gt;
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 font-semibold text-slate-500">Subject:</span>
                            <span className="font-semibold text-slate-900">
                              {personalizedSubject}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 font-semibold text-slate-500">Attachment:</span>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px]">
                              <FileText className="w-3 h-3 text-blue-600" />
                              <span>{currentItem.filename}</span>
                              <span className="text-blue-400">
                                ({(currentItem.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="p-6 bg-white font-sans whitespace-pre-wrap leading-relaxed text-slate-800 min-h-[220px]">
                          {personalizedBody}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          Strict Isolation: Each employee receives their own email and attachment separately.
                          Other recipients are never CC’d or BCC’d.
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-12 text-slate-400">
                  Select a recipient from the list to preview
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {readyToSendItems.length} payslips ready to send for {selectedMonth} {selectedYear}.
                </div>
                <button
                  onClick={() => setIsConfirmSendOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm & Send Batch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 3: SENDING PROGRESS ================= */}
      {currentStep === 'SENDING' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  {isSendingActive ? (
                    <>
                      <RotateCw className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Sending Payslips in Progress...</span>
                    </>
                  ) : sendFinished ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Batch Distribution Complete</span>
                    </>
                  ) : (
                    <span>Distribution Paused</span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Delivering individual emails through Nodemailer SMTP server
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {sendFinished && failedCount > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={isSendingActive}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry {failedCount} Failed Deliveries</span>
                  </button>
                )}

                {sendFinished && (
                  <>
                    <Link
                      href={`/employees?month=${encodeURIComponent(
                        selectedMonth
                      )}&year=${encodeURIComponent(selectedYear)}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>View Delivery Ticks in Directory (✅)</span>
                      <ExternalLink className="w-3 h-3 text-emerald-500" />
                    </Link>

                    <button
                      onClick={() => {
                        handleClearAll();
                        setCurrentStep('ASSIGN');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Start New Batch</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Progress: {progressPercent}%</span>
                <span>
                  {successCount + failedCount} of {totalInBatch} processed
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(successCount / (totalInBatch || 1)) * 100}%` }}
                />
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${(failedCount / (totalInBatch || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  Delivered (Marked ✅ in Roster)
                </span>
                <span className="text-xl font-bold text-emerald-900">{successCount}</span>
              </div>

              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-center">
                <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">
                  Failed Delivery
                </span>
                <span className="text-xl font-bold text-rose-900">{failedCount}</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Pending Queue
                </span>
                <span className="text-xl font-bold text-slate-800">{pendingCount}</span>
              </div>
            </div>
          </div>

          {/* Delivery Queue Stream */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Detailed Delivery Queue Status
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-4">Employee</th>
                    <th className="py-2.5 px-4">Recipient Email</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Delivery Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {readyToSendItems.map((item) => {
                    const statusRecord = sendStatuses[item.id] || { status: 'PENDING' };

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.assignedEmployee?.name}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">
                            {item.assignedEmployee?.employeeId}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {item.assignedEmployee?.email}
                        </td>

                        <td className="py-3 px-4">
                          {statusRecord.status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              Pending
                            </span>
                          )}
                          {statusRecord.status === 'SENDING' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 flex items-center gap-1">
                              <RotateCw className="w-3 h-3 animate-spin" />
                              <span>Dispatching...</span>
                            </span>
                          )}
                          {statusRecord.status === 'SUCCESS' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Delivered</span>
                            </span>
                          )}
                          {statusRecord.status === 'FAILED' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Failed</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {statusRecord.status === 'SUCCESS' && (
                            <span className="text-emerald-700 font-mono text-[10px]">
                              Confirmed by SMTP ({statusRecord.messageId?.slice(0, 20)}...)
                            </span>
                          )}
                          {statusRecord.status === 'FAILED' && (
                            <span className="text-rose-600 font-medium">
                              {statusRecord.errorMessage || 'SMTP rejected acceptance.'}
                            </span>
                          )}
                          {statusRecord.status === 'PENDING' && (
                            <span className="text-slate-400 italic">Waiting in rate-limited queue</span>
                          )}
                          {statusRecord.status === 'SENDING' && (
                            <span className="text-blue-600">Streaming ephemeral PDF buffer...</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before Bulk Send */}
      <Modal
        isOpen={isConfirmSendOpen}
        onClose={() => setIsConfirmSendOpen(false)}
        title="Confirm Payslip Email Distribution"
        description="Verify delivery details before initiating email dispatches"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
            <div className="font-semibold text-blue-950">Distribution Summary:</div>
            <div>
              • <strong>Period:</strong> {selectedMonth} {selectedYear}
            </div>
            <div>
              • <strong>Total Assigned Recipients:</strong> {readyToSendItems.length} employees
            </div>
            {unassignedCount > 0 && (
              <div className="text-amber-800 font-semibold">
                • ⚠️ {unassignedCount} uploaded files are unassigned and will NOT be sent.
              </div>
            )}
            <div>
              • <strong>Mode:</strong> Individual separate dispatches (Zero CC/BCC)
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Upon successful delivery, each employee will be marked with a green checkmark (
            <strong>✅ Sent</strong>) in the Employee Directory for {selectedMonth} {selectedYear}.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsConfirmSendOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleStartSending}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Confirm & Start Sending
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Employee Modal - WITH FILTERING OF ALREADY ASSIGNED EMPLOYEES */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Select Employee for Payslip"
        description={`Assign to: ${activeAssignFile?.filename || ''} (${availableEmployeesInModal.length} employees available)`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-center justify-between">
            <span className="font-semibold">
              Available Employees: {availableEmployeesInModal.length}
            </span>
            <span className="text-[11px] text-blue-700">
              ({assignments && Object.keys(assignments).length} already assigned)
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, ID, or email..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {availableEmployeesInModal.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                {assignSearch ? (
                  <span>No available employees match your search query.</span>
                ) : (
                  <span>All registered employees have already been assigned to other PDFs!</span>
                )}
              </div>
            ) : (
              availableEmployeesInModal.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmployeeForFile(emp.id)}
                  className="w-full text-left p-3 hover:bg-blue-50/70 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-700">
                      {emp.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{emp.email}</div>
                    {emp.department && (
                      <div className="text-[10px] text-slate-400">{emp.department}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800">
                      {emp.employeeId}
                    </span>
                    <span className="text-xs text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Select →
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] text-slate-400">
              Assigned employees will not appear when assigning subsequent PDFs.
            </span>
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* In-Memory PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        file={previewPdfFile}
        filename={previewPdfFilename}
        employeeName={previewPdfEmployeeName}
      />
    </DashboardShell>
  );
}
