export interface WorkspaceThemePalette {
  primaryColor: string;
  hoverColor: string;
  lightColor: string;
  borderColor: string;
  textColor: string;
}

export interface SecondaryThemePalette {
  sidebarBg: string;
  sidebarBorder: string;
  sidebarHover: string;
  sidebarSurface: string;
  sidebarText: string;
  sidebarTextHover: string;
  sidebarMuted: string;
  isDark: boolean;
}

export const THEME_PRESETS: Array<{ name: string } & WorkspaceThemePalette> = [
  {
    name: 'Sterling Green',
    primaryColor: '#78B338',
    hoverColor: '#689F2E',
    lightColor: '#F2F8EA',
    borderColor: '#D6EDBC',
    textColor: '#3F6E15',
  },
  {
    name: 'Executive Blue',
    primaryColor: '#2563EB',
    hoverColor: '#1D4ED8',
    lightColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    textColor: '#1E40AF',
  },
  {
    name: 'Indigo Slate',
    primaryColor: '#4F46E5',
    hoverColor: '#4338CA',
    lightColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    textColor: '#3730A3',
  },
  {
    name: 'Emerald Corporate',
    primaryColor: '#059669',
    hoverColor: '#047857',
    lightColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    textColor: '#065F46',
  },
  {
    name: 'Teal Precision',
    primaryColor: '#0D9488',
    hoverColor: '#0F766E',
    lightColor: '#F0FDFA',
    borderColor: '#99F6E4',
    textColor: '#115E59',
  },
  {
    name: 'Crimson Enterprise',
    primaryColor: '#DC2626',
    hoverColor: '#B91C1C',
    lightColor: '#FEF2F2',
    borderColor: '#FECACA',
    textColor: '#991B1B',
  },
  {
    name: 'Amber Gold',
    primaryColor: '#D97706',
    hoverColor: '#B45309',
    lightColor: '#FFFBEB',
    borderColor: '#FDE68A',
    textColor: '#92400E',
  },
  {
    name: 'Charcoal Monochrome',
    primaryColor: '#334155',
    hoverColor: '#1E293B',
    lightColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    textColor: '#0F172A',
  },
];

export const SECONDARY_THEME_PRESETS: Array<{ name: string; color: string }> = [
  { name: 'Obsidian Charcoal', color: '#221E1E' },
  { name: 'Midnight Navy', color: '#0F172A' },
  { name: 'Deep Indigo', color: '#1E1B4B' },
  { name: 'Forest Pine', color: '#132A1B' },
  { name: 'Graphite Zinc', color: '#18181B' },
  { name: 'Burgundy Dark', color: '#2C1219' },
  { name: 'Clean White', color: '#FFFFFF' },
  { name: 'Cool Mist', color: '#F1F5F9' },
];

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function mixWithWhite(rgb: { r: number; g: number; b: number }, ratio: number): string {
  return toHex(
    rgb.r + (255 - rgb.r) * ratio,
    rgb.g + (255 - rgb.g) * ratio,
    rgb.b + (255 - rgb.b) * ratio
  );
}

function darken(rgb: { r: number; g: number; b: number }, ratio: number): string {
  return toHex(rgb.r * (1 - ratio), rgb.g * (1 - ratio), rgb.b * (1 - ratio));
}

/**
 * Generates a cohesive 5-token primary palette from any hex color.
 */
export function deriveThemePalette(primaryHex: string): WorkspaceThemePalette {
  const normalized = primaryHex.trim().toUpperCase();
  const matchedPreset = THEME_PRESETS.find((p) => p.primaryColor.toUpperCase() === normalized);
  if (matchedPreset) {
    return {
      primaryColor: matchedPreset.primaryColor,
      hoverColor: matchedPreset.hoverColor,
      lightColor: matchedPreset.lightColor,
      borderColor: matchedPreset.borderColor,
      textColor: matchedPreset.textColor,
    };
  }

  const rgb = parseHex(normalized);
  if (!rgb) {
    return {
      primaryColor: '#78B338',
      hoverColor: '#689F2E',
      lightColor: '#F2F8EA',
      borderColor: '#D6EDBC',
      textColor: '#3F6E15',
    };
  }

  return {
    primaryColor: normalized.startsWith('#') ? normalized : `#${normalized}`,
    hoverColor: darken(rgb, 0.14),
    lightColor: mixWithWhite(rgb, 0.9),
    borderColor: mixWithWhite(rgb, 0.68),
    textColor: darken(rgb, 0.35),
  };
}

/**
 * Generates contrast-aware sidebar & shell surface tokens from any secondary hex color.
 * Automatically switches text & borders cleanly for both dark and white/light sidebars.
 */
export function deriveSecondaryPalette(secondaryHex?: string | null): SecondaryThemePalette {
  const normalized = (secondaryHex || '#221E1E').trim().toUpperCase();
  if (normalized === '#221E1E') {
    return {
      sidebarBg: '#221E1E',
      sidebarBorder: '#332D2D',
      sidebarHover: '#342F2F',
      sidebarSurface: '#2C2727',
      sidebarText: '#D6D3D1',
      sidebarTextHover: '#FFFFFF',
      sidebarMuted: '#A8A29E',
      isDark: true,
    };
  }

  const rgb = parseHex(normalized);
  if (!rgb) {
    return deriveSecondaryPalette('#221E1E');
  }

  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  const isDark = luminance < 145;

  if (isDark) {
    return {
      sidebarBg: normalized.startsWith('#') ? normalized : `#${normalized}`,
      sidebarBorder: mixWithWhite(rgb, 0.1),
      sidebarHover: mixWithWhite(rgb, 0.12),
      sidebarSurface: mixWithWhite(rgb, 0.06),
      sidebarText: '#E2E8F0',
      sidebarTextHover: '#FFFFFF',
      sidebarMuted: '#94A3B8',
      isDark: true,
    };
  }

  // Light / White sidebar
  return {
    sidebarBg: normalized.startsWith('#') ? normalized : `#${normalized}`,
    sidebarBorder: darken(rgb, 0.11),
    sidebarHover: darken(rgb, 0.06),
    sidebarSurface: darken(rgb, 0.04),
    sidebarText: '#334155',
    sidebarTextHover: '#0F172A',
    sidebarMuted: '#64748B',
    isDark: false,
  };
}

export function buildMonogramFaviconSvg(name: string, bgHex: string = '#2563EB'): string {
  const initials =
    (name || 'HR')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HR';

  const safeColor = /^#[0-9a-fA-F]{6}$/.test(bgHex.trim()) ? bgHex.trim() : '#2563EB';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${safeColor}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="26" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function slugifyWorkspaceName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
