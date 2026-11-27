import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  deletePayslipTemplate,
  getPayslipTemplateById,
  getWorkspaceById,
  updatePayslipTemplate,
} from '@/lib/db-store';
import { parseWorkspacePermissions } from '@/lib/workspace-permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getPayslipTemplateById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // Master templates & other companies' templates require SUPER_ADMIN
    if (existing.workspaceId === null) {
      if (session.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Only Top Group Admin can edit master templates.' },
          { status: 403 }
        );
      }
    } else {
      if (existing.workspaceId !== session.workspaceId && session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      if (session.role !== 'SUPER_ADMIN') {
        const ws = await getWorkspaceById(existing.workspaceId);
        const perms = parseWorkspacePermissions(ws?.permissionsJson);
        if (!perms.allowTemplateDesigner) {
          return NextResponse.json(
            {
              success: false,
              error: 'Template editing is restricted by Top Group Admin for this workspace.',
            },
            { status: 403 }
          );
        }
      }
    }

    const body = await request.json();
    const updated = await updatePayslipTemplate(id, {
      name: body.name,
      description: body.description,
      presetStyle: body.presetStyle,
      config: body.config,
      isDefault: body.isDefault,
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update template' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getPayslipTemplateById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    if (existing.workspaceId === null) {
      if (session.role !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Only Top Group Admin can delete master templates.' },
          { status: 403 }
        );
      }
    } else {
      if (existing.workspaceId !== session.workspaceId && session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      if (session.role !== 'SUPER_ADMIN') {
        const ws = await getWorkspaceById(existing.workspaceId);
        const perms = parseWorkspacePermissions(ws?.permissionsJson);
        if (!perms.allowTemplateDesigner) {
          return NextResponse.json(
            { success: false, error: 'Template deletion restricted by Top Group Admin.' },
            { status: 403 }
          );
        }
      }
    }

    await deletePayslipTemplate(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete template' },
      { status: 400 }
    );
  }
}
