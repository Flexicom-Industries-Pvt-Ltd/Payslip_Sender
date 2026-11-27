import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getWorkspaceBySlug, toPublicWorkspaceBranding } from '@/lib/db-store';
import { buildWorkspaceCssText } from '@/lib/theme-utils';
import { LoginClient } from './login-client';
import type { WorkspaceBranding } from '@/components/layout/workspace-context';

async function ServerLoginLoader({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; w?: string }>;
}) {
  const params = await searchParams;
  const slug = (params.workspace || params.w || '').trim();
  let initialBrandedWorkspace: WorkspaceBranding | null = null;

  if (slug) {
    try {
      const ws = await getWorkspaceBySlug(slug);
      if (ws && ws.isActive) {
        initialBrandedWorkspace = toPublicWorkspaceBranding(ws);
      }
    } catch {
      // Fallback cleanly to neutral login if DB unreachable
    }
  }

  return (
    <>
      {initialBrandedWorkspace && (
        <style
          id="login-ssr-theme"
          dangerouslySetInnerHTML={{ __html: buildWorkspaceCssText(initialBrandedWorkspace) }}
        />
      )}
      <LoginClient
        initialSlug={slug}
        initialBrandedWorkspace={initialBrandedWorkspace}
      />
    </>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; w?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <ServerLoginLoader searchParams={searchParams} />
    </Suspense>
  );
}
