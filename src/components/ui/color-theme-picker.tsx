'use client';

import React from 'react';
import { Palette, Sidebar as SidebarIcon } from 'lucide-react';
import {
  THEME_PRESETS,
  SECONDARY_THEME_PRESETS,
  deriveThemePalette,
  deriveSecondaryPalette,
} from '@/lib/theme-utils';

interface ColorThemePickerProps {
  primaryColor: string;
  secondaryColor: string;
  companyName?: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
}

export function ColorThemePicker({
  primaryColor,
  secondaryColor,
  companyName = 'Company Name',
  logoUrl,
  iconUrl,
  onPrimaryChange,
  onSecondaryChange,
}: ColorThemePickerProps) {
  const primaryPalette = deriveThemePalette(primaryColor);
  const secondaryPalette = deriveSecondaryPalette(secondaryColor);

  const initials =
    (companyName || 'CO')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CO';

  return (
    <div className="space-y-4">
      {/* Dual-Color Mini Portal Live Preview */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-2xs">
        <div className="flex h-24">
          {/* Mini Sidebar Preview */}
          <div
            className="w-36 p-2.5 flex flex-col justify-between shrink-0 border-r"
            style={{
              backgroundColor: secondaryPalette.sidebarBg,
              borderColor: secondaryPalette.sidebarBorder,
            }}
          >
            <div className="bg-white rounded-md px-1.5 py-1 flex items-center justify-center h-7 border border-black/10 overflow-hidden">
              {logoUrl || iconUrl ? (
                <img
                  src={logoUrl || iconUrl || ''}
                  alt="Preview Logo"
                  className="h-5 w-auto max-w-full object-contain"
                />
              ) : (
                <span className="text-[10px] font-bold text-slate-900 truncate">
                  {companyName}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div
                className="px-2 py-1 rounded text-[10px] font-bold text-white truncate"
                style={{ backgroundColor: primaryPalette.primaryColor }}
              >
                Employees
              </div>
              <div
                className="px-2 py-0.5 rounded text-[10px] truncate"
                style={{ color: secondaryPalette.sidebarText }}
              >
                Settings
              </div>
            </div>
          </div>

          {/* Mini Content Area Preview */}
          <div className="flex-1 p-3 bg-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                {iconUrl || logoUrl ? (
                  <img
                    src={iconUrl || logoUrl || ''}
                    alt="Tab Icon"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded text-white flex items-center justify-center font-bold text-[10px]"
                    style={{ backgroundColor: primaryPalette.primaryColor }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{companyName}</div>
                <div className="text-[10px] text-slate-500">Live Portal & Browser Tab Icon</div>
              </div>
            </div>

            <span
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white shrink-0 shadow-2xs"
              style={{ backgroundColor: primaryPalette.primaryColor }}
            >
              Primary Button
            </span>
          </div>
        </div>
      </div>

      {/* Primary Color Picker */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-slate-500" />
              <span>Primary Color (Buttons, Active Nav & Accents)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="w-20 px-2 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded-lg uppercase"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {THEME_PRESETS.map((preset) => {
            const selected = primaryColor.toUpperCase() === preset.primaryColor.toUpperCase();
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onPrimaryChange(preset.primaryColor)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  selected
                    ? 'bg-white border-slate-900 text-slate-900 shadow-2xs'
                    : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Color Picker (Sidebar Background) */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <SidebarIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Secondary Color (Sidebar Background Theme)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => onSecondaryChange(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
            />
            <input
              type="text"
              value={secondaryColor}
              onChange={(e) => onSecondaryChange(e.target.value)}
              className="w-20 px-2 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded-lg uppercase"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SECONDARY_THEME_PRESETS.map((preset) => {
            const selected = secondaryColor.toUpperCase() === preset.color.toUpperCase();
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onSecondaryChange(preset.color)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  selected
                    ? 'bg-white border-slate-900 text-slate-900 shadow-2xs'
                    : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/20"
                  style={{ backgroundColor: preset.color }}
                />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
