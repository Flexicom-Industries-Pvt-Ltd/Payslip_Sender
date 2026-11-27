import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  getWorkspaceById,
  getWorkspacesWithStats,
  toPublicWorkspaceBranding,
  updateWorkspace,
} from '@/lib/db-store';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let workspaceBranding = null;
    if (session.workspaceId) {
      const workspace = await getWorkspaceById(session.workspaceId);
      if (workspace) {
        workspaceBranding = toPublicWorkspaceBranding(workspace);
      }
    }

    let availableWorkspaces = undefined;
    if (session.role === 'SUPER_ADMIN') {
      const all = await getWorkspacesWithStats();
      availableWorkspaces = all.map((w) => ({
        id: w.id,
        slug: w.slug,
        name: w.name,
        primaryColor: w.primaryColor,
        secondaryColor: w.secondaryColor,
        iconUrl: w.iconUrl,
        logoUrl: w.logoUrl,
        isActive: w.isActive,
      }));
    }

    return NextResponse.json({
      success: true,
      role: session.role,
      workspace: workspaceBranding,
      availableWorkspaces,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load active workspace' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (session.role !== 'SUPER_ADMIN') {
      const updated = await updateWorkspace(session.workspaceId, {
        defaultSubject: body.defaultSubject,
        defaultBody: body.defaultBody,
      });

      return NextResponse.json({
        success: true,
        workspace: toPublicWorkspaceBranding(updated),
      });
    }

    const updated = await updateWorkspace(session.workspaceId, {
      name: body.name,
      legalName: body.legalName,
      tagline: body.tagline,
      logoUrl: body.logoUrl,
      iconUrl: body.iconUrl,
      heroImageUrl: body.heroImageUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      defaultSubject: body.defaultSubject,
      defaultBody: body.defaultBody,
      ...(body.passcode ? { passcode: body.passcode } : {}),
    });

    return NextResponse.json({
      success: true,
      workspace: toPublicWorkspaceBranding(updated),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update workspace settings' },
      { status: 400 }
    );
  }
}
