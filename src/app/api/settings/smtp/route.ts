import { NextRequest, NextResponse } from 'next/server';
import { getSMTPConfigStatus, saveStoredSMTPConfig, verifySMTPConnection } from '@/lib/mailer';

export async function GET() {
  try {
    const status = await getSMTPConfigStatus();
    return NextResponse.json({ success: true, smtp: status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve SMTP configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, user, password, from, secure } = body;

    if (!host || !host.trim()) {
      return NextResponse.json(
        { success: false, error: 'SMTP Host address is required.' },
        { status: 400 }
      );
    }

    if (!user || !user.trim()) {
      return NextResponse.json(
        { success: false, error: 'SMTP Username / Email is required.' },
        { status: 400 }
      );
    }

    const updatedStatus = await saveStoredSMTPConfig({
      host,
      port: Number(port) || 587,
      user,
      password,
      from: from || user,
      secure: Boolean(secure),
    });

    return NextResponse.json({
      success: true,
      message: 'SMTP Email Server configuration saved successfully!',
      smtp: updatedStatus,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save SMTP configuration' },
      { status: 500 }
    );
  }
}

