import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getEnterpriseAuditLogs } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const statusParam = searchParams.get('status') || 'ALL';
    const status =
      statusParam === 'SUCCESS' || statusParam === 'FAILED' ? statusParam : 'ALL';
    const month = searchParams.get('month') || undefined;
    const year = searchParams.get('year') || undefined;
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const data = await getEnterpriseAuditLogs({
      workspaceId: session.workspaceId,
      search,
      status,
      month: month && month !== 'ALL' ? month : undefined,
      year: year && year !== 'ALL' ? year : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve audit logs',
      },
      { status: 500 }
    );
  }
}
