import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  getEffectiveWorkspacePermissions,
  getEmailLogs,
  getPayrollRunById,
  getWorkspaceById,
} from '@/lib/db-store';
import { sendPayslipEmail, getSMTPConfigStatus } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const smtpStatus = await getSMTPConfigStatus(session.workspaceId);
    if (!smtpStatus.isConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: `SMTP is not configured for this workspace. Missing: ${smtpStatus.missingFields.join(', ')}. Please configure SMTP in Settings.`,
          isConfigError: true,
        },
        { status: 503 }
      );
    }

    const workspace = await getWorkspaceById(session.workspaceId);
    const companyName = workspace?.legalName || workspace?.name || 'Payslip Dispatch Portal';

    const formData = await request.formData();
    const file = formData.get('pdfFile') as File | null;
    const employeeId = formData.get('employeeId') as string | null;
    const employeeName = formData.get('employeeName') as string | null;
    const toEmail = formData.get('toEmail') as string | null;
    const month = formData.get('month') as string | null;
    const year = formData.get('year') as string | null;
    const subject = formData.get('subject') as string | null;
    const body = formData.get('body') as string | null;
    const payrollRunId = formData.get('payrollRunId') as string | null;

    if (session.role !== 'SUPER_ADMIN') {
      const perms = await getEffectiveWorkspacePermissions(session.workspaceId);

      if (perms.requireMakerChecker && payrollRunId) {
        const run = await getPayrollRunById(payrollRunId, session.workspaceId);
        if (!run || (run.status !== 'APPROVED' && run.status !== 'COMPLETED')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Payroll run requires Top Group Admin approval before payslips can be emailed.',
            },
            { status: 403 }
          );
        }
      }

      if (!perms.allowResendSent && employeeId && month && year) {
        const recentLogs = await getEmailLogs(500, session.workspaceId);
        const alreadySent = recentLogs.some(
          (l) =>
            l.status === 'SUCCESS' &&
            l.employeeId.toLowerCase() === employeeId.trim().toLowerCase() &&
            l.month.toLowerCase() === month.trim().toLowerCase() &&
            l.year.trim() === year.trim()
        );
        if (alreadySent) {
          return NextResponse.json(
            {
              success: false,
              error: `Payslip for ${employeeId} (${month} ${year}) has already been sent and re-sending is locked by Top Group Admin.`,
            },
            { status: 403 }
          );
        }
      }
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Salary slip PDF file is required.' },
        { status: 400 }
      );
    }

    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim())) {
      return NextResponse.json(
        { success: false, error: `Invalid recipient email address: "${toEmail || ''}"` },
        { status: 400 }
      );
    }

    if (!employeeId || !employeeName) {
      return NextResponse.json(
        { success: false, error: 'Employee identification details are missing.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let pdfBuffer: Buffer | null = Buffer.from(arrayBuffer);

    if (pdfBuffer.length > 15 * 1024 * 1024) {
      pdfBuffer = null;
      return NextResponse.json(
        { success: false, error: 'PDF attachment exceeds maximum allowed size (15MB).' },
        { status: 400 }
      );
    }

    const header = pdfBuffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-') && !file.name.toLowerCase().endsWith('.pdf')) {
      pdfBuffer = null;
      return NextResponse.json(
        { success: false, error: 'The uploaded file does not appear to be a valid PDF document.' },
        { status: 400 }
      );
    }

    const result = await sendPayslipEmail({
      workspaceId: session.workspaceId,
      companyName,
      to: toEmail.trim(),
      employeeName: employeeName.trim(),
      employeeId: employeeId.trim(),
      month: month || 'Current',
      year: year || new Date().getFullYear().toString(),
      subject: subject || 'Salary Slip Notification',
      body: body || '',
      pdfBuffer,
      filename: file.name,
    });

    pdfBuffer = null;

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to dispatch email.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Salary slip successfully sent to ${employeeName} (${toEmail})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected error occurred while sending email.' },
      { status: 500 }
    );
  }
}
