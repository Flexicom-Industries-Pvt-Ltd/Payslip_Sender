import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceBySlug, ensureDefaultWorkspace } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slugParam = searchParams.get('workspace')?.trim() || searchParams.get('slug')?.trim();

    let ws = slugParam ? await getWorkspaceBySlug(slugParam) : null;
    if (!ws && slugParam === 'sterling-distillers') {
      ws = await ensureDefaultWorkspace();
    }

    const activeSlug = ws?.slug || slugParam || '';
    const appName = ws
      ? `${ws.name} — Payslip Portal`
      : 'Enterprise Payslip Distribution Portal';
    const shortName = ws?.name ? ws.name.slice(0, 24) : 'Payslip Portal';
    const startUrl = activeSlug
      ? `/login?workspace=${encodeURIComponent(activeSlug)}`
      : '/login';
    const themeColor = ws?.primaryColor || '#0F172A';
    const iconQuery = activeSlug
      ? `slug=${encodeURIComponent(activeSlug)}&png=true`
      : 'png=true';

    const manifest = {
      id: activeSlug ? `/?workspace=${encodeURIComponent(activeSlug)}` : '/',
      name: appName,
      short_name: shortName,
      description: ws
        ? `Confidential Employee Payslip Distribution Portal for ${ws.legalName || ws.name}`
        : 'Multi-Tenant Enterprise HR Payslip Distribution Portal',
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#FFFFFF',
      theme_color: themeColor,
      icons: [
        {
          src: `/api/workspaces/icon?${iconQuery}&size=192`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/workspaces/icon?${iconQuery}&size=512`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
      ],
    };

    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json(
      {
        name: 'Payslip Dispatch Portal',
        short_name: 'Payslip Portal',
        start_url: '/login',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#0F172A',
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
      }
    );
  }
}
