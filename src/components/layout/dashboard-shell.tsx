import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Footer } from './footer';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-6">{children}</div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
