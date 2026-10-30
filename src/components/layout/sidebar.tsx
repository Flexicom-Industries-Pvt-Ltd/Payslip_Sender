'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Send,
  MailCheck,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
  },
  {
    name: 'Payslip Distribution',
    href: '/payslips',
    icon: Send,
  },
  {
    name: 'Email Composer',
    href: '/composer',
    icon: MailCheck,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#221E1E] text-stone-300 flex flex-col shrink-0 border-r border-[#332D2D] select-none">
      {/* Brand Header */}
      <div className="h-20 flex items-center px-4 border-b border-[#332D2D]">
        <div className="w-full bg-white rounded-lg px-2.5 py-1.5 flex items-center justify-center shadow-xs">
          <img
            src="/sterling-logo.jpg"
            alt="Sterling Distillers Private Limited"
            className="h-9 w-auto max-w-full object-contain"
          />
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          HR Operations
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#78B338] text-white shadow-xs font-semibold'
                  : 'text-stone-300 hover:text-white hover:bg-[#342F2F]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-stone-400'
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

