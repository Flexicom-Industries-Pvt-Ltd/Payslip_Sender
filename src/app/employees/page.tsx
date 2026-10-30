'use client';

import React, { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { MONTHS } from '@/lib/email-templates';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Building,
  RefreshCw,
  Check,
  Clock,
  Calendar,
  Send,
  History,
  Table,
  List,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface MonthStatusRecord {
  id?: string;
  month: string;
  year: string;
  status: 'SENT' | 'FAILED';
  sentAt: string | Date;
  errorMessage?: string | null;
}

interface ActiveMonthSummary {
  month: string;
  year: string;
  sentCount: number;
  totalCount: number;
}

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  createdAt: string;
  updatedAt: string;
  payslipStatus?: 'SENT' | 'MISSED' | 'FAILED';
  lastSentAt?: string | null;
  lastError?: string | null;
  yearlyStatusMap?: Record<string, 'SENT' | 'FAILED'>;
  dispatchHistory?: MonthStatusRecord[];
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Month & Year filter for tracking monthly payslip delivery
  const [selectedMonth, setSelectedMonth] = useState('October');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'missed' | 'failed'>('all');
  const [counts, setCounts] = useState({
    total: 0,
    sentCount: 0,
    missedCount: 0,
    failedCount: 0,
  });

  // Multi-Month & Matrix View states
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [activeMonths, setActiveMonths] = useState<ActiveMonthSummary[]>([]);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    department: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    errors: Array<{ row: number; employeeId: string; error: string }>;
  } | null>(null);
  const [importError, setImportError] = useState('');

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (departmentFilter && departmentFilter !== 'all') {
        params.set('department', departmentFilter);
      }
      params.set('month', selectedMonth);
      params.set('year', selectedYear);
      if (statusFilter && statusFilter !== 'all') {
        params.set('statusFilter', statusFilter);
      }

      const res = await fetch(`/api/employees?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees);
        if (data.counts) {
          setCounts(data.counts);
        }
        if (data.activeMonths) {
          setActiveMonths(data.activeMonths);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHistory = (emp: Employee) => {
    setHistoryEmployee(emp);
    setIsHistoryModalOpen(true);
  };

  useEffect(() => {
    try {
      const now = new Date();
      setSelectedMonth(MONTHS[now.getMonth()]);
      setSelectedYear(now.getFullYear().toString());
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 150);
    return () => clearTimeout(timer);
  }, [search, departmentFilter, selectedMonth, selectedYear, statusFilter]);

  // Extract distinct departments for filtering
  const allDepartments = Array.from(
    new Set(employees.map((e) => e.department).filter(Boolean) as string[])
  ).sort();

  // Handle Add Employee
  const handleOpenAdd = () => {
    setFormData({ employeeId: '', name: '', email: '', department: '' });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId.trim() || !formData.name.trim() || !formData.email.trim()) {
      setFormError('Employee ID, Name, and Email are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to save employee.');
        return;
      }
      setIsAddModalOpen(false);
      fetchEmployees();
    } catch {
      setFormError('Network error while saving employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Employee
  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      department: emp.department || '',
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      setIsSubmitting(true);
      setFormError('');
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to update employee.');
        return;
      }
      setIsEditModalOpen(false);
      fetchEmployees();
    } catch {
      setFormError('Network error while updating employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Employee
  const handleOpenDelete = (emp: Employee) => {
    setDeletingEmployee(emp);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEmployee) return;
    try {
      setIsSubmitting(true);
      await fetch(`/api/employees/${deletingEmployee.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      fetchEmployees();
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Import Submit
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportError('Please select an Excel (.xlsx) or CSV file');
      return;
    }

    try {
      setImportLoading(true);
      setImportError('');
      setImportSummary(null);

      const fd = new FormData();
      fd.append('file', importFile);

      const res = await fetch('/api/employees/import', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setImportError(data.error || 'Import failed.');
        return;
      }

      setImportSummary(data.summary);
      fetchEmployees();
    } catch {
      setImportError('Network error during file import.');
    } finally {
      setImportLoading(false);
    }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <DashboardShell>
      {/* Header and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Employee Directory & Monthly Payslip Status</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor employees and track monthly payslip dispatch delivery status in real time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle: List View vs 12-Month Matrix */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-[#78B338]" />
              <span>List View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-[#78B338]" />
              <span>12-Month Matrix</span>
            </button>
          </div>

          <a
            href="/api/employees/export?template=true"
            download="Sterling_Distillers_Employee_Import_Template.xlsx"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Download formatted Excel template with instructions and sample rows"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Template (.xlsx)</span>
          </a>

          <button
            onClick={() => {
              setImportFile(null);
              setImportSummary(null);
              setImportError('');
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Excel / CSV</span>
          </button>

          <a
            href={`/api/employees/export?month=${encodeURIComponent(
              selectedMonth
            )}&year=${encodeURIComponent(selectedYear)}`}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Export full employee directory with registration dates and monthly payslip status"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Roster</span>
          </a>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#78B338] rounded-lg hover:bg-[#689F2E] transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Monthly Payslip Status Tracking Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-[#78B338]" />
              <span>Delivery Period:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#96D055]"
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
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#96D055]"
              >
                {['2024', '2025', '2026', '2027'].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({counts.total})
            </button>

            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                statusFilter === 'sent'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Sent ({counts.sentCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('missed')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                statusFilter === 'missed'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Missed / Not Sent ({counts.missedCount})</span>
            </button>

            {counts.failedCount > 0 && (
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  statusFilter === 'failed'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Failed ({counts.failedCount})</span>
              </button>
            )}

            <Link
              href="/payslips"
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#78B338] hover:bg-[#689F2E] text-white rounded-lg font-semibold shadow-2xs text-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Distribute Payslips</span>
            </Link>
          </div>
        </div>

        {/* Quick Month Jumper (Active Dispatched Months) */}
        {activeMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-[#78B338]" />
              <span>Active Dispatched Months ({selectedYear}):</span>
            </span>
            {activeMonths.map((am) => {
              const isSelected = am.month === selectedMonth && am.year === selectedYear;

              return (
                <button
                  key={`${am.year}-${am.month}`}
                  onClick={() => {
                    setSelectedMonth(am.month);
                    setSelectedYear(am.year);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#78B338] text-white shadow-xs font-bold'
                      : 'bg-[#F2F8EA] text-[#3F6E15] hover:bg-[#E4F3CE] border border-[#D6EDBC]'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>{am.month}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[#D6EDBC] text-[#2E2A2A]'
                    }`}
                  >
                    {am.sentCount} sent
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white transition-all text-slate-800"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] font-medium"
            >
              <option value="all">All Departments</option>
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchEmployees}
            title="Reload employee records"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: STANDARD LIST VIEW ================= */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">
                    Delivery Status ({selectedMonth} {selectedYear})
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No employees found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {search || departmentFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try clearing your search or status filters'
                          : 'Add employees manually or import from an Excel / CSV spreadsheet.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                            {emp.employeeId}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{emp.name}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                          {emp.email}
                        </td>
                        <td className="py-3.5 px-4">
                          {emp.department ? (
                            <span className="inline-flex items-center gap-1 text-slate-700">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{emp.department}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {emp.payslipStatus === 'SENT' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenHistory(emp)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F2F8EA] text-[#3F6E15] border border-[#D6EDBC] hover:bg-[#E4F3CE] transition-all cursor-pointer shadow-2xs"
                                title="Click to view full delivery history"
                              >
                                <Check className="w-3.5 h-3.5 text-[#78B338] stroke-[3]" />
                                <span>Sent</span>
                                {emp.lastSentAt && (
                                  <span className="text-[10px] text-[#78B338] font-normal">
                                    (
                                    {new Date(emp.lastSentAt).toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                    )
                                  </span>
                                )}
                              </button>
                            ) : emp.payslipStatus === 'FAILED' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenHistory(emp)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                                title={emp.lastError || 'Click to view delivery error'}
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Failed</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>Missed</span>
                              </span>
                            )}

                            {/* Clean subtle history trigger */}
                            {(emp.dispatchHistory?.length || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenHistory(emp)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-[#78B338] transition-colors cursor-pointer"
                                title="View delivery history timeline"
                              >
                                <History className="w-3 h-3 text-slate-400" />
                                <span>{emp.dispatchHistory?.length} sent</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(emp)}
                              className="p-1.5 text-slate-500 hover:text-[#78B338] hover:bg-[#F2F8EA] rounded-md transition-colors cursor-pointer"
                              title="View Payslip Delivery Timeline"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(emp)}
                              className="p-1.5 text-slate-500 hover:text-[#78B338] hover:bg-[#F2F8EA] rounded-md transition-colors cursor-pointer"
                              title="Edit Employee"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(emp)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: 12-MONTH MATRIX VIEW ================= */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden space-y-2">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Table className="w-4 h-4 text-[#78B338]" />
                <span>Annual 12-Month Payslip Distribution Matrix ({selectedYear})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Track payroll delivery coverage month-by-month for each employee across the entire calendar year.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#96D055]"
              >
                {['2024', '2025', '2026', '2027'].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[90px]">
                    Emp ID
                  </th>
                  <th className="py-3 px-3 sticky left-[90px] bg-slate-50 z-10 border-r border-slate-200 min-w-[140px]">
                    Full Name
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 min-w-[110px]">
                    Department
                  </th>
                  {MONTHS.map((m) => (
                    <th
                      key={m}
                      className={`py-3 px-2 text-center min-w-[50px] font-bold ${
                        m === selectedMonth ? 'bg-[#F2F8EA] text-[#3F6E15]' : ''
                      }`}
                    >
                      {m.slice(0, 3)}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-slate-400">
                      No employees registered yet.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const yMap = emp.yearlyStatusMap || {};

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 sticky left-0 bg-white hover:bg-slate-50 border-r border-slate-200">
                          {emp.employeeId}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 sticky left-[90px] bg-white hover:bg-slate-50 border-r border-slate-200 truncate max-w-[160px]">
                          {emp.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 border-r border-slate-200 truncate max-w-[120px]">
                          {emp.department || '—'}
                        </td>
                        {MONTHS.map((m) => {
                          const st = yMap[m];
                          const isCurrent = m === selectedMonth;

                          return (
                            <td
                              key={m}
                              className={`py-2.5 px-1 text-center border-r border-slate-100 ${
                                isCurrent ? 'bg-[#F2F8EA]/30' : ''
                              }`}
                            >
                              {st === 'SENT' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenHistory(emp)}
                                  title={`${m} ${selectedYear}: Delivered`}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#F2F8EA] text-[#3F6E15] border border-[#D6EDBC] hover:scale-110 transition-transform cursor-pointer font-bold text-xs"
                                >
                                  ✓
                                </button>
                              ) : st === 'FAILED' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenHistory(emp)}
                                  title={`${m} ${selectedYear}: Delivery Failed`}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:scale-110 transition-transform cursor-pointer font-bold text-xs"
                                >
                                  ✗
                                </button>
                              ) : (
                                <span className="text-slate-300 font-mono">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(emp)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-[#F2F8EA] hover:text-[#3F6E15] rounded-md transition-all cursor-pointer"
                            title="View history"
                          >
                            <History className="w-3 h-3 text-[#78B338]" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Matrix Footer with Monthly Totals */}
              {employees.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold border-t-2 border-slate-200 text-[11px]">
                  <tr>
                    <td
                      colSpan={3}
                      className="py-2.5 px-3 text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 border-r border-slate-200"
                    >
                      Total Payslips Delivered:
                    </td>
                    {MONTHS.map((m) => {
                      const countSent = employees.filter(
                        (e) => e.yearlyStatusMap?.[m] === 'SENT'
                      ).length;

                      return (
                        <td
                          key={m}
                          className="py-2.5 px-1 text-center font-bold text-[#3F6E15] border-r border-slate-200"
                        >
                          {countSent > 0 ? countSent : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {selectedYear} Summary
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee"
        description="Register a new employee for monthly payslip email distribution"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employee ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EMP105"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employee Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sarah Connor"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. sarah.connor@sterlingdistillers.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Operations, Finance, Production"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#78B338] hover:bg-[#689F2E] rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Employee Information"
        description={`Update record for ${editingEmployee?.name || ''}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employee ID *
            </label>
            <input
              type="text"
              required
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employee Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department (Optional)
            </label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#78B338] hover:bg-[#689F2E] rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Employee Deletion"
        description="Are you sure you want to remove this employee from the payroll directory?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Employee: <strong>{deletingEmployee?.name}</strong> (ID:{' '}
            <span className="font-mono">{deletingEmployee?.employeeId}</span>) will be permanently
            removed from the employee database.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Employee'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Excel / CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Employees from Spreadsheet"
        description="Ingest employee roster from an Excel (.xlsx, .xls) or CSV document"
        maxWidth="xl"
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {importSummary && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1.5 shadow-2xs">
              <div className="font-bold flex items-center gap-1.5 text-emerald-950 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Spreadsheet Imported Successfully</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200/60">
                  <span className="text-slate-500 text-[11px] block">New Employees Added:</span>
                  <span className="text-emerald-700 font-bold text-sm">
                    {importSummary.createdCount}
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200/60">
                  <span className="text-slate-500 text-[11px] block">Existing Records Updated:</span>
                  <span className="text-[#3F6E15] font-bold text-sm">
                    {importSummary.updatedCount}
                  </span>
                </div>
              </div>
              {importSummary.errors.length > 0 && (
                <div className="text-rose-700 text-[11px] font-medium pt-1 border-t border-emerald-200/60">
                  ⚠️ {importSummary.errors.length} rows were skipped due to invalid email or missing ID.
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Download Template Callout */}
          <div className="p-3.5 bg-gradient-to-r from-[#F2F8EA] to-emerald-50 border border-[#D6EDBC] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-[#2E2A2A] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#78B338]" />
                <span>Step 1: Need the pre-formatted Excel template?</span>
              </div>
              <p className="text-[11px] text-[#4B4545] leading-relaxed">
                Download the official template with pre-styled columns, sample rows, and matching guidelines.
              </p>
            </div>
            <a
              href="/api/employees/export?template=true"
              download="Sterling_Distillers_Employee_Import_Template.xlsx"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#78B338] hover:bg-[#689F2E] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </a>
          </div>

          {/* STEP 2: File Upload Dropzone */}
          <div>
            <div className="text-xs font-bold text-slate-800 mb-1.5">
              Step 2: Upload Completed File (.xlsx, .xls, .csv)
            </div>
            <div className="border-2 border-dashed border-slate-200 hover:border-[#96D055] rounded-xl p-5 text-center bg-slate-50/60 hover:bg-[#F2F8EA]/30 transition-all">
              <FileSpreadsheet className="w-8 h-8 text-[#78B338] mx-auto mb-1.5" />
              <div className="text-xs font-semibold text-slate-800">
                {importFile ? importFile.name : 'Select or drag your filled spreadsheet here'}
              </div>
              {importFile && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(importFile.size / 1024).toFixed(1)} KB
                </div>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImportFile(e.target.files[0]);
                  }
                }}
                className="mt-2.5 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#F2F8EA] file:text-[#3F6E15] hover:file:bg-[#E4F3CE] cursor-pointer"
              />
            </div>
          </div>

          {/* Expected Columns Reference Table */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Recognized Column Headers:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <span className="font-semibold text-slate-800 block">Employee ID *</span>
                <span className="text-[10px] text-slate-400">e.g. EMP001 (Unique)</span>
              </div>
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <span className="font-semibold text-slate-800 block">Employee Name *</span>
                <span className="text-[10px] text-slate-400">e.g. Sarah Connor</span>
              </div>
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <span className="font-semibold text-slate-800 block">Email Address *</span>
                <span className="text-[10px] text-slate-400">Valid email destination</span>
              </div>
              <div className="bg-white p-2 rounded-md border border-slate-200">
                <span className="font-semibold text-slate-800 block">Department</span>
                <span className="text-[10px] text-slate-400">Optional grouping</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!importFile || importLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#78B338] hover:bg-[#689F2E] rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {importLoading ? 'Processing...' : 'Upload & Import Employees'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Employee Delivery History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={historyEmployee ? `Payslip Delivery History: ${historyEmployee.name}` : 'Employee Delivery History'}
        description={
          historyEmployee
            ? `ID: ${historyEmployee.employeeId} • ${historyEmployee.email} • ${historyEmployee.department || 'General'}`
            : ''
        }
        maxWidth="xl"
      >
        {historyEmployee && (
          <div className="space-y-4">
            {/* Quick stats for this employee */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                  Total Dispatched
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {historyEmployee.dispatchHistory?.length || 0}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider block">
                  Delivered (✅)
                </span>
                <span className="text-lg font-bold text-emerald-900">
                  {historyEmployee.dispatchHistory?.filter((h) => h.status === 'SENT').length || 0}
                </span>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="text-[10px] text-rose-700 font-semibold uppercase tracking-wider block">
                  Delivery Failures
                </span>
                <span className="text-lg font-bold text-rose-900">
                  {historyEmployee.dispatchHistory?.filter((h) => h.status === 'FAILED').length || 0}
                </span>
              </div>
            </div>

            {/* Dispatches Timeline Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Full Dispatch Log Timeline
                </span>
                <span className="text-[11px] text-slate-400">
                  Chronological records in Neon PostgreSQL
                </span>
              </div>

              {!historyEmployee.dispatchHistory || historyEmployee.dispatchHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Clock className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                  <p className="font-semibold text-slate-600">No payslips have been dispatched yet to this employee.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    When you send a payslip from the Payslips module, the delivery record will appear here.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-500 font-semibold text-[11px] border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-3">Salary Period</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Sent Timestamp</th>
                        <th className="py-2 px-3">Target Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyEmployee.dispatchHistory.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.month} {item.year}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.status === 'SENT' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Delivered</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                                title={item.errorMessage || 'Failed'}
                              >
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Failed</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {new Date(item.sentAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {historyEmployee.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Payslips are delivered individually with Zero Permanent PDF Storage.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
                <Link
                  href="/payslips"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#78B338] hover:bg-[#689F2E] rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Payslip Now</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
