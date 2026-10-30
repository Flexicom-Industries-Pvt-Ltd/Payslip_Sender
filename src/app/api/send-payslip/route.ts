import { NextRequest, NextResponse } from 'next/server';
import { sendPayslipEmail, getSMTPConfigStatus } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    const smtpStatus = await getSMTPConfigStatus();
    if (!smtpStatus.isConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: `SMTP is not configured on the server. Missing: ${smtpStatus.missingFields.join(', ')}. Please configure SMTP environment variables.`,
          isConfigError: true,
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('pdfFile') as File | null;
    const employeeId = formData.get('employeeId') as string | null;
    const employeeName = formData.get('employeeName') as string | null;
    const toEmail = formData.get('toEmail') as string | null;
    const month = formData.get('month') as string | null;
    const year = formData.get('year') as string | null;
    const subject = formData.get('subject') as string | null;
    const body = formData.get('body') as string | null;

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

    // Validate PDF magic bytes / MIME type
    const arrayBuffer = await file.arrayBuffer();
    let pdfBuffer: Buffer | null = Buffer.from(arrayBuffer);

    // Validate size limit (max 15MB)
    if (pdfBuffer.length > 15 * 1024 * 1024) {
      pdfBuffer = null;
      return NextResponse.json(
        { success: false, error: 'PDF attachment exceeds maximum allowed size (15MB).' },
        { status: 400 }
      );
    }

    // Check header for %PDF
    const header = pdfBuffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-') && !file.name.toLowerCase().endsWith('.pdf')) {
      pdfBuffer = null;
      return NextResponse.json(
        { success: false, error: 'The uploaded file does not appear to be a valid PDF document.' },
        { status: 400 }
      );
    }

    // Send email with Nodemailer
    const result = await sendPayslipEmail({
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

    // Explicitly release buffer
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

