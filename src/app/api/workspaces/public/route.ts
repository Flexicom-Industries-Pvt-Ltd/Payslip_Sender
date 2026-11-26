import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceBySlug, toPublicWorkspaceBranding } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug')?.trim();

    if (!slug) {
      return NextResponse.json({
        success: true,
        workspace: null,
      });
    }

    const ws = await getWorkspaceBySlug(slug);
    if (!ws || !ws.isActive) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found or inactive' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: toPublicWorkspaceBranding(ws),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load workspace branding' },
      { status: 500 }
    );
  }
}
