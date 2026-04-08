"use client";

import React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Menu, X } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  isCustomer?: boolean;
}

export function AppShell({ children, isCustomer = false }: AppShellProps) {
  const [user, setUser] = React.useState<{ name: string; email: string; companyName: string | null; role: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => { if (d.user) setUser(d.user); }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar isCustomer={isCustomer} userRole={user?.role} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar isCustomer={isCustomer} userRole={user?.role} />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center h-14 w-14 text-gray-500 hover:text-gray-700"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="flex-1">
            <Topbar userName={user?.name} userEmail={user?.email} companyName={user?.companyName || "C&D Packaging"} />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
