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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface WorkspaceContextValue {
  workspace: WorkspaceBranding;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | null;
  availableWorkspaces: WorkspaceSummary[];
  loading: boolean;
  switching: boolean;
  isInstalledApp: boolean;
  canOneClickInstall: boolean;
  triggerPwaInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  refreshWorkspace: () => Promise<void>;
  switchWorkspace: (workspaceId: string | null) => Promise<void>;
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
  primaryColor: '#0F172A',
  secondaryColor: '#FFFFFF',
  hoverColor: '#1E293B',
  lightColor: '#F1F5F9',
  borderColor: '#CBD5E1',
  textColor: '#0F172A',
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
  isInstalledApp: false,
  canOneClickInstall: false,
  triggerPwaInstall: async () => 'unavailable',
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
  const primaryPalette = deriveThemePalette(ws.primaryColor || '#0F172A');
  const secondaryPalette = deriveSecondaryPalette(ws.secondaryColor || '#FFFFFF');

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
 * Updates favicon/icon links in <head> in-place WITHOUT calling .remove() on React-managed metadata nodes,
 * preventing React 19 head reconciliation crashes (removeChild of null) during SPA route transitions.
 */
export function applyFaviconToDocument(iconHref: string) {
  if (typeof document === 'undefined' || !iconHref) return;

  const isSvg = iconHref.startsWith('data:image/svg+xml') || iconHref.endsWith('.svg');

  for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon']) {
    const existing = document.head.querySelectorAll(`link[rel='${rel}']`);
    if (existing.length > 0) {
      existing.forEach((node) => {
        if (node.getAttribute('href') !== iconHref) {
          node.setAttribute('href', iconHref);
        }
        if (isSvg) {
          node.setAttribute('type', 'image/svg+xml');
        } else {
          node.removeAttribute('type');
        }
      });
    } else {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = iconHref;
      if (isSvg) {
        link.type = 'image/svg+xml';
      }
      link.setAttribute('data-workspace-favicon', 'true');
      document.head.appendChild(link);
    }
  }
}

/**
 * Dynamically binds the active company's Web App Manifest so Chrome/Edge installs a dedicated Desktop App
 * with that company's own name, logo, and login URL.
 */
export function applyManifestToDocument(workspaceSlug?: string | null) {
  if (typeof document === 'undefined') return;

  const manifestUrl = workspaceSlug
    ? `/api/manifest?workspace=${encodeURIComponent(workspaceSlug)}`
    : '/api/manifest';

  let link: HTMLLinkElement | null = document.head.querySelector("link[rel='manifest']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== manifestUrl) {
    link.href = manifestUrl;
  }
}

interface WorkspaceProviderProps {
  children: React.ReactNode;
  initialWorkspace?: WorkspaceBranding | null;
  initialRole?: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | null;
  initialAvailableWorkspaces?: WorkspaceSummary[];
}

export function WorkspaceProvider({
  children,
  initialWorkspace = null,
  initialRole = null,
  initialAvailableWorkspaces = [],
}: WorkspaceProviderProps) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceBranding>(
    initialWorkspace || NEUTRAL_INITIAL_WORKSPACE
  );
  const [role, setRole] = useState<'SUPER_ADMIN' | 'COMPANY_ADMIN' | null>(initialRole);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceSummary[]>(
    initialAvailableWorkspaces
  );
  const [loading, setLoading] = useState(!initialWorkspace);
  const [switching, setSwitching] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(false);

  const applyBrandingToDocument = useCallback((ws: WorkspaceBranding) => {
    applyWorkspaceCssTheme(ws);
    if (typeof document !== 'undefined') {
      document.title = `${ws.name} | Employee Payslip Distribution System`;
      const resolvedIcon =
        ws.iconUrl || ws.logoUrl || buildMonogramFaviconSvg(ws.name, ws.primaryColor);
      applyFaviconToDocument(resolvedIcon);
      applyManifestToDocument(ws.slug);
    }
  }, []);

  // Keep client state synced with updated SSR props (e.g. right after login or router.refresh())
  useEffect(() => {
    if (initialWorkspace) {
      setWorkspace(initialWorkspace);
      setRole(initialRole);
      setAvailableWorkspaces(initialAvailableWorkspaces);
      setLoading(false);
      if (!pathname?.startsWith('/login') && !pathname?.startsWith('/admin')) {
        applyBrandingToDocument(initialWorkspace);
      }
    }
  }, [initialWorkspace, initialRole, initialAvailableWorkspaces, pathname, applyBrandingToDocument]);

  // Register lightweight Service Worker + capture browser install prompt + standalone detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const checkStandalone = () => {
      const standaloneMedia =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches;
      const iosStandalone = Boolean((window.navigator as any).standalone);
      setIsInstalledApp(standaloneMedia || iosStandalone);
    };
    checkStandalone();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalledApp(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerPwaInstall = useCallback(async (): Promise<
    'accepted' | 'dismissed' | 'unavailable'
  > => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstalledApp(true);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  const refreshWorkspace = useCallback(async () => {
    if (pathname?.startsWith('/login') || pathname?.startsWith('/admin/login')) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/workspaces/current', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        if (data.workspace) setWorkspace(data.workspace);
        setRole(data.role || null);
        if (Array.isArray(data.availableWorkspaces)) {
          setAvailableWorkspaces(data.availableWorkspaces);
        }
        if (data.workspace && !pathname?.startsWith('/admin')) {
          applyBrandingToDocument(data.workspace);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pathname, applyBrandingToDocument]);

  useEffect(() => {
    if (!initialWorkspace && !pathname?.startsWith('/login') && !pathname?.startsWith('/admin/login')) {
      refreshWorkspace();
    }
  }, [initialWorkspace, pathname, refreshWorkspace]);

  const switchWorkspace = useCallback(
    async (workspaceId: string | null) => {
      if (workspaceId && workspaceId === workspace.id && !pathname?.startsWith('/admin')) return;
      try {
        setSwitching(true);
        const res = await fetch('/api/workspaces/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        });
        const data = await res.json();
        if (data.success) {
          if (data.workspace) {
            setWorkspace(data.workspace);
            applyBrandingToDocument(data.workspace);
            window.location.assign('/employees');
          } else {
            window.location.assign('/admin/workspaces');
          }
        } else {
          setSwitching(false);
        }
      } catch {
        setSwitching(false);
      }
    },
    [workspace.id, pathname, applyBrandingToDocument]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        role,
        availableWorkspaces,
        loading,
        switching,
        isInstalledApp,
        canOneClickInstall: Boolean(deferredPrompt),
        triggerPwaInstall,
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
