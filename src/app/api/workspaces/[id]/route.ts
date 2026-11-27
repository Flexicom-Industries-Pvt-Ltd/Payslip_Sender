import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, setAuthSession } from '@/lib/auth';
import {
  deleteWorkspace,
  toPublicWorkspaceBranding,
  updateWorkspace,
} from '@/lib/db-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Top Group Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const updated = await updateWorkspace(id, {
      name: body.name,
      slug: body.slug,
      legalName: body.legalName,
      tagline: body.tagline,
      passcode: body.passcode,
      logoUrl: body.logoUrl,
      iconUrl: body.iconUrl,
      heroImageUrl: body.heroImageUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      defaultSubject: body.defaultSubject,
      defaultBody: body.defaultBody,
      permissions: body.permissions,
      isActive: body.isActive,
    });

    return NextResponse.json({
      success: true,
      workspace: {
        ...toPublicWorkspaceBranding(updated),
        passcode: updated.passcode,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update workspace' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Top Group Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    await deleteWorkspace(id);

    if (session.workspaceId === id) {
      await setAuthSession({
        role: 'SUPER_ADMIN',
        workspaceId: null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete workspace' },
      { status: 400 }
    );
  }
}
