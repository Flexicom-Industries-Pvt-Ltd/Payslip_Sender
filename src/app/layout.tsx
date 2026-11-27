import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ServerWorkspaceShell } from '@/components/layout/server-workspace-shell';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const NEUTRAL_DEFAULT_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0F172A"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="24" font-weight="700">HR</text></svg>'
  );

export const metadata: Metadata = {
  title: 'Employee Payslip Distribution Portal',
  description:
    'Multi-Tenant Enterprise HR Payslip & Salary Slip Distribution System.',
  icons: {
    icon: [{ url: NEUTRAL_DEFAULT_ICON, type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
          <ServerWorkspaceShell>{children}</ServerWorkspaceShell>
        </Suspense>
      </body>
    </html>
  );
}
