import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  createWorkspace,
  getWorkspacesWithStats,
  toPublicWorkspaceBranding,
} from '@/lib/db-store';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required.' },
        { status: 403 }
      );
    }

    const workspaces = await getWorkspacesWithStats();
    return NextResponse.json({
      success: true,
      workspaces,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const created = await createWorkspace({
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
    });

    return NextResponse.json(
      {
        success: true,
        workspace: {
          ...toPublicWorkspaceBranding(created),
          passcode: created.passcode,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create workspace' },
      { status: 400 }
    );
  }
}
