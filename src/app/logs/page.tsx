'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import {
  ScrollText,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Mail,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Zap,
  ChevronRight,
  X,
} from 'lucide-react';

interface AuditLogRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  email: string;
  month: string;
  year: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  sentAt: string;
  messageId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  fromAddress?: string | null;
  subject?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  rawDetails?: string | null;
}

interface LogMetrics {
  totalDispatches: number;
  successfulCount: number;
  failedCount: number;
  successRate: number;
  avgDurationMs: number;
  uniqueRecipients: number;
}

const MONTHS = [
  'All',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEARS = ['All', '2026', '2025', '2024'];

export default function EnterpriseLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [metrics, setMetrics] = useState<LogMetrics>({
    totalDispatches: 0,
    successfulCount: 0,
    failedCount: 0,
    successRate: 100,
    avgDurationMs: 0,
    uniqueRecipients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [monthFilter, setMonthFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'overview' | 'smtp' | 'payload' | 'raw'>('overview');

  const fetchLogs = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (monthFilter !== 'All') params.set('month', monthFilter);
      if (yearFilter !== 'All') params.set('year', yearFilter);
      params.set('limit', '300');

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, monthFilter, yearFilter]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // CSV Export for Compliance Auditing
  const handleExportCSV = () => {
    if (!logs.length) return;

    const headers = [
      'Log ID',
      'Employee ID',
      'Employee Name',
      'Recipient Email',
      'Salary Month',
      'Salary Year',
      'Status',
      'Duration (ms)',
      'SMTP Host',
      'SMTP Message ID',
      'Server Response',
      'Error Message',
      'Timestamp (ISO)',
    ];

    const rows = logs.map((l) => [
      `"${l.id}"`,
      `"${l.employeeId}"`,
      `"${l.employeeName}"`,
      `"${l.email}"`,
      `"${l.month}"`,
      `"${l.year}"`,
      `"${l.status}"`,
      `"${l.durationMs || ''}"`,
      `"${l.smtpHost || ''}"`,
      `"${l.messageId || ''}"`,
      `"${(l.responseBody || '').replace(/"/g, '""')}"`,
      `"${(l.errorMessage || '').replace(/"/g, '""')}"`,
      `"${l.sentAt}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Sterling_Payslip_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parsedRawDetails = useMemo(() => {
    if (!selectedLog?.rawDetails) return null;
    try {
      return JSON.parse(selectedLog.rawDetails);
    } catch {
      return selectedLog.rawDetails;
    }
  }, [selectedLog]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-primary" />
              <span>Enterprise Email & Audit Logs</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive end-to-end telemetry, cryptographic headers, and raw SMTP server response logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#221E1E] text-white hover:bg-black shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>
          </div>
        </div>

        {/* Enterprise Metrics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Dispatches</span>
              <Mail className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {metrics.totalDispatches.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">All outbound attempts</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Delivered</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-emerald-700 font-mono">
              {metrics.successfulCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              {metrics.successRate}% Success Rate
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-rose-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Failures</span>
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-rose-600 font-mono">
              {metrics.failedCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">SMTP relay / invalid address</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Latency</span>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {metrics.avgDurationMs ? `${metrics.avgDurationMs}ms` : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Roundtrip SMTP dispatch</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-blue-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Recipients</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {metrics.uniqueRecipients.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Distinct employee inboxes</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by Employee, ID, Email, Message ID, or Subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900"
              />
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('SUCCESS')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  statusFilter === 'SUCCESS'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Delivered</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('FAILED')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  statusFilter === 'FAILED'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <XCircle className="w-3 h-3" />
                <span>Failed</span>
              </button>
            </div>

            {/* Month & Year Jumpers */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'All' ? 'All Months' : m}
                  </option>
                ))}
              </select>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y === 'All' ? 'All Years' : y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Telemetry Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Status & Code</th>
                  <th className="py-3 px-4">Recipient / Employee</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Server Response / Diagnostics</th>
                  <th className="py-3 px-4">Dispatched At</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span>Querying Enterprise Telemetry Logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No dispatch telemetry records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const codeLabel = isSuccess ? '250 OK' : 'FAILED';

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                            }`}
                          >
                            {isSuccess ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{codeLabel}</span>
                          </span>
                        </td>

                        {/* Recipient */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{log.employeeName}</span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-normal">
                              {log.employeeId}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[220px]">
                            {log.email}
                          </div>
                        </td>

                        {/* Period */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-slate-700 font-medium">
                            {log.month} {log.year}
                          </span>
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                          {log.durationMs ? (
                            <span
                              className={`${
                                log.durationMs < 1000
                                  ? 'text-emerald-700'
                                  : log.durationMs < 3000
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {log.durationMs}ms
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Server Response preview */}
                        <td className="py-3 px-4 max-w-[320px]">
                          <div
                            className={`text-[11px] font-mono truncate ${
                              isSuccess ? 'text-slate-600' : 'text-rose-600 font-semibold'
                            }`}
                            title={log.errorMessage || log.responseBody || ''}
                          >
                            {log.errorMessage || log.responseBody || '250 Message accepted'}
                          </div>
                          {log.messageId && (
                            <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                              ID: {log.messageId}
                            </div>
                          )}
                        </td>

                        {/* Dispatched At */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          {new Date(log.sentAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="text-xs font-semibold text-primary hover:text-[#5E8E2B] group-hover:underline flex items-center justify-end gap-1 ml-auto cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Enterprise End-to-End Telemetry Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                    selectedLog.status === 'SUCCESS'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {selectedLog.status === 'SUCCESS' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{selectedLog.status === 'SUCCESS' ? '250 DELIVERED' : '550 REJECTED / FAILED'}</span>
                </span>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    Dispatch Telemetry: {selectedLog.employeeName} ({selectedLog.employeeId})
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Log UUID: {selectedLog.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="bg-slate-100 px-6 border-b border-slate-200 flex gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveInspectorTab('overview')}
                className={`py-2.5 border-b-2 cursor-pointer transition-all ${
                  activeInspectorTab === 'overview'
                    ? 'border-[#78B338] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Telemetry Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('smtp')}
                className={`py-2.5 border-b-2 cursor-pointer transition-all ${
                  activeInspectorTab === 'smtp'
                    ? 'border-[#78B338] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                SMTP Response Body
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('payload')}
                className={`py-2.5 border-b-2 cursor-pointer transition-all ${
                  activeInspectorTab === 'payload'
                    ? 'border-[#78B338] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Payload & Attachment
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectorTab('raw')}
                className={`py-2.5 border-b-2 cursor-pointer transition-all ${
                  activeInspectorTab === 'raw'
                    ? 'border-[#78B338] text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Raw Diagnostic JSON
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {activeInspectorTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Salary Period
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {selectedLog.month} {selectedLog.year}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Execution Latency
                      </div>
                      <div className="text-xs font-bold font-mono text-emerald-700">
                        {selectedLog.durationMs ? `${selectedLog.durationMs} ms` : 'N/A'}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Outbound Host
                      </div>
                      <div className="text-xs font-bold font-mono text-slate-800 truncate">
                        {selectedLog.smtpHost ? `${selectedLog.smtpHost}:${selectedLog.smtpPort || 465}` : 'Configured SMTP'}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    <div className="p-3 bg-slate-50 flex items-center justify-between">
                      <span className="font-semibold text-slate-600">SMTP Message-ID</span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800">
                        <span>{selectedLog.messageId || 'Pending or Unassigned'}</span>
                        {selectedLog.messageId && (
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedLog.messageId!, 'msgId')}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Copy Message ID"
                          >
                            {copiedKey === 'msgId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Envelope Sender (MAIL FROM)</span>
                      <span className="font-mono text-slate-800">{selectedLog.fromAddress || 'tech@plascom.in'}</span>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Envelope Recipient (RCPT TO)</span>
                      <span className="font-mono text-slate-800">{selectedLog.email}</span>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Dispatched Timestamp</span>
                      <span className="font-mono text-slate-800">{new Date(selectedLog.sentAt).toISOString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeInspectorTab === 'smtp' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Mail Server Handshake & Response Body
                    </h4>
                    {selectedLog.responseBody && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedLog.responseBody!, 'resp')}
                        className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        {copiedKey === 'resp' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy Response</span>
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                    {selectedLog.responseBody || selectedLog.errorMessage || 'No response body recorded for this transaction.'}
                  </div>

                  {selectedLog.errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Transmission Error Logged:</div>
                        <div className="font-mono text-[11px] mt-0.5">{selectedLog.errorMessage}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeInspectorTab === 'payload' && (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-0.5">
                        Subject Line
                      </span>
                      <span className="font-semibold text-slate-800 text-sm">
                        {selectedLog.subject || `Payslip for ${selectedLog.month} ${selectedLog.year}`}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-0.5">
                          Attached Payslip Document
                        </span>
                        <span className="font-mono text-slate-800 font-semibold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span>{selectedLog.attachmentName || `Payslip_${selectedLog.employeeId}_${selectedLog.month}.pdf`}</span>
                        </span>
                      </div>

                      {selectedLog.attachmentSize && (
                        <div className="text-right">
                          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block mb-0.5">
                            Attachment Size
                          </span>
                          <span className="font-mono text-slate-800 font-semibold">
                            {(selectedLog.attachmentSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 italic">
                    Note: To preserve employee data confidentiality and zero-knowledge storage, in-memory PDF binary buffers are immediately discarded upon SMTP acknowledgment.
                  </div>
                </div>
              )}

              {activeInspectorTab === 'raw' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Complete Diagnostic JSON Dump
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), 'rawJson')}
                      className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {copiedKey === 'rawJson' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy Full JSON</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-[320px] leading-normal border border-slate-800">
                    {JSON.stringify(
                      {
                        ...selectedLog,
                        parsedDetails: parsedRawDetails,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Sterling Distillers Enterprise Audit Engine
              </span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
