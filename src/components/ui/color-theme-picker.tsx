'use client';

import React from 'react';
import { Check, Palette, PanelLeft } from 'lucide-react';
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

  const activePrimaryPreset = THEME_PRESETS.find(
    (p) => p.primaryColor.toUpperCase() === primaryColor.toUpperCase()
  );
  const activeSecondaryPreset = SECONDARY_THEME_PRESETS.find(
    (p) => p.color.toUpperCase() === secondaryColor.toUpperCase()
  );

  return (
    <div className="space-y-3.5">
      {/* Sleek Live Portal App Window Preview */}
      <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-xs">
        {/* Browser / Desktop Window Top Bar */}
        <div className="h-7 px-3 bg-slate-50/90 border-b border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3.5 h-3.5 rounded bg-white border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
              {iconUrl || logoUrl ? (
                <img
                  src={iconUrl || logoUrl || ''}
                  alt=""
                  className="w-full h-full object-contain"
                />
              ) : (
                <span
                  className="w-full h-full flex items-center justify-center text-[7px] font-bold text-white"
                  style={{ backgroundColor: primaryPalette.primaryColor }}
                >
                  {initials}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium text-slate-600 truncate">
              {companyName} — Payslip Portal
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
        </div>

        {/* Mini Workspace Frame */}
        <div className="flex h-36 bg-slate-50/40">
          {/* Mini Sidebar */}
          <div
            className="w-36 p-2.5 flex flex-col justify-between shrink-0 border-r transition-colors"
            style={{
              backgroundColor: secondaryPalette.sidebarBg,
              borderColor: secondaryPalette.sidebarBorder,
            }}
          >
            <div className="bg-white rounded-md px-2 py-1 flex items-center justify-center h-7 border border-black/10 overflow-hidden shadow-2xs">
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
                className="px-2 py-1 rounded-md text-[10px] font-semibold text-white truncate shadow-2xs"
                style={{ backgroundColor: primaryPalette.primaryColor }}
              >
                Employees
              </div>
              <div
                className="px-2 py-0.5 rounded text-[10px] truncate"
                style={{ color: secondaryPalette.sidebarText }}
              >
                Payslips
              </div>
              <div
                className="px-2 py-0.5 rounded text-[10px] truncate"
                style={{ color: secondaryPalette.sidebarText }}
              >
                Settings
              </div>
            </div>
          </div>

          {/* Mini Content Area */}
          <div className="flex-1 p-3.5 bg-white flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{companyName}</div>
                <div className="text-[10px] text-slate-400">HR Payroll Workspace</div>
              </div>
              <span
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: primaryPalette.primaryColor }}
              >
                Send Payslips
              </span>
            </div>

            {/* Skeleton Metrics & Status */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 space-y-1.5">
                <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="h-2.5 w-8 rounded bg-slate-300/80" />
              </div>
              <div
                className="rounded-lg border p-2 flex flex-col justify-between"
                style={{
                  backgroundColor: primaryPalette.lightColor,
                  borderColor: primaryPalette.borderColor,
                }}
              >
                <span
                  className="text-[9px] font-semibold"
                  style={{ color: primaryPalette.textColor }}
                >
                  Active Theme
                </span>
                <span
                  className="text-[10px] font-bold font-mono uppercase"
                  style={{ color: primaryPalette.textColor }}
                >
                  {primaryColor}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Brand Accent Swatches */}
      <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Palette className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Brand Accent</span>
            <span className="text-[11px] text-slate-400 truncate">
              · {activePrimaryPreset ? activePrimaryPreset.name : 'Custom'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/70">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="w-4 h-4 rounded-sm cursor-pointer border-0 bg-transparent p-0"
              aria-label="Pick primary accent color"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => onPrimaryChange(e.target.value)}
              className="w-16 text-[11px] font-mono bg-transparent text-slate-700 focus:outline-hidden uppercase"
              aria-label="Primary hex color"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {THEME_PRESETS.map((preset) => {
            const selected = primaryColor.toUpperCase() === preset.primaryColor.toUpperCase();
            return (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                onClick={() => onPrimaryChange(preset.primaryColor)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border border-black/10 ${
                  selected
                    ? 'ring-2 ring-offset-2 ring-slate-900 scale-105'
                    : 'hover:scale-110 opacity-90 hover:opacity-100'
                }`}
                style={{ backgroundColor: preset.primaryColor }}
              >
                {selected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Surface Swatches */}
      <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <PanelLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Sidebar Surface</span>
            <span className="text-[11px] text-slate-400 truncate">
              · {activeSecondaryPreset ? activeSecondaryPreset.name : 'Custom'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/70">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => onSecondaryChange(e.target.value)}
              className="w-4 h-4 rounded-sm cursor-pointer border-0 bg-transparent p-0"
              aria-label="Pick sidebar background color"
            />
            <input
              type="text"
              value={secondaryColor}
              onChange={(e) => onSecondaryChange(e.target.value)}
              className="w-16 text-[11px] font-mono bg-transparent text-slate-700 focus:outline-hidden uppercase"
              aria-label="Secondary hex color"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {SECONDARY_THEME_PRESETS.map((preset) => {
            const selected = secondaryColor.toUpperCase() === preset.color.toUpperCase();
            const isDark = deriveSecondaryPalette(preset.color).isDark;
            return (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                onClick={() => onSecondaryChange(preset.color)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  isDark ? 'border-black/15' : 'border-slate-300'
                } ${
                  selected
                    ? 'ring-2 ring-offset-2 ring-slate-900 scale-105'
                    : 'hover:scale-110 opacity-90 hover:opacity-100'
                }`}
                style={{ backgroundColor: preset.color }}
              >
                {selected && (
                  <Check
                    className={`w-3.5 h-3.5 stroke-[2.5] ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
