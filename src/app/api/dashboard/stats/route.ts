import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getDashboardStats } from '@/lib/db-store';
import { getSMTPConfigStatus } from '@/lib/mailer';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getDashboardStats(session.workspaceId);
    const smtp = await getSMTPConfigStatus(session.workspaceId);

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
