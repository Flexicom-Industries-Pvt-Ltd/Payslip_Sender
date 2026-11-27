import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getSMTPConfigStatus } from '@/lib/mailer';
import { getDatabaseStatus } from '@/lib/db-store';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const smtp = await getSMTPConfigStatus(session.workspaceId);
    const db = await getDatabaseStatus();

    return NextResponse.json({
      success: true,
      smtp,
      database: db,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve system status' },
      { status: 500 }
    );
  }
}
