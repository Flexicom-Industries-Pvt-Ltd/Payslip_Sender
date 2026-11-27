'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_EMAIL_SUBJECT, buildDefaultEmailBody } from '@/lib/email-templates';
import {
  buildMonogramFaviconSvg,
  deriveSecondaryPalette,
  deriveThemePalette,
} from '@/lib/theme-utils';

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
  secondaryColor: string;
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
  secondaryColor?: string;
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

const NEUTRAL_INITIAL_WORKSPACE: WorkspaceBranding = {
  id: '',
  slug: 'company',
  name: 'HR Portal',
  legalName: 'Enterprise Payroll Portal',
  tagline: null,
  logoUrl: null,
  iconUrl: null,
  heroImageUrl: null,
  primaryColor: '#78B338',
  secondaryColor: '#221E1E',
  hoverColor: '#689F2E',
  lightColor: '#F2F8EA',
  borderColor: '#D6EDBC',
  textColor: '#3F6E15',
  defaultSubject: DEFAULT_EMAIL_SUBJECT,
  defaultBody: buildDefaultEmailBody('Human Resources Department'),
  isActive: true,
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: NEUTRAL_INITIAL_WORKSPACE,
  role: null,
  availableWorkspaces: [],
  loading: true,
  switching: false,
  refreshWorkspace: async () => {},
  switchWorkspace: async () => {},
});

export function applyWorkspaceCssTheme(
  ws: Partial<
    Pick<
      WorkspaceBranding,
      'primaryColor' | 'secondaryColor' | 'hoverColor' | 'lightColor' | 'borderColor' | 'textColor'
    >
  >
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  const primaryPalette = deriveThemePalette(ws.primaryColor || '#78B338');
  const secondaryPalette = deriveSecondaryPalette(ws.secondaryColor || '#221E1E');

  root.setProperty('--brand-primary', ws.primaryColor || primaryPalette.primaryColor);
  root.setProperty('--brand-hover', ws.hoverColor || primaryPalette.hoverColor);
  root.setProperty('--brand-light', ws.lightColor || primaryPalette.lightColor);
  root.setProperty('--brand-border', ws.borderColor || primaryPalette.borderColor);
  root.setProperty('--brand-text', ws.textColor || primaryPalette.textColor);

  root.setProperty('--sidebar-bg', secondaryPalette.sidebarBg);
  root.setProperty('--sidebar-border', secondaryPalette.sidebarBorder);
  root.setProperty('--sidebar-hover', secondaryPalette.sidebarHover);
  root.setProperty('--sidebar-surface', secondaryPalette.sidebarSurface);
  root.setProperty('--sidebar-text', secondaryPalette.sidebarText);
  root.setProperty('--sidebar-text-hover', secondaryPalette.sidebarTextHover);
  root.setProperty('--sidebar-muted', secondaryPalette.sidebarMuted);
}

/**
 * Replaces ALL existing favicon/icon links in <head> so static default icons never override the active company's tab icon.
 */
export function applyFaviconToDocument(iconHref: string) {
  if (typeof document === 'undefined' || !iconHref) return;

  const existing = document.head.querySelectorAll(
    "link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
  );
  existing.forEach((node) => node.remove());

  for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon']) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = iconHref;
    document.head.appendChild(link);
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceBranding>(NEUTRAL_INITIAL_WORKSPACE);
  const [role, setRole] = useState<'SUPER_ADMIN' | 'COMPANY_ADMIN' | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const applyBrandingToDocument = useCallback((ws: WorkspaceBranding) => {
    applyWorkspaceCssTheme(ws);
    if (typeof document !== 'undefined') {
      document.title = `${ws.name} | Employee Payslip Distribution System`;
      const resolvedIcon =
        ws.iconUrl || ws.logoUrl || buildMonogramFaviconSvg(ws.name, ws.primaryColor);
      applyFaviconToDocument(resolvedIcon);
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
