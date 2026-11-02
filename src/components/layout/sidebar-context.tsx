'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggleSidebar: () => {},
  setIsCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sterling_sidebar_collapsed');
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch {
      // ignore in SSR or restricted storage
    }
  }, []);

  const handleToggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sterling_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSet = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('sterling_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar: handleToggle,
        setIsCollapsed: handleSet,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
