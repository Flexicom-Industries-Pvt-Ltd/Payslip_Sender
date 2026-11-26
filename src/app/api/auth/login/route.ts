import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_WORKSPACE_ID,
  setAuthSession,
  verifySuperAdminPasscode,
} from '@/lib/auth';
import {
  ensureDefaultWorkspace,
  getWorkspaceBySlug,
  toPublicWorkspaceBranding,
} from '@/lib/db-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passcode, workspaceSlug, mode } = body as {
      passcode?: string;
      workspaceSlug?: string;
      mode?: 'workspace' | 'super_admin';
    };

    const trimmedPasscode = (passcode || '').trim();
    if (!trimmedPasscode) {
      return NextResponse.json(
        { success: false, error: 'Passcode is required.' },
        { status: 400 }
      );
    }

    // 1. Explicit Super Admin sign-in
    if (mode === 'super_admin') {
      if (!verifySuperAdminPasscode(trimmedPasscode)) {
        return NextResponse.json(
          { success: false, error: 'Invalid Platform Super Admin passcode.' },
          { status: 401 }
        );
      }

      const defaultWs = await ensureDefaultWorkspace();
      await setAuthSession({
        role: 'SUPER_ADMIN',
        workspaceId: defaultWs.id,
      });

      return NextResponse.json({
        success: true,
        role: 'SUPER_ADMIN',
        workspace: toPublicWorkspaceBranding(defaultWs),
      });
    }

    // 2. Company Workspace sign-in via slug
    const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
    if (cleanSlug) {
      const ws = await getWorkspaceBySlug(cleanSlug);
      if (!ws || !ws.isActive) {
        return NextResponse.json(
          { success: false, error: 'Workspace not found or inactive.' },
          { status: 404 }
        );
      }

      // Super Admin can also log straight into any workspace with their master passcode
      const isWorkspaceMatch = ws.passcode === trimmedPasscode;
      const isMasterMatch = verifySuperAdminPasscode(trimmedPasscode);

      if (!isWorkspaceMatch && !isMasterMatch) {
        return NextResponse.json(
          { success: false, error: 'Invalid workspace passcode.' },
          { status: 401 }
        );
      }

      const role = isMasterMatch && !isWorkspaceMatch ? 'SUPER_ADMIN' : 'COMPANY_ADMIN';
      await setAuthSession({
        role,
        workspaceId: ws.id,
      });

      return NextResponse.json({
        success: true,
        role,
        workspace: toPublicWorkspaceBranding(ws),
      });
    }

    // 3. Fallback when no workspaceSlug entered: check Super Admin passcode directly
    if (verifySuperAdminPasscode(trimmedPasscode)) {
      const defaultWs = await ensureDefaultWorkspace();
      await setAuthSession({
        role: 'SUPER_ADMIN',
        workspaceId: defaultWs.id || DEFAULT_WORKSPACE_ID,
      });

      return NextResponse.json({
        success: true,
        role: 'SUPER_ADMIN',
        workspace: toPublicWorkspaceBranding(defaultWs),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Please specify your Company Workspace Code and valid passcode.',
      },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
