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
} from 'lucide-react';
import Link from 'next/link';

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
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
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
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
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
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Monthly Payslip Status Tracking Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Delivery Period:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-2xs text-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Distribute Payslips</span>
          </Link>
        </div>
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
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
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
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
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
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Employees Table */}
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
                  Payslip Status ({selectedMonth} {selectedYear})
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
                        {emp.payslipStatus === 'SENT' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            <span>Sent</span>
                            {emp.lastSentAt && (
                              <span className="text-[10px] text-emerald-600 font-normal">
                                (
                                {new Date(emp.lastSentAt).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                )
                              </span>
                            )}
                          </span>
                        ) : emp.payslipStatus === 'FAILED' ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                            title={emp.lastError || 'Delivery failed'}
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delivery Failed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>Missed / Not Sent</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(emp)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. sarah.connor@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Engineering, Human Resources, Finance"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
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
                  <span className="text-blue-700 font-bold text-sm">
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
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Step 1: Need the pre-formatted Excel template?</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Download the official template with pre-styled columns, sample rows, and matching guidelines.
              </p>
            </div>
            <a
              href="/api/employees/export?template=true"
              download="Sterling_Distillers_Employee_Import_Template.xlsx"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
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
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-5 text-center bg-slate-50/60 hover:bg-blue-50/20 transition-all">
              <FileSpreadsheet className="w-8 h-8 text-blue-600 mx-auto mb-1.5" />
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
                className="mt-2.5 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
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
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!importFile || importLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {importLoading ? 'Processing...' : 'Upload & Import Employees'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
