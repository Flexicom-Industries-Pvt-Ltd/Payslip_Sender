'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_EMAIL_SUBJECT, buildDefaultEmailBody } from '@/lib/email-templates';

export interface WorkspaceBranding {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  hoverColor: string;
  lightColor: string;
  borderColor: string;
  textColor: string;
  defaultSubject: string | null;
  defaultBody: string | null;
  isActive: boolean;
}

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  primaryColor: string;
  iconUrl: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

interface WorkspaceContextValue {
  workspace: WorkspaceBranding;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | null;
  availableWorkspaces: WorkspaceSummary[];
  loading: boolean;
  switching: boolean;
  refreshWorkspace: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const FALLBACK_WORKSPACE: WorkspaceBranding = {
  id: 'ws_sterling',
  slug: 'sterling-distillers',
  name: 'Sterling Distillers',
  legalName: 'Sterling Distillers Private Limited',
  tagline: 'Purba Bardhaman Plant • West Bengal',
  logoUrl: '/sterling-logo.jpg',
  iconUrl: '/sterling-favicon.png',
  heroImageUrl: '/sterling-project-1.jpg',
  primaryColor: '#78B338',
  hoverColor: '#689F2E',
  lightColor: '#F2F8EA',
  borderColor: '#D6EDBC',
  textColor: '#3F6E15',
  defaultSubject: DEFAULT_EMAIL_SUBJECT,
  defaultBody: buildDefaultEmailBody('Sterling Distillers Private Limited'),
  isActive: true,
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: FALLBACK_WORKSPACE,
  role: null,
  availableWorkspaces: [],
  loading: true,
  switching: false,
  refreshWorkspace: async () => {},
  switchWorkspace: async () => {},
});

export function applyWorkspaceCssTheme(
  ws: Pick<
    WorkspaceBranding,
    'primaryColor' | 'hoverColor' | 'lightColor' | 'borderColor' | 'textColor'
  >
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  root.setProperty('--brand-primary', ws.primaryColor || '#78B338');
  root.setProperty('--brand-hover', ws.hoverColor || '#689F2E');
  root.setProperty('--brand-light', ws.lightColor || '#F2F8EA');
  root.setProperty('--brand-border', ws.borderColor || '#D6EDBC');
  root.setProperty('--brand-text', ws.textColor || '#3F6E15');
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceBranding>(FALLBACK_WORKSPACE);
  const [role, setRole] = useState<'SUPER_ADMIN' | 'COMPANY_ADMIN' | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const applyBrandingToDocument = useCallback((ws: WorkspaceBranding) => {
    applyWorkspaceCssTheme(ws);
    if (typeof document !== 'undefined') {
      document.title = `${ws.name} | Employee Payslip Distribution System`;
      const iconHref = ws.iconUrl || ws.logoUrl;
      if (iconHref) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = iconHref;
      }
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (pathname?.startsWith('/login')) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/workspaces/current', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.workspace) {
        setWorkspace(data.workspace);
        setRole(data.role || null);
        if (Array.isArray(data.availableWorkspaces)) {
          setAvailableWorkspaces(data.availableWorkspaces);
        }
        applyBrandingToDocument(data.workspace);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pathname, applyBrandingToDocument]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId || workspaceId === workspace.id) return;
      try {
        setSwitching(true);
        const res = await fetch('/api/workspaces/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        });
        const data = await res.json();
        if (data.success && data.workspace) {
          setWorkspace(data.workspace);
          applyBrandingToDocument(data.workspace);
          window.location.href = '/employees';
        } else {
          setSwitching(false);
        }
      } catch {
        setSwitching(false);
      }
    },
    [workspace.id, applyBrandingToDocument]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        role,
        availableWorkspaces,
        loading,
        switching,
        refreshWorkspace,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
