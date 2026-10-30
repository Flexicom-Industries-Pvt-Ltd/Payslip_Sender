'use client';

import React, { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import {
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
  AVAILABLE_VARIABLES,
  interpolateTemplate,
  MONTHS,
} from '@/lib/email-templates';
import {
  Mail,
  Save,
  RotateCcw,
  Sparkles,
  Eye,
  CheckCircle,
  Copy,
  Info,
  Send,
} from 'lucide-react';
import Link from 'next/link';

export default function EmailComposerPage() {
  const [subject, setSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [body, setBody] = useState(DEFAULT_EMAIL_BODY);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preview mock variables
  const [previewMonth, setPreviewMonth] = useState('October');
  const [previewYear, setPreviewYear] = useState('2026');
  const [sampleEmployee, setSampleEmployee] = useState({
    name: 'Sarah Connor',
    id: 'EMP001',
  });

  useEffect(() => {
    // Load custom template if saved previously
    const savedSubject = localStorage.getItem('hr_payslip_email_subject');
    const savedBody = localStorage.getItem('hr_payslip_email_body');
    if (savedSubject) setSubject(savedSubject);
    if (savedBody) setBody(savedBody);
  }, []);

  const handleSave = () => {
    localStorage.setItem('hr_payslip_email_subject', subject);
    localStorage.setItem('hr_payslip_email_body', body);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleReset = () => {
    setSubject(DEFAULT_EMAIL_SUBJECT);
    setBody(DEFAULT_EMAIL_BODY);
    localStorage.removeItem('hr_payslip_email_subject');
    localStorage.removeItem('hr_payslip_email_body');
  };

  const insertVariable = (tag: string, target: 'subject' | 'body') => {
    if (target === 'subject') {
      setSubject((prev) => prev + ` ${tag}`);
    } else {
      setBody((prev) => prev + ` ${tag}`);
    }
  };

  const interpolatedSubject = interpolateTemplate(subject, {
    employee_name: sampleEmployee.name,
    employee_id: sampleEmployee.id,
    month: previewMonth,
    year: previewYear,
  });

  const interpolatedBody = interpolateTemplate(body, {
    employee_name: sampleEmployee.name,
    employee_id: sampleEmployee.id,
    month: previewMonth,
    year: previewYear,
  });

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span>Email Composer & Template</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customize the email subject and notification message sent alongside confidential payslip PDFs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset to Default</span>
          </button>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#78B338] hover:bg-[#689F2E] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Template Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Template</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Column */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Email Subject Line</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Supports dynamic tokens</span>
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Salary Slip – {{month}} {{year}}"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900 font-medium transition-all shadow-2xs"
              />
            </div>

            {/* Variable Pills Toolbar */}
            <div className="p-3.5 bg-gradient-to-r from-slate-50/80 to-[#F2F8EA]/30 rounded-xl border border-slate-200/70">
              <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#78B338]" />
                <span>Click to insert personalization token:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => insertVariable(v.tag, 'body')}
                    className="group inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:border-[#96D055] hover:bg-[#F2F8EA] rounded-lg text-xs font-mono text-[#3F6E15] transition-all shadow-2xs cursor-pointer"
                    title={v.description}
                  >
                    <span>{v.tag}</span>
                    <span className="text-[10px] text-slate-400 font-sans group-hover:text-[#78B338] font-bold">
                      +
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Email Body Content
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Personalized per employee</span>
              </div>
              <textarea
                rows={11}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your payslip notification email body..."
                className="w-full p-3.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#96D055] focus:bg-white text-slate-900 font-sans leading-relaxed transition-all shadow-2xs resize-y"
              />
            </div>

            <div className="flex items-center gap-2.5 text-xs text-[#2E2A2A] bg-[#F2F8EA]/80 p-3 rounded-xl border border-[#D6EDBC]">
              <Info className="w-4 h-4 text-[#78B338] shrink-0" />
              <span className="text-[11px] leading-relaxed">
                Each employee strictly receives their own individual salary slip PDF as an attachment.
                Other employee details are never visible (zero CC / BCC).
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Preview Column */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col h-full">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#78B338]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Live Recipient Preview
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={previewMonth}
                  onChange={(e) => setPreviewMonth(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#96D055]"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 font-semibold">{previewYear}</span>
              </div>
            </div>

            {/* Mock Email Client Container */}
            <div className="mt-4 flex-1 bg-slate-50/60 rounded-xl border border-slate-200/90 overflow-hidden flex flex-col text-xs shadow-2xs">
              {/* Window Header */}
              <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
                <span className="text-[10px] text-slate-400 font-medium font-mono">
                  Inbox Preview
                </span>
              </div>

              {/* Email Headers */}
              <div className="bg-white px-4 py-3.5 border-b border-slate-100 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#F2F8EA] text-[#78B338] border border-[#D6EDBC] flex items-center justify-center font-bold text-xs">
                    SC
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 truncate">
                        {sampleEmployee.name}
                      </span>
                      <span className="text-slate-400 text-[11px] truncate">
                        &lt;sarah.connor@example.com&gt;
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      From: Sterling Distillers HR &lt;sales@sterlingdistillers.com&gt;
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 text-[11px] mr-1.5">Subject:</span>
                  <span className="font-bold text-slate-900">{interpolatedSubject}</span>
                </div>
              </div>

              {/* Rendered Body */}
              <div className="p-5 flex-1 bg-white whitespace-pre-wrap font-sans text-slate-800 leading-relaxed text-xs min-h-[200px]">
                {interpolatedBody}
              </div>

              {/* Mock Attachment Badge */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md font-bold text-[10px]">
                    PDF
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">
                      Payslip_{sampleEmployee.id}_{previewMonth}_{previewYear}.pdf
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Confidential Attachment (~42 KB)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex justify-end">
              <Link
                href="/payslips"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#78B338] hover:bg-[#689F2E] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>Proceed to Payslip Distribution</span>
                <Send className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

