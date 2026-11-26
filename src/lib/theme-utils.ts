export interface WorkspaceThemePalette {
  primaryColor: string;
  hoverColor: string;
  lightColor: string;
  borderColor: string;
  textColor: string;
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
 * Generates a cohesive 5-token palette from any primary hex color.
 * Preserves exact hand-tuned tokens for known presets.
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

export function slugifyWorkspaceName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
