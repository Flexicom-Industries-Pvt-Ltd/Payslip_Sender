import { NextRequest, NextResponse } from 'next/server';
import { setAuthSession, verifySuperAdminPasscode } from '@/lib/auth';
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

    // 1. Dedicated Super Admin sign-in (/admin/login only)
    // Starts in clean Platform Admin mode (workspaceId: null) until a workspace is explicitly opened
    if (mode === 'super_admin') {
      if (!verifySuperAdminPasscode(trimmedPasscode)) {
        return NextResponse.json(
          { success: false, error: 'Invalid Top Group Admin passcode.' },
          { status: 401 }
        );
      }

      await ensureDefaultWorkspace();
      await setAuthSession({
        role: 'SUPER_ADMIN',
        workspaceId: null,
      });

      return NextResponse.json({
        success: true,
        role: 'SUPER_ADMIN',
        workspace: null,
      });
    }

    // 2. Company Workspace sign-in (/login or /login?workspace=<slug>)
    const cleanSlug = (workspaceSlug || '').trim().toLowerCase();
    if (!cleanSlug) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter your Company Workspace Code.',
        },
        { status: 400 }
      );
    }

    const ws = await getWorkspaceBySlug(cleanSlug);
    if (!ws || !ws.isActive) {
      return NextResponse.json(
        { success: false, error: 'Company workspace not found or inactive.' },
        { status: 404 }
      );
    }

    if (ws.passcode !== trimmedPasscode) {
      return NextResponse.json(
        { success: false, error: 'Invalid workspace passcode.' },
        { status: 401 }
      );
    }

    await setAuthSession({
      role: 'COMPANY_ADMIN',
      workspaceId: ws.id,
    });

    return NextResponse.json({
      success: true,
      role: 'COMPANY_ADMIN',
      workspace: toPublicWorkspaceBranding(ws),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
