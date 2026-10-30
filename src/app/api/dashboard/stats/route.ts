import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db-store';
import { getSMTPConfigStatus } from '@/lib/mailer';

export async function GET() {
  try {
    const stats = await getDashboardStats();
    const smtp = getSMTPConfigStatus();

    return NextResponse.json({
      success: true,
      stats,
      smtpConfigured: smtp.isConfigured,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}

