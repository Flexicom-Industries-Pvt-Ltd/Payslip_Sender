import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  createPayslipTemplate,
  getAccessibleTemplatesForWorkspace,
  getAllPayslipTemplatesForAdmin,
  getWorkspaceById,
} from '@/lib/db-store';
import { parseWorkspacePermissions } from '@/lib/workspace-permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const scope = new URL(request.url).searchParams.get('scope');
    if (session.role === 'SUPER_ADMIN' && (scope === 'admin' || !session.workspaceId)) {
      const templates = await getAllPayslipTemplatesForAdmin();
      return NextResponse.json({ success: true, templates });
    }

    if (!session.workspaceId) {
      return NextResponse.json({ success: false, error: 'No active workspace selected' }, { status: 400 });
    }

    const templates = await getAccessibleTemplatesForWorkspace(session.workspaceId);
    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load payslip templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const isMasterRequest = body.isMaster === true || !session.workspaceId;

    if (isMasterRequest) {
      if (session.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Only Top Group Admin can create master templates.' },
          { status: 403 }
        );
      }
      const created = await createPayslipTemplate({
        workspaceId: null,
        name: body.name,
        description: body.description,
        presetStyle: body.presetStyle,
        config: body.config || {},
        isDefault: Boolean(body.isDefault),
      });
      return NextResponse.json({ success: true, template: created }, { status: 201 });
    }

    if (session.role !== 'SUPER_ADMIN') {
      const ws = await getWorkspaceById(session.workspaceId!);
      const perms = parseWorkspacePermissions(ws?.permissionsJson);
      if (!perms.allowTemplateDesigner) {
        return NextResponse.json(
          {
            success: false,
            error: 'Custom Payslip Template Designer is disabled by Top Group Admin for this company.',
          },
          { status: 403 }
        );
      }
    }

    const created = await createPayslipTemplate({
      workspaceId: session.workspaceId,
      name: body.name,
      description: body.description,
      presetStyle: body.presetStyle,
      config: body.config || {},
      isDefault: Boolean(body.isDefault),
    });

    return NextResponse.json({ success: true, template: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create payslip template' },
      { status: 400 }
    );
  }
}
