import { NextResponse } from 'next/server';
import { getSMTPConfigStatus } from '@/lib/mailer';
import { getDatabaseStatus } from '@/lib/db-store';

export async function GET() {
  try {
    const smtp = getSMTPConfigStatus();
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

