'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
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
  Send,
  Hash,
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

  // Filter out noisy nulls for clean, executive-level JSON inspection
  const cleanJsonPayload = useMemo(() => {
    if (!selectedLog) return {};
    const obj: Record<string, any> = {
      id: selectedLog.id,
      timestamp: selectedLog.sentAt,
      status: selectedLog.status,
      recipient: {
        id: selectedLog.employeeId,
        name: selectedLog.employeeName,
        email: selectedLog.email,
        period: `${selectedLog.month} ${selectedLog.year}`,
      },
      delivery: {
        latencyMs: selectedLog.durationMs || null,
        smtpHost: selectedLog.smtpHost || 'smtppro.zoho.in',
        smtpPort: selectedLog.smtpPort || 465,
        from: selectedLog.fromAddress || 'Tech Team <tech@plascom.in>',
        messageId: selectedLog.messageId || null,
        response: selectedLog.responseBody || null,
      },
    };

    if (selectedLog.errorMessage) {
      obj.error = selectedLog.errorMessage;
    }

    if (selectedLog.attachmentName) {
      obj.attachment = {
        name: selectedLog.attachmentName,
        sizeBytes: selectedLog.attachmentSize || 0,
      };
    }

    if (selectedLog.rawDetails) {
      try {
        obj.diagnostics = JSON.parse(selectedLog.rawDetails);
      } catch {
        obj.diagnostics = selectedLog.rawDetails;
      }
    }

    return obj;
  }, [selectedLog]);

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-[#78B338]" />
              <span>Audit Logs</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time delivery status, latency tracking, and SMTP response logs.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#78B338]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#221E1E] text-white hover:bg-black shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Minimal Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/70 rounded-xl p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Total Dispatches
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics.totalDispatches.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.uniqueRecipients} unique employees
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-xl p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Delivered
            </div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight flex items-baseline gap-2">
              <span>{metrics.successfulCount.toLocaleString()}</span>
              <span className="text-xs font-semibold text-emerald-600/80">({metrics.successRate}%)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Acknowledged by server</div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-xl p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Failed
            </div>
            <div className="text-2xl font-bold text-rose-600 tracking-tight">
              {metrics.failedCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Relay or mailbox issues</div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-xl p-4 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Avg. Latency
            </div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
              {metrics.avgDurationMs ? `${metrics.avgDurationMs}ms` : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Roundtrip SMTP dispatch</div>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="bg-white border border-slate-200/70 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, ID, email, message ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50/70 border border-slate-200/80 focus:outline-hidden focus:ring-1 focus:ring-[#78B338] focus:bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('SUCCESS')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'SUCCESS'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Delivered
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('FAILED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === 'FAILED'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Failed
              </button>
            </div>

            {/* Select Dropdowns */}
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50/70 border border-slate-200/80 rounded-lg text-slate-700 font-medium cursor-pointer"
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
              className="px-2.5 py-1.5 text-xs bg-slate-50/70 border border-slate-200/80 rounded-lg text-slate-700 font-medium cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y === 'All' ? 'All Years' : y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clean Minimal Table */}
        <div className="bg-white border border-slate-200/70 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/70 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Recipient</th>
                  <th className="py-2.5 px-4 font-medium">Period</th>
                  <th className="py-2.5 px-4 font-medium">Latency</th>
                  <th className="py-2.5 px-4 font-medium">Server Response</th>
                  <th className="py-2.5 px-4 font-medium">Dispatched</th>
                  <th className="py-2.5 px-4 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#78B338]" />
                        <span>Loading audit logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No dispatch records found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            <span>{isSuccess ? 'Delivered' : 'Failed'}</span>
                          </span>
                        </td>

                        {/* Recipient */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 flex items-center gap-1.5">
                            <span>{log.employeeName}</span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                              {log.employeeId}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                            {log.email}
                          </div>
                        </td>

                        {/* Period */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                          {log.month} {log.year}
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                          {log.durationMs ? `${log.durationMs}ms` : '—'}
                        </td>

                        {/* Server Response */}
                        <td className="py-3 px-4 max-w-[280px]">
                          <div
                            className={`truncate text-[11px] font-mono ${
                              isSuccess ? 'text-slate-600' : 'text-rose-600'
                            }`}
                            title={log.errorMessage || log.responseBody || ''}
                          >
                            {log.errorMessage || log.responseBody || '250 Message accepted'}
                          </div>
                        </td>

                        {/* Dispatched */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                          {new Date(log.sentAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-700 inline-flex items-center gap-0.5 transition-colors">
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
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

      {/* Sleek Minimal Telemetry Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimal Clean Header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedLog.status === 'SUCCESS'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedLog.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <span>{selectedLog.status === 'SUCCESS' ? 'Delivered (250 OK)' : 'Failed (550 Error)'}</span>
                  </span>

                  <span className="text-xs text-slate-400">
                    {new Date(selectedLog.sentAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                    {selectedLog.employeeName}
                  </h3>
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {selectedLog.employeeId}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-mono text-slate-500">{selectedLog.email}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer -mr-2 -mt-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Pill Tabs */}
            <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeInspectorTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('smtp')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeInspectorTab === 'smtp'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Server Handshake
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('payload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeInspectorTab === 'payload'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Attachment
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('raw')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeInspectorTab === 'raw'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Raw JSON
                </button>
              </div>

              {activeInspectorTab === 'raw' && (
                <button
                  type="button"
                  onClick={() => handleCopy(JSON.stringify(cleanJsonPayload, null, 2), 'rawJson')}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer font-medium"
                >
                  {copiedKey === 'rawJson' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'rawJson' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* TAB 1: OVERVIEW */}
              {activeInspectorTab === 'overview' && (
                <div className="space-y-4">
                  {/* Metric Chips */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-medium text-slate-400">Response Time</div>
                      <div className="text-sm font-semibold text-slate-900 font-mono mt-0.5">
                        {selectedLog.durationMs ? `${selectedLog.durationMs} ms` : '—'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-medium text-slate-400">Salary Period</div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        {selectedLog.month} {selectedLog.year}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-medium text-slate-400">SMTP Host</div>
                      <div className="text-sm font-semibold text-slate-900 font-mono mt-0.5 truncate">
                        {selectedLog.smtpHost || 'smtppro.zoho.in'}
                      </div>
                    </div>
                  </div>

                  {/* Key-Value Details List */}
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Message-ID</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-800 text-[11px]">
                          {selectedLog.messageId || '—'}
                        </span>
                        {selectedLog.messageId && (
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedLog.messageId!, 'msgId')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            {copiedKey === 'msgId' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Sender (From)</span>
                      <span className="font-mono text-slate-800">
                        {selectedLog.fromAddress || 'Tech Team <tech@plascom.in>'}
                      </span>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Recipient Address</span>
                      <span className="font-mono text-slate-800">{selectedLog.email}</span>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Subject</span>
                      <span className="text-slate-800 font-medium">
                        {selectedLog.subject || `Payslip for ${selectedLog.month} ${selectedLog.year}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SERVER HANDSHAKE */}
              {activeInspectorTab === 'smtp' && (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-slate-500">
                    Raw response returned by the outbound SMTP server:
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed border border-slate-800 shadow-inner overflow-x-auto">
                    {selectedLog.responseBody || selectedLog.errorMessage || '250 2.0.0 OK: Message accepted for delivery'}
                  </div>

                  {selectedLog.errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Server Diagnostics:</div>
                        <div className="font-mono text-[11px] mt-0.5">{selectedLog.errorMessage}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ATTACHMENT */}
              {activeInspectorTab === 'payload' && (
                <div className="space-y-3">
                  <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">
                          {selectedLog.attachmentName || `Payslip_${selectedLog.employeeId}_${selectedLog.month}.pdf`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {selectedLog.attachmentSize
                            ? `${(selectedLog.attachmentSize / 1024).toFixed(1)} KB`
                            : 'Standard PDF Document'}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full font-medium">
                      Encrypted in Memory
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    To comply with payroll confidentiality standards, in-memory PDF buffers are wiped immediately upon SMTP delivery acknowledgment.
                  </p>
                </div>
              )}

              {/* TAB 4: RAW JSON */}
              {activeInspectorTab === 'raw' && (
                <div className="space-y-2">
                  <pre className="p-4 rounded-xl bg-[#0F172A] text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[320px] border border-slate-800 shadow-inner">
                    {JSON.stringify(cleanJsonPayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Minimal Footer */}
            <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span>ID: {selectedLog.id}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedLog.id, 'logId')}
                  className="hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Copy Log ID"
                >
                  {copiedKey === 'logId' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-black text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
