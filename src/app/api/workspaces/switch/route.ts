import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, setAuthSession } from '@/lib/auth';
import { getWorkspaceById, toPublicWorkspaceBranding } from '@/lib/db-store';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only platform Super Admin can switch workspaces.' },
        { status: 403 }
      );
    }

    const { workspaceId } = await request.json();

    // Allow clearing active workspace to return cleanly to Platform Super Admin Console
    if (!workspaceId) {
      await setAuthSession({
        role: 'SUPER_ADMIN',
        workspaceId: null,
      });
      return NextResponse.json({
        success: true,
        workspace: null,
      });
    }

    const target = await getWorkspaceById(workspaceId);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    await setAuthSession({
      role: 'SUPER_ADMIN',
      workspaceId: target.id,
    });

    return NextResponse.json({
      success: true,
      workspace: toPublicWorkspaceBranding(target),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to switch workspace' },
      { status: 500 }
    );
  }
}
