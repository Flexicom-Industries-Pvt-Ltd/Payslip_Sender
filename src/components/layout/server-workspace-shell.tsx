import React from 'react';
import { getAuthSession } from '@/lib/auth';
import {
  getWorkspaceById,
  getWorkspacesWithStats,
  toPublicWorkspaceBranding,
} from '@/lib/db-store';
import { buildWorkspaceCssText } from '@/lib/theme-utils';
import {
  WorkspaceProvider,
  type WorkspaceBranding,
  type WorkspaceSummary,
} from './workspace-context';

export async function ServerWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialWorkspace: WorkspaceBranding | null = null;
  let initialRole: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | null = null;
  let initialAvailableWorkspaces: WorkspaceSummary[] = [];

  try {
    const session = await getAuthSession();
    if (session) {
      initialRole = session.role;
      const ws = await getWorkspaceById(session.workspaceId);
      if (ws) {
        initialWorkspace = toPublicWorkspaceBranding(ws);
      }
      if (session.role === 'SUPER_ADMIN') {
        const all = await getWorkspacesWithStats();
        initialAvailableWorkspaces = all.map((w) => ({
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
    }
  } catch {
    // Fallback cleanly to neutral context if DB unavailable during build
  }

  return (
    <>
      {initialWorkspace && (
        <style
          id="workspace-ssr-theme"
          dangerouslySetInnerHTML={{ __html: buildWorkspaceCssText(initialWorkspace) }}
        />
      )}
      <WorkspaceProvider
        initialWorkspace={initialWorkspace}
        initialRole={initialRole}
        initialAvailableWorkspaces={initialAvailableWorkspaces}
      >
        {children}
      </WorkspaceProvider>
    </>
  );
}
