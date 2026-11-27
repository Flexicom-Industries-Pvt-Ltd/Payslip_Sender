import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  getPendingApprovalsForAdmin,
  getPayrollRuns,
  getWorkspaceById,
  savePayrollRun,
} from '@/lib/db-store';
import { parseWorkspacePermissions } from '@/lib/workspace-permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const scope = new URL(request.url).searchParams.get('scope');
    if (session.role === 'SUPER_ADMIN' && scope === 'pending') {
      const pending = await getPendingApprovalsForAdmin();
      return NextResponse.json({ success: true, runs: pending });
    }

    if (!session.workspaceId) {
      return NextResponse.json({ success: false, error: 'No workspace active' }, { status: 400 });
    }

    const runs = await getPayrollRuns(session.workspaceId);
    return NextResponse.json({ success: true, runs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load payroll runs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const ws = await getWorkspaceById(session.workspaceId);
    const perms = parseWorkspacePermissions(ws?.permissionsJson);

    const sourceMode = body.sourceMode === 'EXCEL' ? 'EXCEL' : 'MANUAL';
    if (session.role !== 'SUPER_ADMIN') {
      if (sourceMode === 'EXCEL' && !perms.allowExcelImport) {
        return NextResponse.json(
          { success: false, error: 'Excel import is disabled by Top Group Admin.' },
          { status: 403 }
        );
      }
      if (sourceMode === 'MANUAL' && !perms.allowManualSalary) {
        return NextResponse.json(
          { success: false, error: 'Manual salary entry is disabled by Top Group Admin.' },
          { status: 403 }
        );
      }
    }

    let status = body.status || 'DRAFT';
    if (perms.requireMakerChecker && session.role !== 'SUPER_ADMIN') {
      status = body.submitForApproval ? 'PENDING_APPROVAL' : 'DRAFT';
    } else if (!perms.requireMakerChecker && status === 'PENDING_APPROVAL') {
      status = 'APPROVED';
    }

    const saved = await savePayrollRun({
      id: body.id,
      workspaceId: session.workspaceId,
      month: body.month || 'October',
      year: body.year || String(new Date().getFullYear()),
      templateId: body.templateId || null,
      sourceMode,
      status,
      notes: body.notes,
      entries: Array.isArray(body.entries) ? body.entries : [],
    });

    return NextResponse.json({ success: true, run: saved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save payroll run' },
      { status: 400 }
    );
  }
}
